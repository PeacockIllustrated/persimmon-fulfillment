import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * The proof for one order: its pages, their provenance and where each one has
 * got to. Admin only — nothing customer-facing reads this.
 *
 * POST replaces the pack wholesale. Rebuilding an order is how you fix a bad
 * page, so a second build must not leave the first build's pages behind for a
 * human to approve by mistake.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  const { data: order } = await supabase
    .from("psp_orders")
    .select("order_number,status,fulfilment_status,site_name,contact_name,created_at")
    .eq("order_number", orderNumber)
    .single();

  if (!order) {
    return NextResponse.json({ error: "No such order" }, { status: 404 });
  }

  const { data: pack } = await supabase
    .from("psp_artwork_packs")
    .select("built_at,line_items,pages_packed,needs_attention,pack_filename,pack_size_bytes")
    .eq("order_number", orderNumber)
    .maybeSingle();

  const { data: pages } = await supabase
    .from("psp_artwork_pages")
    .select("*")
    .eq("order_number", orderNumber)
    .order("page_no", { ascending: true });

  return NextResponse.json({ order, pack: pack ?? null, pages: pages ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
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

  const { manifest, pages } = body ?? {};
  if (!manifest || !Array.isArray(pages)) {
    return NextResponse.json(
      { error: "Expected { manifest, pages: [...] }" },
      { status: 400 }
    );
  }

  const { data: order } = await supabase
    .from("psp_orders")
    .select("order_number")
    .eq("order_number", orderNumber)
    .single();

  if (!order) {
    return NextResponse.json({ error: "No such order" }, { status: 404 });
  }

  const { error: packError } = await supabase.from("psp_artwork_packs").upsert(
    {
      order_number: orderNumber,
      built_at: new Date().toISOString(),
      line_items: Number(manifest.lineItems ?? pages.length),
      pages_packed: Number(manifest.pagesPacked ?? pages.length),
      needs_attention: manifest.needsAttention ?? [],
      manifest,
    },
    { onConflict: "order_number" }
  );

  if (packError) {
    console.error("Artwork pack upsert failed:", packError);
    return NextResponse.json({ error: "Failed to save pack" }, { status: 500 });
  }

  // Replace, don't merge: see the note at the top of this file.
  await supabase.from("psp_artwork_pages").delete().eq("order_number", orderNumber);

  const rows = pages.map((page: Record<string, unknown>, i: number) => ({
    order_number: orderNumber,
    page_no: Number(page.pageNo ?? i + 1),
    code: String(page.code ?? ""),
    base_code: page.baseCode ?? null,
    name: String(page.name ?? ""),
    size: page.size ?? null,
    quantity: Number(page.quantity ?? 1),
    provenance: String(page.provenance ?? "UNRESOLVED"),
    reason: page.reason ?? null,
    brand: page.brand ?? null,
    fit_note: page.fitNote ?? null,
    source_file: page.sourceFile ?? null,
    source_page: page.sourcePage ?? null,
    preview: page.preview ?? null,
  }));

  if (rows.length) {
    const { error: pageError } = await supabase.from("psp_artwork_pages").insert(rows);
    if (pageError) {
      console.error("Artwork page insert failed:", pageError);
      return NextResponse.json({ error: "Failed to save pages" }, { status: 500 });
    }
  }

  await supabase
    .from("psp_orders")
    .update({ fulfilment_status: "proof_ready" })
    .eq("order_number", orderNumber);

  console.log(`Artwork pack received for ${orderNumber} — ${rows.length} pages`);
  return NextResponse.json({ success: true, pages: rows.length });
}
