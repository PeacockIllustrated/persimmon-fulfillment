import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * The print pack itself. Admin only.
 *
 * Sent as a raw PDF body rather than base64 JSON: a nine-page pack is a few
 * megabytes, and base64 on the wire adds a third to that for no reason. It is
 * stored base64 because that is how this app already stores PO and delivery
 * documents.
 *
 * It lives here rather than only on the machine that built it because a pack
 * built in an agent session goes away with the container, and the approved
 * artwork is the thing everything downstream needs.
 */

const MAX_BYTES = 12 * 1024 * 1024;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (body.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `Pack too large (${Math.round(body.length / 1024 / 1024)}MB, max 12MB)` },
      { status: 413 }
    );
  }
  if (body.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Body is not a PDF" }, { status: 400 });
  }

  const { data: pack } = await supabase
    .from("psp_artwork_packs")
    .select("order_number")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!pack) {
    return NextResponse.json(
      { error: "Send the manifest first — no pack record for this order" },
      { status: 409 }
    );
  }

  const filename =
    req.nextUrl.searchParams.get("filename") || `${orderNumber}-artwork.pdf`;

  const { error } = await supabase
    .from("psp_artwork_packs")
    .update({
      pack_document: body.toString("base64"),
      pack_filename: filename,
      pack_size_bytes: body.length,
    })
    .eq("order_number", orderNumber);

  if (error) {
    console.error("Pack upload failed:", error);
    return NextResponse.json({ error: "Failed to store pack" }, { status: 500 });
  }

  console.log(`Artwork pack stored for ${orderNumber} — ${Math.round(body.length / 1024)}KB`);
  return NextResponse.json({ success: true, bytes: body.length });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  const { data } = await supabase
    .from("psp_artwork_packs")
    .select("pack_document,pack_filename")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!data?.pack_document) {
    return NextResponse.json({ error: "No pack stored for this order" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(data.pack_document, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="${data.pack_filename || `${orderNumber}-artwork.pdf`}"`,
    },
  });
}
