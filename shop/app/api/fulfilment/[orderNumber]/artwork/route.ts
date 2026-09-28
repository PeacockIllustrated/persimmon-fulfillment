import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import {
  PACK_BUCKET,
  MAX_STORED_PACK_BYTES,
  removeStoredPack,
} from "@/lib/artwork-packs";

/**
 * The print pack itself. Admin only.
 *
 * It lives here rather than only on the machine that built it because a pack
 * built in an agent session goes away with the container, and the approved
 * artwork is the thing everything downstream needs.
 *
 * Two ways in, because Vercel caps a function's request and response bodies
 * at 4.5MB:
 *
 *   POST  { filename, bytes }  -> a signed URL to upload the PDF straight to
 *                                 Storage, bypassing this function
 *   PATCH { path, filename }   -> confirm that upload and make it the pack
 *
 *   PUT   raw PDF body         -> small packs only, stored base64 in the row,
 *                                 the way PO and delivery documents are
 *
 * GET serves whichever is current: a redirect to a short-lived signed URL for
 * a stored pack, the PDF itself for a base64 one.
 */

const MAX_INLINE_BYTES = 4 * 1024 * 1024;

type Params = { params: Promise<{ orderNumber: string }> };

async function currentPack(orderNumber: string) {
  const { data } = await supabase
    .from("psp_artwork_packs")
    .select("order_number,pack_storage_path")
    .eq("order_number", orderNumber)
    .maybeSingle();
  return data;
}

const noPackRecord = () =>
  NextResponse.json(
    { error: "Send the manifest first — no pack record for this order" },
    { status: 409 }
  );

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const bytes = Number(body?.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return NextResponse.json({ error: "Expected { filename, bytes }" }, { status: 400 });
  }
  if (bytes > MAX_STORED_PACK_BYTES) {
    return NextResponse.json(
      { error: `Pack too large (${Math.round(bytes / 1024 / 1024)}MB, max 50MB)` },
      { status: 413 }
    );
  }

  if (!(await currentPack(orderNumber))) return noPackRecord();

  // A fresh path per upload: a rebuild never overwrites the pack a human may
  // be looking at until PATCH says the new one arrived intact.
  const filename = String(body?.filename || `${orderNumber}-artwork.pdf`)
    .replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${orderNumber}/${Date.now()}-${filename}`;

  const { data, error } = await supabase.storage
    .from(PACK_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Signed upload URL failed:", error);
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const path = String(body?.path ?? "");
  if (!path.startsWith(`${orderNumber}/`)) {
    return NextResponse.json({ error: "Path does not belong to this order" }, { status: 400 });
  }

  const pack = await currentPack(orderNumber);
  if (!pack) return noPackRecord();

  const { data: file, error } = await supabase.storage.from(PACK_BUCKET).download(path);
  if (error || !file) {
    return NextResponse.json({ error: "Upload not found in storage" }, { status: 404 });
  }
  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
  if (head !== "%PDF-") {
    await removeStoredPack(path);
    return NextResponse.json({ error: "Upload is not a PDF" }, { status: 400 });
  }

  const filename = String(body?.filename || `${orderNumber}-artwork.pdf`);
  const { error: updateError } = await supabase
    .from("psp_artwork_packs")
    .update({
      pack_storage_path: path,
      pack_document: null,
      pack_filename: filename,
      pack_size_bytes: file.size,
    })
    .eq("order_number", orderNumber);

  if (updateError) {
    console.error("Pack record update failed:", updateError);
    return NextResponse.json({ error: "Failed to record pack" }, { status: 500 });
  }

  if (pack.pack_storage_path !== path) {
    await removeStoredPack(pack.pack_storage_path);
  }

  console.log(`Artwork pack stored for ${orderNumber} — ${Math.round(file.size / 1024)}KB in storage`);
  return NextResponse.json({ success: true, bytes: file.size });
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (body.length > MAX_INLINE_BYTES) {
    return NextResponse.json(
      { error: `Pack too large to send inline (${Math.round(body.length / 1024 / 1024)}MB) — use POST for a signed upload URL` },
      { status: 413 }
    );
  }
  if (body.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Body is not a PDF" }, { status: 400 });
  }

  const pack = await currentPack(orderNumber);
  if (!pack) return noPackRecord();

  const filename =
    req.nextUrl.searchParams.get("filename") || `${orderNumber}-artwork.pdf`;

  const { error } = await supabase
    .from("psp_artwork_packs")
    .update({
      pack_document: body.toString("base64"),
      pack_storage_path: null,
      pack_filename: filename,
      pack_size_bytes: body.length,
    })
    .eq("order_number", orderNumber);

  if (error) {
    console.error("Pack upload failed:", error);
    return NextResponse.json({ error: "Failed to store pack" }, { status: 500 });
  }

  await removeStoredPack(pack.pack_storage_path);

  console.log(`Artwork pack stored for ${orderNumber} — ${Math.round(body.length / 1024)}KB`);
  return NextResponse.json({ success: true, bytes: body.length });
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  const { data } = await supabase
    .from("psp_artwork_packs")
    .select("pack_document,pack_filename,pack_storage_path")
    .eq("order_number", orderNumber)
    .maybeSingle();

  const filename = data?.pack_filename || `${orderNumber}-artwork.pdf`;

  if (data?.pack_storage_path) {
    const { data: signed, error } = await supabase.storage
      .from(PACK_BUCKET)
      .createSignedUrl(data.pack_storage_path, 300, { download: filename });
    if (error || !signed) {
      console.error("Signed download URL failed:", error);
      return NextResponse.json({ error: "Could not fetch pack" }, { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl, 302);
  }

  if (!data?.pack_document) {
    return NextResponse.json({ error: "No pack stored for this order" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(data.pack_document, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
