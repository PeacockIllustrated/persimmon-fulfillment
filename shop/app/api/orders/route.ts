import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendOrderConfirmation, sendTeamNotification } from "@/lib/email";

function generateOrderNumber(): string {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PER-${datePart}-${rand}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactName, email, phone, siteName, siteAddress, poNumber, notes, items } = body;

    // Validation
    if (!contactName || !email || !phone || !siteName || !siteAddress || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (items.length > 100) {
      return NextResponse.json({ error: "Maximum 100 items per order" }, { status: 400 });
    }

    // Recalculate totals server-side (never trust client)
    let subtotal = 0;
    const validatedItems = items.map((item: { code: string; baseCode?: string; name: string; size?: string; material?: string; description?: string; price: number; quantity: number }) => {
      const price = Math.round(Number(item.price) * 100) / 100;
      const quantity = Math.max(1, Math.min(9999, Math.floor(Number(item.quantity))));
      if (price <= 0 || price > 100000) {
        throw new Error(`Invalid price for item ${item.code}`);
      }
      const lineTotal = Math.round(price * quantity * 100) / 100;
      subtotal += lineTotal;
      return {
        code: String(item.code),
        base_code: item.baseCode ? String(item.baseCode) : null,
        name: String(item.name),
        size: item.size ? String(item.size) : null,
        material: item.material ? String(item.material) : null,
        price,
        quantity,
        line_total: lineTotal,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const vat = Math.round(subtotal * 20) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;

    const orderNumber = generateOrderNumber();

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("psp_orders")
      .insert({
        order_number: orderNumber,
        status: "new",
        contact_name: String(contactName),
        email: String(email),
        phone: String(phone),
        site_name: String(siteName),
        site_address: String(siteAddress),
        po_number: poNumber ? String(poNumber) : null,
        notes: notes ? String(notes) : null,
        subtotal,
        vat,
        total,
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Supabase order insert error:", orderError);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    // Insert order items
    const itemsWithOrderId = validatedItems.map((item: { code: string; base_code: string | null; name: string; size: string | null; material: string | null; price: number; quantity: number; line_total: number }) => ({
      order_id: order.id,
      ...item,
    }));

    const { error: itemsError } = await supabase.from("psp_order_items").insert(itemsWithOrderId);

    if (itemsError) {
      console.error("Supabase items insert error:", itemsError);
      // Order was created but items failed — log but don't fail the request
    }

    // Send emails — awaited so serverless function stays alive until sent
    const emailData = {
      orderNumber,
      contactName: String(contactName),
      email: String(email),
      phone: String(phone),
      siteName: String(siteName),
      siteAddress: String(siteAddress),
      poNumber: poNumber ? String(poNumber) : null,
      notes: notes ? String(notes) : null,
      items: validatedItems,
      subtotal,
      vat,
      total,
    };

    await Promise.all([
      sendOrderConfirmation(emailData).catch((e) => console.error("Confirmation email failed:", e)),
      sendTeamNotification(emailData).catch((e) => console.error("Team notification failed:", e)),
    ]);

    console.log(`Order ${orderNumber} saved to Supabase — £${total.toFixed(2)}`);

    return NextResponse.json({ orderNumber, message: "Order submitted successfully" });
  } catch (error) {
    console.error("Order submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: orders, error } = await supabase
      .from("psp_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Fetch items for all orders
    const orderIds = orders.map((o) => o.id);
    const { data: allItems } = await supabase
      .from("psp_order_items")
      .select("*")
      .in("order_id", orderIds);

    // Transform to match frontend expected shape
    const transformed = orders.map((o) => ({
      orderNumber: o.order_number,
      createdAt: o.created_at,
      status: o.status,
      contact: { contactName: o.contact_name, email: o.email, phone: o.phone },
      site: { siteName: o.site_name, siteAddress: o.site_address },
      poNumber: o.po_number,
      notes: o.notes,
      items: (allItems || [])
        .filter((item) => item.order_id === o.id)
        .map((item) => ({
          code: item.code,
          name: item.name,
          size: item.size,
          price: Number(item.price),
          quantity: item.quantity,
        })),
      subtotal: Number(o.subtotal),
      vat: Number(o.vat),
      total: Number(o.total),
    }));

    return NextResponse.json({ orders: transformed });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
