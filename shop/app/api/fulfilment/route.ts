import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * Artwork state for every order that has a proof, keyed by order number.
 *
 * Separate from GET /api/orders on purpose. That route is reachable with shop
 * auth as well as admin auth, so anything added to its response goes out to
 * Persimmon's own buyers. Fulfilment state is ours, not theirs: the admin page
 * fetches this alongside and merges the two client-side, which leaves the
 * customer payload exactly as it was.
 */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const { data: orders } = await supabase
    .from("psp_orders")
    .select("order_number,fulfilment_status");

  const { data: pages } = await supabase
    .from("psp_artwork_pages")
    .select("order_number,decision");

  const tally: Record<string, { pages: number; approved: number; rejected: number }> = {};
  for (const page of pages ?? []) {
    const row = (tally[page.order_number] ??= { pages: 0, approved: 0, rejected: 0 });
    row.pages += 1;
    if (page.decision === "approved") row.approved += 1;
    if (page.decision === "rejected") row.rejected += 1;
  }

  const fulfilment: Record<string, unknown> = {};
  for (const order of orders ?? []) {
    fulfilment[order.order_number] = {
      status: order.fulfilment_status ?? "pending",
      ...(tally[order.order_number] ?? { pages: 0, approved: 0, rejected: 0 }),
    };
  }

  return NextResponse.json({ fulfilment });
}
