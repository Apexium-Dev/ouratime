"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AuthNavbar } from "@/components/AuthNavbar";
import authStyles from "../../auth.module.css";
import styles from "../onboarding.module.css";

const useCaseOptions = [
  { value: "personal", title: "Personal", desc: "Track your own focus and habits" },
  { value: "team", title: "Team / Agency", desc: "Manage time across your whole team" },
  { value: "freelance", title: "Freelancing", desc: "Log billable hours for clients" },
  { value: "research", title: "Research", desc: "Structure deep work sessions" },
];

const teamSizeOptions = [
  { value: "solo", title: "Just me", desc: "Solo tracking" },
  { value: "small", title: "2 – 10", desc: "Small team" },
  { value: "mid", title: "11 – 50", desc: "Mid-size team" },
  { value: "large", title: "50+", desc: "Large organization" },
];

export default function OnboardingCustomize() {
  const [useCase, setUseCase] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFinish = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error: dbError } = await supabase.from("profiles").upsert({
          id: session.user.id,
          use_case: useCase,
          team_size: teamSize,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (dbError) throw dbError;
      } else {
        localStorage.setItem("ouratime_onboarding_customize", JSON.stringify({ use_case: useCase, team_size: teamSize }));
      }
      window.location.href = "/dashboard";
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
        <div className={`${authStyles.card} ${styles.wideCard}`}>
          <Link href="/" className={authStyles.cardBrand}>ouratime</Link>

          {/* Step indicator */}
          <div className={styles.steps}>
            <div className={styles.stepDot} />
            <div className={`${styles.stepDot} ${styles.stepDotActive}`} />
          </div>

          <h1 className={authStyles.cardTitle}>Customize your experience</h1>
          <p className={authStyles.cardSubtitle}>Help us tailor ouratime for the way you work</p>

          <div style={{ marginTop: "1.75rem" }}>
            {/* Question 1 */}
            <div className={styles.question}>
              <p className={styles.questionLabel}>How will you primarily use ouratime?</p>
              <div className={styles.optionGrid}>
                {useCaseOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.optionCard} ${useCase === opt.value ? styles.optionCardSelected : ""}`}
                    onClick={() => setUseCase(opt.value)}
                  >
                    <span className={styles.optionTitle}>{opt.title}</span>
                    <span className={styles.optionDesc}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Question 2 */}
            <div className={styles.question}>
              <p className={styles.questionLabel}>What&apos;s your team size?</p>
              <div className={styles.optionGrid}>
                {teamSizeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.optionCard} ${teamSize === opt.value ? styles.optionCardSelected : ""}`}
                    onClick={() => setTeamSize(opt.value)}
                  >
                    <span className={styles.optionTitle}>{opt.title}</span>
                    <span className={styles.optionDesc}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className={authStyles.errorMsg}>{error}</p>}

          <button
            className={authStyles.submitBtn}
            onClick={handleFinish}
            disabled={loading}
          >
            {loading ? "Setting up…" : "Go to Dashboard →"}
          </button>

          <hr className={authStyles.divider} />
          <p className={authStyles.switchText}>
            <button
              type="button"
              onClick={handleFinish}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", color: "#aaa" }}
            >
              Skip for now
            </button>
          </p>
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
