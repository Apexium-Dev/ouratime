import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import styles from "./invoice.module.css";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  sort_order: number;
}

interface Invoice {
  id: string;
  number: string;
  client_name: string;
  client_email: string;
  client_address: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  notes: string;
  currency: string;
  tax_rate: number;
  from_name: string;
  from_email: string;
  invoice_items: InvoiceItem[];
  profiles: { full_name: string | null; email: string | null } | null;
}

function fmt(n: number, currency = "USD") {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n); }
  catch { return `${currency} ${n.toFixed(2)}`; }
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  draft: "status_draft", sent: "status_sent", paid: "status_paid", overdue: "status_overdue",
};

export default async function PublicInvoicePage({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), profiles(full_name, email)")
    .eq("id", params.id)
    .single();

  if (!data || data.status === "draft") notFound();

  const inv = data as Invoice;
  const items = [...inv.invoice_items].sort((a, b) => a.sort_order - b.sort_order);
  const sub   = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax   = sub * (inv.tax_rate / 100);
  const total = sub + tax;

  const STATUS_LABEL: Record<string, string> = { sent: "Sent", paid: "Paid", overdue: "Overdue" };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.invLabel}>INVOICE</div>
            <div className={styles.invNum}>{inv.number}</div>
            <span className={`${styles.badge} ${styles[STATUS_STYLES[inv.status] ?? "status_sent"]}`}>
              {STATUS_LABEL[inv.status] ?? inv.status}
            </span>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.metaRow}><span>Issued</span><span>{fmtDate(inv.issue_date)}</span></div>
            {inv.due_date && <div className={styles.metaRow}><span>Due</span><span>{fmtDate(inv.due_date)}</span></div>}
          </div>
        </div>

        {/* Parties */}
        <div className={styles.parties}>
          {(inv.from_name || inv.profiles?.full_name) && (
            <div className={styles.party}>
              <div className={styles.partyLabel}>From</div>
              <div className={styles.partyName}>{inv.from_name || inv.profiles?.full_name || "—"}</div>
              {(inv.from_email || inv.profiles?.email) && (
                <div className={styles.partySub}>{inv.from_email || inv.profiles?.email}</div>
              )}
            </div>
          )}
          {inv.client_name && (
            <div className={styles.party}>
              <div className={styles.partyLabel}>Bill to</div>
              <div className={styles.partyName}>{inv.client_name}</div>
              {inv.client_email  && <div className={styles.partySub}>{inv.client_email}</div>}
              {inv.client_address && <div className={styles.partySub} style={{ whiteSpace: "pre-line" }}>{inv.client_address}</div>}
            </div>
          )}
        </div>

        {/* Line items */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Description</th>
              <th className={styles.right}>Qty</th>
              <th className={styles.right}>Rate</th>
              <th className={styles.right}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className={styles.empty}>No items</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td>{item.description || "—"}</td>
                <td className={styles.right}>{item.quantity}</td>
                <td className={styles.right}>{fmt(item.rate, inv.currency)}</td>
                <td className={styles.right}>{fmt(item.quantity * item.rate, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className={styles.totals}>
          <div className={styles.totalRow}><span>Subtotal</span><span>{fmt(sub, inv.currency)}</span></div>
          {inv.tax_rate > 0 && (
            <div className={styles.totalRow}><span>Tax ({inv.tax_rate}%)</span><span>{fmt(tax, inv.currency)}</span></div>
          )}
          <div className={`${styles.totalRow} ${styles.grandTotal}`}>
            <span>Total due</span><span>{fmt(total, inv.currency)}</span>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className={styles.notes}>
            <div className={styles.notesLabel}>Notes</div>
            <div className={styles.notesText}>{inv.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          Generated with OuraTime
        </div>

      </div>
    </div>
  );
}
