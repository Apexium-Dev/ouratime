"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  NAV_ITEMS,
  loadSidebarConfig,
  saveSidebarConfig,
  defaultConfig,
  type SidebarEntry,
} from "@/lib/sidebarConfig";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const [hourlyRate, setHourlyRate] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");

  const [sidebarConfig, setSidebarConfig] = useState<SidebarEntry[]>(() =>
    NAV_ITEMS.map(n => ({ href: n.href, visible: true }))
  );

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("hourly_rate")
        .eq("id", user.id)
        .single();
      if (data?.hourly_rate != null) setHourlyRate(String(data.hourly_rate));
    });
    setSidebarConfig(loadSidebarConfig());
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);

    const rate = parseFloat(hourlyRate);
    if (hourlyRate !== "" && (isNaN(rate) || rate < 0)) {
      setError("Please enter a valid hourly rate.");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: err } = await supabase
      .from("profiles")
      .update({ hourly_rate: hourlyRate === "" ? null : rate })
      .eq("id", user.id);

    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleVisible = (href: string) => {
    const next = sidebarConfig.map(e =>
      e.href === href ? { ...e, visible: !e.visible } : e
    );
    if (next.every(e => !e.visible)) return;
    setSidebarConfig(next);
    saveSidebarConfig(next);
  };

  const resetSidebar = () => {
    const next = defaultConfig();
    setSidebarConfig(next);
    saveSidebarConfig(next);
  };

  const visibleCount = sidebarConfig.filter(e => e.visible).length;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.cards}>

        {/* ── Billing ── */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Billing</h2>
          <p className={styles.sectionDesc}>
            Set your default hourly rate. This will be used to calculate earnings in reports.
          </p>

          <form onSubmit={handleSave} className={styles.form}>
            <label className={styles.label} htmlFor="hourly-rate">
              Hourly rate
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.currencySymbol}>$</span>
              <input
                id="hourly-rate"
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
              <span className={styles.perHour}>/hr</span>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {saved && <p className={styles.success}>Saved!</p>}

            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        {/* ── Sidebar Navigation ── */}
        <section className={styles.card}>
          <div className={styles.cardTitleRow}>
            <div>
              <h2 className={styles.sectionTitle}>Sidebar Navigation</h2>
              <p className={styles.sectionDesc}>
                Toggle which pages are visible. Drag items in the sidebar to reorder them.
              </p>
            </div>
            <button className={styles.resetBtn} onClick={resetSidebar}>
              Reset
            </button>
          </div>

          <div className={styles.sidebarList}>
            {sidebarConfig.map((entry) => {
              const label = NAV_ITEMS.find(n => n.href === entry.href)?.label ?? entry.href;
              return (
                <div
                  key={entry.href}
                  className={`${styles.sidebarRow} ${!entry.visible ? styles.sidebarRowHidden : ""}`}
                >
                  <span className={styles.sidebarLabel}>{label}</span>
                  <button
                    className={`${styles.sidebarToggle} ${entry.visible ? styles.sidebarToggleOn : styles.sidebarToggleOff}`}
                    onClick={() => toggleVisible(entry.href)}
                    disabled={entry.visible && visibleCount === 1}
                    title={entry.visible ? "Hide from sidebar" : "Show in sidebar"}
                  >
                    {entry.visible ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
