"use client";

import { useState, useEffect, useMemo } from "react";
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
  contactId: string | null;
  siteId: string | null;
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

const statusConfig: Record<string, { label: string; color: string; description: string }> = {
  new: { label: "New", color: "bg-blue-50 text-blue-600", description: "Order received and awaiting review" },
  "awaiting_po": { label: "Awaiting PO", color: "bg-yellow-50 text-yellow-600", description: "Order sent for purchase order approval" },
  "in-progress": { label: "In Progress", color: "bg-amber-50 text-amber-600", description: "Being processed by our team" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-600", description: "Order fulfilled" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", description: "Order cancelled" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; code: string } | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const contactCards = useMemo(() => {
    const contactMap = new Map<string, { contactId: string; name: string; email: string; orderCount: number }>();
    for (const o of orders) {
      if (!o.contactId) continue;
      let entry = contactMap.get(o.contactId);
      if (!entry) {
        entry = { contactId: o.contactId, name: o.contact.contactName, email: o.contact.email, orderCount: 0 };
        contactMap.set(o.contactId, entry);
      }
      entry.orderCount++;
    }
    return Array.from(contactMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const siteCards = useMemo(() => {
    const siteMap = new Map<string, { siteId: string; name: string; address: string; statuses: Record<string, number> }>();
    for (const o of orders) {
      if (!o.siteId) continue;
      let entry = siteMap.get(o.siteId);
      if (!entry) {
        entry = { siteId: o.siteId, name: o.site.siteName, address: o.site.siteAddress, statuses: {} };
        siteMap.set(o.siteId, entry);
      }
      entry.statuses[o.status] = (entry.statuses[o.status] || 0) + 1;
    }
    return Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (selectedContactId) result = result.filter((o) => o.contactId === selectedContactId || !o.contactId);
    if (selectedSiteId) result = result.filter((o) => o.siteId === selectedSiteId || !o.siteId);
    if (filter !== "all") result = result.filter((o) => o.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.contact.contactName.toLowerCase().includes(q) ||
          o.site.siteName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, filter, search, selectedSiteId, selectedContactId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-28 bg-gray-50 rounded" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-5 w-16 bg-gray-100 rounded-full ml-auto" />
                  <div className="h-4 w-20 bg-gray-50 rounded ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-persimmon-navy">Your Orders</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {orders.length} {orders.length === 1 ? "order" : "orders"} placed
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-persimmon-green transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to shop
        </Link>
      </div>

      {/* Contact pills */}
      {contactCards.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-persimmon-navy">Ordered By</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {contactCards.map((contact) => {
              const isSelected = selectedContactId === contact.contactId;
              const initials = contact.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              // Deterministic soft colour from name
              const hue = Array.from(contact.name).reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
              return (
                <button
                  key={contact.contactId}
                  onClick={() => setSelectedContactId(isSelected ? null : contact.contactId)}
                  className={`flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full border-2 transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? "border-persimmon-green bg-white shadow-sm"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: `hsl(${hue}, 45%, 55%)` }}
                  >
                    {initials}
                  </span>
                  <span className="text-sm font-medium text-persimmon-navy">{contact.name}</span>
                  <span className="text-[11px] text-gray-400">{contact.orderCount}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Site bento cards */}
      {siteCards.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-persimmon-navy">Your Sites</h2>
            <span className="bg-persimmon-navy text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium">
              {siteCards.length} {siteCards.length === 1 ? "site" : "sites"}
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {siteCards.map((site) => {
              const isSelected = selectedSiteId === site.siteId;
              return (
                <button
                  key={site.siteId}
                  onClick={() => setSelectedSiteId(isSelected ? null : site.siteId)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-persimmon-green bg-white shadow-sm"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-persimmon-navy text-sm">{site.name}</p>
                    {isSelected && (
                      <span className="w-5 h-5 bg-persimmon-green rounded-full flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2 line-clamp-1">{site.address}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(site.statuses).map(([status, count]) => {
                      const cfg = statusConfig[status];
                      if (!cfg) return null;
                      return (
                        <span key={status} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
                          {count} {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active filter indicators */}
      {(selectedContactId || selectedSiteId) && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {selectedContactId && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-persimmon-navy font-medium">
                By: {contactCards.find((c) => c.contactId === selectedContactId)?.name}
              </span>
              <button
                onClick={() => setSelectedContactId(null)}
                className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2 py-0.5 hover:bg-gray-50 transition"
              >
                &times;
              </button>
            </div>
          )}
          {selectedSiteId && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-persimmon-navy font-medium">
                Site: {siteCards.find((s) => s.siteId === selectedSiteId)?.name}
              </span>
              <button
                onClick={() => setSelectedSiteId(null)}
                className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2 py-0.5 hover:bg-gray-50 transition"
              >
                &times;
              </button>
            </div>
          )}
          {selectedContactId && selectedSiteId && (
            <button
              onClick={() => { setSelectedContactId(null); setSelectedSiteId(null); }}
              className="text-xs text-persimmon-green font-medium hover:underline transition"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by order number, name or site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green transition"
        />
      </div>

      {/* Status filters */}
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
            {f === "all" ? "All" : statusConfig[f]?.label || f}
            {f !== "all" && (
              <span className="ml-1.5 opacity-60">
                ({orders.filter((o) => o.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <p className="text-gray-400 mb-1">
            {search || filter !== "all" ? "No orders match your search." : "No orders yet."}
          </p>
          <p className="text-sm text-gray-300 mb-6">
            {search || filter !== "all" ? "Try a different search or filter." : "Orders you place will appear here."}
          </p>
          {!search && filter === "all" && (
            <Link
              href="/"
              className="inline-block bg-persimmon-green text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-persimmon-green-dark transition"
            >
              Browse Signs
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrder === order.orderNumber;
            const status = statusConfig[order.status] || statusConfig.new;

            return (
              <div key={order.orderNumber}>
                {/* Summary card */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.orderNumber)}
                  className={`w-full text-left bg-white border p-5 transition-all hover:shadow-md ${
                    isExpanded
                      ? "border-persimmon-green shadow-md rounded-t-2xl rounded-b-none border-b-0"
                      : "border-gray-100 hover:border-gray-200 rounded-2xl"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-persimmon-navy">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{order.site.siteName}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-[11px] text-gray-300">{order.items.length} {order.items.length === 1 ? "item" : "items"}</p>
                        {order.items.some((i) => i.customData?.signType) && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-semibold rounded-full">
                            Custom Sign
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                        <p className="text-sm font-bold text-persimmon-navy mt-1.5">
                          {"\u00A3"}{order.total.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
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
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="bg-white rounded-b-2xl border border-t-0 border-persimmon-green p-6">
                    {/* Status banner */}
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5 ${
                      order.status === "completed" ? "bg-emerald-50" :
                      order.status === "awaiting_po" ? "bg-yellow-50" :
                      order.status === "in-progress" ? "bg-amber-50" :
                      order.status === "cancelled" ? "bg-gray-50" : "bg-blue-50"
                    }`}>
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
                      <p className={`text-sm ${
                        order.status === "completed" ? "text-emerald-700" :
                        order.status === "awaiting_po" ? "text-yellow-700" :
                        order.status === "in-progress" ? "text-amber-700" :
                        order.status === "cancelled" ? "text-gray-500" : "text-blue-700"
                      }`}>
                        {status.description}
                      </p>
                    </div>

                    <div className="flex justify-between items-start mb-5">
                      <p className="text-xs text-gray-400">
                        Placed on {new Date(order.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="space-y-5">
                      {/* Contact & Site info */}
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

                      {/* Purchaser */}
                      {(order.purchaserName || order.purchaserEmail) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Purchaser</h3>
                            {order.purchaserName && <p className="text-sm font-medium">{order.purchaserName}</p>}
                            {order.purchaserEmail && <p className="text-sm text-gray-500">{order.purchaserEmail}</p>}
                          </div>
                        </div>
                      )}

                      {/* PO / Notes */}
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

                      {/* PO Document */}
                      {order.poDocumentName && (
                        <div>
                          <a
                            href={`/api/orders/${order.orderNumber}/download-po`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PO: {order.poDocumentName}
                          </a>
                        </div>
                      )}

                      {/* Items table */}
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
                              // Custom sign request
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
                                const typeLabel =
                                  item.customData.signType.charAt(0).toUpperCase() +
                                  item.customData.signType.slice(1).replace("-", " ");
                                return (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="py-2 pr-2">
                                      <div
                                        className={`w-9 h-9 rounded flex items-center justify-center ${
                                          typeColors[item.customData.signType] || "bg-gray-400"
                                        }`}
                                      >
                                        <span className="text-white text-[8px] font-bold leading-tight text-center">
                                          {typeLabel}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5">
                                      <p className="font-medium text-amber-600 text-xs">CUSTOM SIGN</p>
                                      <p className="text-xs text-gray-500">
                                        {typeLabel} · {item.customData.shape} · {item.size || ""}
                                      </p>
                                      <p className="text-xs text-gray-700 mt-0.5">
                                        &ldquo;{item.customData.textContent}&rdquo;
                                      </p>
                                      {item.customData.additionalNotes && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                          Notes: {item.customData.additionalNotes}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                                    <td className="py-2.5 text-right font-medium text-amber-600 text-xs">Quote</td>
                                  </tr>
                                );
                              }

                              // Standard item
                              const imgCode = (item.baseCode || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
                              const customFields = item.customData?.fields as
                                | Array<{ label: string; key: string; value: string }>
                                | undefined;
                              return (
                                <tr key={i} className="border-b border-gray-50">
                                  <td className="py-2 pr-2">
                                    <img
                                      src={`/images/products/${imgCode}.png`}
                                      alt={item.code}
                                      className="w-9 h-9 rounded object-contain bg-gray-50 cursor-pointer hover:ring-2 hover:ring-persimmon-green/40 transition"
                                      onClick={() =>
                                        setLightbox({ src: `/images/products/${imgCode}.png`, code: item.code })
                                      }
                                    />
                                  </td>
                                  <td className="py-2.5">
                                    <p className="font-medium text-gray-700">{item.code}</p>
                                    <p className="text-xs text-gray-400">
                                      {item.name}
                                      {item.size ? ` (${item.size})` : ""}
                                    </p>
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
                                  <td className="py-2.5 text-right font-medium">
                                    {"\u00A3"}
                                    {(item.price * item.quantity).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-100">
                              <td colSpan={3} className="pt-2.5 text-right text-gray-500">
                                Subtotal
                              </td>
                              <td className="pt-2.5 text-right">
                                {"\u00A3"}
                                {order.subtotal.toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="text-right text-gray-400 text-xs">
                                VAT (20%)
                              </td>
                              <td className="text-right text-gray-400 text-xs">
                                {"\u00A3"}
                                {order.vat.toFixed(2)}
                              </td>
                            </tr>
                            <tr className="font-bold text-persimmon-navy">
                              <td colSpan={3} className="pt-2 text-right">
                                Total
                              </td>
                              <td className="pt-2 text-right">
                                {"\u00A3"}
                                {order.total.toFixed(2)}
                              </td>
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

      {/* Lightbox */}
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
            <img src={lightbox.src} alt={lightbox.code} className="w-full rounded-xl object-contain bg-gray-50" />
            <p className="text-center text-sm font-semibold text-persimmon-navy mt-3">{lightbox.code}</p>
          </div>
        </div>
      )}
    </div>
  );
}
