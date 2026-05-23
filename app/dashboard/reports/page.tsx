"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./reports.module.css";

interface Entry {
  id: string;
  description: string | null;
  started_at: string;
  stopped_at: string | null;
  duration: number | null;
  billable: boolean;
  project_id: string | null;
  projects: { name: string; color: string; hourly_rate: number } | null;
}

interface ProjectSlice {
  id: string;
  name: string;
  color: string;
  secs: number;
  pct: number;
}

const NO_PROJECT_COLOR = "#D4D0CC";
const PERIODS = [
  { key: "7d",     label: "Last 7 Days" },
  { key: "30d",    label: "Last 30 Days" },
  { key: "90d",    label: "Last 90 Days" },
  { key: "custom", label: "Custom" },
] as const;
type Period = (typeof PERIODS)[number]["key"];

// ── Date helpers ─────────────────────────────────────────────────────────────
function getPeriodRange(period: Exclude<Period, "custom">): { from: Date; to: Date } {
  const now = new Date();
  const eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const days = period === "7d" ? 6 : period === "30d" ? 29 : 89;
  const from = new Date(eod);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to: eod };
}

function fmtH(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtHHMM(s: number) {
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}

// ── Donut chart ──────────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arc(
  cx: number,
  cy: number,
  oR: number,
  iR: number,
  a1: number,
  a2: number,
) {
  const os = polar(cx, cy, oR, a1),
    oe = polar(cx, cy, oR, a2);
  const is = polar(cx, cy, iR, a1),
    ie = polar(cx, cy, iR, a2);
  const lg = a2 - a1 > 180 ? 1 : 0;
  return `M${os.x} ${os.y} A${oR} ${oR} 0 ${lg} 1 ${oe.x} ${oe.y} L${ie.x} ${ie.y} A${iR} ${iR} 0 ${lg} 0 ${is.x} ${is.y}Z`;
}

function DonutChart({
  slices,
  totalSecs,
  hoveredId,
  onHover,
}: {
  slices: ProjectSlice[];
  totalSecs: number;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const cx = 110,
    cy = 110,
    oR = 88,
    iR = 60,
    GAP = 1.8;
  let angle = 0;
  const segs = slices.map((s) => {
    const sweep = (s.pct / 100) * 360;
    const a1 = angle + GAP / 2,
      a2 = angle + sweep - GAP / 2;
    angle += sweep;
    return { ...s, a1, a2 };
  });
  const hov = hoveredId ? slices.find((s) => s.id === hoveredId) : null;

  return (
    <svg viewBox="0 0 220 220" className={styles.donutSvg}>
      {segs.map((s) => (
        <path
          key={s.id}
          d={arc(cx, cy, oR + (hoveredId === s.id ? 7 : 0), iR, s.a1, s.a2)}
          fill={s.color}
          opacity={hoveredId && hoveredId !== s.id ? 0.25 : 1}
          style={{ transition: "all 0.18s ease", cursor: "pointer" }}
          onMouseEnter={() => onHover(s.id)}
          onMouseLeave={() => onHover(null)}
        />
      ))}
      <text x={cx} y={cy - 11} textAnchor="middle" className={styles.donutBig}>
        {hov ? fmtH(hov.secs) : fmtH(totalSecs)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" className={styles.donutSm}>
        {hov ? hov.name : "total"}
      </text>
      {hov && (
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          className={styles.donutPct}
        >
          {hov.pct.toFixed(1)}%
        </text>
      )}
    </svg>
  );
}

// ── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({
  data,
  period,
}: {
  data: { label: string; secs: number }[];
  period: Period;
}) {
  const [hov, setHov] = useState<number | null>(null);
  const W = 560,
    H = 210,
    PL = 36,
    PB = 32,
    PT = 14,
    PR = 8;
  const cW = W - PL - PR,
    cH = H - PT - PB;

  const maxSecs = Math.max(...data.map((d) => d.secs), 1800);
  const maxH = Math.ceil(maxSecs / 3600);
  const yMax = Math.max(maxH, 1) * 3600;
  const yTicks =
    maxH <= 4
      ? Array.from({ length: maxH + 1 }, (_, i) => i)
      : maxH <= 8
        ? [0, Math.round(maxH / 2), maxH]
        : [
            0,
            Math.round(maxH / 4),
            Math.round(maxH / 2),
            Math.round((maxH * 3) / 4),
            maxH,
          ];

  const step = cW / data.length;
  const bW = Math.max(3, step * 0.55);
  const isWeek = period === "7d";
  const every =
    data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 31 ? 7 : 14;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.barSvg}>
      {/* Grid */}
      {yTicks.map((h) => {
        const y = PT + cH - ((h * 3600) / yMax) * cH;
        return (
          <g key={h}>
            <line
              x1={PL}
              y1={y}
              x2={W - PR}
              y2={y}
              stroke={h === 0 ? "#e0ddd9" : "#f3f1ef"}
              strokeWidth={h === 0 ? 1.5 : 1}
            />
            <text
              x={PL - 5}
              y={y + 4}
              textAnchor="end"
              className={styles.axisLbl}
            >
              {h}h
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const bH = d.secs > 0 ? Math.max(4, (d.secs / yMax) * cH) : 0;
        const x = PL + i * step + (step - bW) / 2;
        const y = PT + cH - bH;
        const isHov = hov === i;
        const faded = hov !== null && !isHov;

        return (
          <g
            key={i}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <rect
              x={PL + i * step}
              y={PT}
              width={step}
              height={cH + PB}
              fill="transparent"
            />
            {bH > 0 && (
              <rect
                x={x}
                y={y}
                width={bW}
                height={bH}
                rx={Math.min(4, bW / 2)}
                fill="#008080"
                opacity={faded ? 0.2 : isHov ? 1 : 0.7}
                style={{ transition: "opacity 0.12s" }}
              />
            )}
            {isHov &&
              d.secs > 0 &&
              (() => {
                const tx = Math.min(Math.max(x + bW / 2, PL + 30), W - PR - 30);
                const ty = Math.max(y - 30, PT + 2);
                return (
                  <g>
                    <rect
                      x={tx - 28}
                      y={ty}
                      width={56}
                      height={20}
                      rx={5}
                      fill="#050505"
                    />
                    <text
                      x={tx}
                      y={ty + 14}
                      textAnchor="middle"
                      className={styles.tooltip}
                    >
                      {fmtH(d.secs)}
                    </text>
                  </g>
                );
              })()}
            {i % every === 0 && (
              <text
                x={PL + i * step + step / 2}
                y={H - 6}
                textAnchor="middle"
                className={styles.axisLbl}
              >
                {isWeek ? d.label : (d.label.split(" ")[1] ?? d.label)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(entries: Entry[], profileRate: number, period: string) {
  const header = ["Date", "Description", "Project", "Start", "End", "Duration (h)", "Billable", "Amount (USD)"];
  const rows = entries.map((e) => {
    const dur = e.duration ?? 0;
    const rate = (e.projects?.hourly_rate ?? 0) > 0 ? e.projects!.hourly_rate : profileRate;
    const amount = e.billable ? (dur / 3600) * rate : 0;
    const started = new Date(e.started_at);
    const stopped = e.stopped_at ? new Date(e.stopped_at) : null;
    return [
      started.toLocaleDateString(),
      e.description ?? "",
      e.projects?.name ?? "No project",
      started.toLocaleTimeString(),
      stopped ? stopped.toLocaleTimeString() : "",
      (dur / 3600).toFixed(2),
      e.billable ? "Yes" : "No",
      amount > 0 ? amount.toFixed(2) : "",
    ];
  });

  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ouratime-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovProject, setHovProject] = useState<string | null>(null);
  const [profileRate, setProfileRate] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("hourly_rate").eq("id", user.id).single();
      setProfileRate(data?.hourly_rate ?? 0);
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);

      let from: Date, to: Date;
      if (period === "custom") {
        if (!customFrom || !customTo) { setLoading(false); return; }
        from = new Date(customFrom + "T00:00:00");
        to   = new Date(customTo   + "T23:59:59.999");
      } else {
        ({ from, to } = getPeriodRange(period));
      }

      const { data } = await supabase
        .from("time_entries")
        .select(
          "id, description, started_at, stopped_at, duration, billable, project_id, projects(name,color,hourly_rate)",
        )
        .gte("started_at", from.toISOString())
        .lte("started_at", to.toISOString())
        .not("stopped_at", "is", null)
        .order("started_at");

      // Properly map the data, handling potential array returns from FK queries
      const mappedEntries: Entry[] = (data ?? []).map((item: any) => ({
        id: item.id,
        description: item.description ?? null,
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
      }));

      setEntries(mappedEntries);
      setLoading(false);
    }
    load();
  }, [period, customFrom, customTo]);

  const { totalSecs, billableSecs, billableAmount, avgDailySecs, slices, bars } = useMemo(() => {
    let totalSecs = 0, billableSecs = 0, billableAmount = 0;
    const pMap: Record<string, { name: string; color: string; secs: number }> = {};
    const daySet = new Set<string>();

    for (const e of entries) {
      const s = e.duration ?? 0;
      totalSecs += s;
      daySet.add(new Date(e.started_at).toDateString());
      if (e.billable) {
        billableSecs += s;
        const rate = (e.projects?.hourly_rate ?? 0) > 0 ? e.projects!.hourly_rate : profileRate;
        billableAmount += (s / 3600) * rate;
      }
      const key = e.project_id ?? "__none__";
      if (!pMap[key])
        pMap[key] = {
          name: e.projects?.name ?? "No project",
          color: e.projects?.color ?? NO_PROJECT_COLOR,
          secs: 0,
        };
      pMap[key].secs += s;
    }

    const slices: ProjectSlice[] = Object.entries(pMap)
      .map(([id, v]) => ({
        id,
        ...v,
        pct: totalSecs > 0 ? (v.secs / totalSecs) * 100 : 0,
      }))
      .sort((a, b) => b.secs - a.secs);

    // Daily bars
    let barFrom: Date, barTo: Date;
    if (period === "custom") {
      barFrom = customFrom ? new Date(customFrom + "T00:00:00") : new Date();
      barTo   = customTo   ? new Date(customTo   + "T23:59:59") : new Date();
    } else {
      ({ from: barFrom, to: barTo } = getPeriodRange(period));
    }
    const dayMap: Record<string, number> = {};
    for (const e of entries) {
      const k = new Date(e.started_at).toDateString();
      dayMap[k] = (dayMap[k] ?? 0) + (e.duration ?? 0);
    }
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const bars: { label: string; secs: number }[] = [];
    const cur = new Date(barFrom);
    cur.setHours(0, 0, 0, 0);
    const isWeek = period === "7d";
    while (cur <= barTo) {
      bars.push({
        label: isWeek
          ? DAYS[cur.getDay()]
          : `${MONS[cur.getMonth()]} ${cur.getDate()}`,
        secs: dayMap[cur.toDateString()] ?? 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    const avgDailySecs = daySet.size > 0 ? totalSecs / daySet.size : 0;
    return { totalSecs, billableSecs, billableAmount, avgDailySecs, slices, bars };
  }, [entries, period, profileRate, customFrom, customTo]);

  const billPct = totalSecs > 0 ? Math.round((billableSecs / totalSecs) * 100) : 0;
  const topSlice = slices[0];
  const isEmpty = !loading && entries.length === 0;

  const STAT_KEYS = ["total","billable_time","billable_hours","amount","avg_daily","top_project","entries"] as const;
  type StatKey = typeof STAT_KEYS[number];
  const STAT_LABELS: Record<StatKey, string> = {
    total: "Total tracked", billable_time: "Billable time", billable_hours: "Billable hours",
    amount: "Amount", avg_daily: "Avg daily hours", top_project: "Top project", entries: "Entries",
  };

  const STATS_LS_KEY = "ouratime:reports-stats";
  const [visibleStats, setVisibleStats] = useState<Record<StatKey, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STATS_LS_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch {}
    return { total: true, billable_time: true, billable_hours: true, amount: true, avg_daily: true, top_project: true, entries: true };
  });
  const [showCustomize, setShowCustomize] = useState(false);

  function toggleStat(key: StatKey) {
    setVisibleStats(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STATS_LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <main className={styles.page}>
      {/* ── Top bar: period tabs + customize ── */}
      <div className={styles.topBar}>
        <div className={styles.tabs}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`${styles.tab} ${period === p.key ? styles.tabActive : ""}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className={styles.topBarRight}>
          {!isEmpty && (
            <button
              className={styles.exportBtn}
              onClick={() => exportCSV(entries, profileRate, period)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          )}

          <div className={styles.customizeWrap}>
          <button className={styles.customizeBtn} onClick={() => setShowCustomize(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Customize
          </button>
          {showCustomize && (
            <div className={styles.customizeMenu}>
              <div className={styles.customizeTitle}>Show / hide stats</div>
              {STAT_KEYS.map(key => (
                <label key={key} className={styles.customizeRow}>
                  <input
                    type="checkbox"
                    checked={visibleStats[key]}
                    onChange={() => toggleStat(key)}
                    className={styles.customizeCheck}
                  />
                  <span>{STAT_LABELS[key]}</span>
                </label>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ── Custom date range ── */}
      {period === "custom" && (
        <div className={styles.customRange}>
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className={styles.dateInput}
          />
          <span className={styles.dateRangeSep}>to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className={styles.dateInput}
          />
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : isEmpty ? (
        <div className={styles.emptyState}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
            <path d="M7 8h4M7 11h6" />
          </svg>
          <p>No tracked time for this period.</p>
          <p>Start the timer to see your stats here.</p>
        </div>
      ) : (
        <>
          {/* ── Stats ── */}
          <div className={styles.statsRow}>
            {visibleStats.total && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Total tracked</p>
                <p className={`${styles.statVal} ${styles.teal}`}>{fmtHHMM(totalSecs)}</p>
              </div>
            )}
            {visibleStats.billable_time && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Billable time</p>
                <p className={styles.statVal}>{fmtHHMM(billableSecs)}</p>
                <p className={styles.statSub}>{billPct}% of total</p>
              </div>
            )}
            {visibleStats.billable_hours && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Billable hours</p>
                <p className={styles.statVal}>{fmtH(billableSecs)}</p>
              </div>
            )}
            {visibleStats.amount && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Amount</p>
                <p className={`${styles.statVal} ${styles.teal}`}>
                  {billableAmount > 0 ? `$${billableAmount.toFixed(2)}` : "—"}
                </p>
                {profileRate === 0 && billableAmount === 0 && (
                  <p className={styles.statSub}>Set rate in Settings</p>
                )}
              </div>
            )}
            {visibleStats.avg_daily && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Avg daily hours</p>
                <p className={styles.statVal}>{fmtH(Math.round(avgDailySecs))}</p>
              </div>
            )}
            {visibleStats.top_project && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Top project</p>
                {topSlice ? (
                  <p className={`${styles.statVal} ${styles.statValMd}`}>
                    <span className={styles.topDot} style={{ background: topSlice.color }} />
                    {topSlice.name}
                  </p>
                ) : (
                  <p className={styles.statVal}>—</p>
                )}
              </div>
            )}
            {visibleStats.entries && (
              <div className={styles.statCard}>
                <p className={styles.statLbl}>Entries</p>
                <p className={styles.statVal}>{entries.length}</p>
              </div>
            )}
          </div>

          {/* ── Charts ── */}
          <div className={styles.chartsRow}>
            {/* Donut */}
            <div className={styles.chartCard}>
              <p className={styles.chartTitle}>Time by project</p>
              <div className={styles.donutLayout}>
                <DonutChart
                  slices={slices}
                  totalSecs={totalSecs}
                  hoveredId={hovProject}
                  onHover={setHovProject}
                />
                <div className={styles.legend}>
                  {slices.map((s) => (
                    <div
                      key={s.id}
                      className={`${styles.legendRow} ${hovProject && hovProject !== s.id ? styles.legendFade : ""}`}
                      onMouseEnter={() => setHovProject(s.id)}
                      onMouseLeave={() => setHovProject(null)}
                    >
                      <span
                        className={styles.legendDot}
                        style={{ background: s.color }}
                      />
                      <span className={styles.legendName}>{s.name}</span>
                      <span className={styles.legendTime}>{fmtH(s.secs)}</span>
                      <span className={styles.legendPct}>
                        {s.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar */}
            <div className={`${styles.chartCard} ${styles.barCard}`}>
              <p className={styles.chartTitle}>Daily activity</p>
              <BarChart data={bars} period={period} />
            </div>
          </div>

          {/* ── Project breakdown ── */}
          <div className={styles.breakdownCard}>
            <p className={styles.chartTitle}>Project breakdown</p>
            <div className={styles.breakList}>
              {slices.map((s, i) => (
                <div
                  key={s.id}
                  className={styles.breakRow}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className={styles.breakInfo}>
                    <span
                      className={styles.breakDot}
                      style={{ background: s.color }}
                    />
                    <span className={styles.breakName}>{s.name}</span>
                  </div>
                  <div className={styles.breakTrack}>
                    <div
                      className={styles.breakFill}
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                  <span className={styles.breakTime}>{fmtHHMM(s.secs)}</span>
                  <span className={styles.breakPct}>{s.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
