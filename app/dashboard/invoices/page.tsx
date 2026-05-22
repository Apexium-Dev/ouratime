"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./invoices.module.css";

interface Invoice {
  id: string;
  number: string;
  client_name: string;
  client_email: string;
  status: "draft" | "sent" | "paid" | "overdue";
  issue_date: string;
  due_date: string | null;
  currency: string;
  tax_rate: number;
  invoice_items: { quantity: number; rate: number }[];
}

type Filter = "all" | "draft" | "sent" | "paid" | "overdue";

function invoiceTotal(inv: Invoice) {
  const sub = inv.invoice_items.reduce((s, i) => s + i.quantity * i.rate, 0);
  return sub + sub * (inv.tax_rate / 100);
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    n,
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("invoices")
        .select(
          "id, number, client_name, client_email, status, issue_date, due_date, currency, tax_rate, invoice_items(quantity, rate)",
        )
        .order("created_at", { ascending: false });
      setInvoices((data as Invoice[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const handleNew = async () => {
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    const number = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data, error } = await supabase
      .from("invoices")
      .insert({ user_id: user.id, number })
      .select("id")
      .single();

    setCreating(false);
    if (!error && data) router.push(`/dashboard/invoices/${data.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (!error) setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  const filtered =
    filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const totalInvoiced = invoices
    .filter((i) => i.status !== "draft")
    .reduce((s, i) => s + invoiceTotal(i), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + invoiceTotal(i), 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + invoiceTotal(i), 0);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "paid", label: "Paid" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <main className={styles.page}>
      {/* Header */}
      <div className={styles.topBar}>
        <h1 className={styles.title}>Invoices</h1>
        <button
          className={styles.newBtn}
          onClick={handleNew}
          disabled={creating}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {creating ? "Creating…" : "New invoice"}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <p className={styles.statLbl}>Total invoiced</p>
          <p className={`${styles.statVal} ${styles.teal}`}>
            {fmt(totalInvoiced)}
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLbl}>Paid</p>
          <p className={styles.statVal}>{fmt(totalPaid)}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLbl}>Outstanding</p>
          <p
            className={`${styles.statVal} ${outstanding > 0 ? styles.orange : ""}`}
          >
            {fmt(outstanding)}
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLbl}>Total invoices</p>
          <p className={styles.statVal}>{invoices.length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filterTabs}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.filterTab} ${filter === f.key ? styles.filterTabActive : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== "all" && (
              <span className={styles.filterCount}>
                {invoices.filter((i) => i.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ddd"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p>
            {filter === "all" ? "No invoices yet." : `No ${filter} invoices.`}
          </p>
          {filter === "all" && (
            <p>Click &quot;New invoice&quot; to create your first one.</p>
          )}
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Invoice #</span>
            <span>Client</span>
            <span>Issued</span>
            <span>Due</span>
            <span style={{ textAlign: "right" }}>Amount</span>
            <span>Status</span>
            <span />
          </div>
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className={styles.tableRow}
              onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
            >
              <span className={styles.invNumber}>{inv.number}</span>
              <div className={styles.clientCell}>
                <span className={styles.clientName}>
                  {inv.client_name || "—"}
                </span>
                {inv.client_email && (
                  <span className={styles.clientEmail}>{inv.client_email}</span>
                )}
              </div>
              <span className={styles.dateCell}>{fmtDate(inv.issue_date)}</span>
              <span
                className={`${styles.dateCell} ${inv.due_date && new Date(inv.due_date) < new Date() && inv.status === "sent" ? styles.overdue : ""}`}
              >
                {fmtDate(inv.due_date)}
              </span>
              <span className={styles.amountCell}>
                {fmt(invoiceTotal(inv), inv.currency)}
              </span>
              <span
                className={`${styles.statusBadge} ${styles["status_" + inv.status]}`}
              >
                {STATUS_LABEL[inv.status]}
              </span>
              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(e, inv.id)}
                title="Delete invoice"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
