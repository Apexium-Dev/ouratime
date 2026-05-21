"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AuthNavbar } from "@/components/AuthNavbar";
import authStyles from "../../auth.module.css";
import styles from "../onboarding.module.css";

export default function OnboardingProfile() {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      setError("You must agree to the Terms of Use to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error: dbError } = await supabase.from("profiles").upsert({
          id: session.user.id,
          full_name: name,
          organization,
          updated_at: new Date().toISOString(),
        });
        if (dbError) throw dbError;
      } else {
        localStorage.setItem("ouratime_onboarding_profile", JSON.stringify({ full_name: name, organization }));
      }
      window.location.href = "/onboarding/customize";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={authStyles.page}>
      <AuthNavbar />
      <main className={authStyles.main}>
        <div className={authStyles.card}>
          <Link href="/" className={authStyles.cardBrand}>ouratime</Link>

          {/* Step indicator */}
          <div className={styles.steps}>
            <div className={`${styles.stepDot} ${styles.stepDotActive}`} />
            <div className={styles.stepDot} />
          </div>

          <h1 className={authStyles.cardTitle}>Tell us about you</h1>
          <p className={authStyles.cardSubtitle}>This helps us set up your workspace</p>

          <form className={authStyles.form} onSubmit={handleContinue}>
            <div className={authStyles.fieldGroup}>
              <label className={authStyles.label} htmlFor="name">Your name</label>
              <input
                id="name"
                className={authStyles.input}
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className={authStyles.fieldGroup}>
              <label className={authStyles.label} htmlFor="organization">Organization</label>
              <input
                id="organization"
                className={authStyles.input}
                type="text"
                placeholder="Company, studio, or school"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                autoComplete="organization"
              />
            </div>

            <div className={styles.checkboxRow}>
              <input
                id="terms"
                className={styles.checkbox}
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label className={styles.checkboxLabel} htmlFor="terms">
                I agree to ouratime&apos;s{" "}
                <Link href="/terms" target="_blank">Terms of Use</Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank">Privacy Policy</Link>
              </label>
            </div>

            {error && <p className={authStyles.errorMsg}>{error}</p>}

            <button
              type="submit"
              className={authStyles.submitBtn}
              disabled={loading}
            >
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
        </div>
      </main>

      <footer className={authStyles.footer}>
        <div className={authStyles.footerInner}>
          <Link href="/" className={authStyles.footerLogo}>ouratime</Link>
          <p className={authStyles.footerCopy}>© 2025 ouratime. Open-source time tracking.</p>
          <div className={authStyles.footerLinks}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
