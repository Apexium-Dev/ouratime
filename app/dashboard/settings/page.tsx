"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const [hourlyRate, setHourlyRate] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");

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

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

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
    </main>
  );
}
