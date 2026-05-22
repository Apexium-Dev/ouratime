"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import styles from "./projects.module.css";

const COLORS = [
  "#008080", "#0ea5e9", "#8b5cf6", "#ec4899",
  "#f97316", "#eab308", "#22c55e", "#ef4444",
];

interface Project {
  id: string; name: string; color: string; created_at: string;
  archived: boolean; is_template: boolean; is_favorite: boolean;
}
interface Stats { tasks: number; totalSecs: number; weekSecs: number; }

type Tab = "active" | "favorites" | "templates" | "archived";

function fmtHHMM(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ProjectsPage() {
  const [projects, setProjects]   = useState<Project[]>([]);
  const [stats, setStats]         = useState<Record<string, Stats>>({});
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>("active");
  const [showModal, setShowModal] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [saving, setSaving]       = useState(false);

  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState("");

  const notify = () => window.dispatchEvent(new CustomEvent("ouratime:projects-changed"));

  const load = useCallback(async () => {
    const [{ data: proj }, { data: entries }, { data: tasks }] = await Promise.all([
      supabase.from("projects").select("*").order("is_favorite", { ascending: false }).order("created_at"),
      supabase.from("time_entries").select("project_id, duration, started_at"),
      supabase.from("tasks").select("project_id"),
    ]);
    setProjects(proj ?? []);
    const monday = startOfWeek();
    const map: Record<string, Stats> = {};
    for (const p of proj ?? []) {
      const pe = (entries ?? []).filter((e) => e.project_id === p.id);
      map[p.id] = {
        tasks:     (tasks ?? []).filter((t) => t.project_id === p.id).length,
        totalSecs: pe.reduce((s, e) => s + (e.duration ?? 0), 0),
        weekSecs:  pe.filter((e) => new Date(e.started_at) >= monday).reduce((s, e) => s + (e.duration ?? 0), 0),
      };
    }
    setStats(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Toggle field helper ─────────────────────────────────────
  const toggle = async (id: string, field: "is_favorite" | "is_template" | "archived", value: boolean) => {
    const { error } = await supabase.from("projects").update({ [field]: value }).eq("id", id);
    if (!error) {
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
      notify();
    }
  };

  // ── Edit ────────────────────────────────────────────────────
  const startEdit = (p: Project) => {
    setEditingId(p.id); setEditName(p.name); setEditColor(p.color);
    setDeletingId(null); setDeleteError("");
  };
  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("projects").update({ name: editName.trim(), color: editColor }).eq("id", id);
    setSaving(false);
    if (!error) {
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: editName.trim(), color: editColor } : p));
      setEditingId(null);
      notify();
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const deleteProject = async (id: string) => {
    setDeleteLoading(true); setDeleteError("");
    const { error } = await supabase.from("projects").delete().eq("id", id);
    setDeleteLoading(false);
    if (error) { setDeleteError(error.message); return; }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
    notify();
  };

  // ── Filter by tab ───────────────────────────────────────────
  const visible = projects.filter((p) => {
    if (tab === "archived")  return p.archived;
    if (tab === "favorites") return p.is_favorite && !p.archived;
    if (tab === "templates") return p.is_template && !p.archived;
    return !p.archived;
  });

  const counts = {
    active:    projects.filter((p) => !p.archived).length,
    favorites: projects.filter((p) => p.is_favorite && !p.archived).length,
    templates: projects.filter((p) => p.is_template && !p.archived).length,
    archived:  projects.filter((p) => p.archived).length,
  };

  if (loading) return <main className={styles.page}><p className={styles.empty}>Loading…</p></main>;

  return (
    <main className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.subtitle}>{counts.active} active · {counts.archived} archived</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New project
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {(["active","favorites","templates","archived"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {counts[t] > 0 && <span className={styles.tabCount}>{counts[t]}</span>}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      {visible.length === 0 ? (
        <div className={styles.emptyState}>
          {tab === "archived"  && <p>No archived projects.</p>}
          {tab === "favorites" && <p>No favorite projects yet. Click the ★ on any project.</p>}
          {tab === "templates" && <p>No templates yet. Mark a project as a template to reuse it.</p>}
          {tab === "active"    && (
            <>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <p>No projects yet. Create one to get started.</p>
              <button className={styles.newBtn} onClick={() => setShowModal(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New project
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((project) => {
            const s         = stats[project.id] ?? { tasks: 0, totalSecs: 0, weekSecs: 0 };
            const isEditing  = editingId  === project.id;
            const isDeleting = deletingId === project.id;

            return (
              <div key={project.id} className={`${styles.card} ${project.archived ? styles.cardArchived : ""}`}>
                <div className={styles.cardAccent} style={{ background: project.color }} />

                {isEditing ? (
                  <div className={styles.editBody}>
                    <input
                      className={styles.editInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(project.id); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                    />
                    <div className={styles.swatches}>
                      {COLORS.map((c) => (
                        <button key={c} className={`${styles.swatch} ${editColor === c ? styles.swatchActive : ""}`}
                          style={{ background: c }} onClick={() => setEditColor(c)} />
                      ))}
                    </div>
                    <div className={styles.rowActions}>
                      <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                      <button className={styles.saveBtn} onClick={() => saveEdit(project.id)} disabled={saving || !editName.trim()}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>

                ) : isDeleting ? (
                  <div className={styles.deleteBody}>
                    <p className={styles.deleteMsg}>Delete <strong>{project.name}</strong>?</p>
                    <p className={styles.deleteHint}>Tasks will be deleted. Time entries will lose the project reference.</p>
                    {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
                    <div className={styles.rowActions}>
                      <button className={styles.cancelBtn} onClick={() => { setDeletingId(null); setDeleteError(""); }}>Cancel</button>
                      <button className={styles.deleteConfirmBtn} onClick={() => deleteProject(project.id)} disabled={deleteLoading}>
                        {deleteLoading ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>

                ) : (
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <div className={styles.projectName}>
                        <span className={styles.nameDot} style={{ background: project.color }} />
                        <span className={styles.nameText}>{project.name}</span>
                        {project.is_template && (
                          <span className={styles.badge} title="Template">T</span>
                        )}
                      </div>

                      <div className={styles.actions}>
                        {/* Favorite */}
                        <button
                          className={`${styles.actionBtn} ${project.is_favorite ? styles.actionBtnFavOn : ""}`}
                          onClick={() => toggle(project.id, "is_favorite", !project.is_favorite)}
                          title={project.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24"
                            fill={project.is_favorite ? "currentColor" : "none"}
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>

                        {/* Edit */}
                        <button className={styles.actionBtn} onClick={() => startEdit(project)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        {/* Template toggle */}
                        <button
                          className={`${styles.actionBtn} ${project.is_template ? styles.actionBtnOn : ""}`}
                          onClick={() => toggle(project.id, "is_template", !project.is_template)}
                          title={project.is_template ? "Remove template" : "Mark as template"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 9h18M9 21V9" />
                          </svg>
                        </button>

                        {/* Archive toggle */}
                        <button
                          className={`${styles.actionBtn} ${project.archived ? styles.actionBtnOn : ""}`}
                          onClick={() => toggle(project.id, "archived", !project.archived)}
                          title={project.archived ? "Unarchive" : "Archive"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="21 8 21 21 3 21 3 8" />
                            <rect x="1" y="3" width="22" height="5" />
                            <line x1="10" y1="12" x2="14" y2="12" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          onClick={() => { setDeletingId(project.id); setEditingId(null); }}
                          title="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className={styles.statsRow}>
                      <div className={styles.stat}>
                        <span className={styles.statVal}>{s.tasks}</span>
                        <span className={styles.statLbl}>{s.tasks === 1 ? "task" : "tasks"}</span>
                      </div>
                      <div className={styles.statDivider} />
                      <div className={styles.stat}>
                        <span className={styles.statVal}>{fmtHHMM(s.weekSecs)}</span>
                        <span className={styles.statLbl}>this week</span>
                      </div>
                      <div className={styles.statDivider} />
                      <div className={styles.stat}>
                        <span className={styles.statVal}>{fmtHHMM(s.totalSecs)}</span>
                        <span className={styles.statLbl}>total</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreate={(p) => {
            const full = { ...p, created_at: new Date().toISOString(), archived: false, is_template: false, is_favorite: false };
            setProjects((prev) => [...prev, full]);
            setStats((prev) => ({ ...prev, [p.id]: { tasks: 0, totalSecs: 0, weekSecs: 0 } }));
            notify();
          }}
        />
      )}
    </main>
  );
}
