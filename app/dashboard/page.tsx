"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./dashboard.module.css";
import { EditEntryModal, type EntryForEdit } from "@/components/EditEntryModal";

interface Tag {
  id: string;
  name: string;
  color: string;
}
interface EntryRow {
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

function entryDuration(e: EntryRow, mounted = true): number {
  if (e.stopped_at) return e.duration ?? 0;
  if (!mounted) return 0;
  return Math.floor((Date.now() - new Date(e.started_at).getTime()) / 1000);
}

function fmtHHMMSS(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function fmtHHMM(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date(),
    yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const [editingEntry, setEditingEntry] = useState<EntryRow | null>(null);

  // setMounted on first client render, then tick every second for live durations
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function load() {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data } = await supabase
        .from("time_entries")
        .select(
          `
          id, description, started_at, stopped_at, duration, billable, project_id,
          projects (name, color),
          time_entry_tags (tags (id, name, color))
        `,
        )
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false });

      // Properly map the data, handling potential array returns from FK queries
      const mappedEntries: EntryRow[] = (data ?? []).map((item: any) => ({
        id: item.id,
        description: item.description,
        started_at: item.started_at,
        stopped_at: item.stopped_at,
        duration: item.duration,
        billable: item.billable,
        project_id: item.project_id,
        projects: item.projects
          ? Array.isArray(item.projects)
            ? item.projects[0]
            : item.projects
          : null,
        time_entry_tags: item.time_entry_tags ?? [],
      }));

      setEntries(mappedEntries);
      setLoading(false);
    }
    load();
  }, []);

  // ── Weekly stats ────────────────────────────────────────────
  const monday = startOfWeek();
  const todayStr = new Date().toDateString();
  const weekEntries = entries.filter((e) => new Date(e.started_at) >= monday);
  const todayEntries = entries.filter(
    (e) => new Date(e.started_at).toDateString() === todayStr,
  );
  const totalSecs = weekEntries.reduce(
    (s, e) => s + entryDuration(e, mounted),
    0,
  );
  const billableSecs = weekEntries
    .filter((e) => e.billable && e.stopped_at)
    .reduce((s, e) => s + entryDuration(e, mounted), 0);
  const todaySecs = todayEntries.reduce(
    (s, e) => s + entryDuration(e, mounted),
    0,
  );
  const activeProjects = new Set(
    weekEntries.map((e) => e.project_id).filter(Boolean),
  ).size;

  // ── Group by day ────────────────────────────────────────────
  const groups: { dateKey: string; label: string; entries: EntryRow[] }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const key = new Date(e.started_at).toDateString();
    if (!seen.has(key)) {
      seen.add(key);
      groups.push({
        dateKey: key,
        label: dayLabel(key),
        entries: entries.filter(
          (x) => new Date(x.started_at).toDateString() === key,
        ),
      });
    }
  }

  // ── Resume handler ──────────────────────────────────────────
  const resume = (entry: EntryRow) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(
      new CustomEvent("ouratime:resume", {
        detail: {
          description: entry.description,
          project:
            entry.project_id && entry.projects
              ? { id: entry.project_id, ...entry.projects }
              : null,
          tags: entry.time_entry_tags
            .map((t) => t.tags)
            .filter((t): t is Tag => t !== null),
          billable: entry.billable,
        },
      }),
    );
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>Loading…</p>
      </main>
    );
  }

  return (
    <>
      <main className={styles.page}>
        {/* ── Stats ── */}
        <div className={styles.statsRow}>
          <div className={styles.card}>
            <p className={styles.statLabel}>Today</p>
            <p className={`${styles.statValue} ${styles.statValueTeal}`}>
              {fmtHHMM(todaySecs)}
            </p>
          </div>

          <div className={styles.card}>
            <p className={styles.statLabel}>Total This Week</p>
            <p className={styles.statValue}>{fmtHHMM(totalSecs)}</p>
          </div>

          <div className={styles.card}>
            <p className={styles.statLabel}>Billable Hours</p>
            <p className={`${styles.statValue} ${styles.statValueTeal}`}>
              {fmtHHMM(billableSecs)}
            </p>
          </div>

          <div className={styles.card}>
            <p className={styles.statLabel}>Active Projects</p>
            <p className={styles.statValue}>
              {String(activeProjects).padStart(2, "0")}
            </p>
          </div>
        </div>

        {/* ── Entries ── */}
        {groups.length === 0 ? (
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p>No time entries yet.</p>
            <p>Start the timer above to track your first entry.</p>
          </div>
        ) : (
          <div className={styles.groups}>
            {groups.map((g) => {
              const groupTotal = g.entries.reduce(
                (s, e) => s + entryDuration(e, mounted),
                0,
              );
              return (
                <div key={g.dateKey} className={styles.group}>
                  <div className={styles.groupHeader}>
                    <span className={styles.groupLabel}>{g.label}</span>
                    <span className={styles.groupTotal}>
                      {fmtHHMMSS(groupTotal)}
                    </span>
                  </div>

                  <div className={styles.entryCard}>
                    {g.entries.map((entry, idx) => {
                      const tags = entry.time_entry_tags
                        .map((t) => t.tags)
                        .filter((t): t is Tag => t !== null);
                      const dur = entryDuration(entry, mounted);
                      const running = !entry.stopped_at;
                      return (
                        <div
                          key={entry.id}
                          className={`${styles.entryRow} ${idx < g.entries.length - 1 ? styles.entryRowBorder : ""}`}
                        >
                          {/* Icon */}
                          <div
                            className={`${styles.entryIcon} ${running ? styles.entryIconRunning : ""}`}
                          >
                            {running ? (
                              <span className={styles.runningDot} />
                            ) : (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                            )}
                          </div>

                          {/* Main info */}
                          <div className={styles.entryMain}>
                            <span className={styles.entryDesc}>
                              {entry.description || (
                                <span className={styles.noDesc}>
                                  No description
                                </span>
                              )}
                            </span>
                            <div className={styles.entryMeta}>
                              {entry.projects && (
                                <span className={styles.projectChip}>
                                  <span
                                    className={styles.projectDot}
                                    style={{ background: entry.projects.color }}
                                  />
                                  {entry.projects.name}
                                </span>
                              )}
                              {tags.map((tag) => (
                                <span
                                  key={tag.id}
                                  className={styles.tagChip}
                                  style={{
                                    background: tag.color + "22",
                                    color: tag.color,
                                  }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Duration + actions */}
                          <div className={styles.entryRight}>
                            <span
                              className={`${styles.duration} ${entry.billable ? styles.durationBillable : ""} ${running ? styles.durationRunning : ""}`}
                            >
                              {fmtHHMMSS(dur)}
                            </span>
                            <button
                              className={styles.editBtn}
                              onClick={() => setEditingEntry(entry)}
                              title="Edit entry"
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {!running && (
                              <button
                                className={styles.playBtn}
                                onClick={() => resume(entry)}
                                title="Continue tracking"
                              >
                                <svg
                                  width="9"
                                  height="11"
                                  viewBox="0 0 9 11"
                                  fill="currentColor"
                                >
                                  <path d="M0 0l9 5.5L0 11V0z" />
                                </svg>
                              </button>
                            )}
                            {running && (
                              <div className={styles.playBtnSpacer} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry as EntryForEdit}
          onClose={() => setEditingEntry(null)}
          onSave={(updated) => {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === updated.id ? (updated as EntryRow) : e,
              ),
            );
            setEditingEntry(null);
          }}
          onDelete={(id) => {
            setEntries((prev) => prev.filter((e) => e.id !== id));
            setEditingEntry(null);
          }}
        />
      )}
    </>
  );
}
