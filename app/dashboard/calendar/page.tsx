"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./calendar.module.css";

interface Entry {
  id: string;
  description: string;
  started_at: string;
  stopped_at: string | null;
  duration: number | null;
  billable: boolean;
  projects: { name: string; color: string } | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmtHHMM(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtHHMMSS(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Returns the Monday that starts the display grid
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  const d = new Date(first);
  d.setDate(first.getDate() + offset);
  return d;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch the full month plus a buffer week on each side
      const from = new Date(year, month - 1, 24);
      const to = new Date(year, month + 1, 8);

      const { data } = await supabase
        .from("time_entries")
        .select(
          "id, description, started_at, stopped_at, duration, billable, projects (name, color)",
        )
        .gte("started_at", from.toISOString())
        .lte("started_at", to.toISOString())
        .order("started_at", { ascending: false });

      // Properly cast and map the data
      const mappedEntries: Entry[] = (data ?? []).map((item: any) => ({
        id: item.id,
        description: item.description,
        started_at: item.started_at,
        stopped_at: item.stopped_at,
        duration: item.duration,
        billable: item.billable,
        projects: item.projects
          ? Array.isArray(item.projects)
            ? item.projects[0]
            : item.projects
          : null,
      }));

      setEntries(mappedEntries);
      setLoading(false);
    }
    load();
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };

  // Build 42-cell grid (6 rows × 7 days)
  const start = gridStart(year, month);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  // Index entries by date string
  const byDay: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = new Date(e.started_at).toDateString();
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(e);
  }

  // Selected day entries
  const selKey = selectedDay.toDateString();
  const selEntries = byDay[selKey] ?? [];
  const selTotal = selEntries.reduce((s, e) => s + (e.duration ?? 0), 0);

  const selLabel = isSameDay(selectedDay, today)
    ? "Today"
    : selectedDay.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

  return (
    <div className={styles.page}>
      {/* ── Calendar panel ── */}
      <div className={styles.calPanel}>
        {/* Header */}
        <div className={styles.calHeader}>
          <button className={styles.navBtn} onClick={prevMonth}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 className={styles.monthTitle}>
            {MONTHS[month]} {year}
          </h2>
          <button className={styles.navBtn} onClick={nextMonth}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button
            className={styles.todayBtn}
            onClick={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth());
              setSelectedDay(today);
            }}
          >
            Today
          </button>
        </div>

        {/* Day-of-week labels */}
        <div className={styles.dayLabels}>
          {DAYS.map((d) => (
            <span key={d} className={styles.dayLabel}>
              {d}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {cells.map((cell, i) => {
            const key = cell.toDateString();
            const inMonth = cell.getMonth() === month;
            const isToday = isSameDay(cell, today);
            const isSelected = isSameDay(cell, selectedDay);
            const dayEntries = byDay[key] ?? [];
            const totalSecs = dayEntries.reduce(
              (s, e) => s + (e.duration ?? 0),
              0,
            );
            const hasRunning = dayEntries.some((e) => !e.stopped_at);

            // Up to 4 unique project colors
            const colors = [
              ...new Map(
                dayEntries
                  .filter((e) => e.projects)
                  .map((e) => [e.projects!.color, e.projects!.color]),
              ).values(),
            ].slice(0, 4);

            return (
              <button
                key={i}
                className={[
                  styles.cell,
                  !inMonth ? styles.cellOutside : "",
                  isToday ? styles.cellToday : "",
                  isSelected ? styles.cellSelected : "",
                  dayEntries.length > 0 ? styles.cellHasEntries : "",
                ].join(" ")}
                onClick={() => setSelectedDay(new Date(cell))}
              >
                <span className={styles.cellDay}>{cell.getDate()}</span>

                {totalSecs > 0 && (
                  <span className={styles.cellTime}>
                    {fmtHHMM(totalSecs)}
                    {hasRunning && <span className={styles.runningDot} />}
                  </span>
                )}

                {colors.length > 0 && (
                  <div className={styles.cellDots}>
                    {colors.map((c, idx) => (
                      <span
                        key={idx}
                        className={styles.cellDot}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day panel ── */}
      <div className={styles.dayPanel}>
        <div className={styles.dayPanelHeader}>
          <div>
            <p className={styles.dayPanelLabel}>{selLabel}</p>
            {selTotal > 0 && (
              <p className={styles.dayPanelTotal}>{fmtHHMMSS(selTotal)}</p>
            )}
          </div>
        </div>

        {loading ? (
          <p className={styles.panelEmpty}>Loading…</p>
        ) : selEntries.length === 0 ? (
          <div className={styles.panelEmptyState}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ddd"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p>
              No entries tracked
              {isSameDay(selectedDay, today) ? " today" : " this day"}.
            </p>
          </div>
        ) : (
          <div className={styles.entryList}>
            {selEntries.map((entry) => (
              <div key={entry.id} className={styles.entryRow}>
                {entry.projects && (
                  <span
                    className={styles.entryAccent}
                    style={{ background: entry.projects.color }}
                  />
                )}
                <div className={styles.entryMain}>
                  <span className={styles.entryDesc}>
                    {entry.description || (
                      <span className={styles.noDesc}>No description</span>
                    )}
                  </span>
                  {entry.projects && (
                    <span className={styles.entryProject}>
                      <span
                        className={styles.projectDot}
                        style={{ background: entry.projects.color }}
                      />
                      {entry.projects.name}
                    </span>
                  )}
                </div>
                <div className={styles.entryRight}>
                  <span
                    className={`${styles.entryDur} ${entry.billable ? styles.entryDurBillable : ""}`}
                  >
                    {entry.stopped_at ? (
                      fmtHHMMSS(entry.duration ?? 0)
                    ) : (
                      <span className={styles.running}>running</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
