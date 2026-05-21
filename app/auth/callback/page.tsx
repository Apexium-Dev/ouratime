"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import authStyles from "../../auth.module.css";
import styles from "./callback.module.css";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      router.replace("/login?error=missing_code");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        setStatus("error");
        return;
      }

      const userId = data.session.user.id;
      const now = new Date().toISOString();

      // Record that the user verified their email
      await supabase.from("profiles").upsert({
        id: userId,
        email_verified_at: now,
        onboarding_started_at: now,
        updated_at: now,
      });

      router.replace("/onboarding/profile");
    });
  }, [searchParams, router]);

  if (status === "error") {
    return (
      <div className={authStyles.page}>
        <main className={authStyles.main}>
          <div className={authStyles.card}>
            <h1 className={authStyles.cardTitle}>Link expired</h1>
            <p className={authStyles.cardSubtitle}>
              This verification link has expired or already been used.
            </p>
            <a href="/signup" className={authStyles.submitBtn} style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: "1rem" }}>
              Sign up again
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={authStyles.page}>
      <main className={authStyles.main}>
        <div className={authStyles.card}>
          <div className={styles.spinner} />
          <h1 className={authStyles.cardTitle}>Verifying your email</h1>
          <p className={authStyles.cardSubtitle}>Just a moment…</p>
        </div>
      </main>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
