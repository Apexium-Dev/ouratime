"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./editor.module.css";

/* ─── Types ─────────────────────────────────────────── */
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  sort_order: number;
  _new?: boolean;
}

interface Invoice {
  id: string;
  number: string;
  from_name: string;
  from_email: string;
  client_name: string;
  client_email: string;
  client_address: string;
  status: "draft" | "sent" | "paid" | "overdue";
  issue_date: string;
  due_date: string;
  notes: string;
  currency: string;
  tax_rate: number;
  invoice_items: InvoiceItem[];
}

interface TimeEntry {
  id: string;
  description: string;
  started_at: string;
  stopped_at: string | null;
  duration: number | null;
  project_id: string | null;
  projects: { name: string; color: string } | null;
}

const CURRENCIES = ["USD","EUR","GBP","CAD","AUD","JPY","CHF","CNY","SEK","NOK","DKK","PLN","CZK","HUF","RON","BGN","HRK","RSD","UAH","TRY","BRL","MXN","ARS","CLP","COP","PEN","UYU","ZAR","EGP","NGN","KES","GHS","INR","PKR","BDT","LKR","NPR","THB","VND","IDR","MYR","PHP","SGD","HKD","TWD","KRW","AED","SAR","QAR","KWD","BHD","OMR","JOD","ILS","MAD","TND"];

function fmt(n: number, currency = "USD") {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function secToHHMM(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function lineTotal(item: InvoiceItem) { return item.quantity * item.rate; }
function subtotal(items: InvoiceItem[]) { return items.reduce((s, i) => s + lineTotal(i), 0); }
function taxAmount(items: InvoiceItem[], rate: number) { return subtotal(items) * (rate / 100); }
function grandTotal(items: InvoiceItem[], rate: number) { return subtotal(items) + taxAmount(items, rate); }

/* ─── Component ─────────────────────────────────────── */
export default function InvoiceEditorPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Import modal */
  const [showImport, setShowImport] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);

  /* Status change */
  const [statusChanging, setStatusChanging] = useState(false);

  /* Copied link toast */
  const [copied, setCopied] = useState(false);

  /* ── Load invoice ── */
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", id)
        .single();
      if (!data) { router.push("/dashboard/invoices"); return; }
      const sorted = [...(data.invoice_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      setInv({ ...data, invoice_items: sorted });
      setLoading(false);
    }
    load();
  }, [id, router]);

  /* ── Auto-save helper ── */
  const saveInvoice = useCallback(async (patch: Partial<Invoice>) => {
    if (!inv) return;
    setSaving(true);
    await supabase.from("invoices").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }, [inv, id]);

  /* ── Field setters ── */
  function field<K extends keyof Invoice>(key: K, val: Invoice[K]) {
    setInv(prev => prev ? { ...prev, [key]: val } : prev);
  }

  /* ── Line items ── */
  function addItem() {
    setInv(prev => {
      if (!prev) return prev;
      const newItem: InvoiceItem = {
        id: crypto.randomUUID(), description: "", quantity: 1, rate: 0,
        sort_order: prev.invoice_items.length, _new: true,
      };
      return { ...prev, invoice_items: [...prev.invoice_items, newItem] };
    });
  }

  function updateItem(itemId: string, patch: Partial<InvoiceItem>) {
    setInv(prev => {
      if (!prev) return prev;
      return { ...prev, invoice_items: prev.invoice_items.map(i => i.id === itemId ? { ...i, ...patch } : i) };
    });
  }

  async function deleteItem(itemId: string, isNew?: boolean) {
    setInv(prev => {
      if (!prev) return prev;
      return { ...prev, invoice_items: prev.invoice_items.filter(i => i.id !== itemId) };
    });
    if (!isNew) await supabase.from("invoice_items").delete().eq("id", itemId);
  }

  /* ── Save full invoice (header + items) ── */
  async function handleSave() {
    if (!inv) return;
    setSaving(true);
    const { invoice_items, ...header } = inv;
    await supabase.from("invoices").update({ ...header, updated_at: new Date().toISOString() }).eq("id", id);

    for (const item of invoice_items) {
      const { _new, ...row } = item;
      if (_new) {
        await supabase.from("invoice_items").insert({ ...row, invoice_id: id });
        // clear _new flag
        setInv(prev => prev ? {
          ...prev,
          invoice_items: prev.invoice_items.map(i => i.id === item.id ? { ...i, _new: false } : i)
        } : prev);
      } else {
        await supabase.from("invoice_items").update(row).eq("id", item.id);
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  /* ── Status change ── */
  async function setStatus(status: Invoice["status"]) {
    if (!inv) return;
    setStatusChanging(true);
    await supabase.from("invoices").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setInv(prev => prev ? { ...prev, status } : prev);
    setStatusChanging(false);
  }

  /* ── Import time entries ── */
  async function openImport() {
    setImportLoading(true);
    setShowImport(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImportLoading(false); return; }
    const { data } = await supabase
      .from("time_entries")
      .select("id, description, started_at, stopped_at, duration, project_id, projects(name, color)")
      .eq("user_id", user.id)
      .not("stopped_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(200);
    setTimeEntries((data as unknown as TimeEntry[]) ?? []);
    setImportLoading(false);
  }

  function toggleEntry(entryId: string) {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  }

  async function confirmImport() {
    if (!inv || selectedEntries.size === 0) return;
    const toImport = timeEntries.filter(e => selectedEntries.has(e.id));

    // Group by project
    const groups = new Map<string, { label: string; entries: TimeEntry[] }>();
    for (const e of toImport) {
      const key = e.project_id ?? "__none__";
      const label = e.projects?.name ?? "No project";
      if (!groups.has(key)) groups.set(key, { label, entries: [] });
      groups.get(key)!.entries.push(e);
    }

    const newItems: InvoiceItem[] = [];
    let order = inv.invoice_items.length;
    for (const [, { label, entries }] of groups) {
      const totalSec = entries.reduce((s, e) => {
        if (e.duration) return s + e.duration;
        if (e.stopped_at) return s + Math.round((new Date(e.stopped_at).getTime() - new Date(e.started_at).getTime()) / 1000);
        return s;
      }, 0);
      const hours = Math.round(totalSec / 36) / 100; // 2 decimal places
      const item: InvoiceItem = {
        id: crypto.randomUUID(),
        description: label,
        quantity: hours,
        rate: 0,
        sort_order: order++,
        _new: true,
      };
      newItems.push(item);
    }

    setInv(prev => prev ? { ...prev, invoice_items: [...prev.invoice_items, ...newItems] } : prev);
    setSelectedEntries(new Set());
    setShowImport(false);
  }

  /* ── Copy share link ── */
  async function copyLink() {
    const url = `${window.location.origin}/invoice/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !inv) {
    return <div style={{ padding: "4rem", textAlign: "center", color: "#aaa" }}>Loading…</div>;
  }

  const sub = subtotal(inv.invoice_items);
  const tax = taxAmount(inv.invoice_items, inv.tax_rate);
  const total = grandTotal(inv.invoice_items, inv.tax_rate);

  return (
    <main className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <button className={styles.backBtn} onClick={() => router.push("/dashboard/invoices")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <h1 className={styles.invNum}>{inv.number}</h1>
            <span className={`${styles.statusBadge} ${styles["status_" + inv.status]}`}>
              {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
            </span>
          </div>
        </div>
        <div className={styles.topActions}>
          {(inv.status === "sent" || inv.status === "paid" || inv.status === "overdue") && (
            <button className={styles.linkBtn} onClick={copyLink}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              {copied ? "Copied!" : "Copy link"}
            </button>
          )}
          {inv.status === "draft" && (
            <button className={styles.actionBtn} disabled={statusChanging} onClick={() => setStatus("sent")}>
              Mark as Sent
            </button>
          )}
          {inv.status === "sent" && (
            <button className={`${styles.actionBtn} ${styles.paidBtn}`} disabled={statusChanging} onClick={() => setStatus("paid")}>
              Mark as Paid
            </button>
          )}
          {(inv.status === "sent" || inv.status === "overdue") && (
            <button className={`${styles.actionBtn} ${styles.overdueBtn}`} disabled={statusChanging} onClick={() => setStatus("overdue")}>
              Mark Overdue
            </button>
          )}
          {inv.status !== "draft" && (
            <button className={styles.ghostBtn} disabled={statusChanging} onClick={() => setStatus("draft")}>
              Revert to Draft
            </button>
          )}
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      <div className={styles.layout}>

        {/* ── LEFT: Edit form ── */}
        <div className={styles.formCol}>

          {/* From / sender */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>From (you)</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Your name</label>
                <input className={styles.input} value={inv.from_name} placeholder="Your name or business"
                  onChange={e => field("from_name", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Your email</label>
                <input className={styles.input} type="email" value={inv.from_email} placeholder="you@example.com"
                  onChange={e => field("from_email", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Client info */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Client</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Client name</label>
                <input className={styles.input} value={inv.client_name} placeholder="Acme Inc."
                  onChange={e => field("client_name", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.input} type="email" value={inv.client_email} placeholder="client@example.com"
                  onChange={e => field("client_email", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Address</label>
                <textarea className={styles.textarea} value={inv.client_address} rows={3}
                  placeholder="123 Main St, City, Country"
                  onChange={e => field("client_address", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Invoice details */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Details</h2>
            <div className={styles.detailsGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Issue date</label>
                <input className={styles.input} type="date" value={inv.issue_date}
                  onChange={e => field("issue_date", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Due date</label>
                <input className={styles.input} type="date" value={inv.due_date ?? ""}
                  onChange={e => field("due_date", e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Currency</label>
                <select className={styles.select} value={inv.currency}
                  onChange={e => field("currency", e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Tax rate (%)</label>
                <input className={styles.input} type="number" min="0" max="100" step="0.01"
                  value={inv.tax_rate}
                  onChange={e => field("tax_rate", parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className={styles.card}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>Line items</h2>
              <button className={styles.importBtn} onClick={openImport}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Import from time
              </button>
            </div>
            <div className={styles.itemsHead}>
              <span>Description</span><span>Qty</span><span>Rate</span><span>Total</span><span/>
            </div>
            {inv.invoice_items.length === 0 && (
              <div className={styles.itemsEmpty}>No items yet. Add one below.</div>
            )}
            {inv.invoice_items.map(item => (
              <div key={item.id} className={styles.itemRow}>
                <input className={styles.itemDesc} placeholder="Service description"
                  value={item.description}
                  onChange={e => updateItem(item.id, { description: e.target.value })} />
                <input className={styles.itemNum} type="number" min="0" step="0.01"
                  value={item.quantity}
                  onChange={e => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })} />
                <input className={styles.itemNum} type="number" min="0" step="0.01"
                  value={item.rate}
                  onChange={e => updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })} />
                <span className={styles.itemTotal}>{fmt(lineTotal(item), inv.currency)}</span>
                <button className={styles.deleteItemBtn} onClick={() => deleteItem(item.id, item._new)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            <button className={styles.addItemBtn} onClick={addItem}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add item
            </button>
          </section>

          {/* Notes */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Notes</h2>
            <textarea className={styles.textarea} rows={4} value={inv.notes}
              placeholder="Payment terms, bank details, thank-you note…"
              onChange={e => field("notes", e.target.value)} />
          </section>

        </div>

        {/* ── RIGHT: Preview ── */}
        <div className={styles.previewCol}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <div>
                <div className={styles.previewInvLabel}>INVOICE</div>
                <div className={styles.previewInvNum}>{inv.number}</div>
              </div>
              <div className={styles.previewMeta}>
                <div className={styles.previewMetaRow}>
                  <span>Issued</span><span>{fmtDate(inv.issue_date)}</span>
                </div>
                {inv.due_date && (
                  <div className={styles.previewMetaRow}>
                    <span>Due</span><span>{fmtDate(inv.due_date)}</span>
                  </div>
                )}
                <div className={`${styles.previewMetaRow} ${styles["pstatus_" + inv.status]}`}>
                  <span>Status</span><span>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                </div>
              </div>
            </div>

            <div className={styles.previewParties}>
              {inv.from_name && (
                <div className={styles.previewBillTo}>
                  <div className={styles.previewBillLabel}>From</div>
                  <div className={styles.previewBillName}>{inv.from_name}</div>
                  {inv.from_email && <div className={styles.previewBillSub}>{inv.from_email}</div>}
                </div>
              )}
              {inv.client_name && (
                <div className={styles.previewBillTo}>
                  <div className={styles.previewBillLabel}>Bill to</div>
                  <div className={styles.previewBillName}>{inv.client_name}</div>
                  {inv.client_email && <div className={styles.previewBillSub}>{inv.client_email}</div>}
                  {inv.client_address && <div className={styles.previewBillSub} style={{ whiteSpace: "pre-line" }}>{inv.client_address}</div>}
                </div>
              )}
            </div>

            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className={styles.right}>Qty</th>
                  <th className={styles.right}>Rate</th>
                  <th className={styles.right}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.invoice_items.length === 0 ? (
                  <tr><td colSpan={4} className={styles.previewEmpty}>No items</td></tr>
                ) : inv.invoice_items.map(item => (
                  <tr key={item.id}>
                    <td>{item.description || <span className={styles.placeholder}>–</span>}</td>
                    <td className={styles.right}>{item.quantity}</td>
                    <td className={styles.right}>{fmt(item.rate, inv.currency)}</td>
                    <td className={styles.right}>{fmt(lineTotal(item), inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.previewTotals}>
              <div className={styles.previewTotalRow}>
                <span>Subtotal</span><span>{fmt(sub, inv.currency)}</span>
              </div>
              {inv.tax_rate > 0 && (
                <div className={styles.previewTotalRow}>
                  <span>Tax ({inv.tax_rate}%)</span><span>{fmt(tax, inv.currency)}</span>
                </div>
              )}
              <div className={`${styles.previewTotalRow} ${styles.grandTotal}`}>
                <span>Total</span><span>{fmt(total, inv.currency)}</span>
              </div>
            </div>

            {inv.notes && (
              <div className={styles.previewNotes}>
                <div className={styles.previewNotesLabel}>Notes</div>
                <div className={styles.previewNotesText}>{inv.notes}</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Import modal ── */}
      {showImport && (
        <div className={styles.overlay} onClick={() => setShowImport(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Import from time entries</h3>
              <button className={styles.modalClose} onClick={() => setShowImport(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {importLoading ? (
              <div className={styles.modalLoading}>Loading entries…</div>
            ) : timeEntries.length === 0 ? (
              <div className={styles.modalEmpty}>No tracked time entries found.</div>
            ) : (
              <>
                <div className={styles.modalSubtitle}>
                  Selected entries will be grouped by project and added as line items.
                </div>
                <div className={styles.entryList}>
                  {timeEntries.map(e => {
                    const dur = e.duration ?? (e.stopped_at ? Math.round((new Date(e.stopped_at).getTime() - new Date(e.started_at).getTime()) / 1000) : 0);
                    const checked = selectedEntries.has(e.id);
                    return (
                      <label key={e.id} className={`${styles.entryRow} ${checked ? styles.entryChecked : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleEntry(e.id)} className={styles.entryCheckbox} />
                        {e.projects && (
                          <span className={styles.entryDot} style={{ background: e.projects.color || "#aaa" }} />
                        )}
                        <span className={styles.entryDesc}>{e.description || "No description"}</span>
                        <span className={styles.entryProject}>{e.projects?.name ?? "No project"}</span>
                        <span className={styles.entryDur}>{secToHHMM(dur)}</span>
                      </label>
                    );
                  })}
                </div>
                <div className={styles.modalFooter}>
                  <span className={styles.selectedCount}>{selectedEntries.size} selected</span>
                  <button className={styles.ghostBtn} onClick={() => setShowImport(false)}>Cancel</button>
                  <button className={styles.saveBtn} disabled={selectedEntries.size === 0} onClick={confirmImport}>
                    Import {selectedEntries.size > 0 ? `(${selectedEntries.size})` : ""}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
