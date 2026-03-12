# Nest PO Request System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Send to Nest" button in the admin dashboard that sends a formatted PO request email and tracks order status through an `awaiting_po` state.

**Architecture:** New API route (`send-to-nest`) handles email dispatch and status update atomically. New email function reuses existing Resend/HTML patterns. Admin and customer UIs gain the new status in filters, badges, and dropdowns.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Resend (email), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-12-nest-po-request-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `shop/app/api/orders/[orderNumber]/route.ts` | Modify | Add `awaiting_po` to valid statuses |
| `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` | Create | POST handler: validate, send email, update status |
| `shop/lib/email.ts` | Modify | Add `sendNestPORequest()` function |
| `shop/app/(shop)/admin/page.tsx` | Modify | Add button, filter pill, badge colour, dropdown option |
| `shop/app/(shop)/orders/page.tsx` | Modify | Add `awaiting_po` to statusConfig, filters, banner |
| `shop/supabase-setup.sql` | Modify | Update CHECK constraint and add `custom_data` column |

---

## Chunk 1: Backend — Status Model + Send-to-Nest API + Email

### Task 1: Update status constraint in API and SQL

**Files:**
- Modify: `shop/app/api/orders/[orderNumber]/route.ts:17`
- Modify: `shop/supabase-setup.sql:8`

- [ ] **Step 1: Add `awaiting_po` to valid statuses in PATCH handler**

In `shop/app/api/orders/[orderNumber]/route.ts`, line 17, change:

```ts
const validStatuses = ["new", "in-progress", "completed", "cancelled"];
```

to:

```ts
const validStatuses = ["new", "awaiting_po", "in-progress", "completed", "cancelled"];
```

- [ ] **Step 2: Update the CHECK constraint in supabase-setup.sql**

In `shop/supabase-setup.sql`, line 8, change:

```sql
status        text not null default 'new' check (status in ('new','in-progress','completed','cancelled')),
```

to:

```sql
status        text not null default 'new' check (status in ('new','awaiting_po','in-progress','completed','cancelled')),
```

- [ ] **Step 3: Add `custom_data` column to `psp_order_items` in supabase-setup.sql**

In `shop/supabase-setup.sql`, line 34, change:

```sql
  line_total  numeric(10,2) not null
```

to:

```sql
  line_total  numeric(10,2) not null,
  custom_data   jsonb default null
```

Note the trailing comma on `line_total` — without it the SQL is invalid. This documents the column the code already uses. The live DB migration is a separate manual step.

- [ ] **Step 4: Commit**

```bash
git add shop/app/api/orders/[orderNumber]/route.ts shop/supabase-setup.sql
git commit -m "feat: add awaiting_po status to order model"
```

---

### Task 2: Add `sendNestPORequest` email function

**Files:**
- Modify: `shop/lib/email.ts` (append new function after `sendTeamNotification`)

- [ ] **Step 1: Add the `sendNestPORequest` function**

Append to the end of `shop/lib/email.ts`:

```ts
export async function sendNestPORequest(order: OrderData): Promise<void> {
  const nestEmail = process.env.NEST_EMAIL;
  if (!nestEmail) {
    throw new Error("NEST_EMAIL environment variable is not configured");
  }

  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const attachments = buildImageAttachments(order.items, siteUrl);

  const { error } = await resend.emails.send({
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

  if (error) {
    throw new Error(`Nest PO request email failed: ${error.message}`);
  }
  console.log(`Nest PO request email sent to ${nestEmail} for ${order.orderNumber}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add shop/lib/email.ts
git commit -m "feat: add sendNestPORequest email function"
```

---

### Task 3: Create the send-to-nest API route

**Files:**
- Create: `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts`

- [ ] **Step 1: Create the route file**

Create `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts`:

```ts
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
```

- [ ] **Step 2: Verify build compiles**

Run: `cd shop && npx next build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add shop/app/api/orders/[orderNumber]/send-to-nest/route.ts
git commit -m "feat: add send-to-nest API route"
```

---

## Chunk 2: Frontend — Admin Dashboard + Customer Orders Page

### Task 4: Update admin dashboard — status colours, filter pills, dropdown

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx`

- [ ] **Step 1: Replace `statusColors` with `statusColors` + `statusLabels` maps**

In `shop/app/(shop)/admin/page.tsx`, line 84-88, change:

```ts
  const statusColors: Record<string, string> = {
    new: "bg-blue-50 text-blue-600",
    "in-progress": "bg-amber-50 text-amber-600",
    completed: "bg-emerald-50 text-emerald-600",
  };
```

to:

```ts
  const statusColors: Record<string, string> = {
    new: "bg-blue-50 text-blue-600",
    "awaiting_po": "bg-yellow-50 text-yellow-600",
    "in-progress": "bg-amber-50 text-amber-600",
    completed: "bg-emerald-50 text-emerald-600",
  };

  const statusLabels: Record<string, string> = {
    new: "New",
    "awaiting_po": "Awaiting PO",
    "in-progress": "In Progress",
    completed: "Completed",
  };
```

- [ ] **Step 2: Add `awaiting_po` to filter pills**

Line 222, change:

```tsx
{["all", "new", "in-progress", "completed"].map((f) => (
```

to:

```tsx
{["all", "new", "awaiting_po", "in-progress", "completed"].map((f) => (
```

- [ ] **Step 3: Update filter pill label and badge to use `statusLabels`**

Line 232 (filter pill label), change:

```tsx
{f.charAt(0).toUpperCase() + f.slice(1)}
```

to:

```tsx
{statusLabels[f] || f.charAt(0).toUpperCase() + f.slice(1)}
```

Line 271 (badge text in order summary card), change:

```tsx
{order.status}
```

to:

```tsx
{statusLabels[order.status] || order.status}
```

- [ ] **Step 4: Commit**

```bash
git add shop/app/(shop)/admin/page.tsx
git commit -m "feat: add awaiting_po status to admin dashboard filters and dropdown"
```

---

### Task 5: Add "Send to Nest" button to admin dashboard

**Files:**
- Modify: `shop/app/(shop)/admin/page.tsx`

- [ ] **Step 1: Add `sendingToNest` state to track loading per order**

After the existing state declarations (around line 53), add:

```ts
const [sendingToNest, setSendingToNest] = useState<string | null>(null);
const [nestError, setNestError] = useState<string | null>(null);
```

Also update the `setExpandedOrder` toggle to clear stale errors. Find the toggle call (line 255):

```tsx
onClick={() => setExpandedOrder(isExpanded ? null : order.orderNumber)}
```

change to:

```tsx
onClick={() => { setExpandedOrder(isExpanded ? null : order.orderNumber); setNestError(null); }}
```

- [ ] **Step 2: Add the `sendToNest` handler function**

After the `updateStatus` function (after line 99), add:

```ts
  const sendToNest = async (orderNumber: string) => {
    if (!confirm(`Send PO request to Nest for ${orderNumber}?`)) return;
    setSendingToNest(orderNumber);
    setNestError(null);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/send-to-nest`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setNestError(data.error || "Failed to send PO request");
        return;
      }
      // Update local state to reflect new status
      setOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === orderNumber ? { ...o, status: "awaiting_po" } : o
        )
      );
    } catch {
      setNestError("Network error — please try again");
    } finally {
      setSendingToNest(null);
    }
  };
```

- [ ] **Step 3: Add the "Send to Nest" button in the expanded order detail**

In the expanded order detail section (inside the `isExpanded &&` block), after the `<select>` status dropdown (after line 316), add the button. Replace the block from line 303 to 316:

```tsx
<div className="flex justify-between items-start mb-5">
  <p className="text-xs text-gray-400">
    {new Date(order.createdAt).toLocaleString("en-GB")}
  </p>
  <div className="flex items-center gap-2">
    {(order.status === "new" || order.status === "awaiting_po") && (
      <button
        onClick={(e) => { e.stopPropagation(); sendToNest(order.orderNumber); }}
        disabled={sendingToNest === order.orderNumber}
        className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sendingToNest === order.orderNumber ? "Sending..." : order.status === "awaiting_po" ? "Re-send to Nest" : "Send to Nest"}
      </button>
    )}
    <select
      value={order.status}
      onChange={(e) => updateStatus(order.orderNumber, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-persimmon-green/15"
    >
      <option value="new">New</option>
      <option value="awaiting_po">Awaiting PO</option>
      <option value="in-progress">In Progress</option>
      <option value="completed">Completed</option>
    </select>
  </div>
</div>
{nestError && expandedOrder === order.orderNumber && (
  <div className="mb-4 px-4 py-2.5 bg-red-50 text-red-600 text-sm rounded-xl">
    {nestError}
  </div>
)}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd shop && npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add shop/app/(shop)/admin/page.tsx
git commit -m "feat: add Send to Nest button in admin order detail"
```

---

### Task 6: Update customer orders page with `awaiting_po` status

**Files:**
- Modify: `shop/app/(shop)/orders/page.tsx`

- [ ] **Step 1: Add `awaiting_po` to the `statusConfig` object**

In `shop/app/(shop)/orders/page.tsx`, lines 37-42, change:

```ts
const statusConfig: Record<string, { label: string; color: string; description: string }> = {
  new: { label: "New", color: "bg-blue-50 text-blue-600", description: "Order received and awaiting review" },
  "in-progress": { label: "In Progress", color: "bg-amber-50 text-amber-600", description: "Being processed by our team" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-600", description: "Order fulfilled" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", description: "Order cancelled" },
};
```

to:

```ts
const statusConfig: Record<string, { label: string; color: string; description: string }> = {
  new: { label: "New", color: "bg-blue-50 text-blue-600", description: "Order received and awaiting review" },
  "awaiting_po": { label: "Awaiting PO", color: "bg-yellow-50 text-yellow-600", description: "Order sent for purchase order approval" },
  "in-progress": { label: "In Progress", color: "bg-amber-50 text-amber-600", description: "Being processed by our team" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-600", description: "Order fulfilled" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", description: "Order cancelled" },
};
```

- [ ] **Step 2: Add `awaiting_po` to filter pills**

Line 147, change:

```tsx
{["all", "new", "in-progress", "completed"].map((f) => (
```

to:

```tsx
{["all", "new", "awaiting_po", "in-progress", "completed"].map((f) => (
```

- [ ] **Step 3: Add `awaiting_po` to the status banner in expanded order detail**

Lines 257-260, change:

```tsx
<div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5 ${
  order.status === "completed" ? "bg-emerald-50" :
  order.status === "in-progress" ? "bg-amber-50" :
  order.status === "cancelled" ? "bg-gray-50" : "bg-blue-50"
}`}>
```

to:

```tsx
<div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5 ${
  order.status === "completed" ? "bg-emerald-50" :
  order.status === "awaiting_po" ? "bg-yellow-50" :
  order.status === "in-progress" ? "bg-amber-50" :
  order.status === "cancelled" ? "bg-gray-50" : "bg-blue-50"
}`}>
```

- [ ] **Step 4: Add `awaiting_po` icon and text colour in the status banner**

Lines 261-278. After the existing cancelled check (line 268-269), add an `awaiting_po` branch. Change:

```tsx
{order.status === "completed" ? (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
) : order.status === "cancelled" ? (
  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
) : (
  <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
  </svg>
)}
```

to:

```tsx
{order.status === "completed" ? (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
) : order.status === "cancelled" ? (
  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
) : order.status === "awaiting_po" ? (
  <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
) : (
  <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
  </svg>
)}
```

And for the text colour (lines 275-278), change:

```tsx
<p className={`text-sm ${
  order.status === "completed" ? "text-emerald-700" :
  order.status === "in-progress" ? "text-amber-700" :
  order.status === "cancelled" ? "text-gray-500" : "text-blue-700"
}`}>
```

to:

```tsx
<p className={`text-sm ${
  order.status === "completed" ? "text-emerald-700" :
  order.status === "awaiting_po" ? "text-yellow-700" :
  order.status === "in-progress" ? "text-amber-700" :
  order.status === "cancelled" ? "text-gray-500" : "text-blue-700"
}`}>
```

- [ ] **Step 5: Verify build compiles**

Run: `cd shop && npx next build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add shop/app/(shop)/orders/page.tsx
git commit -m "feat: add awaiting_po status to customer orders page"
```

---

## Chunk 3: Final Verification

### Task 7: Full build and manual test checklist

- [ ] **Step 1: Run production build**

Run: `cd shop && npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Add `NEST_EMAIL` to local `.env.local`**

Add to `shop/.env.local`:
```
NEST_EMAIL=your-test-email@onesign.co.uk
```

(Use your own Onesign team email for internal testing.)

- [ ] **Step 3: Manual test checklist**

Start the dev server: `cd shop && npm run dev`

Verify:
1. **Admin dashboard** — filter pills show "Awaiting PO" with count
2. **Admin dashboard** — status dropdown includes "Awaiting PO"
3. **Admin dashboard** — "Send to Nest" button appears on `new` orders
4. **Admin dashboard** — clicking button shows confirm dialog
5. **Admin dashboard** — after confirm, order moves to `awaiting_po` status, badge is yellow
6. **Admin dashboard** — "Re-send to Nest" button appears on `awaiting_po` orders
7. **Admin dashboard** — button does NOT appear on `in-progress` or `completed` orders
8. **Customer orders page** — "Awaiting PO" filter pill appears
9. **Customer orders page** — `awaiting_po` orders show yellow badge and banner
10. **Email** — check your test inbox for the PO request email with correct formatting

- [ ] **Step 4: Final commit on staging branch**

```bash
git add -A
git commit -m "feat: nest PO request system — complete implementation"
```

---

## Database Migration (Manual — run in Supabase SQL Editor)

**Run these before testing against the live database:**

```sql
-- 1. Add custom_data column if not yet applied
ALTER TABLE psp_order_items ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT NULL;

-- 2. Update status constraint to include awaiting_po
ALTER TABLE psp_orders DROP CONSTRAINT IF EXISTS psp_orders_status_check;
ALTER TABLE psp_orders ADD CONSTRAINT psp_orders_status_check
  CHECK (status IN ('new', 'awaiting_po', 'in-progress', 'completed', 'cancelled'));
```

## Environment Variables (Vercel)

Add to the Vercel project settings:

| Variable | Value |
|----------|-------|
| `NEST_EMAIL` | Your Onesign test email (swap to Nest's real email after verification) |
