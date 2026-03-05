import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface OrderItem {
  code: string;
  base_code: string | null;
  name: string;
  size: string | null;
  material: string | null;
  price: number;
  quantity: number;
  line_total: number;
}

interface OrderData {
  orderNumber: string;
  contactName: string;
  email: string;
  phone: string;
  siteName: string;
  siteAddress: string;
  poNumber: string | null;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  vat: number;
  total: number;
}

function itemRowsHtml(items: OrderItem[], siteUrl: string): string {
  return items
    .map((item) => {
      const imgCode = item.base_code || item.code.replace(/\/.*$/, "");
      const imgSrc = `${siteUrl}/images/products/${imgCode}.png`;
      return `
    <tr>
      <td style="padding:8px 4px 8px 12px;border-bottom:1px solid #eee;vertical-align:middle;width:48px">
        <img src="${imgSrc}" alt="${item.code}" width="40" height="40" style="display:block;border-radius:4px;object-fit:contain;background:#f8f8f8" />
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;vertical-align:middle">
        <strong style="color:#333">${item.code}</strong><br/>
        <span style="color:#666;font-size:12px">${item.name}${item.size ? ` (${item.size})` : ""}</span>
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;vertical-align:middle">${item.quantity}</td>
      <td style="padding:8px 12px 8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:right;vertical-align:middle">&pound;${item.line_total.toFixed(2)}</td>
    </tr>`;
    })
    .join("");
}

function totalsHtml(subtotal: number, vat: number, total: number): string {
  return `
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;font-size:14px;color:#666">Subtotal</td>
      <td style="padding:8px 12px 8px 8px;text-align:right;font-size:14px">&pound;${subtotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;font-size:14px;color:#666">VAT (20%)</td>
      <td style="padding:8px 12px 8px 8px;text-align:right;font-size:14px">&pound;${vat.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;font-weight:bold;font-size:14px;color:#00474a">Total</td>
      <td style="padding:8px 12px 8px 8px;text-align:right;font-weight:bold;font-size:14px;color:#00474a">&pound;${total.toFixed(2)}</td>
    </tr>`;
}

export async function sendOrderConfirmation(order: OrderData): Promise<void> {
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  const { error } = await resend.emails.send({
    from: `Persimmon Signage <${fromEmail}>`,
    to: order.email,
    subject: `Order Confirmed - ${order.orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#00474a;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Order Confirmed</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;color:#333">Hi ${order.contactName},</p>
          <p style="font-size:15px;color:#333">Thank you for your order. Our team will review it and be in touch shortly.</p>

          <div style="background:#f8faf9;border-radius:8px;padding:16px 20px;margin:20px 0">
            <p style="margin:0 0 4px;font-size:13px;color:#666">Order Number</p>
            <p style="margin:0;font-size:18px;font-weight:bold;color:#00474a">${order.orderNumber}</p>
          </div>

          <div style="margin:20px 0">
            <p style="font-size:13px;color:#666;margin:0 0 4px">Site: <strong style="color:#333">${order.siteName}</strong></p>
            <p style="font-size:13px;color:#666;margin:0">${order.siteAddress}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;width:48px"></th>
                <th style="padding:8px 8px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml(order.items, siteUrl)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total)}
            </tfoot>
          </table>

          <p style="font-size:13px;color:#999;margin-top:32px">If you have any questions about your order, please contact us.</p>
        </div>
      </div>`,
  });

  if (error) {
    // Log but don't throw — customer emails may fail without verified domain
    console.warn(`Customer confirmation skipped (${order.email}):`, error.message);
    return;
  }
  console.log(`Order confirmation email sent to ${order.email}`);
}

export async function sendTeamNotification(order: OrderData): Promise<void> {
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL;
  if (!teamEmail) return;

  const { error } = await resend.emails.send({
    from: `Persimmon Signage Portal <${fromEmail}>`,
    to: teamEmail,
    subject: `New Order: ${order.orderNumber} - ${order.siteName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#00474a;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">New Order Received</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#00474a">${order.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#666">&pound;${order.total.toFixed(2)} inc. VAT &middot; ${order.items.length} items</p>
          </div>

          <div style="display:flex;gap:24px;margin-bottom:24px">
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Contact</p>
              <p style="margin:0;font-size:14px"><strong>${order.contactName}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${order.email}</p>
              <p style="margin:0;font-size:14px;color:#666">${order.phone}</p>
            </div>
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px"><strong>${order.siteName}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${order.siteAddress}</p>
            </div>
          </div>

          ${order.poNumber ? `<p style="font-size:14px;color:#666;margin-bottom:16px"><strong>PO Number:</strong> ${order.poNumber}</p>` : ""}

          ${order.notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px"><p style="margin:0;font-size:13px;color:#c2410c"><strong>Notes:</strong> ${order.notes}</p></div>` : ""}

          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;width:48px"></th>
                <th style="padding:8px 8px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml(order.items, siteUrl)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total)}
            </tfoot>
          </table>
        </div>
      </div>`,
  });

  if (error) {
    console.error("Resend team notification error:", JSON.stringify(error));
    throw new Error(`Team notification failed: ${error.message}`);
  }
  console.log(`Team notification email sent to ${teamEmail}`);
}
