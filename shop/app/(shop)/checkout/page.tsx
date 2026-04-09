"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "@/components/BasketContext";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Site {
  id: string;
  name: string;
  address: string;
}

interface Purchaser {
  id: string;
  name: string;
  email: string;
}

export default function CheckoutPage() {
  const { items, totalPrice, deliveryFee, clearBasket } = useBasket();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Saved records
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // "Add new" form state
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewSite, setShowNewSite] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [savingSite, setSavingSite] = useState(false);

  // Manage modals
  const [manageContacts, setManageContacts] = useState(false);
  const [manageSites, setManageSites] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editContactForm, setEditContactForm] = useState({ name: "", email: "", phone: "" });
  const [editSiteForm, setEditSiteForm] = useState({ name: "", address: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Purchasers
  const [purchasers, setPurchasers] = useState<Purchaser[]>([]);
  const [selectedPurchaser, setSelectedPurchaser] = useState<Purchaser | null>(null);
  const [showNewPurchaser, setShowNewPurchaser] = useState(false);
  const [newPurchaser, setNewPurchaser] = useState({ name: "", email: "" });
  const [savingPurchaser, setSavingPurchaser] = useState(false);
  const [managePurchasers, setManagePurchasers] = useState(false);
  const [editingPurchaser, setEditingPurchaser] = useState<Purchaser | null>(null);
  const [editPurchaserForm, setEditPurchaserForm] = useState({ name: "", email: "" });

  // Free-text fields
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch contacts and sites on mount
  useEffect(() => {
    fetch("/api/contacts").then((r) => r.json()).then((d) => setContacts(d.contacts || [])).catch(() => {});
    fetch("/api/sites").then((r) => r.json()).then((d) => setSites(d.sites || [])).catch(() => {});
    fetch("/api/purchasers").then((r) => r.json()).then((d) => setPurchasers(d.purchasers || [])).catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-persimmon-navy mb-2">Nothing to checkout</h1>
        <p className="text-gray-400 mb-8">Add some items to your basket first.</p>
        <Link href="/" className="inline-block bg-persimmon-green text-white px-8 py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition">
          Browse Products
        </Link>
      </div>
    );
  }

  const canSubmit = selectedContact && selectedSite && selectedPurchaser && !submitting;

  const handleContactSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") { setSelectedContact(null); setShowNewContact(true); return; }
    if (val === "__manage__") { setManageContacts(true); e.target.value = selectedContact?.id || ""; return; }
    setShowNewContact(false);
    setSelectedContact(contacts.find((c) => c.id === val) || null);
  };

  const handleSiteSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") { setSelectedSite(null); setShowNewSite(true); return; }
    if (val === "__manage__") { setManageSites(true); e.target.value = selectedSite?.id || ""; return; }
    setShowNewSite(false);
    setSelectedSite(sites.find((s) => s.id === val) || null);
  };

  const startEditContact = (c: Contact) => {
    setEditingContact(c);
    setEditContactForm({ name: c.name, email: c.email, phone: c.phone });
  };

  const saveEditContact = async () => {
    if (!editingContact) return;
    if (!editContactForm.name.trim() || !editContactForm.email.trim() || !editContactForm.phone.trim()) { alert("All fields are required."); return; }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/contacts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingContact.id, ...editContactForm }) });
      if (res.ok) {
        const updated: Contact = await res.json();
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (selectedContact?.id === updated.id) setSelectedContact(updated);
        setEditingContact(null);
      }
    } catch { /* ignore */ }
    setSavingEdit(false);
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Remove this contact? Orders placed with this contact will keep their data.")) return;
    try {
      const res = await fetch("/api/contacts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) {
        setContacts((prev) => prev.filter((c) => c.id !== id));
        if (selectedContact?.id === id) setSelectedContact(null);
        if (editingContact?.id === id) setEditingContact(null);
      }
    } catch { /* ignore */ }
  };

  const startEditSite = (s: Site) => {
    setEditingSite(s);
    setEditSiteForm({ name: s.name, address: s.address });
  };

  const saveEditSite = async () => {
    if (!editingSite) return;
    if (!editSiteForm.name.trim() || !editSiteForm.address.trim()) { alert("All fields are required."); return; }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/sites", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingSite.id, ...editSiteForm }) });
      if (res.ok) {
        const updated: Site = await res.json();
        setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        if (selectedSite?.id === updated.id) setSelectedSite(updated);
        setEditingSite(null);
      }
    } catch { /* ignore */ }
    setSavingEdit(false);
  };

  const deleteSite = async (id: string) => {
    if (!confirm("Remove this site? Orders placed with this site will keep their data.")) return;
    try {
      const res = await fetch("/api/sites", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) {
        setSites((prev) => prev.filter((s) => s.id !== id));
        if (selectedSite?.id === id) setSelectedSite(null);
        if (editingSite?.id === id) setEditingSite(null);
      }
    } catch { /* ignore */ }
  };

  const handlePurchaserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__new__") { setSelectedPurchaser(null); setShowNewPurchaser(true); return; }
    if (val === "__manage__") { setManagePurchasers(true); e.target.value = selectedPurchaser?.id || ""; return; }
    setShowNewPurchaser(false);
    setSelectedPurchaser(purchasers.find((p) => p.id === val) || null);
  };

  const startEditPurchaser = (p: Purchaser) => {
    setEditingPurchaser(p);
    setEditPurchaserForm({ name: p.name, email: p.email });
  };

  const saveEditPurchaser = async () => {
    if (!editingPurchaser) return;
    if (!editPurchaserForm.name.trim() || !editPurchaserForm.email.trim()) { alert("All fields are required."); return; }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/purchasers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingPurchaser.id, ...editPurchaserForm }) });
      if (res.ok) {
        const updated: Purchaser = await res.json();
        setPurchasers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        if (selectedPurchaser?.id === updated.id) setSelectedPurchaser(updated);
        setEditingPurchaser(null);
      }
    } catch { /* ignore */ }
    setSavingEdit(false);
  };

  const deletePurchaser = async (id: string) => {
    if (!confirm("Remove this purchaser? Orders placed with this purchaser will keep their data.")) return;
    try {
      const res = await fetch("/api/purchasers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) {
        setPurchasers((prev) => prev.filter((p) => p.id !== id));
        if (selectedPurchaser?.id === id) setSelectedPurchaser(null);
        if (editingPurchaser?.id === id) setEditingPurchaser(null);
      }
    } catch { /* ignore */ }
  };

  const saveNewPurchaser = async () => {
    if (!newPurchaser.name.trim() || !newPurchaser.email.trim()) {
      alert("Please fill in all purchaser fields.");
      return;
    }
    setSavingPurchaser(true);
    try {
      const res = await fetch("/api/purchasers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPurchaser),
      });
      if (res.ok) {
        const saved: Purchaser = await res.json();
        setPurchasers((prev) => {
          const exists = prev.some((p) => p.id === saved.id);
          const updated = exists ? prev : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
          return updated;
        });
        setSelectedPurchaser(saved);
        setShowNewPurchaser(false);
        setNewPurchaser({ name: "", email: "" });
      }
    } catch { /* ignore */ }
    setSavingPurchaser(false);
  };

  const saveNewContact = async () => {
    if (!newContact.name.trim() || !newContact.email.trim() || !newContact.phone.trim()) {
      alert("Please fill in all contact fields.");
      return;
    }
    setSavingContact(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });
      if (res.ok) {
        const saved: Contact = await res.json();
        setContacts((prev) => {
          const exists = prev.some((c) => c.id === saved.id);
          const updated = exists ? prev : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
          return updated;
        });
        setSelectedContact(saved);
        setShowNewContact(false);
        setNewContact({ name: "", email: "", phone: "" });
      }
    } catch { /* ignore */ }
    setSavingContact(false);
  };

  const saveNewSite = async () => {
    if (!newSite.name.trim() || !newSite.address.trim()) {
      alert("Please fill in all site fields.");
      return;
    }
    setSavingSite(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSite),
      });
      if (res.ok) {
        const saved: Site = await res.json();
        setSites((prev) => {
          const exists = prev.some((s) => s.id === saved.id);
          const updated = exists ? prev : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
          return updated;
        });
        setSelectedSite(saved);
        setShowNewSite(false);
        setNewSite({ name: "", address: "" });
      }
    } catch { /* ignore */ }
    setSavingSite(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: selectedContact.name,
          email: selectedContact.email,
          phone: selectedContact.phone,
          siteName: selectedSite.name,
          siteAddress: selectedSite.address,
          contactId: selectedContact.id,
          siteId: selectedSite.id,
          purchaserName: selectedPurchaser!.name,
          purchaserEmail: selectedPurchaser!.email,
          purchaserId: selectedPurchaser!.id,
          poNumber,
          notes,
          items: items.map((item) => ({
            code: item.code,
            baseCode: item.baseCode,
            name: item.name,
            size: item.size,
            material: item.material,
            description: item.description,
            price: item.price,
            quantity: item.quantity,
            ...(item.customSign ? { customSign: item.customSign } : {}),
            ...(item.customFieldValues ? { customFieldValues: item.customFieldValues } : {}),
            ...(item.customSizeData ? { customSizeData: item.customSizeData } : {}),
            ...(item.customQuote ? { customQuote: item.customQuote } : {}),
          })),
          subtotal: totalPrice,
          deliveryFee,
          vat: (totalPrice + deliveryFee) * 0.2,
          total: (totalPrice + deliveryFee) * 1.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        clearBasket();
        router.push(`/order-confirmation?order=${data.orderNumber}`);
      } else {
        alert("Failed to submit order. Please try again.");
      }
    } catch {
      alert("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white appearance-none cursor-pointer";
  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-persimmon-green/15 focus:border-persimmon-green outline-none transition bg-white";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/basket" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-persimmon-green transition mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to basket
      </Link>
      <h1 className="text-2xl font-bold text-persimmon-navy mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6 min-w-0">

          {/* Contact section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Contact Details <span className="text-red-400">*</span></h2>
            <select value={selectedContact?.id || (showNewContact ? "__new__" : "")} onChange={handleContactSelect} className={selectClass}>
              <option value="" disabled>Select a contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
              <option value="__new__">+ Add new contact</option>
              {contacts.length > 0 && <option value="__manage__">Manage contacts...</option>}
            </select>

            {selectedContact && !showNewContact && (
              <div className="mt-3 px-1 text-sm text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-700">{selectedContact.name}</p>
                <p>{selectedContact.email}</p>
                <p>{selectedContact.phone}</p>
              </div>
            )}

            {showNewContact && (
              <div className="mt-4 border-2 border-dashed border-persimmon-green rounded-xl p-4 bg-emerald-50/30">
                <p className="text-sm font-semibold text-persimmon-navy mb-3">New Contact</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <input type="text" placeholder="Name *" value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                  <input type="email" placeholder="Email *" value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                  <input type="tel" placeholder="Phone *" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => { setShowNewContact(false); setNewContact({ name: "", email: "", phone: "" }); }} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                  <button type="button" onClick={saveNewContact} disabled={savingContact} className="px-4 py-2 text-sm text-white bg-persimmon-green rounded-lg font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50">{savingContact ? "Saving..." : "Save Contact"}</button>
                </div>
              </div>
            )}
          </div>

          {/* Site section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Site Details <span className="text-red-400">*</span></h2>
            <select value={selectedSite?.id || (showNewSite ? "__new__" : "")} onChange={handleSiteSelect} className={selectClass}>
              <option value="" disabled>Select a site...</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__new__">+ Add new site</option>
              {sites.length > 0 && <option value="__manage__">Manage sites...</option>}
            </select>

            {selectedSite && !showNewSite && (
              <div className="mt-3 px-1 text-sm text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-700">{selectedSite.name}</p>
                <p>{selectedSite.address}</p>
              </div>
            )}

            {showNewSite && (
              <div className="mt-4 border-2 border-dashed border-persimmon-green rounded-xl p-4 bg-emerald-50/30">
                <p className="text-sm font-semibold text-persimmon-navy mb-3">New Site</p>
                <div className="space-y-3">
                  <input type="text" placeholder="Site Name *" value={newSite.name} onChange={(e) => setNewSite((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                  <textarea placeholder="Site Address *" value={newSite.address} onChange={(e) => setNewSite((p) => ({ ...p, address: e.target.value }))} rows={2} className={inputClass} />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => { setShowNewSite(false); setNewSite({ name: "", address: "" }); }} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                  <button type="button" onClick={saveNewSite} disabled={savingSite} className="px-4 py-2 text-sm text-white bg-persimmon-green rounded-lg font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50">{savingSite ? "Saving..." : "Save Site"}</button>
                </div>
              </div>
            )}
          </div>

          {/* Purchaser section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-1">Purchaser <span className="text-red-400">*</span></h2>
            <p className="text-xs text-gray-400 mb-4">The person responsible for raising the purchase order.</p>
            <select value={selectedPurchaser?.id || (showNewPurchaser ? "__new__" : "")} onChange={handlePurchaserSelect} className={selectClass}>
              <option value="" disabled>Select a purchaser...</option>
              {purchasers.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
              ))}
              <option value="__new__">+ Add new purchaser</option>
              {purchasers.length > 0 && <option value="__manage__">Manage purchasers...</option>}
            </select>

            {selectedPurchaser && !showNewPurchaser && (
              <div className="mt-3 px-1 text-sm text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-700">{selectedPurchaser.name}</p>
                <p>{selectedPurchaser.email}</p>
              </div>
            )}

            {showNewPurchaser && (
              <div className="mt-4 border-2 border-dashed border-persimmon-green rounded-xl p-4 bg-emerald-50/30">
                <p className="text-sm font-semibold text-persimmon-navy mb-3">New Purchaser</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Name *" value={newPurchaser.name} onChange={(e) => setNewPurchaser((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                  <input type="email" placeholder="Email *" value={newPurchaser.email} onChange={(e) => setNewPurchaser((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button type="button" onClick={() => { setShowNewPurchaser(false); setNewPurchaser({ name: "", email: "" }); }} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                  <button type="button" onClick={saveNewPurchaser} disabled={savingPurchaser} className="px-4 py-2 text-sm text-white bg-persimmon-green rounded-lg font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50">{savingPurchaser ? "Saving..." : "Save Purchaser"}</button>
                </div>
              </div>
            )}
          </div>

          {/* PO Number & Notes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-persimmon-navy mb-5">Order Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">PO Number</label>
                <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className={inputClass} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Special Instructions</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="Any special requirements or notes..." />
              </div>
            </div>
          </div>
        </div>

        {/* Order summary sidebar */}
        <div className="min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
            <h2 className="text-base font-semibold text-persimmon-navy mb-4">Order Summary</h2>

            <div className="space-y-2.5 mb-4 max-h-60 overflow-y-auto">
              {items.map((item) => (
                <div key={item.code} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 truncate mr-2">
                      {item.customSign ? "Custom Sign" : item.customQuote ? "Custom Item (Quote)" : item.customSizeData?.requiresQuote ? "Custom Size (Quote)" : item.code} x{item.quantity}
                    </span>
                    {item.customSign || item.customSizeData?.requiresQuote || !!item.customQuote ? (
                      <span className="font-medium text-amber-600 shrink-0 text-xs">Quote</span>
                    ) : (
                      <span className="font-medium text-gray-700 shrink-0">
                        {"\u00A3"}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.customFieldValues && item.customFieldValues.length > 0 && (
                    <div className="ml-1 mt-0.5">
                      {item.customFieldValues.map((f) => (
                        <p key={f.key} className="text-[11px] text-persimmon-green truncate">
                          {f.label}: <span className="text-gray-400">{f.value}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>{"\u00A3"}{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Delivery</span>
                {deliveryFee > 0 ? (
                  <span>{"\u00A3"}{deliveryFee.toFixed(2)}</span>
                ) : (
                  <span className="text-persimmon-green font-medium">FREE</span>
                )}
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>VAT (20%)</span>
                <span>{"\u00A3"}{((totalPrice + deliveryFee) * 0.2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-persimmon-navy pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>{"\u00A3"}{((totalPrice + deliveryFee) * 1.2).toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full mt-6 bg-persimmon-green text-white py-3 rounded-xl font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {submitting ? "Submitting Order..." : "Submit Order"}
            </button>

            {!selectedContact && !showNewContact && (
              <p className="text-[11px] text-amber-600 mt-3 text-center">Please select or add a contact to continue.</p>
            )}
            {!selectedSite && !showNewSite && selectedContact && (
              <p className="text-[11px] text-amber-600 mt-3 text-center">Please select or add a site to continue.</p>
            )}

            <p className="text-[11px] text-gray-400 mt-3 text-center leading-relaxed">
              All prices exclude VAT. You will receive a confirmation email.
            </p>
            {items.some((i) => i.customSign || i.customSizeData?.requiresQuote || !!i.customQuote) && (
              <p className="text-[11px] text-amber-600 mt-2 text-center leading-relaxed">
                Items requiring a quote will be priced separately after review.
              </p>
            )}
          </div>
        </div>
      </form>

      {/* Manage Contacts Modal */}
      {manageContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setManageContacts(false); setEditingContact(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-persimmon-navy">Manage Contacts</h2>
              <button onClick={() => { setManageContacts(false); setEditingContact(null); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {contacts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No contacts yet.</p>
              ) : (
                <div className="space-y-3">
                  {contacts.map((c) => (
                    <div key={c.id}>
                      {editingContact?.id === c.id ? (
                        <div className="border-2 border-persimmon-green rounded-xl p-4 bg-emerald-50/30">
                          <div className="grid sm:grid-cols-3 gap-3 mb-3">
                            <input type="text" value={editContactForm.name} onChange={(e) => setEditContactForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className={inputClass} />
                            <input type="email" value={editContactForm.email} onChange={(e) => setEditContactForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className={inputClass} />
                            <input type="tel" value={editContactForm.phone} onChange={(e) => setEditContactForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className={inputClass} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingContact(null)} className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                            <button type="button" onClick={saveEditContact} disabled={savingEdit} className="px-3 py-1.5 text-sm text-white bg-persimmon-green rounded-lg font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50">{savingEdit ? "Saving..." : "Save"}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-persimmon-navy">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email} · {c.phone}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <button type="button" onClick={() => startEditContact(c)} className="px-2.5 py-1 text-xs text-persimmon-green border border-persimmon-green/30 rounded-lg hover:bg-persimmon-green/5 transition">Edit</button>
                            <button type="button" onClick={() => deleteContact(c.id)} className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Sites Modal */}
      {manageSites && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setManageSites(false); setEditingSite(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-persimmon-navy">Manage Sites</h2>
              <button onClick={() => { setManageSites(false); setEditingSite(null); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {sites.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No sites yet.</p>
              ) : (
                <div className="space-y-3">
                  {sites.map((s) => (
                    <div key={s.id}>
                      {editingSite?.id === s.id ? (
                        <div className="border-2 border-persimmon-green rounded-xl p-4 bg-emerald-50/30">
                          <div className="space-y-3 mb-3">
                            <input type="text" value={editSiteForm.name} onChange={(e) => setEditSiteForm((p) => ({ ...p, name: e.target.value }))} placeholder="Site Name" className={inputClass} />
                            <textarea value={editSiteForm.address} onChange={(e) => setEditSiteForm((p) => ({ ...p, address: e.target.value }))} placeholder="Site Address" rows={2} className={inputClass} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingSite(null)} className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                            <button type="button" onClick={saveEditSite} disabled={savingEdit} className="px-3 py-1.5 text-sm text-white bg-persimmon-green rounded-lg font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50">{savingEdit ? "Saving..." : "Save"}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-persimmon-navy">{s.name}</p>
                            <p className="text-xs text-gray-400 truncate">{s.address}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <button type="button" onClick={() => startEditSite(s)} className="px-2.5 py-1 text-xs text-persimmon-green border border-persimmon-green/30 rounded-lg hover:bg-persimmon-green/5 transition">Edit</button>
                            <button type="button" onClick={() => deleteSite(s.id)} className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Manage Purchasers Modal */}
      {managePurchasers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setManagePurchasers(false); setEditingPurchaser(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-persimmon-navy">Manage Purchasers</h2>
              <button onClick={() => { setManagePurchasers(false); setEditingPurchaser(null); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {purchasers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No purchasers yet.</p>
              ) : (
                <div className="space-y-3">
                  {purchasers.map((p) => (
                    <div key={p.id}>
                      {editingPurchaser?.id === p.id ? (
                        <div className="border-2 border-persimmon-green rounded-xl p-4 bg-emerald-50/30">
                          <div className="grid sm:grid-cols-2 gap-3 mb-3">
                            <input type="text" value={editPurchaserForm.name} onChange={(e) => setEditPurchaserForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" className={inputClass} />
                            <input type="email" value={editPurchaserForm.email} onChange={(e) => setEditPurchaserForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className={inputClass} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingPurchaser(null)} className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                            <button type="button" onClick={saveEditPurchaser} disabled={savingEdit} className="px-3 py-1.5 text-sm text-white bg-persimmon-green rounded-lg font-medium hover:bg-persimmon-green-dark transition disabled:opacity-50">{savingEdit ? "Saving..." : "Save"}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-persimmon-navy">{p.name}</p>
                            <p className="text-xs text-gray-400 truncate">{p.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            <button type="button" onClick={() => startEditPurchaser(p)} className="px-2.5 py-1 text-xs text-persimmon-green border border-persimmon-green/30 rounded-lg hover:bg-persimmon-green/5 transition">Edit</button>
                            <button type="button" onClick={() => deletePurchaser(p.id)} className="px-2.5 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
