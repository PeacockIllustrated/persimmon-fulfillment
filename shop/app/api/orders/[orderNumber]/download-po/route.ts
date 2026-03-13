import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isShopAuthed, isAdminAuthed } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    const { data: order, error } = await supabase
      .from("psp_orders")
      .select("po_document_name, po_document_data, po_document_type")
      .eq("order_number", orderNumber)
      .single();

    if (error || !order || !order.po_document_data) {
      return NextResponse.json({ error: "PO document not found" }, { status: 404 });
    }

    const buffer = Buffer.from(order.po_document_data, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": order.po_document_type || "application/pdf",
        "Content-Disposition": `attachment; filename="${order.po_document_name || `po-${orderNumber}.pdf`}"`,
      },
    });
  } catch (error) {
    console.error("PO download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
