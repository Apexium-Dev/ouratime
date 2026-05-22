import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { JoinButton } from "./JoinButton";
import styles from "./invite.module.css";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .rpc("get_project_by_invite_token", { p_token: params.token });

  if (!data || data.length === 0) notFound();
  const project = data[0];

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoMark}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <p className={styles.appName}>OuraTime</p>

        <div className={styles.projectPreview}>
          <span className={styles.projectDot} style={{ background: project.color }} />
          <span className={styles.projectName}>{project.name}</span>
        </div>

        <h1 className={styles.heading}>You've been invited</h1>
        <p className={styles.sub}>
          Request to join <strong>{project.name}</strong>.{" "}
          The project owner will approve your request.
        </p>
        <p className={styles.members}>
          {project.member_count} {project.member_count === 1 ? "member" : "members"} already
        </p>

        <JoinButton token={params.token} projectName={project.name} />
      </div>
    </div>
  );
}
