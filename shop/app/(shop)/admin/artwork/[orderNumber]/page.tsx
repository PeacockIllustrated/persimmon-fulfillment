"use client";

/**
 * Proof approval for one order's artwork pack.
 *
 * Admin only — it sits under app/(shop)/admin, whose layout redirects anyone
 * without the admin cookie. No customer-facing route links here or reads any
 * of it, so a Persimmon buyer's flow is exactly what it was.
 *
 * Every page is decided on its own. Approving a whole order in one click is
 * what keeps a human reviewing all of it forever; per-page decisions are what
 * eventually let a straight library pull pass unattended while a sign drawn
 * from scratch still gets looked at.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";

type Decision = "pending" | "approved" | "rejected";

interface Page {
  id: string;
  page_no: number;
  code: string;
  name: string;
  size: string | null;
  quantity: number;
  provenance: string;
  reason: string | null;
  brand: string | null;
  fit_note: string | null;
  source_file: string | null;
  source_page: number | null;
  preview: string | null;
  decision: Decision;
  decision_note: string | null;
}

interface Pack {
  built_at: string;
  line_items: number;
  pages_packed: number;
  needs_attention: string[];
  pack_filename: string | null;
  pack_size_bytes: number | null;
}

interface Order {
  order_number: string;
  status: string;
  fulfilment_status: string;
  site_name: string;
  contact_name: string;
}

const PROVENANCE_STYLE: Record<string, string> = {
  LIBRARY: "bg-emerald-50 text-emerald-800 border-emerald-200",
  MERGED: "bg-blue-50 text-blue-800 border-blue-200",
  GENERATED: "bg-amber-50 text-amber-900 border-amber-200",
  BLOCKED: "bg-red-50 text-red-800 border-red-200",
  UNRESOLVED: "bg-gray-100 text-gray-600 border-gray-200",
};

const PROVENANCE_HELP: Record<string, string> = {
  LIBRARY: "Lifted from artwork already printed and approved.",
  MERGED: "A template redrawn with this order's own text.",
  GENERATED: "Drawn from the catalogue image — we hold no artwork for it.",
  BLOCKED: "Artwork found, but branded for another housebuilder.",
  UNRESOLVED: "Nothing to work from.",
};

export default function ArtworkApproval({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [pack, setPack] = useState<Pack | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [zoomed, setZoomed] = useState<Page | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/fulfilment/${orderNumber}`);
    if (!res.ok) {
      setMessage((await res.json().catch(() => ({}))).error ?? "Could not load the proof");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setOrder(data.order);
    setPack(data.pack);
    setPages(data.pages);
    setLoading(false);
  }, [orderNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(page: Page, decision: Decision, reason?: string) {
    setBusy(page.id);
    setMessage(null);
    const res = await fetch(`/api/fulfilment/${orderNumber}/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: reason ?? null }),
    });
    setBusy(null);
    if (!res.ok) {
      setMessage((await res.json().catch(() => ({}))).error ?? "Could not save that");
      return;
    }
    setRejecting(null);
    setNote("");
    await load();
  }

  async function approvePack() {
    setBusy("pack");
    setMessage(null);
    const res = await fetch(`/api/fulfilment/${orderNumber}/approve`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage(body.error ?? "Could not approve the pack");
      return;
    }
    await load();
  }

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading proof…</div>;
  }

  if (!order) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-600">{message ?? "No such order."}</p>
        <Link href="/admin" className="text-sm text-persimmon-green underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const decided = pages.filter((p) => p.decision !== "pending").length;
  const approved = pages.filter((p) => p.decision === "approved").length;
  const rejected = pages.filter((p) => p.decision === "rejected").length;
  const allDecided = pages.length > 0 && decided === pages.length;
  const signedOff = order.fulfilment_status === "approved" || order.fulfilment_status === "packed";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/admin" className="text-xs text-gray-500 hover:text-persimmon-navy">
        ← Orders
      </Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-persimmon-navy">
            {order.order_number}
          </h1>
          <p className="text-sm text-gray-500">
            {order.site_name} · {order.contact_name}
            {pack && ` · built ${new Date(pack.built_at).toLocaleString("en-GB")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pack?.pack_filename && (
            <a
              href={`/api/fulfilment/${orderNumber}/artwork`}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:border-gray-300 text-persimmon-navy"
            >
              Download pack
              {pack.pack_size_bytes
                ? ` (${Math.round(pack.pack_size_bytes / 1024 / 1024 * 10) / 10}MB)`
                : ""}
            </a>
          )}
          <button
            onClick={approvePack}
            disabled={!allDecided || rejected > 0 || busy === "pack" || signedOff}
            className="px-4 py-2 text-sm rounded-lg font-medium text-white bg-persimmon-green disabled:bg-gray-200 disabled:text-gray-400"
          >
            {signedOff ? "Approved" : busy === "pack" ? "Approving…" : "Approve pack"}
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-persimmon-gray text-persimmon-navy font-medium">
          {approved}/{pages.length} approved
        </span>
        {rejected > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-medium">
            {rejected} rejected — rebuild before approving
          </span>
        )}
        <span className="px-2.5 py-1 rounded-full bg-persimmon-gray text-gray-600">
          {order.fulfilment_status.replace("_", " ")}
        </span>
      </div>

      {message && (
        <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {message}
        </div>
      )}

      {pack?.needs_attention?.length ? (
        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900 mb-1.5">
            Not in this pack
          </h2>
          <ul className="text-sm text-amber-900 space-y-0.5">
            {pack.needs_attention.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {pages.map((page) => {
          const style = PROVENANCE_STYLE[page.provenance] ?? PROVENANCE_STYLE.UNRESOLVED;
          return (
            <div
              key={page.id}
              className={`rounded-xl border bg-white overflow-hidden flex flex-col ${
                page.decision === "approved"
                  ? "border-emerald-300"
                  : page.decision === "rejected"
                  ? "border-red-300"
                  : "border-gray-200"
              }`}
            >
              <button
                type="button"
                onClick={() => page.preview && setZoomed(page)}
                className="bg-persimmon-gray aspect-[4/3] flex items-center justify-center p-3 cursor-zoom-in"
              >
                {page.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`data:image/png;base64,${page.preview}`}
                    alt={`${page.code} — ${page.name}`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-400">No preview</span>
                )}
              </button>

              <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-persimmon-navy truncate">
                      {page.page_no}. {page.code}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{page.name}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">×{page.quantity}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold tracking-wide ${style}`}
                    title={PROVENANCE_HELP[page.provenance]}
                  >
                    {page.provenance}
                  </span>
                  {page.size && (
                    <span className="text-[11px] text-gray-500">{page.size}</span>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 leading-snug">{page.reason}</p>
                {page.fit_note && page.fit_note !== "as printed" && (
                  <p className="text-[11px] text-gray-400 leading-snug">{page.fit_note}</p>
                )}

                {page.decision === "rejected" && page.decision_note && (
                  <p className="text-[11px] text-red-700 leading-snug">
                    Rejected: {page.decision_note}
                  </p>
                )}

                {rejecting === page.id ? (
                  <div className="mt-auto flex flex-col gap-2">
                    <textarea
                      id={`reject-note-${page.id}`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What's wrong with it?"
                      rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide(page, "rejected", note)}
                        disabled={!note.trim() || busy === page.id}
                        className="flex-1 py-1.5 text-xs rounded-lg font-medium text-white bg-red-600 disabled:bg-gray-200 disabled:text-gray-400"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setRejecting(null);
                          setNote("");
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex gap-2 pt-1">
                    <button
                      onClick={() =>
                        decide(page, page.decision === "approved" ? "pending" : "approved")
                      }
                      disabled={busy === page.id}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium border ${
                        page.decision === "approved"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-persimmon-navy border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {page.decision === "approved" ? "Approved" : "Approve"}
                    </button>
                    <button
                      onClick={() => {
                        setRejecting(page.id);
                        setNote(page.decision_note ?? "");
                      }}
                      disabled={busy === page.id}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${
                        page.decision === "rejected"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {page.decision === "rejected" ? "Rejected" : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pages.length === 0 && (
        <p className="text-sm text-gray-500">
          No proof built for this order yet. Run{" "}
          <code className="text-xs bg-persimmon-gray px-1.5 py-0.5 rounded">
            build_pack.py {orderNumber} --publish
          </code>
          .
        </p>
      )}

      {zoomed?.preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${zoomed.preview}`}
            alt={`${zoomed.code} — ${zoomed.name}`}
            className="max-w-full max-h-full object-contain bg-white rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
