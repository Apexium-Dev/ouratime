"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [myId, setMyId]             = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs]     = useState<Workspace | null>(null);
  const [members, setMembers]       = useState<Member[]>([]);
  const [invites, setInvites]       = useState<Invite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [myRole, setMyRole]         = useState<"owner" | "admin" | "member">("member");
  const [search, setSearch]         = useState("");

  // Workspace switcher
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [newWsName, setNewWsName]       = useState("");
  const [showNewWs, setShowNewWs]       = useState(false);
  const [creatingWs, setCreatingWs]     = useState(false);
  const [createWsError, setCreateWsError] = useState("");
  const switcherRef = useRef<HTMLDivElement>(null);

  // First workspace creation
  const [wsName, setWsName]           = useState("");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState("");

  // Invite form
  const [showInvite, setShowInvite]       = useState(false);
  const [inviteEmail, setInviteEmail]     = useState("");
  const [inviteRole, setInviteRole]       = useState<"admin" | "member">("member");
  const [inviting, setInviting]           = useState(false);
  const [inviteError, setInviteError]     = useState("");
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [confirmDeleteWs, setConfirmDeleteWs] = useState(false);
  const [deletingWs, setDeletingWs] = useState(false);

  const loadTeam = useCallback(async (wsId: string, uid: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ data: rawMembers }, { data: rawInvites }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id, user_id, role, joined_at")
        .eq("workspace_id", wsId),
      supabase
        .from("workspace_invites")
        .select("id, email, role, token, created_at")
        .eq("workspace_id", wsId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    const memberList = (rawMembers ?? []) as Array<{
      id: string; user_id: string; role: "owner"|"admin"|"member"; joined_at: string;
    }>;

    const memberIds = memberList.map(m => m.user_id);

    const [{ data: profilesData }, { data: entries }] = await Promise.all([
      memberIds.length > 0
        ? supabase.from("profiles").select("id, full_name, email, last_seen_at").in("id", memberIds)
        : Promise.resolve({ data: [] as Profile[] }),
      memberIds.length > 0
        ? supabase.from("time_entries")
            .select("user_id, duration, stopped_at, started_at, description")
            .in("user_id", memberIds)
            .gte("started_at", today.toISOString())
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap: Record<string, Profile> = {};
    for (const p of profilesData ?? []) profileMap[p.id] = p;

    const todayMap: Record<string, number> = {};
    const runningMap: Record<string, string | null> = {};
    for (const e of (entries ?? []) as Array<{ user_id: string; duration: number | null; stopped_at: string | null; started_at: string; description: string | null }>) {
      if (!e.stopped_at) {
        runningMap[e.user_id] = e.description || "Tracking…";
        todayMap[e.user_id] = (todayMap[e.user_id] ?? 0) + Math.floor((Date.now() - new Date(e.started_at).getTime()) / 1000);
      } else {
        todayMap[e.user_id] = (todayMap[e.user_id] ?? 0) + (e.duration ?? 0);
      }
    }

    const built: Member[] = memberList.map(m => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      profile: profileMap[m.user_id] ?? { id: m.user_id, full_name: null, email: null, last_seen_at: null },
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

      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(id, name, owner_id)")
        .eq("user_id", user.id);

      const wsList = (memberships ?? [])
        .map(m => m.workspaces as unknown as Workspace)
        .filter(Boolean);

      setWorkspaces(wsList);

      if (wsList.length > 0) {
        const savedId = localStorage.getItem("ouratime:active_workspace");
        const active = wsList.find(w => w.id === savedId) ?? wsList[0];
        setActiveWs(active);
        await loadTeam(active.id, user.id);
      }

      setLoading(false);
    }
    init();
  }, [loadTeam]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
        setShowNewWs(false);
        setNewWsName("");
        setCreateWsError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchTo = async (ws: Workspace) => {
    setActiveWs(ws);
    localStorage.setItem("ouratime:active_workspace", ws.id);
    setShowSwitcher(false);
    setShowNewWs(false);
    setMembers([]); setInvites([]);
    await loadTeam(ws.id, myId!);
  };

  const doCreate = async (name: string): Promise<Workspace | null> => {
    const { data, error } = await supabase.rpc("create_workspace", { workspace_name: name });
    if (error || data?.error) return null;
    return data as Workspace;
  };

  const createFirstWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = wsName.trim();
    if (!name) return;
    setCreating(true); setCreateError("");
    const ws = await doCreate(name);
    setCreating(false);
    if (!ws) { setCreateError("Failed to create workspace."); return; }
    setWorkspaces([ws]);
    setActiveWs(ws);
    localStorage.setItem("ouratime:active_workspace", ws.id);
    setMyRole("owner");
    await loadTeam(ws.id, myId!);
  };

  const createExtraWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWsName.trim();
    if (!name) return;
    setCreatingWs(true); setCreateWsError("");
    const ws = await doCreate(name);
    setCreatingWs(false);
    if (!ws) { setCreateWsError("Failed to create workspace."); return; }
    setWorkspaces(prev => [...prev, ws]);
    setNewWsName(""); setShowNewWs(false);
    await switchTo(ws);
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !activeWs) return;
    setInviting(true); setInviteError(""); setNewInviteLink(null);

    const { data, error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: activeWs.id, email, role: inviteRole, invited_by: myId! })
      .select().single();

    setInviting(false);
    if (error) {
      setInviteError(error.message.includes("unique") ? "This email was already invited." : error.message);
      return;
    }
    setNewInviteLink(`${window.location.origin}/join/${data.token}`);
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
    if (newInviteLink) setNewInviteLink(null);
  };

  const changeRole = async (memberId: string, newRole: "admin" | "member") => {
    setChangingRole(memberId);
    const { error } = await supabase.from("workspace_members").update({ role: newRole }).eq("id", memberId);
    setChangingRole(null);
    if (!error) setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  const removeMember = async (memberId: string) => {
    const { data, error } = await supabase.rpc("remove_workspace_member", { member_row_id: memberId });
    if (error || data?.error) {
      alert(data?.error ?? error?.message ?? "Failed to remove member");
      return;
    }
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const canManage = myId !== null && (
    activeWs?.owner_id === myId || myRole === "owner" || myRole === "admin"
  );
  const isOwner = myId !== null && activeWs?.owner_id === myId;

  const deleteWorkspace = async () => {
    if (!confirmDeleteWs) { setConfirmDeleteWs(true); return; }
    if (!activeWs) return;
    setDeletingWs(true);
    const { data, error } = await supabase.rpc("delete_workspace", { p_workspace_id: activeWs.id });
    if (error || data?.error) {
      alert(data?.error ?? error?.message ?? "Failed to delete workspace");
      setDeletingWs(false);
      setConfirmDeleteWs(false);
      return;
    }
    const remaining = workspaces.filter(w => w.id !== activeWs.id);
    setWorkspaces(remaining);
    localStorage.removeItem("ouratime:active_workspace");
    if (remaining.length > 0) {
      setActiveWs(remaining[0]);
      localStorage.setItem("ouratime:active_workspace", remaining[0].id);
      await loadTeam(remaining[0].id, myId!);
    } else {
      setActiveWs(null);
      setMembers([]);
      setInvites([]);
    }
    setConfirmDeleteWs(false);
    setDeletingWs(false);
  };

  const filtered = members.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.profile.full_name ?? "").toLowerCase().includes(q) ||
      (m.profile.email ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) return <main className={styles.page}><p className={styles.empty}>Loading…</p></main>;

  if (workspaces.length === 0) return (
    <main className={styles.page}>
      <div className={styles.createCard}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <h2 className={styles.createTitle}>Create your workspace</h2>
        <p className={styles.createDesc}>
          Invite teammates, share projects, and see everyone&apos;s tracked time in one place.
        </p>
        {createError && <p className={styles.inviteError}>{createError}</p>}
        <form className={styles.createForm} onSubmit={createFirstWorkspace}>
          <input className={styles.createInput} placeholder="Workspace name…" value={wsName}
            onChange={(e) => setWsName(e.target.value)} autoFocus />
          <button className={styles.createSubmit} type="submit" disabled={creating || !wsName.trim()}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </main>
  );

  return (
    <main className={styles.page}>

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          {/* Workspace switcher */}
          <div className={styles.wsSwitcher} ref={switcherRef}>
            <button
              className={styles.wsTrigger}
              onClick={() => { setShowSwitcher(v => !v); setShowNewWs(false); setNewWsName(""); }}
            >
              <span className={styles.wsTriggerDot} style={{ background: avatarColor(activeWs!.id) }} />
              <span className={styles.wsTriggerName}>{activeWs!.name}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {showSwitcher && (
              <div className={styles.wsDropdown}>
                <p className={styles.wsDropdownLabel}>Your workspaces</p>
                {workspaces.map(ws => (
                  <button key={ws.id} className={`${styles.wsOption} ${activeWs?.id === ws.id ? styles.wsOptionActive : ""}`} onClick={() => switchTo(ws)}>
                    <span className={styles.wsOptionDot} style={{ background: avatarColor(ws.id) }} />
                    {ws.name}
                    {activeWs?.id === ws.id && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: "auto" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
                <div className={styles.wsDropdownDivider} />
                {showNewWs ? (
                  <form className={styles.wsNewForm} onSubmit={createExtraWorkspace}>
                    <input className={styles.wsNewInput} placeholder="Workspace name…" value={newWsName}
                      onChange={(e) => { setNewWsName(e.target.value); setCreateWsError(""); }} autoFocus />
                    <button className={styles.wsNewBtn} type="submit" disabled={creatingWs || !newWsName.trim()}>
                      {creatingWs ? "…" : "Create"}
                    </button>
                  </form>
                ) : (
                  <button className={styles.wsNewTrigger} onClick={() => setShowNewWs(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New workspace
                  </button>
                )}
                {createWsError && <p className={styles.wsNewError}>{createWsError}</p>}
              </div>
            )}
          </div>
          <p className={styles.pageSubtitle}>{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {canManage && (
            <button className={styles.inviteBtn}
              onClick={() => { setShowInvite(v => !v); setNewInviteLink(null); setInviteError(""); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Invite member
            </button>
          )}
          {isOwner && (
            <button
              className={`${styles.deleteWsBtn} ${confirmDeleteWs ? styles.deleteWsBtnConfirm : ""}`}
              onClick={deleteWorkspace}
              disabled={deletingWs}
              title="Delete workspace"
            >
              {deletingWs ? "Deleting…" : confirmDeleteWs ? "Are you sure?" : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                </svg>
              )}
            </button>
          )}
          {confirmDeleteWs && !deletingWs && (
            <button className={styles.cancelDeleteWsBtn} onClick={() => setConfirmDeleteWs(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Invite form ── */}
      {showInvite && (
        <div className={styles.inviteCard}>
          <p className={styles.inviteCardTitle}>Invite by email</p>
          <form onSubmit={sendInvite}>
            <div className={styles.inviteRow}>
              <input className={styles.inviteInput} type="email" placeholder="colleague@example.com"
                value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }} autoFocus />
              <select className={styles.roleSelect} value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button className={styles.inviteSendBtn} type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? "Sending…" : "Send invite"}
              </button>
              <button className={styles.inviteCancelBtn} type="button"
                onClick={() => { setShowInvite(false); setNewInviteLink(null); }}>
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

      {/* ── Search ── */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            className={styles.searchInput}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <span className={styles.memberCount}>{filtered.length} of {members.length}</span>
        )}
      </div>

      {/* ── Members table ── */}
      <div className={styles.table}>
        <div className={styles.tableHead}>
          <span className={styles.tableHeadCell}>Name</span>
          <span className={styles.tableHeadCell}>Email</span>
          <span className={styles.tableHeadCell}>Status</span>
          <span className={styles.tableHeadCell} style={{ textAlign: "right" }}>Today</span>
          <span className={styles.tableHeadCell}>Role</span>
          <span className={styles.tableHeadCell} />
        </div>

        {filtered.map((m) => {
          const online      = isOnline(m.profile.last_seen_at);
          const name        = m.profile.full_name || m.profile.email || "Unknown";
          const isMe        = m.user_id === myId;
          const isRowOwner  = m.role === "owner";

          return (
            <div key={m.id} className={styles.tableRow}>

              {/* Name */}
              <div className={styles.nameCell}>
                <div className={styles.avatar} style={{ background: avatarColor(m.user_id) }}>
                  {initials(m.profile)}
                  {online && <span className={styles.onlineDot} />}
                </div>
                <span className={styles.nameText}>
                  {name}
                  {isMe && <span className={styles.youBadge}>you</span>}
                </span>
              </div>

              {/* Email */}
              <span className={styles.emailCell}>{m.profile.email ?? "—"}</span>

              {/* Status */}
              <div className={styles.statusCell}>
                {m.runningDesc ? (
                  <span className={styles.statusTracking}>
                    <span className={styles.trackingDot} />
                    {m.runningDesc}
                  </span>
                ) : (
                  <span className={styles.statusIdle}>
                    {online ? "Online" : m.profile.last_seen_at
                      ? `Seen ${new Date(m.profile.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : "Never active"}
                  </span>
                )}
              </div>

              {/* Today */}
              <span className={`${styles.todayCell} ${m.todaySecs > 0 ? styles.todayCellActive : ""}`}>
                {m.todaySecs > 0 ? fmtHHMM(m.todaySecs) : "—"}
              </span>

              {/* Role */}
              <div className={styles.roleCell}>
                <span className={`${styles.roleBadge} ${
                  m.role === "owner" ? styles.roleOwner :
                  m.role === "admin" ? styles.roleAdmin : styles.roleMember
                }`}>{m.role}</span>
              </div>

              {/* Actions */}
              <div className={styles.actionsCell}>
                {canManage && !isMe && !isRowOwner && (
                  <>
                    {myRole === "owner" && (
                      <select className={styles.roleDropdown} value={m.role}
                        disabled={changingRole === m.id}
                        onChange={(e) => changeRole(m.id, e.target.value as "admin" | "member")}>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnRemove}`}
                      onClick={() => removeMember(m.id)} title="Remove">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* ── Pending invites ── */}
      {invites.length > 0 && (
        <>
          <p className={styles.sectionLabel}>Pending invites — {invites.length}</p>
          <div className={styles.pendingTable}>
            {invites.map((inv) => (
              <div key={inv.id} className={styles.pendingRow}>
                <span className={styles.pendingEmail}>{inv.email}</span>
                <span className={`${styles.roleBadge} ${inv.role === "admin" ? styles.roleAdmin : styles.roleMember}`}>
                  {inv.role}
                </span>
                <span className={styles.pendingDate}>
                  {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <button className={styles.copyBtn}
                  onClick={() => copyLink(`${window.location.origin}/join/${inv.token}`)}>
                  Copy link
                </button>
                {canManage && (
                  <button className={styles.revokeBtn} onClick={() => revokeInvite(inv.id)} title="Revoke">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
