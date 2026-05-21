"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AuthNavbar } from "@/components/AuthNavbar";
import styles from "../auth.module.css";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Account created! Check your email to confirm your address.");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
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
          <h1 className={styles.cardTitle}>Create your account</h1>
          <p className={styles.cardSubtitle}>Start tracking your time today — free, forever</p>

          <form className={styles.form} onSubmit={handleSignUp}>
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

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="password">Password</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                className={styles.input}
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}
            {success && <p className={styles.successMsg}>{success}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <hr className={styles.divider} />
          <p className={styles.switchText}>
            Already have an account?{" "}
            <Link href="/login" className={styles.switchLink}>Sign in</Link>
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
