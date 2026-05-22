"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./EditEntryModal.module.css";

interface Tag     { id: string; name: string; color: string; }
interface Project { id: string; name: string; color: string; }

export interface EntryForEdit {
  id: string;
  description: string;
  started_at: string;
  stopped_at: string | null;
  duration: number | null;
  billable: boolean;
  project_id: string | null;
  projects: { name: string; color: string } | null;
  time_entry_tags: { tags: Tag | null }[];
}

interface Props {
  entry: EntryForEdit;
  onClose: () => void;
  onSave:  (updated: EntryForEdit) => void;
  onDelete:(id: string) => void;
}

function toTimeVal(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function applyTime(baseIso: string, timeVal: string) {
  const d = new Date(baseIso);
  const [h, m] = timeVal.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function secondsBetween(a: string, b: string) {
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000));
}

function fmtDur(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

export function EditEntryModal({ entry, onClose, onSave, onDelete }: Props) {
  const [description,      setDescription]     = useState(entry.description);
  const [projects,         setProjects]         = useState<Project[]>([]);
  const [selectedProject,  setSelectedProject]  = useState<Project | null>(
    entry.project_id && entry.projects ? { id: entry.project_id, ...entry.projects } : null
  );
  const [allTags,          setAllTags]          = useState<Tag[]>([]);
  const [selectedTags,     setSelectedTags]     = useState<Tag[]>(
    entry.time_entry_tags.map(t => t.tags).filter((t): t is Tag => t !== null)
  );
  const [billable,         setBillable]         = useState(entry.billable);
  const [startTime,        setStartTime]        = useState(toTimeVal(entry.started_at));
  const [stopTime,         setStopTime]         = useState(entry.stopped_at ? toTimeVal(entry.stopped_at) : "");
  const [tagSearch,        setTagSearch]        = useState("");
  const [saving,           setSaving]           = useState(false);
  const [confirmDelete,    setConfirmDelete]    = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("projects").select("id, name, color").eq("archived", false).order("created_at")
      .then(({ data }) => setProjects(data ?? []));
    supabase.from("tags").select("id, name, color").order("name")
      .then(({ data }) => setAllTags(data ?? []));
  }, []);

  // Derived times
  const startIso = applyTime(entry.started_at, startTime);
  const stopIso  = stopTime && entry.stopped_at ? applyTime(entry.stopped_at, stopTime) : entry.stopped_at;
  const duration = stopIso ? secondsBetween(startIso, stopIso) : null;

  const handleSave = async () => {
    setSaving(true);
    const patch: Record<string, unknown> = {
      description: description.trim(),
      project_id:  selectedProject?.id ?? null,
      billable,
      started_at:  startIso,
    };
    if (stopIso) { patch.stopped_at = stopIso; patch.duration = duration; }

    const { data: updated, error } = await supabase
      .from("time_entries")
      .update(patch)
      .eq("id", entry.id)
      .select("id, description, started_at, stopped_at, duration, billable, project_id, projects(name, color)")
      .single();

    if (!error && updated) {
      await supabase.from("time_entry_tags").delete().eq("time_entry_id", entry.id);
      if (selectedTags.length > 0) {
        await supabase.from("time_entry_tags").insert(
          selectedTags.map(t => ({ time_entry_id: entry.id, tag_id: t.id }))
        );
      }
      // Properly map the projects field, handling potential array return
      const projectsValue = updated.projects ? (Array.isArray(updated.projects) ? updated.projects[0] : updated.projects) : null;
      onSave({
        ...updated,
        projects:         projectsValue as { name: string; color: string } | null,
        time_entry_tags:  selectedTags.map(t => ({ tags: t })),
      });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await supabase.from("time_entry_tags").delete().eq("time_entry_id", entry.id);
    await supabase.from("time_entries").delete().eq("id", entry.id);
    onDelete(entry.id);
  };

  const toggleTag = (tag: Tag) => {
    setSelectedTags(prev =>
      prev.find(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    );
  };

  const filteredTags = allTags.filter(t =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onMouseDown={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Edit entry</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <input
              className={styles.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What were you working on?"
              autoFocus
            />
          </div>

          {/* Project */}
          <div className={styles.field}>
            <label className={styles.label}>Project</label>
            <div className={styles.chips}>
              <button
                className={`${styles.chip} ${!selectedProject ? styles.chipSelected : ""}`}
                onClick={() => setSelectedProject(null)}
              >
                <span className={styles.chipDotEmpty} />
                No project
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  className={`${styles.chip} ${selectedProject?.id === p.id ? styles.chipSelected : ""}`}
                  onClick={() => setSelectedProject(p)}
                  style={selectedProject?.id === p.id ? { borderColor: p.color, background: p.color + "18" } : {}}
                >
                  <span className={styles.chipDot} style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label className={styles.label}>Tags</label>
            {allTags.length > 5 && (
              <input
                className={`${styles.input} ${styles.inputSm}`}
                placeholder="Search tags…"
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
              />
            )}
            <div className={styles.chips}>
              {filteredTags.map(tag => {
                const active = !!selectedTags.find(t => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    className={`${styles.chip} ${active ? styles.chipTagActive : ""}`}
                    onClick={() => toggleTag(tag)}
                    style={active ? { borderColor: tag.color, background: tag.color + "18", color: tag.color } : {}}
                  >
                    <span className={styles.chipDot} style={{ background: tag.color }} />
                    {tag.name}
                  </button>
                );
              })}
              {filteredTags.length === 0 && (
                <span className={styles.noTags}>No tags yet</span>
              )}
            </div>
          </div>

          {/* Time */}
          <div className={styles.field}>
            <label className={styles.label}>Time</label>
            <div className={styles.timeRow}>
              <div className={styles.timeGroup}>
                <span className={styles.timeSubLabel}>Start</span>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>
              {entry.stopped_at && (
                <>
                  <span className={styles.timeSep}>–</span>
                  <div className={styles.timeGroup}>
                    <span className={styles.timeSubLabel}>End</span>
                    <input
                      type="time"
                      className={styles.timeInput}
                      value={stopTime}
                      onChange={e => setStopTime(e.target.value)}
                    />
                  </div>
                  <div className={styles.timeGroup}>
                    <span className={styles.timeSubLabel}>Duration</span>
                    <span className={styles.durDisplay}>
                      {duration !== null ? fmtDur(duration) : "—"}
                    </span>
                  </div>
                </>
              )}
              {!entry.stopped_at && (
                <span className={styles.runningBadge}>Running</span>
              )}
            </div>
          </div>

          {/* Billable */}
          <div className={styles.field}>
            <button
              className={`${styles.billableBtn} ${billable ? styles.billableBtnOn : ""}`}
              onClick={() => setBillable(v => !v)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              {billable ? "Billable" : "Non-billable"}
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <button
              className={`${styles.deleteBtn} ${confirmDelete ? styles.deleteBtnConfirm : ""}`}
              onClick={handleDelete}
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
            {confirmDelete && (
              <button className={styles.cancelDeleteBtn} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            )}
          </div>
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
