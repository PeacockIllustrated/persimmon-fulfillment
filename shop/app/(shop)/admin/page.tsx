"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OrderItem {
  code: string;
  baseCode: string | null;
  name: string;
  size: string | null;
  quantity: number;
  price: number;
  customData?: {
    type?: string;
    signType?: string;
    textContent?: string;
    shape?: string;
    additionalNotes?: string;
    fields?: Array<{ label: string; key: string; value: string }>;
  } | null;
}

interface Order {
  orderNumber: string;
  createdAt: string;
  status: string;
  contact: { contactName: string; email: string; phone: string };
  site: { siteName: string; siteAddress: string };
  poNumber: string | null;
  notes: string | null;
  purchaserName: string | null;
  purchaserEmail: string | null;
  poDocumentName: string | null;
  items: OrderItem[];
  subtotal: number;
  vat: number;
  total: number;
}

interface Suggestion {
  id: string;
  name: string;
  message: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [lightbox, setLightbox] = useState<{ src: string; code: string } | null>(null);
  const [tab, setTab] = useState<"orders" | "suggestions">("orders");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sugFilter, setSugFilter] = useState("all");
  const [sendingToNest, setSendingToNest] = useState<string | null>(null);
  const [nestError, setNestError] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch("/api/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {});
  }, []);

  const updateSuggestionStatus = async (id: string, newStatus: string) => {
    await fetch("/api/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
  };

  const filteredSuggestions = sugFilter === "all" ? suggestions : suggestions.filter((s) => s.status === sugFilter);

  const filteredOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);

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

  const updateStatus = async (orderNumber: string, newStatus: string) => {
    await fetch(`/api/orders/${orderNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setOrders((prev) =>
      prev.map((o) => (o.orderNumber === orderNumber ? { ...o, status: newStatus } : o))
    );
  };

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

  const deleteOrder = async (orderNumber: string) => {
    if (!confirm(`Permanently delete ${orderNumber}? This cannot be undone.`)) return;
    setDeletingOrder(orderNumber);
    try {
      const res = await fetch(`/api/orders/${orderNumber}`, { method: "DELETE" });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.orderNumber !== orderNumber));
        setExpandedOrder(null);
      } else {
        alert("Failed to delete order.");
      }
    } catch {
      alert("Network error — please try again.");
    } finally {
      setDeletingOrder(null);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-400">Loading orders...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-persimmon-navy">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {orders.length} orders · {suggestions.length} suggestions
          </p>
        </div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-persimmon-green transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to shop
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-50 rounded-xl p-1 max-w-xs">
        <button
          onClick={() => setTab("orders")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "orders" ? "bg-white text-persimmon-navy shadow-sm" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => setTab("suggestions")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition relative ${
            tab === "suggestions" ? "bg-white text-persimmon-navy shadow-sm" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Suggestions
          {suggestions.filter((s) => s.status === "new").length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-persimmon-green text-white rounded-full">
              {suggestions.filter((s) => s.status === "new").length}
            </span>
          )}
        </button>
      </div>

      {tab === "suggestions" ? (
        /* ─── Suggestions Tab ─── */
        <div>
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {["all", "new", "noted", "done", "dismissed"].map((f) => (
              <button
                key={f}
                onClick={() => setSugFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  sugFilter === f
                    ? "bg-persimmon-navy text-white shadow-sm"
                    : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && (
                  <span className="ml-1.5 opacity-60">
                    ({suggestions.filter((s) => s.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {filteredSuggestions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400">No suggestions yet.</p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-3">
              {filteredSuggestions.map((s) => {
                const sugStatusColors: Record<string, string> = {
                  new: "bg-blue-50 text-blue-600",
                  noted: "bg-amber-50 text-amber-600",
                  done: "bg-emerald-50 text-emerald-600",
                  dismissed: "bg-gray-100 text-gray-500",
                };
                return (
                  <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-persimmon-navy text-sm">{s.name}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${sugStatusColors[s.status] || "bg-gray-100 text-gray-500"}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{s.message}</p>
                        <p className="text-[11px] text-gray-300 mt-2">
                          {new Date(s.createdAt).toLocaleString("en-GB", {
                            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <select
                        value={s.status}
                        onChange={(e) => updateSuggestionStatus(s.id, e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-persimmon-green/15 shrink-0"
                      >
                        <option value="new">New</option>
                        <option value="noted">Noted</option>
                        <option value="done">Done</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      /* ─── Orders Tab ─── */
      <>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {["all", "new", "awaiting_po", "in-progress", "completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
              filter === f
                ? "bg-persimmon-navy text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            {statusLabels[f] || f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-1.5 opacity-60">
                ({orders.filter((o) => o.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">No orders found.</p>
        </div>
      ) : (
        <div className="max-w-3xl space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrder === order.orderNumber;

            return (
              <div key={order.orderNumber}>
                {/* Order summary card */}
                <button
                  onClick={() => { setExpandedOrder(isExpanded ? null : order.orderNumber); setNestError(null); }}
                  className={`w-full text-left bg-white border p-5 transition-all hover:shadow-md ${
                    isExpanded
                      ? "border-persimmon-green shadow-md rounded-t-2xl rounded-b-none border-b-0"
                      : "border-gray-100 hover:border-gray-200 rounded-2xl"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-persimmon-navy">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{order.contact.contactName}</p>
                      <p className="text-xs text-gray-400">{order.site.siteName}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusColors[order.status] || "bg-gray-100 text-gray-500"}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                        <p className="text-sm font-bold text-persimmon-navy mt-1.5">
                          {"\u00A3"}{order.total.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-300 mt-0.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <p className="text-[11px] text-gray-300">{order.items.length} items</p>
                    {order.items.some((i) => i.customData?.signType) && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full">
                        Custom Sign
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded detail (accordion) */}
                {isExpanded && (
                  <div className="bg-white rounded-b-2xl border border-t-0 border-persimmon-green p-6">
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
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteOrder(order.orderNumber); }}
                          disabled={deletingOrder === order.orderNumber}
                          className="px-3 py-1.5 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {deletingOrder === order.orderNumber ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    {nestError && expandedOrder === order.orderNumber && (
                      <div className="mb-4 px-4 py-2.5 bg-red-50 text-red-600 text-sm rounded-xl">
                        {nestError}
                      </div>
                    )}

                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Contact</h3>
                          <p className="text-sm font-medium">{order.contact.contactName}</p>
                          <p className="text-sm text-gray-500">{order.contact.email}</p>
                          <p className="text-sm text-gray-500">{order.contact.phone}</p>
                        </div>
                        <div>
                          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Site</h3>
                          <p className="text-sm font-medium">{order.site.siteName}</p>
                          <p className="text-sm text-gray-500">{order.site.siteAddress}</p>
                        </div>
                      </div>

                      {(order.purchaserName || order.purchaserEmail) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Purchaser</h3>
                            {order.purchaserName && <p className="text-sm font-medium">{order.purchaserName}</p>}
                            {order.purchaserEmail && <p className="text-sm text-gray-500">{order.purchaserEmail}</p>}
                          </div>
                        </div>
                      )}

                      {(order.poNumber || order.notes) && (
                        <div className="grid grid-cols-2 gap-4">
                          {order.poNumber && (
                            <div>
                              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">PO Number</h3>
                              <p className="text-sm">{order.poNumber}</p>
                            </div>
                          )}
                          {order.notes && (
                            <div>
                              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</h3>
                              <p className="text-sm text-gray-500">{order.notes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Documents */}
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/orders/${order.orderNumber}/delivery-note`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-persimmon-navy border border-persimmon-navy/20 rounded-lg hover:bg-persimmon-navy/5 transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Delivery Note
                        </a>
                        {order.poDocumentName && (
                          <a
                            href={`/api/orders/${order.orderNumber}/download-po`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PO: {order.poDocumentName}
                          </a>
                        )}
                      </div>

                      <div>
                        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-left text-gray-400 text-xs">
                              <th className="pb-2 font-medium w-10"></th>
                              <th className="pb-2 font-medium">Product</th>
                              <th className="pb-2 font-medium text-center">Qty</th>
                              <th className="pb-2 font-medium text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, i) => {
                              // Custom sign request (price 0, quote)
                              if (item.customData?.signType) {
                                const typeColors: Record<string, string> = {
                                  warning: "bg-yellow-400",
                                  prohibition: "bg-red-600",
                                  mandatory: "bg-blue-600",
                                  information: "bg-green-600",
                                  "fire-safety": "bg-red-600",
                                  directional: "bg-green-600",
                                  security: "bg-blue-600",
                                  environmental: "bg-green-600",
                                };
                                const typeLabel = item.customData.signType.charAt(0).toUpperCase() + item.customData.signType.slice(1).replace("-", " ");
                                return (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="py-2 pr-2">
                                      <div className={`w-9 h-9 rounded flex items-center justify-center ${typeColors[item.customData.signType] || "bg-gray-400"}`}>
                                        <span className="text-white text-[8px] font-bold leading-tight text-center">{typeLabel}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5">
                                      <p className="font-medium text-amber-600 text-xs">CUSTOM SIGN</p>
                                      <p className="text-xs text-gray-500">{typeLabel} · {item.customData.shape} · {item.size || ""}</p>
                                      <p className="text-xs text-gray-700 mt-0.5">&ldquo;{item.customData.textContent}&rdquo;</p>
                                      {item.customData.additionalNotes && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">Notes: {item.customData.additionalNotes}</p>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                                    <td className="py-2.5 text-right font-medium text-amber-600 text-xs">Quote</td>
                                  </tr>
                                );
                              }

                              // Standard item (with optional custom field values)
                              const imgCode = (item.baseCode || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
                              const customFields = item.customData?.fields as Array<{ label: string; key: string; value: string }> | undefined;
                              return (
                                <tr key={i} className="border-b border-gray-50">
                                  <td className="py-2 pr-2">
                                    <img
                                      src={`/images/products/${imgCode}.png`}
                                      alt={item.code}
                                      className="w-9 h-9 rounded object-contain bg-gray-50 cursor-pointer hover:ring-2 hover:ring-persimmon-green/40 transition"
                                      onClick={(e) => { e.stopPropagation(); setLightbox({ src: `/images/products/${imgCode}.png`, code: item.code }); }}
                                    />
                                  </td>
                                  <td className="py-2.5">
                                    <p className="font-medium text-gray-700">{item.code}</p>
                                    <p className="text-xs text-gray-400">{item.name}{item.size ? ` (${item.size})` : ""}</p>
                                    {customFields && customFields.length > 0 && (
                                      <div className="mt-0.5">
                                        {customFields.map((f) => (
                                          <p key={f.key} className="text-[11px] text-persimmon-green">
                                            {f.label}: <span className="text-gray-500">{f.value}</span>
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                                  <td className="py-2.5 text-right font-medium">{"\u00A3"}{(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-100">
                              <td colSpan={3} className="pt-2.5 text-right text-gray-500">Subtotal</td>
                              <td className="pt-2.5 text-right">{"\u00A3"}{order.subtotal.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="text-right text-gray-400 text-xs">VAT</td>
                              <td className="text-right text-gray-400 text-xs">{"\u00A3"}{order.vat.toFixed(2)}</td>
                            </tr>
                            <tr className="font-bold text-persimmon-navy">
                              <td colSpan={3} className="pt-2 text-right">Total</td>
                              <td className="pt-2 text-right">{"\u00A3"}{order.total.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-4 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={lightbox.src}
              alt={lightbox.code}
              className="w-full rounded-xl object-contain bg-gray-50"
            />
            <p className="text-center text-sm font-semibold text-persimmon-navy mt-3">{lightbox.code}</p>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
