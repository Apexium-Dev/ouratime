"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./tags.module.css";

const COLORS = [
  "#008080", "#0ea5e9", "#8b5cf6", "#ec4899",
  "#f97316", "#eab308", "#22c55e", "#ef4444",
  "#64748b", "#a16207",
];

interface Tag { id: string; name: string; color: string; }

export default function TagsPage() {
  const [tags, setTags]       = useState<Tag[]>([]);
  const [usage, setUsage]     = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Create
  const [newName, setNewName]   = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [saving, setSaving]       = useState(false);

  // Delete
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState("");

  const load = useCallback(async () => {
    const [{ data: tagsData }, { data: usageData }] = await Promise.all([
      supabase.from("tags").select("id, name, color").order("name"),
      supabase.from("time_entry_tags").select("tag_id"),
    ]);
    setTags(tagsData ?? []);
    const map: Record<string, number> = {};
    for (const row of usageData ?? []) {
      map[row.tag_id] = (map[row.tag_id] ?? 0) + 1;
    }
    setUsage(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create ──────────────────────────────────────────────────
  const createTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true); setCreateError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name, color: newColor })
      .select().single();

    setCreating(false);
    if (error) { setCreateError(error.message); return; }
    setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setUsage((prev) => ({ ...prev, [data.id]: 0 }));
    setNewName(""); setNewColor(COLORS[0]);
  };

  // ── Edit ────────────────────────────────────────────────────
  const startEdit = (tag: Tag) => {
    setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color);
    setDeletingId(null); setDeleteError("");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("tags").update({ name: editName.trim(), color: editColor }).eq("id", id);
    setSaving(false);
    if (!error) {
      setTags((prev) =>
        prev.map((t) => t.id === id ? { ...t, name: editName.trim(), color: editColor } : t)
            .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const deleteTag = async (id: string) => {
    setDeleteLoading(true); setDeleteError("");
    const { error } = await supabase.from("tags").delete().eq("id", id);
    setDeleteLoading(false);
    if (error) { setDeleteError(error.message); return; }
    setTags((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  };

  if (loading) return <main className={styles.page}><p className={styles.empty}>Loading…</p></main>;

  return (
    <main className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tags</h1>
          <p className={styles.subtitle}>{tags.length} tag{tags.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Create form ── */}
      <form className={styles.createCard} onSubmit={createTag}>
        <div className={styles.createTop}>
          <div className={styles.previewDot} style={{ background: newColor }} />
          <input
            className={styles.createInput}
            placeholder="New tag name…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
          />
          <button className={styles.createBtn} type="submit" disabled={creating || !newName.trim()}>
            {creating ? "Adding…" : "Add tag"}
          </button>
        </div>
        <div className={styles.createSwatches}>
          {COLORS.map((c) => (
            <button
              key={c} type="button"
              className={`${styles.swatch} ${newColor === c ? styles.swatchActive : ""}`}
              style={{ background: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </div>
        {createError && <p className={styles.errorMsg}>{createError}</p>}
      </form>

      {/* ── Tag list ── */}
      {tags.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <circle cx="7" cy="7" r="1" fill="#ddd" stroke="none" />
          </svg>
          <p>No tags yet. Create your first one above.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {tags.map((tag) => {
            const count     = usage[tag.id] ?? 0;
            const isEditing  = editingId  === tag.id;
            const isDeleting = deletingId === tag.id;

            return (
              <div key={tag.id} className={styles.row}>
                {isEditing ? (
                  <div className={styles.editRow}>
                    <div className={styles.editLeft}>
                      <div className={styles.previewDot} style={{ background: editColor }} />
                      <input
                        className={styles.editInput}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(tag.id); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                      />
                    </div>
                    <div className={styles.editSwatches}>
                      {COLORS.map((c) => (
                        <button
                          key={c} type="button"
                          className={`${styles.swatch} ${editColor === c ? styles.swatchActive : ""}`}
                          style={{ background: c }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <div className={styles.rowActions}>
                      <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                      <button className={styles.saveBtn} onClick={() => saveEdit(tag.id)} disabled={saving || !editName.trim()}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>

                ) : isDeleting ? (
                  <div className={styles.deleteRow}>
                    <p className={styles.deleteMsg}>
                      Delete <strong style={{ color: tag.color }}>{tag.name}</strong>?
                      {count > 0 && <span className={styles.deleteHint}> Used in {count} entr{count === 1 ? "y" : "ies"}.</span>}
                    </p>
                    {deleteError && <p className={styles.errorMsg}>{deleteError}</p>}
                    <div className={styles.rowActions}>
                      <button className={styles.cancelBtn} onClick={() => { setDeletingId(null); setDeleteError(""); }}>Cancel</button>
                      <button className={styles.deleteConfirmBtn} onClick={() => deleteTag(tag.id)} disabled={deleteLoading}>
                        {deleteLoading ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>

                ) : (
                  <div className={styles.tagRow}>
                    <div className={styles.tagLeft}>
                      <span
                        className={styles.tagPill}
                        style={{ background: tag.color + "22", color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    </div>
                    <span className={styles.usageCount}>
                      {count > 0 ? `${count} entr${count === 1 ? "y" : "ies"}` : "unused"}
                    </span>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => startEdit(tag)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                        onClick={() => { setDeletingId(tag.id); setEditingId(null); }}
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
