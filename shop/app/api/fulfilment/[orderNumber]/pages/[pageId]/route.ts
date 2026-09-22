import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/** Approve or reject one page of a proof. Admin only. */

const DECISIONS = ["pending", "approved", "rejected"] as const;
type Decision = (typeof DECISIONS)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string; pageId: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber, pageId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const decision = body?.decision as Decision;
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json(
      { error: `decision must be one of ${DECISIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;
  if (decision === "rejected" && !note) {
    // A rejection with no reason is a page that gets rebuilt into the same
    // problem, so the reason is the useful half of the decision.
    return NextResponse.json(
      { error: "Say what is wrong with it — a rejection needs a reason" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("psp_artwork_pages")
    .update({
      decision,
      decision_note: decision === "pending" ? null : note,
      decided_at: decision === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", pageId)
    .eq("order_number", orderNumber)
    .select("id,page_no,code,decision,decision_note,decided_at")
    .maybeSingle();

  if (error) {
    console.error("Page decision failed:", error);
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "No such page on this order" }, { status: 404 });
  }

  // A decision on any page unwinds a finished approval: the pack no longer
  // matches what was signed off.
  await supabase
    .from("psp_orders")
    .update({ fulfilment_status: "proof_ready" })
    .eq("order_number", orderNumber)
    .in("fulfilment_status", ["approved", "packed"]);

  return NextResponse.json({ success: true, page: data });
}
