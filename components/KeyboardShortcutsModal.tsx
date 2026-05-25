"use client";

import { useEffect } from "react";
import styles from "./KeyboardShortcutsModal.module.css";

const GROUPS = [
  {
    label: "Timer",
    shortcuts: [
      { keys: ["⇧", "Space"], desc: "Start or stop the timer" },
      { keys: ["Enter"],       desc: "Start timer (when description is focused)" },
    ],
  },
  {
    label: "General",
    shortcuts: [
      { keys: ["Esc"], desc: "Close any open panel or dropdown" },
      { keys: ["?"],   desc: "Show this shortcuts reference" },
    ],
  },
];

interface Props { onClose: () => void; }

export function KeyboardShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Keyboard shortcuts</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {GROUPS.map((group) => (
            <div key={group.label} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.shortcuts.map((s) => (
                <div key={s.desc} className={styles.row}>
                  <span className={styles.desc}>{s.desc}</span>
                  <span className={styles.keys}>
                    {s.keys.map((k, i) => (
                      <span key={i} className={styles.keysWrap}>
                        <kbd className={styles.kbd}>{k}</kbd>
                        {i < s.keys.length - 1 && <span className={styles.plus}>+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          Press <kbd className={styles.kbdInline}>?</kbd> anytime to open this
        </div>
      </div>
    </div>
  );
}
