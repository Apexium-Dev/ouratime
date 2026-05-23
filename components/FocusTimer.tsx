"use client";

import styles from "./FocusTimer.module.css";

interface Project { name: string; color: string; }

interface Props {
  elapsed: number;
  description: string;
  project: Project | null;
  animations: boolean;
  onStop: () => void;
  onMinimize: () => void;
}

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function FocusTimer({ elapsed, description, project, animations, onStop, onMinimize }: Props) {
  return (
    <div className={styles.overlay}>
      {/* Background layers */}
      <div className={styles.grid} aria-hidden="true" />
      {animations && <div className={styles.breathe} aria-hidden="true" />}

      {/* Minimize button top-right */}
      <button className={styles.minimizeBtn} onClick={onMinimize} aria-label="Minimize focus mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
          <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
        </svg>
      </button>

      {/* Center content */}
      <div className={styles.center}>
        {/* Running indicator */}
        <div className={styles.runningPill}>
          <span className={styles.runningDot} />
          Tracking
        </div>

        {/* Timer */}
        <div className={styles.timer}>{fmt(elapsed)}</div>

        {/* Description + project */}
        <div className={styles.meta}>
          <p className={styles.desc}>{description || "No description"}</p>
          {project && (
            <div className={styles.project}>
              <span className={styles.projectDot} style={{ background: project.color }} />
              {project.name}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.stopBtn} onClick={onStop}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
            Stop timer
          </button>
          <button className={styles.ghostBtn} onClick={onMinimize}>
            Keep running in background
          </button>
        </div>
      </div>
    </div>
  );
}
