import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildNestPOEmailHtml, buildPurchaserPOEmailHtml, generateRaisePoToken } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const token = req.nextUrl.searchParams.get("t");

  // Validate token
  const expected = generateRaisePoToken(orderNumber);
  if (!token || token !== expected) {
    return new NextResponse(
      "<h1>Invalid or expired link</h1>",
      { status: 403, headers: { "Content-Type": "text/html" } }
    );
  }

  const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!makeWebhookUrl) {
    return new NextResponse(
      "<h1>Webhook not configured</h1>",
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from("psp_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !order) {
      return new NextResponse(
        "<h1>Order not found</h1>",
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";

    // Prevent duplicate PO raises — only allow from "new" status
    if (order.status !== "new") {
      // Already raised — redirect to upload page (no &raised flag)
      return NextResponse.redirect(
        `${siteUrl}/po-upload/${orderNumber}?t=${token}`
      );
    }

    // Update status immediately to prevent race conditions from double-clicks
    await supabase
      .from("psp_orders")
      .update({ status: "awaiting_po" })
      .eq("order_number", orderNumber);

    // Fetch order items
    const { data: items } = await supabase
      .from("psp_order_items")
      .select("*")
      .eq("order_id", order.id);

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

    const { subject, html } = buildNestPOEmailHtml(orderData, siteUrl);

    // Build purchaser email if a purchaser is attached
    const uploadPoUrl = `${siteUrl}/po-upload/${orderNumber}?t=${token}`;
    const purchaserEmailPayload = order.purchaser_email
      ? buildPurchaserPOEmailHtml({ ...orderData, purchaserName: order.purchaser_name, purchaserEmail: order.purchaser_email }, siteUrl, uploadPoUrl)
      : null;

    // Fire Make webhook with isPO: true
    const res = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: "persimmon",
        isPO: true,
        emailSubject: subject,
        emailHtml: html,
        orderNumber: order.order_number,
        contactName: order.contact_name,
        contactEmail: order.email,
        contactPhone: order.phone,
        siteName: order.site_name,
        siteAddress: order.site_address,
        poNumber: order.po_number,
        notes: order.notes,
        subtotal: Number(order.subtotal),
        vat: Number(order.vat),
        total: Number(order.total),
        itemCount: (items || []).length,
        hasCustomItems: (items || []).some((i: Record<string, unknown>) => !!i.custom_data),
        purchaserName: order.purchaser_name || null,
        purchaserEmail: order.purchaser_email || null,
        purchaserEmailSubject: purchaserEmailPayload?.subject || null,
        purchaserEmailHtml: purchaserEmailPayload?.html || null,
      }),
    });

    console.log(`Raise PO webhook fired for ${orderNumber} — ${res.status}`);

    // Redirect to PO upload page with confirmation
    return NextResponse.redirect(
      `${siteUrl}/po-upload/${orderNumber}?t=${token}&raised=true`
    );
  } catch (error) {
    console.error("Raise PO error:", error);
    return new NextResponse(
      "<h1>Something went wrong</h1><p>Please try again or raise the PO from the admin dashboard.</p>",
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
