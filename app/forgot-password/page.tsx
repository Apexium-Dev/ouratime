"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AuthNavbar } from "@/components/AuthNavbar";
import styles from "../auth.module.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Check your email — we sent a password reset link.");
        setEmail("");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <AuthNavbar />
      <main className={styles.main}>
        <div className={styles.card}>
          <Link href="/" className={styles.cardBrand}>ouratime</Link>
          <h1 className={styles.cardTitle}>Reset your password</h1>
          <p className={styles.cardSubtitle}>
            Enter your email and we&apos;ll send you a reset link
          </p>

          <form className={styles.form} onSubmit={handleReset}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="email">Email address</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}
            {success && <p className={styles.successMsg}>{success}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <hr className={styles.divider} />
          <p className={styles.switchText}>
            <Link href="/login" className={styles.switchLink}>← Back to sign in</Link>
          </p>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/" className={styles.footerLogo}>ouratime</Link>
          <p className={styles.footerCopy}>© 2025 ouratime. Open-source time tracking.</p>
          <div className={styles.footerLinks}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
