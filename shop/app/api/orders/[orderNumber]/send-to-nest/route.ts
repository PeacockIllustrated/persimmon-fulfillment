import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/auth";
import { sendNestPORequest } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { orderNumber } = await params;

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("psp_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only allow sending from 'new' or 'awaiting_po' (re-send)
    if (!["new", "awaiting_po"].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot send PO request for order with status "${order.status}"` },
        { status: 400 }
      );
    }

    // Fetch order items
    const { data: items } = await supabase
      .from("psp_order_items")
      .select("*")
      .eq("order_id", order.id);

    // Build order data for email (matches OrderData interface in email.ts)
    const orderData = {
      orderNumber: order.order_number,
      contactName: order.contact_name,
      email: order.email,
      phone: order.phone,
      siteName: order.site_name,
      siteAddress: order.site_address,
      poNumber: order.po_number,
      notes: order.notes,
      items: (items || []).map((item: Record<string, unknown>) => ({
        code: item.code as string,
        base_code: item.base_code as string | null,
        name: item.name as string,
        size: item.size as string | null,
        material: item.material as string | null,
        price: Number(item.price),
        quantity: item.quantity as number,
        line_total: Number(item.line_total),
        custom_data: item.custom_data || null,
      })),
      subtotal: Number(order.subtotal),
      vat: Number(order.vat),
      total: Number(order.total),
    };

    // Send email (throws on failure — status NOT updated if this fails)
    await sendNestPORequest(orderData);

    // Update status to awaiting_po (skip if already awaiting_po — idempotent re-send)
    if (order.status === "new") {
      const { error: updateError } = await supabase
        .from("psp_orders")
        .update({ status: "awaiting_po" })
        .eq("order_number", orderNumber);

      if (updateError) {
        // Email was sent but status update failed — check if it went through anyway
        const { data: refreshed } = await supabase
          .from("psp_orders")
          .select("status")
          .eq("order_number", orderNumber)
          .single();

        if (refreshed?.status === "awaiting_po") {
          return NextResponse.json({ success: true, message: "PO request sent to Nest" });
        }

        return NextResponse.json(
          {
            error: "Email sent but status update failed. Please set status to 'Awaiting PO' manually.",
            currentStatus: refreshed?.status || order.status,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, message: "PO request sent to Nest" });
  } catch (error) {
    console.error("Error sending Nest PO request:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
