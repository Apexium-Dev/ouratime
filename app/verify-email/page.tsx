"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthNavbar } from "@/components/AuthNavbar";
import authStyles from "../auth.module.css";
import styles from "./verify-email.module.css";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "your email";

  return (
    <div className={authStyles.page}>
      <AuthNavbar />
      <main className={authStyles.main}>
        <div className={authStyles.card}>
          <Link href="/" className={authStyles.cardBrand}>ouratime</Link>

          <div className={styles.iconWrap}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#008080" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </div>

          <h1 className={authStyles.cardTitle}>Check your inbox</h1>
          <p className={authStyles.cardSubtitle}>
            We sent a verification link to<br />
            <strong className={styles.emailHighlight}>{email}</strong>
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span>Open the email from ouratime</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span>Click the verification link</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span>Complete your profile setup</span>
            </div>
          </div>

          <hr className={authStyles.divider} />
          <p className={authStyles.switchText}>
            Wrong email?{" "}
            <Link href="/signup" className={authStyles.switchLink}>Start over</Link>
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

export default function VerifyEmail() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
