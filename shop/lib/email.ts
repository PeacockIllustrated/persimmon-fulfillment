import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** Escape HTML special characters to prevent injection in email templates */
function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface OrderItem {
  code: string;
  base_code: string | null;
  name: string;
  size: string | null;
  material: string | null;
  price: number;
  quantity: number;
  line_total: number;
  custom_data?: {
    type?: string;
    signType?: string;
    textContent?: string;
    shape?: string;
    additionalNotes?: string;
    fields?: Array<{ label: string; key: string; value: string }>;
  } | null;
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

/** Build CID inline attachments — Resend fetches each image via `path` */
function buildImageAttachments(items: OrderItem[], siteUrl: string) {
  const seen = new Set<string>();
  return items
    .map((item) => {
      if (item.custom_data?.signType) return null; // No CID image for custom sign requests
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return {
        path: `${siteUrl}/images/products/${imgCode}.png`,
        filename: `${imgCode}.png`,
        contentType: "image/png",
        cid: imgCode,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}

const SIGN_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  warning: { bg: "#FFD700", fg: "#000" },
  prohibition: { bg: "#CC0000", fg: "#FFF" },
  mandatory: { bg: "#005BBB", fg: "#FFF" },
  information: { bg: "#009639", fg: "#FFF" },
  "fire-safety": { bg: "#CC0000", fg: "#FFF" },
  directional: { bg: "#009639", fg: "#FFF" },
  security: { bg: "#005BBB", fg: "#FFF" },
  environmental: { bg: "#009639", fg: "#FFF" },
};

function itemRowsHtml(items: OrderItem[], siteUrl?: string): string {
  return items
    .map((item) => {
      // Custom sign request (price 0, quote on request)
      if (item.custom_data && item.custom_data.signType) {
        const colors = SIGN_TYPE_COLORS[item.custom_data.signType] || { bg: "#666", fg: "#FFF" };
        const typeLabel = item.custom_data.signType.charAt(0).toUpperCase() + item.custom_data.signType.slice(1).replace("-", " ");
        return `
    <tr>
      <td style="padding:8px 4px 8px 12px;border-bottom:1px solid #eee;vertical-align:middle;width:48px">
        <div style="width:40px;height:40px;border-radius:4px;background:${colors.bg};display:flex;align-items:center;justify-content:center">
          <span style="color:${colors.fg};font-size:10px;font-weight:bold;text-align:center;line-height:1.1">${typeLabel}</span>
        </div>
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;vertical-align:middle">
        <strong style="color:#333">CUSTOM SIGN REQUEST</strong><br/>
        <span style="color:#666;font-size:12px">${esc(typeLabel)} &middot; ${esc(item.custom_data.shape)} &middot; ${esc(item.size)}</span><br/>
        <span style="color:#c2410c;font-size:12px">Text: &ldquo;${esc(item.custom_data.textContent)}&rdquo;</span>
        ${item.custom_data.additionalNotes ? `<br/><span style="color:#999;font-size:11px">Notes: ${esc(item.custom_data.additionalNotes)}</span>` : ""}
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;vertical-align:middle">${item.quantity}</td>
      <td style="padding:8px 12px 8px 8px;border-bottom:1px solid #eee;font-size:12px;text-align:right;vertical-align:middle;color:#d97706;font-weight:bold">Quote</td>
    </tr>`;
      }

      // Standard item (with optional custom field values)
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      const customFieldsHtml = item.custom_data?.fields
        ? (item.custom_data.fields as Array<{ label: string; key: string; value: string }>)
            .map((f) => `<br/><span style="color:#00474a;font-size:11px">${esc(f.label)}: <span style="color:#666">${esc(f.value)}</span></span>`)
            .join("")
        : "";
      return `
    <tr>
      <td style="padding:8px 4px 8px 12px;border-bottom:1px solid #eee;vertical-align:middle;width:48px">
        <img src="${siteUrl ? `${siteUrl}/images/products/${imgCode}.png` : `cid:${imgCode}`}" alt="${esc(item.code)}" width="40" height="40" style="display:block;border-radius:4px;object-fit:contain;background:#f8f8f8" />
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;vertical-align:middle">
        <strong style="color:#333">${esc(item.code)}</strong><br/>
        <span style="color:#666;font-size:12px">${esc(item.name)}${item.size ? ` (${esc(item.size)})` : ""}</span>${customFieldsHtml}
      </td>
      <td style="padding:8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:center;vertical-align:middle">${item.quantity}</td>
      <td style="padding:8px 12px 8px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:right;vertical-align:middle">&pound;${item.line_total.toFixed(2)}</td>
    </tr>`;
    })
    .join("");
}

function totalsHtml(subtotal: number, vat: number, total: number, hasCustomItems: boolean): string {
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
    </tr>
    ${hasCustomItems ? `<tr><td colspan="4" style="padding:12px;text-align:center;font-size:12px;color:#d97706;background:#fffbeb;border-radius:0 0 8px 8px">* Custom sign items will be quoted separately. Final pricing confirmed after review.</td></tr>` : ""}`;
}

export async function sendOrderConfirmation(order: OrderData): Promise<void> {
  const fromEmail = process.env.SMTP_USER;
  if (!fromEmail) return;
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const attachments = buildImageAttachments(order.items, siteUrl);

  try {
    await transporter.sendMail({
      from: `Persimmon Signage <${fromEmail}>`,
      to: order.email,
      subject: `Order Confirmed - ${order.orderNumber}`,
      attachments,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#00474a;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">Order Confirmed</h1>
          </div>
          <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
            <p style="font-size:15px;color:#333">Hi ${esc(order.contactName)},</p>
            <p style="font-size:15px;color:#333">Thank you for your order. Our team will review it and be in touch shortly.</p>

            <div style="background:#f8faf9;border-radius:8px;padding:16px 20px;margin:20px 0">
              <p style="margin:0 0 4px;font-size:13px;color:#666">Order Number</p>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#00474a">${order.orderNumber}</p>
            </div>

            <div style="margin:20px 0">
              <p style="font-size:13px;color:#666;margin:0 0 4px">Site: <strong style="color:#333">${esc(order.siteName)}</strong></p>
              <p style="font-size:13px;color:#666;margin:0">${esc(order.siteAddress)}</p>
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
                ${itemRowsHtml(order.items)}
              </tbody>
              <tfoot>
                ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
              </tfoot>
            </table>

            <p style="font-size:13px;color:#999;margin-top:32px">If you have any questions about your order, please contact us.</p>
          </div>
        </div>`,
    });
    console.log(`Order confirmation email sent to ${order.email}`);
  } catch (err) {
    console.warn(`Customer confirmation skipped (${order.email}):`, err instanceof Error ? err.message : err);
  }
}

export async function sendTeamNotification(order: OrderData): Promise<void> {
  const fromEmail = process.env.SMTP_USER;
  if (!fromEmail) return;
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL;
  if (!teamEmail) return;

  const attachments = buildImageAttachments(order.items, siteUrl);
  console.log(`[EMAIL] Sending team notification with ${attachments.length} inline image(s)`);

  await transporter.sendMail({
    from: `Persimmon Signage Portal <${fromEmail}>`,
    to: teamEmail,
    subject: `New Order: ${order.orderNumber} - ${esc(order.siteName)}`,
    attachments,
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
              <p style="margin:0;font-size:14px"><strong>${esc(order.contactName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${esc(order.email)}</p>
              <p style="margin:0;font-size:14px;color:#666">${esc(order.phone)}</p>
            </div>
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px"><strong>${esc(order.siteName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${esc(order.siteAddress)}</p>
            </div>
          </div>

          ${order.poNumber ? `<p style="font-size:14px;color:#666;margin-bottom:16px"><strong>PO Number:</strong> ${esc(order.poNumber)}</p>` : ""}

          ${order.notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px"><p style="margin:0;font-size:13px;color:#c2410c"><strong>Notes:</strong> ${esc(order.notes)}</p></div>` : ""}

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
              ${itemRowsHtml(order.items)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>
        </div>
      </div>`,
  });
  console.log(`Team notification email sent to ${teamEmail}`);
}

export async function sendNestPORequest(order: OrderData): Promise<void> {
  const nestEmail = process.env.NEST_EMAIL;
  if (!nestEmail) {
    throw new Error("NEST_EMAIL environment variable is not configured");
  }

  const fromEmail = process.env.SMTP_USER;
  if (!fromEmail) {
    throw new Error("SMTP_USER environment variable is not configured");
  }

  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const attachments = buildImageAttachments(order.items, siteUrl);

  await transporter.sendMail({
    from: `Persimmon Signage Portal <${fromEmail}>`,
    to: nestEmail,
    subject: `PO Request — ${order.orderNumber} — ${esc(order.siteName)}`,
    attachments,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#00474a;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Purchase Order Request</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#00474a">${order.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#666">&pound;${order.total.toFixed(2)} inc. VAT &middot; ${order.items.length} items</p>
          </div>

          <div style="display:flex;gap:24px;margin-bottom:24px">
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Contact</p>
              <p style="margin:0;font-size:14px"><strong>${esc(order.contactName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${esc(order.email)}</p>
              <p style="margin:0;font-size:14px;color:#666">${esc(order.phone)}</p>
            </div>
            <div>
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px"><strong>${esc(order.siteName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666">${esc(order.siteAddress)}</p>
            </div>
          </div>

          ${order.poNumber ? `<p style="font-size:14px;color:#666;margin-bottom:16px"><strong>Customer PO:</strong> ${esc(order.poNumber)}</p>` : ""}

          ${order.notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px"><p style="margin:0;font-size:13px;color:#c2410c"><strong>Notes:</strong> ${esc(order.notes)}</p></div>` : ""}

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
              ${itemRowsHtml(order.items)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>
        </div>
      </div>`,
  });
  console.log(`Nest PO request email sent to ${nestEmail} for ${order.orderNumber}`);
}

/** Build the order notification email HTML with absolute image URLs and Raise PO button */
export function buildNestPOEmailHtml(order: OrderData, siteUrl: string, raisePoUrl?: string): { subject: string; html: string } {
  const wb = "word-break:break-word;overflow-wrap:break-word";
  const buttonHtml = raisePoUrl
    ? `<div style="text-align:center;margin:28px 0 8px">
        <a href="${raisePoUrl}" style="background:#3db28c;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:bold;letter-spacing:0.5px">Raise PO</a>
        <p style="margin:8px 0 0;font-size:12px;color:#999">Click to send this order to Nest for purchase order processing</p>
      </div>`
    : "";
  return {
    subject: `${raisePoUrl ? "PO Request" : "PO Raised"} — ${order.orderNumber} — ${esc(order.siteName)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;${wb}">
        <div style="background:#00474a;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Purchase Order Request</h1>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#00474a">${order.orderNumber}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#666">&pound;${order.total.toFixed(2)} inc. VAT &middot; ${order.items.length} items</p>
          </div>

          <table style="width:100%;margin-bottom:24px" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:top;width:50%;padding-right:12px">
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Contact</p>
              <p style="margin:0;font-size:14px;${wb}"><strong>${esc(order.contactName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666;${wb}">${esc(order.email)}</p>
              <p style="margin:0;font-size:14px;color:#666">${esc(order.phone)}</p>
            </td>
            <td style="vertical-align:top;width:50%;padding-left:12px">
              <p style="font-size:12px;color:#999;text-transform:uppercase;margin:0 0 4px">Site</p>
              <p style="margin:0;font-size:14px;${wb}"><strong>${esc(order.siteName)}</strong></p>
              <p style="margin:2px 0;font-size:14px;color:#666;${wb}">${esc(order.siteAddress)}</p>
            </td>
          </tr></table>

          ${order.poNumber ? `<p style="font-size:14px;color:#666;margin-bottom:16px;${wb}"><strong>Customer PO:</strong> ${esc(order.poNumber)}</p>` : ""}

          ${order.notes ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px"><p style="margin:0;font-size:13px;color:#c2410c;${wb}"><strong>Notes:</strong> ${esc(order.notes)}</p></div>` : ""}

          <table style="width:100%;border-collapse:collapse;margin:20px 0;table-layout:fixed">
            <thead>
              <tr style="background:#f5f5f5">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;width:48px"></th>
                <th style="padding:8px 8px;text-align:left;font-size:12px;color:#666;text-transform:uppercase">Product</th>
                <th style="padding:8px 8px;text-align:center;font-size:12px;color:#666;text-transform:uppercase;width:50px">Qty</th>
                <th style="padding:8px 12px 8px 8px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;width:80px">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml(order.items, siteUrl)}
            </tbody>
            <tfoot>
              ${totalsHtml(order.subtotal, order.vat, order.total, order.items.some(i => !!i.custom_data))}
            </tfoot>
          </table>

          ${buttonHtml}
        </div>
      </div>`,
  };
}

/** Generate a raise-PO token for an order number */
export function generateRaisePoToken(orderNumber: string): string {
  const crypto = require("crypto");
  const secret = process.env.RAISE_PO_SECRET || "psp-raise-po-default";
  return crypto.createHmac("sha256", secret).update(orderNumber).digest("hex").slice(0, 16);
}
