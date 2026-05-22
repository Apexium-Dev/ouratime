"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./team.module.css";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  last_seen_at: string | null;
}

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  profile: Profile;
  todaySecs: number;
  runningDesc: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: "admin" | "member";
  token: string;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
}

function isOnline(lastSeen: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function fmtHHMM(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function avatarColor(str: string) {
  const colors = ["#008080","#0ea5e9","#8b5cf6","#ec4899","#f97316","#22c55e","#ef4444","#64748b"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % colors.length;
  return colors[h];
}

function initials(profile: Profile) {
  if (profile.full_name) {
    const parts = profile.full_name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return (profile.email?.[0] ?? "?").toUpperCase();
}

export default function TeamPage() {
  const [myId, setMyId]           = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers]     = useState<Member[]>([]);
  const [invites, setInvites]     = useState<Invite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [myRole, setMyRole]       = useState<"owner" | "admin" | "member">("member");

  // Create workspace
  const [wsName, setWsName]       = useState("");
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState("");

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState<"admin" | "member">("member");
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const load = useCallback(async (wsId: string, uid: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ data: rawMembers }, { data: rawEntries }, { data: rawInvites }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id, user_id, role, joined_at, profiles(id, full_name, email, last_seen_at)")
        .eq("workspace_id", wsId),
      supabase
        .from("time_entries")
        .select("user_id, duration, stopped_at, started_at, description")
        .in("user_id", [uid]) // placeholder — replaced below
        .gte("started_at", today.toISOString()),
      supabase
        .from("workspace_invites")
        .select("id, email, role, token, created_at")
        .eq("workspace_id", wsId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    const memberList = (rawMembers ?? []) as Array<{
      id: string; user_id: string; role: "owner"|"admin"|"member"; joined_at: string;
      profiles: Profile;
    }>;

    const memberIds = memberList.map(m => m.user_id);

    // Fetch entries for all members
    const { data: entries } = await supabase
      .from("time_entries")
      .select("user_id, duration, stopped_at, started_at, description")
      .in("user_id", memberIds)
      .gte("started_at", today.toISOString());

    const todayMap: Record<string, number> = {};
    const runningMap: Record<string, string | null> = {};

    for (const e of entries ?? []) {
      if (!e.stopped_at) {
        runningMap[e.user_id] = e.description || "Tracking…";
        const secs = Math.floor((Date.now() - new Date(e.started_at).getTime()) / 1000);
        todayMap[e.user_id] = (todayMap[e.user_id] ?? 0) + secs;
      } else {
        todayMap[e.user_id] = (todayMap[e.user_id] ?? 0) + (e.duration ?? 0);
      }
    }

    const built: Member[] = memberList.map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      profile: m.profiles,
      todaySecs: todayMap[m.user_id] ?? 0,
      runningDesc: runningMap[m.user_id] ?? null,
    }));

    setMembers(built);
    setInvites((rawInvites as Invite[]) ?? []);
    const me = built.find(m => m.user_id === uid);
    if (me) setMyRole(me.role);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      // Find the user's workspace (as member)
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(id, name, owner_id)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (membership?.workspaces) {
        const ws = membership.workspaces as unknown as Workspace;
        setWorkspace(ws);
        await load(ws.id, user.id);
      }

      setLoading(false);
    }
    init();
  }, [load]);

  // ── Create workspace ──────────────────────────────────────────
  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = wsName.trim();
    if (!name) return;
    setCreating(true); setCreateError("");

    const { data, error } = await supabase.rpc("create_workspace", { workspace_name: name });

    setCreating(false);
    if (error || data?.error) { setCreateError(error?.message ?? data.error); return; }

    const ws = data as Workspace;
    setWorkspace(ws);
    setMyRole("owner");
    await load(ws.id, myId!);
  };

  // ── Invite ────────────────────────────────────────────────────
  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !workspace) return;
    setInviting(true); setInviteError(""); setNewInviteLink(null);

    const { data, error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: workspace.id, email, role: inviteRole, invited_by: myId! })
      .select()
      .single();

    setInviting(false);
    if (error) { setInviteError(error.message.includes("unique") ? "This email was already invited." : error.message); return; }

    const link = `${window.location.origin}/join/${data.token}`;
    setNewInviteLink(link);
    setInvites(prev => [data as Invite, ...prev]);
    setInviteEmail("");
  };

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("workspace_invites").delete().eq("id", id);
    setInvites(prev => prev.filter(i => i.id !== id));
    if (newInviteLink && invites.find(i => i.id === id)) setNewInviteLink(null);
  };

  // ── Role change ───────────────────────────────────────────────
  const changeRole = async (memberId: string, newRole: "admin" | "member") => {
    setChangingRole(memberId);
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("id", memberId);
    setChangingRole(null);
    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    }
  };

  // ── Remove member ─────────────────────────────────────────────
  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId);
    if (!error) setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const canManage = myRole === "owner" || myRole === "admin";

  if (loading) return <main className={styles.page}><p className={styles.empty}>Loading…</p></main>;

  // ── No workspace yet ──────────────────────────────────────────
  if (!workspace) return (
    <main className={styles.page}>
      <div className={styles.createCard}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <h2 className={styles.createTitle}>Create your workspace</h2>
        <p className={styles.createDesc}>
          A workspace lets you invite teammates, share projects, and see everyone&apos;s tracked time in one place.
        </p>
        {createError && <p className={styles.inviteError}>{createError}</p>}
        <form className={styles.createForm} onSubmit={createWorkspace}>
          <input
            className={styles.createInput}
            placeholder="Workspace name…"
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            autoFocus
          />
          <button className={styles.createSubmit} type="submit" disabled={creating || !wsName.trim()}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </main>
  );

  return (
    <main className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Team</h1>
          <p>{workspace.name} · {members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <button className={styles.inviteBtn} onClick={() => { setShowInvite(v => !v); setNewInviteLink(null); setInviteError(""); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Invite member
          </button>
        )}
      </div>

      {/* ── Invite form ── */}
      {showInvite && (
        <div className={styles.inviteCard}>
          <p className={styles.inviteCardTitle}>Invite by email</p>
          <form onSubmit={sendInvite}>
            <div className={styles.inviteRow}>
              <input
                className={styles.inviteInput}
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }}
                autoFocus
              />
              <select
                className={styles.roleSelect}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button className={styles.inviteSendBtn} type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? "Sending…" : "Send invite"}
              </button>
              <button className={styles.inviteCancelBtn} type="button" onClick={() => { setShowInvite(false); setNewInviteLink(null); }}>
                Cancel
              </button>
            </div>
          </form>

          {inviteError && <p className={styles.inviteError}>{inviteError}</p>}

          {newInviteLink && (
            <div className={styles.inviteLink}>
              <span className={styles.inviteLinkUrl}>{newInviteLink}</span>
              <button className={styles.copyBtn} onClick={() => copyLink(newInviteLink)}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Members ── */}
      <p className={styles.sectionLabel}>Members</p>
      <div className={styles.memberList}>
        {members.map((m) => {
          const online  = isOnline(m.profile.last_seen_at);
          const name    = m.profile.full_name || m.profile.email || "Unknown";
          const bgColor = avatarColor(m.user_id);
          const isMe    = m.user_id === myId;
          const isOwner = m.role === "owner";

          return (
            <div key={m.id} className={styles.memberRow}>
              <div className={styles.avatar} style={{ background: bgColor }}>
                {initials(m.profile)}
                {online && <span className={styles.onlineDot} />}
              </div>

              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{name}{isMe ? " (you)" : ""}</div>
                {m.profile.email && <div className={styles.memberEmail}>{m.profile.email}</div>}
              </div>

              {m.runningDesc ? (
                <span className={styles.memberStatus}>▶ {m.runningDesc}</span>
              ) : (
                <span className={`${styles.memberStatus} ${styles.memberStatusIdle}`}>
                  {online ? "Online" : m.profile.last_seen_at
                    ? `Last seen ${new Date(m.profile.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "Never active"}
                </span>
              )}

              <span className={`${styles.memberHours} ${m.todaySecs > 0 ? styles.memberHoursActive : ""}`}>
                {m.todaySecs > 0 ? fmtHHMM(m.todaySecs) : "—"}
              </span>

              <span className={`${styles.roleBadge} ${
                m.role === "owner" ? styles.roleOwner :
                m.role === "admin" ? styles.roleAdmin : styles.roleMember
              }`}>
                {m.role}
              </span>

              {canManage && !isMe && !isOwner && (
                <div className={styles.memberActions}>
                  {myRole === "owner" && (
                    <select
                      className={styles.roleDropdown}
                      value={m.role}
                      disabled={changingRole === m.id}
                      onChange={(e) => changeRole(m.id, e.target.value as "admin" | "member")}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnRemove}`}
                    onClick={() => removeMember(m.id)}
                    title="Remove from workspace"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M16 11V7a4 4 0 00-8 0v4" />
                      <path d="M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pending invites ── */}
      {invites.length > 0 && (
        <>
          <p className={styles.sectionLabel}>Pending invites</p>
          <div className={styles.inviteList}>
            {invites.map((inv) => (
              <div key={inv.id} className={styles.inviteRow}>
                <span className={styles.inviteEmail}>{inv.email}</span>
                <span className={`${styles.roleBadge} ${inv.role === "admin" ? styles.roleAdmin : styles.roleMember}`}>
                  {inv.role}
                </span>
                <span className={styles.invitePending}>
                  {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <button className={styles.copyBtn} onClick={() => copyLink(`${window.location.origin}/join/${inv.token}`)}>
                  Copy link
                </button>
                {canManage && (
                  <button className={styles.revokeBtn} onClick={() => revokeInvite(inv.id)} title="Revoke invite">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

    </main>
  );
}
