"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./project.module.css";

const COLORS = ["#008080","#0ea5e9","#8b5cf6","#ec4899","#f97316","#eab308","#22c55e","#ef4444"];

interface Project {
  id: string; name: string; color: string;
  description: string; tags: string[];
  hourly_rate: number; user_id: string;
  invite_token: string;
}
interface Member {
  id: string; user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
}
interface TimeEntry {
  id: string; started_at: string; duration: number;
  billable: boolean; description: string;
  user_id: string; full_name: string | null;
}

type Tab = "overview" | "members" | "time";

function fmtHHMM(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject]       = useState<Project | null>(null);
  const [members, setMembers]       = useState<Member[]>([]);
  const [timeEntries, setTime]      = useState<TimeEntry[]>([]);
  const [myRole, setMyRole]         = useState<"owner" | "admin" | "member" | null>(null);
  const [currentUserId, setUid]     = useState<string | null>(null);
  const [tab, setTab]               = useState<Tab>("overview");
  const [loading, setLoading]       = useState(true);
  const [timeLoading, setTimeLd]    = useState(false);

  // Edit
  const [editMode, setEditMode]     = useState(false);
  const [editName, setEditName]     = useState("");
  const [editColor, setEditColor]   = useState(COLORS[0]);
  const [editDesc, setEditDesc]     = useState("");
  const [editTags, setEditTags]     = useState<string[]>([]);
  const [editTagInput, setTagIn]    = useState("");
  const [editRate, setEditRate]     = useState(0);
  const [saving, setSaving]         = useState(false);

  // Invite
  const [inviteEmail, setEmail]     = useState("");
  const [inviteRole, setIRole]      = useState<"admin"|"member">("member");
  const [inviting, setInviting]     = useState(false);
  const [inviteMsg, setMsg]         = useState<{type:"error"|"ok"; text:string}|null>(null);
  const [pendingInvites, setPending] = useState<{notification_id:string; recipient_id:string; recipient_name:string|null; role:string; created_at:string}[]>([]);
  const [cancelling, setCancelling]  = useState<string|null>(null);
  const [linkCopied, setLinkCopied]  = useState(false);

  const isAdmin = myRole === "owner" || myRole === "admin";

  // ── Load members ─────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async (userId: string, projOwnerId: string) => {
    const { data: mRows } = await supabase
      .rpc("get_project_members", { p_project_id: id });
    const me = (mRows ?? []).find((m: Member) => m.user_id === userId);
    setMyRole(me?.role ?? (projOwnerId === userId ? "owner" : null));
    setMembers(mRows ?? []);
  }, [id]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUid(user.id);

    const { data: proj } = await supabase
      .from("projects").select("*").eq("id", id).single();
    if (!proj) { router.push("/dashboard/projects"); return; }
    setProject(proj);

    const { data: mRows } = await supabase
      .rpc("get_project_members", { p_project_id: id });

    if (!mRows || mRows.length === 0) {
      if (proj.user_id !== user.id) { router.push("/dashboard/projects"); return; }
    }

    const me = (mRows ?? []).find((m: Member) => m.user_id === user.id);
    setMyRole(me?.role ?? (proj.user_id === user.id ? "owner" : null));
    setMembers(mRows ?? []);
    setLoading(false);
  }, [id, router]);

  // ── Load pending invites ─────────────────────────────────────────────────────
  const loadPendingInvites = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.rpc("get_pending_invites", { p_project_id: id });
    if (error) console.error("get_pending_invites error:", error);
    setPending(data ?? []);
  }, [id, isAdmin]);

  // ── Load time entries ─────────────────────────────────────────────────────────
  const loadTime = useCallback(async () => {
    setTimeLd(true);
    const { data } = await supabase
      .rpc("get_project_time_entries", { p_project_id: id });
    setTime((data ?? []).map((e: any) => ({ ...e, duration: Number(e.duration) })));
    setTimeLd(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "time") loadTime(); }, [tab, loadTime]);
  // Reload members + pending invites every time the Members tab is opened
  useEffect(() => {
    if (tab !== "members" || !currentUserId || !project) return;
    loadMembers(currentUserId, project.user_id);
    loadPendingInvites();
  }, [tab, currentUserId, project, loadMembers, loadPendingInvites]);

  // ── Edit project ─────────────────────────────────────────────────────────────
  const startEdit = () => {
    if (!project) return;
    setEditName(project.name); setEditColor(project.color);
    setEditDesc(project.description ?? ""); setEditTags(project.tags ?? []);
    setEditRate(project.hourly_rate ?? 0); setEditMode(true);
  };

  const saveEdit = async () => {
    if (!editName.trim() || !project) return;
    setSaving(true);
    const { error } = await supabase.from("projects").update({
      name: editName.trim(), color: editColor,
      description: editDesc.trim(), tags: editTags, hourly_rate: editRate,
    }).eq("id", project.id);
    setSaving(false);
    if (!error) {
      setProject(p => p ? { ...p, name: editName.trim(), color: editColor,
        description: editDesc.trim(), tags: editTags, hourly_rate: editRate } : p);
      setEditMode(false);
    }
  };

  const addEditTag = () => {
    const t = editTagInput.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t]);
    setTagIn("");
  };

  // ── Invite ───────────────────────────────────────────────────────────────────
  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setMsg(null);

    const { data, error } = await supabase.rpc("send_project_invite", {
      p_project_id: id, p_email: inviteEmail.trim(), p_role: inviteRole,
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else if (data === "already_member") {
      setMsg({ type: "error", text: "This person is already a member." });
    } else if (data === "already_pending") {
      setMsg({ type: "error", text: "An invite is already pending for this person." });
    } else {
      setMsg({ type: "ok", text: `Invite sent to ${inviteEmail.trim()} as ${inviteRole}.` });
      setEmail("");
      await loadPendingInvites();
    }
    setInviting(false);
  };

  const cancelInvite = async (notificationId: string) => {
    setCancelling(notificationId);
    const { error } = await supabase.rpc("cancel_invite", { p_notification_id: notificationId });
    if (error) {
      setMsg({ type: "error", text: `Could not cancel invite: ${error.message}` });
    } else {
      setPending(prev => prev.filter(p => p.notification_id !== notificationId));
    }
    setCancelling(null);
  };

  const copyInviteLink = () => {
    if (!project) return;
    const url = `${window.location.origin}/invite/${(project as any).invite_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // ── Change role ──────────────────────────────────────────────────────────────
  const changeRole = async (memberId: string, userId: string, newRole: "admin"|"member") => {
    if (userId === currentUserId) return;
    const { error } = await supabase.rpc("update_member_role", {
      p_member_id: memberId, p_new_role: newRole,
    });
    if (!error) setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  // ── Remove member ────────────────────────────────────────────────────────────
  const removeMember = async (memberId: string, userId: string) => {
    if (userId === currentUserId && myRole === "owner") return;
    const { error } = await supabase.rpc("remove_project_member", { p_member_id: memberId });
    if (!error) setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  // ── Group by day ─────────────────────────────────────────────────────────────
  const groupedTime = timeEntries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const day = new Date(e.started_at).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(e); return acc;
  }, {});

  if (loading) {
    return <main className={styles.page}><p className={styles.loadingTxt}>Loading…</p></main>;
  }
  if (!project) return null;

  return (
    <main className={styles.page}>
      {/* Back */}
      <Link href="/dashboard/projects" className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Projects
      </Link>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.colorDot} style={{ background: project.color }} />
          <h1 className={styles.projectTitle}>{project.name}</h1>
          <span className={`${styles.roleBadge} ${styles[`role_${myRole}`]}`}>{myRole}</span>
        </div>
        <div className={styles.headerActions}>
          {isAdmin && !editMode && (
            <button className={styles.editBtn} onClick={startEdit}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit project
            </button>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editMode && (
        <div className={styles.editPanel}>
          <div className={styles.editGrid}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Project name</label>
              <input className={styles.editInput} value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditMode(false); }}
                autoFocus />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Hourly rate</label>
              <div className={styles.rateWrap}>
                <span className={styles.ratePfx}>$</span>
                <input className={styles.rateIn} type="number" min="0" step="0.01"
                  value={editRate} onChange={e => setEditRate(parseFloat(e.target.value) || 0)} />
                <span className={styles.rateSfx}>/hr</span>
              </div>
            </div>
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Description</label>
            <textarea className={styles.editTextarea} rows={2} value={editDesc}
              onChange={e => setEditDesc(e.target.value)} placeholder="What is this project about?" />
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Tags</label>
            <div className={styles.tagBox}>
              {editTags.map(t => (
                <span key={t} className={styles.tag}>
                  {t}
                  <button type="button" className={styles.tagRm}
                    onClick={() => setEditTags(prev => prev.filter(x => x !== t))}>×</button>
                </span>
              ))}
              <input className={styles.tagIn} value={editTagInput}
                placeholder={editTags.length === 0 ? "Add tag, press Enter" : ""}
                onChange={e => setTagIn(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); addEditTag(); }
                  if (e.key === "Backspace" && !editTagInput) setEditTags(prev => prev.slice(0,-1));
                }}
                onBlur={addEditTag} />
            </div>
          </div>
          <div className={styles.editSwatches}>
            {COLORS.map(c => (
              <button key={c} type="button"
                className={`${styles.swatch} ${editColor === c ? styles.swatchActive : ""}`}
                style={{ background: c }} onClick={() => setEditColor(c)} />
            ))}
          </div>
          <div className={styles.editActions}>
            <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>Cancel</button>
            <button className={styles.saveBtn} disabled={saving || !editName.trim()} onClick={saveEdit}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* Description + tags */}
      {!editMode && (
        <>
          {project.description && <p className={styles.desc}>{project.description}</p>}
          {project.tags?.length > 0 && (
            <div className={styles.tags}>
              {project.tags.map(t => <span key={t} className={styles.tagChip}>{t}</span>)}
            </div>
          )}
        </>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {(["overview","members","time"] as Tab[]).map(t => (
          <button key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "members" && <span className={styles.tabCount}>{members.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className={styles.overviewGrid}>
          <div className={styles.statCard}>
            <p className={styles.statLbl}>Members</p>
            <p className={styles.statVal}>{members.length}</p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLbl}>Total tracked</p>
            <p className={`${styles.statVal} ${styles.teal}`}>
              {fmtHHMM(timeEntries.reduce((s,e) => s + (e.duration ?? 0), 0))}
            </p>
          </div>
          {project.hourly_rate > 0 && (
            <div className={styles.statCard}>
              <p className={styles.statLbl}>Hourly rate</p>
              <p className={`${styles.statVal} ${styles.teal}`}>${project.hourly_rate}/hr</p>
            </div>
          )}
        </div>
      )}

      {/* ── Members ── */}
      {tab === "members" && (
        <div className={styles.membersSection}>
          {isAdmin && (
            <div className={styles.inviteBox}>
              <div className={styles.inviteBoxHeader}>
                <p className={styles.inviteTitle}>Invite member</p>
                <button className={styles.copyLinkBtn} onClick={copyInviteLink}>
                  {linkCopied ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                      </svg>
                      Copy invite link
                    </>
                  )}
                </button>
              </div>
              <div className={styles.inviteRow}>
                <input className={styles.inviteInput} type="email" placeholder="Email address"
                  value={inviteEmail}
                  onChange={e => { setEmail(e.target.value); setMsg(null); }}
                  onKeyDown={e => e.key === "Enter" && invite()} />
                <select className={styles.roleSelect} value={inviteRole}
                  onChange={e => setIRole(e.target.value as "admin"|"member")}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button className={styles.inviteBtn} onClick={invite}
                  disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? "Sending…" : "Send invite"}
                </button>
              </div>
              {inviteMsg && (
                <p className={inviteMsg.type === "ok" ? styles.inviteOk : styles.inviteErr}>
                  {inviteMsg.text}
                </p>
              )}
            </div>
          )}

          {/* Pending invites */}
          {isAdmin && pendingInvites.length > 0 && (
            <div className={styles.pendingSection}>
              <p className={styles.pendingSectionTitle}>
                Pending invitations
                <span className={styles.pendingCount}>{pendingInvites.length}</span>
              </p>
              <div className={styles.pendingList}>
                {pendingInvites.map(p => (
                  <div key={p.notification_id} className={styles.pendingRow}>
                    <div className={styles.pendingAvatar}>
                      {initials(p.recipient_name)}
                    </div>
                    <div className={styles.pendingInfo}>
                      <span className={styles.pendingName}>{p.recipient_name ?? "Unknown user"}</span>
                      <span className={styles.pendingMeta}>
                        Invited as <span className={styles.rolePillSm}>{p.role}</span>
                        {" · "}{new Date(p.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" })}
                      </span>
                    </div>
                    <span className={styles.pendingStatusPill}>Pending</span>
                    <button
                      className={styles.cancelInviteBtn}
                      onClick={() => cancelInvite(p.notification_id)}
                      disabled={cancelling === p.notification_id}
                    >
                      {cancelling === p.notification_id ? "…" : "Cancel"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.memberList}>
            {members.map(m => (
              <div key={m.id} className={styles.memberRow}>
                <div className={styles.memberAvatar} style={{ background: project.color }}>
                  {initials(m.full_name)}
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>
                    {m.full_name ?? "Unknown user"}
                    {m.user_id === currentUserId && <span className={styles.youBadge}>you</span>}
                  </span>
                  <span className={styles.memberSince}>Since {fmtDate(m.created_at)}</span>
                </div>
                <div className={styles.memberRoleWrap}>
                  {isAdmin && m.user_id !== currentUserId && m.role !== "owner" ? (
                    <select className={styles.memberRoleSelect} value={m.role}
                      onChange={e => changeRole(m.id, m.user_id, e.target.value as "admin"|"member")}>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <span className={`${styles.rolePill} ${styles[`role_${m.role}`]}`}>{m.role}</span>
                  )}
                </div>
                {isAdmin && m.user_id !== currentUserId && m.role !== "owner" && (
                  <button className={styles.removeBtn}
                    onClick={() => removeMember(m.id, m.user_id)} title="Remove">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Time ── */}
      {tab === "time" && (
        <div className={styles.timeSection}>
          {timeLoading ? (
            <p className={styles.loadingTxt}>Loading entries…</p>
          ) : timeEntries.length === 0 ? (
            <div className={styles.emptyTime}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <p>No time entries yet for this project.</p>
            </div>
          ) : (
            <>
              <div className={styles.timeSummary}>
                <span className={styles.timeSummaryVal}>
                  {fmtHHMM(timeEntries.reduce((s,e) => s + (e.duration ?? 0), 0))}
                </span>
                <span className={styles.timeSummaryLbl}>
                  total · {timeEntries.length} {timeEntries.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              {Object.entries(groupedTime).map(([day, dayEntries]) => (
                <div key={day} className={styles.dayGroup}>
                  <div className={styles.dayHeader}>
                    <span className={styles.dayLabel}>
                      {new Date(day).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
                    </span>
                    <span className={styles.dayTotal}>
                      {fmtHHMM(dayEntries.reduce((s,e) => s + (e.duration ?? 0), 0))}
                    </span>
                  </div>
                  {dayEntries.map(e => (
                    <div key={e.id} className={styles.entryRow}>
                      {isAdmin && e.full_name && (
                        <span className={styles.entryMember}>{e.full_name}</span>
                      )}
                      <span className={styles.entryDesc}>
                        {e.description || <span className={styles.entryNoDesc}>No description</span>}
                      </span>
                      {e.billable && <span className={styles.billableDot} title="Billable">$</span>}
                      <span className={styles.entryDur}>{fmtHHMM(e.duration ?? 0)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </main>
  );
}
