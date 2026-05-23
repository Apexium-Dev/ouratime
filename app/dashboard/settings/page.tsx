"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  NAV_ITEMS,
  loadSidebarConfig,
  saveSidebarConfig,
  defaultConfig,
  type SidebarEntry,
} from "@/lib/sidebarConfig";
import styles from "./settings.module.css";

type Tab = "profile" | "time" | "billing" | "sidebar" | "security";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  // ── Profile ──────────────────────────────────────────
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Time ─────────────────────────────────────────────
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [timeSaving, setTimeSaving] = useState(false);
  const [timeSaved, setTimeSaved] = useState(false);
  const [timeError, setTimeError] = useState("");

  // ── Billing ───────────────────────────────────────────
  const [hourlyRate, setHourlyRate] = useState("");
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);
  const [billingError, setBillingError] = useState("");

  // ── Security ──────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwSaved, setPwSaved]     = useState(false);
  const [pwError, setPwError]     = useState("");

  // ── Sidebar ───────────────────────────────────────────
  const [sidebarConfig, setSidebarConfig] = useState<SidebarEntry[]>(() =>
    NAV_ITEMS.map((n) => ({ href: n.href, visible: true })),
  );

  // ── Load ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select(
          "full_name, username, avatar_url, hourly_rate, timezone, date_format, time_format",
        )
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        if (data.hourly_rate != null) setHourlyRate(String(data.hourly_rate));
        if (data.timezone) setTimezone(data.timezone);
        if (data.date_format) setDateFormat(data.date_format);
        if (data.time_format) setTimeFormat(data.time_format);
      }
    });
    setSidebarConfig(loadSidebarConfig());
  }, []);

  // ── Avatar pick ───────────────────────────────────────
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Save profile ──────────────────────────────────────
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    const name = fullName.trim();
    const uname = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (uname && uname.length < 3) {
      setProfileError("Username must be at least 3 characters.");
      return;
    }
    setProfileSaving(true);

    let newAvatarUrl = avatarUrl;
    if (avatarFile && userId) {
      const ext = avatarFile.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });
      if (upErr) {
        setProfileError("Upload failed: " + upErr.message);
        setProfileSaving(false);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      newAvatarUrl = `${publicUrl}?t=${Date.now()}`;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name || null,
        username: uname || null,
        avatar_url: newAvatarUrl,
      })
      .eq("id", userId);

    setProfileSaving(false);
    if (error) {
      setProfileError(
        error.message.includes("unique")
          ? "That username is taken."
          : error.message,
      );
      return;
    }
    setAvatarUrl(newAvatarUrl);
    setAvatarFile(null);
    setAvatarPreview(null);
    setUsername(uname);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  // ── Save time ─────────────────────────────────────────
  const saveTime = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimeError("");
    setTimeSaved(false);
    setTimeSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ timezone, date_format: dateFormat, time_format: timeFormat })
      .eq("id", userId);
    setTimeSaving(false);
    if (error) {
      setTimeError(error.message);
      return;
    }
    setTimeSaved(true);
    setTimeout(() => setTimeSaved(false), 3000);
  };

  // ── Save billing ──────────────────────────────────────
  const saveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingError("");
    setBillingSaved(false);
    const rate = parseFloat(hourlyRate);
    if (hourlyRate !== "" && (isNaN(rate) || rate < 0)) {
      setBillingError("Please enter a valid hourly rate.");
      return;
    }
    setBillingSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ hourly_rate: hourlyRate === "" ? null : rate })
      .eq("id", userId);
    setBillingSaving(false);
    if (error) {
      setBillingError(error.message);
      return;
    }
    setBillingSaved(true);
    setTimeout(() => setBillingSaved(false), 3000);
  };

  // ── Change password ───────────────────────────────────
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSaved(false);
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwSaving(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (signInErr) {
      setPwError("Current password is incorrect.");
      setPwSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 3000);
  };

  // ── Sidebar ───────────────────────────────────────────
  const toggleVisible = (href: string) => {
    const next = sidebarConfig.map((e) =>
      e.href === href ? { ...e, visible: !e.visible } : e,
    );
    if (next.every((e) => !e.visible)) return;
    setSidebarConfig(next);
    saveSidebarConfig(next);
  };
  const resetSidebar = () => {
    const next = defaultConfig();
    setSidebarConfig(next);
    saveSidebarConfig(next);
  };
  const visibleCount = sidebarConfig.filter((e) => e.visible).length;

  const displaySrc = avatarPreview ?? avatarUrl;
  const initials = fullName.trim()
    ? fullName
        .trim()
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : (email[0]?.toUpperCase() ?? "?");

  return (
    <main className={styles.page}>
      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === "profile" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("profile")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Profile
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "time" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("time")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Time
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "billing" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("billing")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          Billing
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "sidebar" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("sidebar")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          Sidebar
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "security" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("security")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Security
        </button>
      </div>

      {/* ── Profile ── */}
      {tab === "profile" && (
        <div className={styles.cards}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Profile</h2>
            <p className={styles.sectionDesc}>
              Your name, username and profile picture.
            </p>

            <form onSubmit={saveProfile} className={styles.profileForm}>
              <div className={styles.avatarRow}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {displaySrc ? (
                    <img
                      src={displaySrc}
                      alt="Avatar"
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span className={styles.avatarInitials}>{initials}</span>
                  )}
                  <span className={styles.avatarOverlay}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={handleAvatarChange}
                />
                <div className={styles.avatarMeta}>
                  <p className={styles.avatarHint}>
                    Click to upload a new photo
                  </p>
                  <p className={styles.avatarHintSub}>
                    JPG, PNG or WebP — max 2MB
                  </p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Full name</label>
                  <input
                    className={styles.textInput}
                    type="text"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Username</label>
                  <div className={styles.usernameWrap}>
                    <span className={styles.usernameAt}>@</span>
                    <input
                      className={styles.textInput}
                      type="text"
                      placeholder="yourhandle"
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, ""),
                        )
                      }
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    className={`${styles.textInput} ${styles.textInputReadonly}`}
                    type="email"
                    value={email}
                    readOnly
                  />
                </div>
              </div>

              {profileError && <p className={styles.error}>{profileError}</p>}
              {profileSaved && <p className={styles.success}>Profile saved!</p>}
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ── Time ── */}
      {tab === "time" && (
        <div className={styles.cards}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Time</h2>
            <p className={styles.sectionDesc}>
              Your time zone and preferred date and time format.
            </p>
            <form onSubmit={saveTime} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Time zone</label>
                <select
                  className={styles.selectInput}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {(() => {
                    const all: string[] =
                      typeof Intl !== "undefined" && "supportedValuesOf" in Intl
                        ? (Intl as any).supportedValuesOf("timeZone")
                        : [
                            "UTC",
                            "America/New_York",
                            "America/Los_Angeles",
                            "Europe/London",
                            "Europe/Paris",
                            "Europe/Berlin",
                            "Asia/Tokyo",
                            "Asia/Shanghai",
                            "Asia/Kolkata",
                            "Australia/Sydney",
                          ];
                    const popular = [
                      "UTC",
                      "America/New_York",
                      "America/Los_Angeles",
                      "America/Chicago",
                      "Europe/London",
                      "Europe/Paris",
                      "Europe/Berlin",
                      "Europe/Rome",
                      "Europe/Madrid",
                      "Asia/Tokyo",
                      "Asia/Shanghai",
                      "Asia/Dubai",
                      "Asia/Kolkata",
                      "Australia/Sydney",
                    ];
                    const rest = all.filter((tz) => !popular.includes(tz));
                    return (
                      <>
                        <optgroup label="Popular">
                          {popular
                            .filter((p) => all.includes(p))
                            .map((tz) => (
                              <option key={tz} value={tz}>
                                {tz.replace(/_/g, " ")}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="All timezones">
                          {rest.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz.replace(/_/g, " ")}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    );
                  })()}
                </select>
              </div>
              <div className={styles.timeGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Date format</label>
                  <select
                    className={styles.selectInput}
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                    <option value="MMM D, YYYY">MMM D, YYYY</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Time format</label>
                  <div className={styles.toggleGroup}>
                    {(["24h", "12h"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`${styles.toggleBtn} ${timeFormat === f ? styles.toggleBtnActive : ""}`}
                        onClick={() => setTimeFormat(f)}
                      >
                        {f === "24h" ? "24h  (14:30)" : "12h  (2:30 PM)"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {timeError && <p className={styles.error}>{timeError}</p>}
              {timeSaved && <p className={styles.success}>Saved!</p>}
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={timeSaving}
              >
                {timeSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ── Billing ── */}
      {tab === "billing" && (
        <div className={styles.cards}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Billing</h2>
            <p className={styles.sectionDesc}>
              Default hourly rate used to calculate earnings in reports.
            </p>
            <form onSubmit={saveBilling} className={styles.form}>
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
              {billingError && <p className={styles.error}>{billingError}</p>}
              {billingSaved && <p className={styles.success}>Saved!</p>}
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={billingSaving}
              >
                {billingSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ── Security ── */}
      {tab === "security" && (
        <div className={styles.cards}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Change password</h2>
            <p className={styles.sectionDesc}>
              Enter your current password to confirm your identity, then choose a new one.
            </p>
            <form onSubmit={changePassword} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Current password</label>
                <input
                  className={styles.textInput}
                  type="password"
                  placeholder="••••••••"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>New password</label>
                <input
                  className={styles.textInput}
                  type="password"
                  placeholder="Min. 8 characters"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm new password</label>
                <input
                  className={styles.textInput}
                  type="password"
                  placeholder="••••••••"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {pwError && <p className={styles.error}>{pwError}</p>}
              {pwSaved && <p className={styles.success}>Password updated successfully!</p>}
              <button type="submit" className={styles.saveBtn} disabled={pwSaving}>
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* ── Sidebar ── */}
      {tab === "sidebar" && (
        <div className={styles.cards}>
          <section className={styles.card}>
            <div className={styles.cardTitleRow}>
              <div>
                <h2 className={styles.sectionTitle}>Sidebar Navigation</h2>
                <p className={styles.sectionDesc}>
                  Toggle visibility. Drag items in the sidebar to reorder.
                </p>
              </div>
              <button className={styles.resetBtn} onClick={resetSidebar}>
                Reset
              </button>
            </div>
            <div className={styles.sidebarList}>
              {sidebarConfig.map((entry) => {
                const label =
                  NAV_ITEMS.find((n) => n.href === entry.href)?.label ??
                  entry.href;
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
                    >
                      {entry.visible ? (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
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
      )}
    </main>
  );
}
