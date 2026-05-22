"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./inbox.module.css";

interface Notification {
  id: string;
  type: "project_invite" | "join_request";
  status: "pending" | "accepted" | "declined" | "cancelled";
  read: boolean;
  role: string;
  member_row_id: string;
  created_at: string;
  project_id: string;
  project_name: string;
  project_color: string;
  sender_id: string;
  sender_name: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function InboxPage() {
  const [items, setItems]     = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_inbox").then(({ data, error }) => {
      if (error) console.error("get_inbox error:", error);
      setItems((data ?? []) as Notification[]);
      setLoading(false);
    });
  }, []);

  const invites      = items.filter(n => n.type === "project_invite");
  const joinRequests = items.filter(n => n.type === "join_request");
  const pendingCount = items.filter(n => n.status === "pending").length;

  async function respondInvite(id: string, accept: boolean) {
    setActing(id);
    const { error } = await supabase.rpc("respond_to_invite", { p_notification_id: id, p_accept: accept });
    if (error) {
      console.error("respond_to_invite error:", error);
      alert(`Failed to ${accept ? "accept" : "decline"} invite: ${error.message}`);
      setActing(null);
      return;
    }
    setItems(prev => prev.map(n => n.id === id
      ? { ...n, status: accept ? "accepted" : "declined" }
      : n
    ));
    setActing(null);
    window.dispatchEvent(new CustomEvent("ouratime:projects-changed"));
  }

  async function respondJoin(id: string, approve: boolean) {
    setActing(id);
    const { error } = await supabase.rpc("respond_to_join_request", { p_notification_id: id, p_approve: approve });
    if (error) {
      console.error("respond_to_join_request error:", error);
      alert(`Failed to ${approve ? "approve" : "deny"} request: ${error.message}`);
      setActing(null);
      return;
    }
    setItems(prev => prev.map(n => n.id === id
      ? { ...n, status: approve ? "accepted" : "declined" }
      : n
    ));
    setActing(null);
  }

  if (loading) return (
    <main className={styles.page}><p className={styles.empty}>Loading…</p></main>
  );

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Inbox</h1>
        {pendingCount > 0 && (
          <span className={styles.pendingBadge}>{pendingCount} pending</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
          </svg>
          <p>Your inbox is empty.</p>
        </div>
      ) : (
        <>
          {/* ── Project invitations ── */}
          {invites.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Project invitations</h2>
              <div className={styles.list}>
                {invites.map(n => (
                  <div key={n.id} className={`${styles.card} ${n.status !== "pending" ? styles.cardDone : ""}`}>
                    <div className={styles.colorDot} style={{ background: n.project_color }} />
                    <div className={styles.cardBody}>
                      <p className={styles.cardMain}>
                        <strong>{n.sender_name ?? "Someone"}</strong>
                        {" invited you to join "}
                        <strong>{n.project_name}</strong>
                        {" as "}
                        <span className={styles.rolePill}>{n.role}</span>
                      </p>
                      <p className={styles.cardTime}>{timeAgo(n.created_at)}</p>
                    </div>
                    <div className={styles.cardActions}>
                      {n.status === "pending" ? (
                        <>
                          <button
                            className={styles.acceptBtn}
                            onClick={() => respondInvite(n.id, true)}
                            disabled={acting === n.id}
                          >
                            {acting === n.id ? "…" : "Accept"}
                          </button>
                          <button
                            className={styles.declineBtn}
                            onClick={() => respondInvite(n.id, false)}
                            disabled={acting === n.id}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <span className={`${styles.statusPill} ${styles[`status_${n.status}`]}`}>
                          {n.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Join requests (for project owners/admins) ── */}
          {joinRequests.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Join requests</h2>
              <div className={styles.list}>
                {joinRequests.map(n => (
                  <div key={n.id} className={`${styles.card} ${n.status !== "pending" ? styles.cardDone : ""}`}>
                    <div className={styles.colorDot} style={{ background: n.project_color }} />
                    <div className={styles.cardBody}>
                      <p className={styles.cardMain}>
                        <strong>{n.sender_name ?? "Someone"}</strong>
                        {" wants to join "}
                        <strong>{n.project_name}</strong>
                      </p>
                      <p className={styles.cardTime}>{timeAgo(n.created_at)}</p>
                    </div>
                    <div className={styles.cardActions}>
                      {n.status === "pending" ? (
                        <>
                          <button
                            className={styles.acceptBtn}
                            onClick={() => respondJoin(n.id, true)}
                            disabled={acting === n.id}
                          >
                            {acting === n.id ? "…" : "Approve"}
                          </button>
                          <button
                            className={styles.declineBtn}
                            onClick={() => respondJoin(n.id, false)}
                            disabled={acting === n.id}
                          >
                            Deny
                          </button>
                        </>
                      ) : (
                        <span className={`${styles.statusPill} ${styles[`status_${n.status}`]}`}>
                          {n.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
