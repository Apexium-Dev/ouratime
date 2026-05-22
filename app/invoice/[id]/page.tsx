import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import styles from "./invoice.module.css";
import { PrintButton } from "./PrintButton";

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
  purchase_order: string;
  payment_terms: string;
  pay_to: string;
  logo_url: string;
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
const STATUS_LABEL: Record<string, string> = { sent: "Sent", paid: "Paid", overdue: "Overdue" };

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

  const fromName = inv.from_name || inv.profiles?.full_name || null;
  const fromEmail = inv.from_email || inv.profiles?.email || null;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <PrintButton />
      </div>

      <div className={styles.card}>

        {/* ── Logo + top strip ── */}
        <div className={styles.topStrip}>
          <div>
            {inv.logo_url && <img src={inv.logo_url} alt="Logo" className={styles.logo} />}
            <span className={styles.fromCompany}>{fromName ?? ""}</span>
          </div>
          <span className={styles.invNumberTop}>{inv.number}</span>
        </div>

        {/* ── Big heading ── */}
        <h1 className={styles.heading}>INVOICE</h1>

        {/* ── Date / due / status ── */}
        <div className={styles.metaBlock}>
          <div className={styles.metaLine}>
            <strong>Date:</strong>{fmtDate(inv.issue_date)}
            <span className={`${styles.badge} ${styles[STATUS_STYLES[inv.status] ?? "status_sent"]}`}>
              {STATUS_LABEL[inv.status] ?? inv.status}
            </span>
          </div>
          {inv.due_date && (
            <div className={styles.metaLine}>
              <strong>Due:</strong>{fmtDate(inv.due_date)}
            </div>
          )}
          {inv.purchase_order && (
            <div className={styles.metaLine}>
              <strong>PO:</strong>{inv.purchase_order}
            </div>
          )}
          {inv.payment_terms && (
            <div className={styles.metaLine}>
              <strong>Payment terms:</strong>{inv.payment_terms}
            </div>
          )}
        </div>

        {/* ── Parties ── */}
        {(inv.client_name || fromName) && (
          <div className={styles.parties}>
            {inv.client_name && (
              <div className={styles.party}>
                <div className={styles.partyLabel}>Billed to</div>
                <div className={styles.partyName}>{inv.client_name}</div>
                {inv.client_email   && <div className={styles.partySub}>{inv.client_email}</div>}
                {inv.client_address && <div className={styles.partySub} style={{ whiteSpace: "pre-line" }}>{inv.client_address}</div>}
              </div>
            )}
            {fromName && (
              <div className={styles.party}>
                <div className={styles.partyLabel}>From</div>
                <div className={styles.partyName}>{fromName}</div>
                {fromEmail && <div className={styles.partySub}>{fromEmail}</div>}
              </div>
            )}
          </div>
        )}

        {/* ── Line items ── */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Description</th>
              <th className={styles.right}>Qty</th>
              <th className={styles.right}>Unit price</th>
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

        {/* ── Totals ── */}
        <div className={styles.totals}>
          <div className={styles.totalRow}><span>Subtotal</span><span>{fmt(sub, inv.currency)}</span></div>
          {inv.tax_rate > 0 && (
            <div className={styles.totalRow}><span>Tax ({inv.tax_rate}%)</span><span>{fmt(tax, inv.currency)}</span></div>
          )}
          <div className={`${styles.totalRow} ${styles.grandTotal}`}>
            <span>Total</span><span>{fmt(total, inv.currency)}</span>
          </div>
        </div>

        {/* ── Notes ── */}
        {inv.notes && (
          <div className={styles.notes}>
            <div className={styles.notesLabel}>Additional notes</div>
            <div className={styles.notesText}>{inv.notes}</div>
          </div>
        )}

        {/* ── Pay to ── */}
        {inv.pay_to && (
          <div className={styles.notes}>
            <div className={styles.notesLabel}>Payment details</div>
            <div className={styles.notesText}>{inv.pay_to}</div>
          </div>
        )}

        <div className={styles.footer}>Generated with OuraTime</div>
      </div>
    </div>
  );
}
