import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";

/**
 * Sign the pack off once every page has been decided. Admin only.
 *
 * Refuses while anything is still pending, and refuses if a page was rejected:
 * an order that goes to print a sign short is worse than one that waits, and
 * the rejected page has to be rebuilt first.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }
  const { orderNumber } = await params;

  const { data: pages } = await supabase
    .from("psp_artwork_pages")
    .select("page_no,code,decision")
    .eq("order_number", orderNumber);

  if (!pages?.length) {
    return NextResponse.json({ error: "No proof to approve" }, { status: 404 });
  }

  const pending = pages.filter((p) => p.decision === "pending");
  const rejected = pages.filter((p) => p.decision === "rejected");

  if (pending.length) {
    return NextResponse.json(
      {
        error: `${pending.length} page${pending.length === 1 ? "" : "s"} still to review`,
        pages: pending.map((p) => p.code),
      },
      { status: 409 }
    );
  }
  if (rejected.length) {
    return NextResponse.json(
      {
        error: `${rejected.length} page${rejected.length === 1 ? "" : "s"} rejected — rebuild before approving`,
        pages: rejected.map((p) => p.code),
      },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("psp_orders")
    .update({ fulfilment_status: "approved" })
    .eq("order_number", orderNumber);

  if (error) {
    console.error("Approve failed:", error);
    return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
  }

  console.log(`Artwork approved for ${orderNumber} — ${pages.length} pages`);
  return NextResponse.json({ success: true, pages: pages.length });
}
