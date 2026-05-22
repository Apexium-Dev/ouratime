"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./join.module.css";

interface InviteInfo {
  email: string;
  role: string;
  workspaces: { name: string } | null;
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setLoggedIn(!!user);

      const { data } = await supabase
        .from("workspace_invites")
        .select("email, role, workspaces(name)")
        .eq("token", token)
        .is("accepted_at", null)
        .single();

      // Map the data, handling potential array return from workspaces query
      const mappedInvite: InviteInfo | null = data
        ? {
            email: data.email,
            role: data.role,
            workspaces: data.workspaces
              ? Array.isArray(data.workspaces)
                ? data.workspaces[0]
                : data.workspaces
              : null,
          }
        : null;

      setInvite(mappedInvite);
      setLoading(false);
    }
    init();
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    const { data, error: err } = await supabase.rpc("accept_workspace_invite", {
      invite_token: token,
    });
    setJoining(false);
    if (err || data?.error) {
      setError(err?.message ?? data.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard/team"), 2000);
  };

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.sub}>Loading…</p>
        </div>
      </div>
    );

  if (!invite)
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.icon}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className={styles.title}>Invalid invite</h1>
          <p className={styles.sub}>
            This invite link has expired or already been used.
          </p>
        </div>
      </div>
    );

  if (done)
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.icon}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#008080"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className={styles.title}>You&apos;re in!</h1>
          <p className={styles.sub}>Redirecting to your team…</p>
        </div>
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#008080"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>

        <h1 className={styles.title}>You&apos;ve been invited</h1>
        <p className={styles.sub}>
          Join <strong>{invite.workspaces?.name ?? "a workspace"}</strong> as{" "}
          <strong>{invite.role}</strong>
        </p>
        <p className={styles.email}>Invite sent to {invite.email}</p>

        {error && <p className={styles.error}>{error}</p>}

        {loggedIn ? (
          <button
            className={styles.joinBtn}
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? "Joining…" : "Accept & join workspace"}
          </button>
        ) : (
          <a className={styles.joinBtn} href={`/login?redirect=/join/${token}`}>
            Sign in to accept
          </a>
        )}
      </div>
    </div>
  );
}
