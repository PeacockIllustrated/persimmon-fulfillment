import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendOrderConfirmation, sendTeamNotification, buildNestPOEmailHtml, buildPurchaserPOEmailHtml, generateRaisePoToken } from "@/lib/email";
import { isShopAuthed, isAdminAuthed } from "@/lib/auth";
import { calculateDeliveryFee } from "@/lib/delivery";
import { orderHasUnpricedCustomItems } from "@/lib/order-gating";

function generateOrderNumber(): string {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PER-${datePart}-${rand}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!(await isShopAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contactName, email, phone, siteName, siteAddress, poNumber, notes, items, contactId, siteId, purchaserName, purchaserEmail, purchaserId } = body;

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
    const validatedItems = items.map((item: { code: string; baseCode?: string; name: string; size?: string; material?: string; description?: string; price: number; quantity: number; customSign?: { signType: string; textContent: string; shape: string; additionalNotes: string }; customFieldValues?: Array<{ label: string; key: string; value: string }>; customSizeData?: { type: string; requestedWidth: number; requestedHeight: number; matchedVariantCode: string | null; matchedSize: string | null; matchedFromProduct: string | null; requiresQuote: boolean }; customQuote?: { code: string | null; description: string; size: string; material: string; additionalNotes: string } }) => {
      const price = Math.round(Number(item.price) * 100) / 100;
      const quantity = Math.max(1, Math.min(9999, Math.floor(Number(item.quantity))));
      const isQuoteItem = !!item.customSign || !!item.customSizeData?.requiresQuote || !!item.customQuote;
      if (!isQuoteItem && (price <= 0 || price > 100000)) {
        throw new Error(`Invalid price for item ${item.code}`);
      }
      if (isQuoteItem && price !== 0) {
        throw new Error(`Quote items must have price 0`);
      }
      const lineTotal = Math.round(price * quantity * 100) / 100;
      subtotal += lineTotal;

      // Build custom_data JSONB — either custom sign request or custom field values
      let custom_data = null;
      if (item.customSign) {
        custom_data = {
          type: "custom_sign" as const,
          signType: String(item.customSign.signType),
          textContent: String(item.customSign.textContent),
          shape: String(item.customSign.shape),
          additionalNotes: String(item.customSign.additionalNotes || ""),
        };
      } else if (item.customFieldValues && item.customFieldValues.length > 0) {
        custom_data = {
          type: "custom_fields" as const,
          fields: item.customFieldValues.map((f) => ({
            label: String(f.label),
            key: String(f.key),
            value: String(f.value),
          })),
        };
      } else if (item.customQuote) {
        const description = String(item.customQuote.description || "").trim();
        const size = String(item.customQuote.size || "").trim();
        const material = String(item.customQuote.material || "").trim();
        if (!description || !size || !material) {
          throw new Error("Custom item is missing description, size, or material");
        }
        custom_data = {
          type: "custom_quote" as const,
          code: item.customQuote.code ? String(item.customQuote.code) : null,
          description,
          size,
          material,
          additionalNotes: String(item.customQuote.additionalNotes || ""),
        };
      } else if (item.customSizeData) {
        custom_data = {
          type: "custom_size" as const,
          requestedWidth: Number(item.customSizeData.requestedWidth),
          requestedHeight: Number(item.customSizeData.requestedHeight),
          matchedVariantCode: item.customSizeData.matchedVariantCode ? String(item.customSizeData.matchedVariantCode) : null,
          matchedSize: item.customSizeData.matchedSize ? String(item.customSizeData.matchedSize) : null,
          matchedFromProduct: item.customSizeData.matchedFromProduct ? String(item.customSizeData.matchedFromProduct) : null,
          requiresQuote: !!item.customSizeData.requiresQuote,
        };
      }

      return {
        code: String(item.code),
        base_code: item.baseCode ? String(item.baseCode) : null,
        name: String(item.name),
        size: item.size ? String(item.size) : null,
        material: item.material ? String(item.material) : null,
        price,
        quantity,
        line_total: lineTotal,
        custom_data,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const deliveryFee = calculateDeliveryFee(subtotal);
    const vat = Math.round((subtotal + deliveryFee) * 20) / 100;
    const total = Math.round((subtotal + deliveryFee + vat) * 100) / 100;

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
        contact_id: contactId || null,
        site_id: siteId || null,
        purchaser_name: purchaserName ? String(purchaserName) : null,
        purchaser_email: purchaserEmail ? String(purchaserEmail) : null,
        purchaser_id: purchaserId || null,
        subtotal,
        delivery_fee: deliveryFee,
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
    const itemsWithOrderId = validatedItems.map((item: { code: string; base_code: string | null; name: string; size: string | null; material: string | null; price: number; quantity: number; line_total: number; custom_data: Record<string, string> | null }) => ({
      order_id: order.id,
      ...item,
    }));

    const { error: itemsError } = await supabase.from("psp_order_items").insert(itemsWithOrderId);

    if (itemsError) {
      console.error("Supabase items insert error:", itemsError);
      // Roll back the order so we don't leave an empty shell
      await supabase.from("psp_orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Failed to save order items. Please try again." }, { status: 500 });
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
      deliveryFee,
      vat,
      total,
      purchaserName: purchaserName ? String(purchaserName) : null,
      purchaserEmail: purchaserEmail ? String(purchaserEmail) : null,
    };

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;

    // Send emails + fire Make webhook in parallel
    await Promise.all([
      sendOrderConfirmation(emailData).catch((e) => console.error("Confirmation email failed:", e)),
      sendTeamNotification(emailData).catch((e) => console.error("Team notification failed:", e)),
      makeWebhookUrl && !orderHasUnpricedCustomItems(itemsWithOrderId)
        ? (() => {
            const token = generateRaisePoToken(orderNumber);
            const raisePoUrl = `${siteUrl}/api/orders/${orderNumber}/raise-po?t=${token}`;
            const uploadPoUrl = `${siteUrl}/po-upload/${orderNumber}?t=${token}`;
            const { subject, html } = buildNestPOEmailHtml(emailData, siteUrl, raisePoUrl);

            // Build purchaser email if a purchaser is attached
            const purchaserEmailPayload = purchaserEmail
              ? buildPurchaserPOEmailHtml(emailData, siteUrl, uploadPoUrl)
              : null;

            return fetch(makeWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brand: "persimmon",
                isPO: false,
                hasPurchaser: !!purchaserEmail,
                emailSubject: subject,
                emailHtml: html,
                raisePoUrl,
                orderNumber,
                contactName: String(contactName),
                contactEmail: String(email),
                contactPhone: String(phone),
                siteName: String(siteName),
                siteAddress: String(siteAddress),
                poNumber: poNumber ? String(poNumber) : null,
                notes: notes ? String(notes) : null,
                subtotal,
                deliveryFee,
                vat,
                total,
                itemCount: validatedItems.length,
                hasCustomItems: validatedItems.some((i: { custom_data: unknown }) => !!i.custom_data),
                purchaserName: purchaserName ? String(purchaserName) : "",
                purchaserEmail: purchaserEmail ? String(purchaserEmail) : "",
                purchaserEmailSubject: purchaserEmailPayload?.subject || "",
                purchaserEmailHtml: purchaserEmailPayload?.html || "",
              }),
            })
              .then((r) => console.log(`Make webhook fired for ${orderNumber} — ${r.status}`))
              .catch((e) => console.error("Make webhook failed:", e));
          })()
        : Promise.resolve(),
    ]);

    if (makeWebhookUrl && orderHasUnpricedCustomItems(itemsWithOrderId)) {
      console.log(`Order ${orderNumber} held for pricing — Make webhook skipped`);
    }
    console.log(`Order ${orderNumber} saved to Supabase — £${total.toFixed(2)}`);

    return NextResponse.json({ orderNumber, message: "Order submitted successfully" });
  } catch (error) {
    console.error("Order submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  if (!(await isShopAuthed()) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { data: orders, error } = await supabase
      .from("psp_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Fix any orders with incorrect delivery fee (e.g. created before delivery fee feature)
    const wrongDeliveryOrders = orders.filter((o) => {
      const expected = calculateDeliveryFee(Number(o.subtotal));
      return Number(o.delivery_fee || 0) !== expected;
    });
    if (wrongDeliveryOrders.length > 0) {
      await Promise.all(
        wrongDeliveryOrders.map((o) => {
          const subtotal = Number(o.subtotal);
          const deliveryFee = calculateDeliveryFee(subtotal);
          const vat = Math.round((subtotal + deliveryFee) * 20) / 100;
          const total = Math.round((subtotal + deliveryFee + vat) * 100) / 100;
          o.delivery_fee = deliveryFee;
          o.vat = vat;
          o.total = total;
          return supabase
            .from("psp_orders")
            .update({ delivery_fee: deliveryFee, vat, total })
            .eq("id", o.id);
        })
      );
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
      contactId: o.contact_id || null,
      siteId: o.site_id || null,
      contact: { contactName: o.contact_name, email: o.email, phone: o.phone },
      site: { siteName: o.site_name, siteAddress: o.site_address },
      poNumber: o.po_number,
      notes: o.notes,
      purchaserName: o.purchaser_name || null,
      purchaserEmail: o.purchaser_email || null,
      poDocumentName: o.po_document_name || null,
      dnDocumentName: o.dn_document_name || null,
      items: (allItems || [])
        .filter((item) => item.order_id === o.id)
        .map((item) => ({
          id: item.id,
          code: item.code,
          baseCode: item.base_code,
          name: item.name,
          size: item.size,
          price: Number(item.price),
          quantity: item.quantity,
          customData: item.custom_data || null,
        })),
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee || 0),
      vat: Number(o.vat),
      total: Number(o.total),
    }));

    return NextResponse.json({ orders: transformed });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
