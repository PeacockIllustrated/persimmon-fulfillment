import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildNestPOEmailHtml, generateRaisePoToken } from "@/lib/email";

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

    // Fetch order items
    const { data: items } = await supabase
      .from("psp_order_items")
      .select("*")
      .eq("order_id", order.id);

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";

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

    // Fire Make webhook with isPO: true
    const res = await fetch(makeWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

    console.log(`Raise PO webhook fired for ${orderNumber} — ${res.status}`);

    // Update status to awaiting_po if currently new
    if (order.status === "new") {
      await supabase
        .from("psp_orders")
        .update({ status: "awaiting_po" })
        .eq("order_number", orderNumber);
    }

    // Return a simple confirmation page
    return new NextResponse(
      `<!DOCTYPE html>
      <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>PO Raised</title></head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8faf9">
        <div style="text-align:center;padding:40px;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:400px">
          <div style="width:48px;height:48px;background:#3db28c;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-size:24px">&#10003;</span>
          </div>
          <h1 style="color:#00474a;font-size:20px;margin:0 0 8px">PO Request Sent</h1>
          <p style="color:#666;font-size:14px;margin:0">Order <strong>${orderNumber}</strong> has been sent for purchase order processing.</p>
        </div>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Raise PO error:", error);
    return new NextResponse(
      "<h1>Something went wrong</h1><p>Please try again or raise the PO from the admin dashboard.</p>",
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
