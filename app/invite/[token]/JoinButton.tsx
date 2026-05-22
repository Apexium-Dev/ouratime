"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./invite.module.css";

export function JoinButton({ token, projectName }: { token: string; projectName: string }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  async function handleJoin() {
    setState("loading");
    const { data, error } = await supabase
      .rpc("request_project_join", { p_invite_token: token });

    if (error) {
      setState("error");
      setMsg(error.message.includes("already") ? "You're already a member or have a pending request." : error.message);
      return;
    }

    if (data === "already_member") {
      setState("error");
      setMsg("You're already a member of this project.");
    } else if (data === "already_pending") {
      setState("error");
      setMsg("You already have a pending request or invite for this project.");
    } else {
      setState("done");
      setMsg(`Request sent! The owner of "${projectName}" will review it.`);
    }
  }

  if (authed === null) {
    return <div className={styles.btnPlaceholder} />;
  }

  if (!authed) {
    return (
      <a
        href={`/login?next=/invite/${token}`}
        className={styles.joinBtn}
      >
        Sign in to request access
      </a>
    );
  }

  if (state === "done") {
    return (
      <div className={styles.successBox}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#008080" strokeWidth="2.5" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <p>{msg}</p>
        <button className={styles.dashBtn} onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.actionArea}>
      {state === "error" && <p className={styles.errMsg}>{msg}</p>}
      <button
        className={styles.joinBtn}
        onClick={handleJoin}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Sending request…" : "Request to join"}
      </button>
    </div>
  );
}
