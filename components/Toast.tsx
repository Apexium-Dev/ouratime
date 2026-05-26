"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const DURATION = 3800;

/* ── Public API ─────────────────────────────────────────── */
export function showToast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ouratime:toast", { detail: { message, type } }),
  );
}

/* ── Icons ──────────────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ── Single toast ───────────────────────────────────────── */
function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div className={`${styles.toast} ${styles[item.type]}`} role="alert">
      <div className={styles.icon}>
        {item.type === "success" && <CheckIcon />}
        {item.type === "error"   && <ErrorIcon />}
        {item.type === "info"    && <InfoIcon />}
      </div>
      <span className={styles.message}>{item.message}</span>
      <button className={styles.closeBtn} onClick={() => onDismiss(item.id)} aria-label="Dismiss">
        <CloseIcon />
      </button>
      <div
        className={styles.progress}
        style={{ animationDuration: `${DURATION}ms` }}
      />
    </div>
  );
}

/* ── Provider — mount once in root layout ───────────────── */
export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]); // cap at 5
      setTimeout(() => dismiss(id), DURATION);
    };
    window.addEventListener("ouratime:toast", handler);
    return () => window.removeEventListener("ouratime:toast", handler);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
