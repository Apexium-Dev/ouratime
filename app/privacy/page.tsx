import styles from "../legal.module.css";

export const metadata = { title: "Privacy Policy — OuraTime" };

export default function Privacy() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.label}>Legal</span>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.meta}>Last updated: May 2025</p>

        <div className={styles.body}>
          <div className={styles.section}>
            <h2>Overview</h2>
            <p>
              OuraTime is an open-source time tracking application. We collect only what&apos;s
              necessary to make the product work, and we never sell your data to third parties.
            </p>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Data we collect</h2>
            <ul>
              <li>Your email address and name (used for authentication)</li>
              <li>Time entries you create — descriptions, durations, projects, and tags</li>
              <li>Team and project data you choose to share with collaborators</li>
              <li>Basic usage data to keep the service running (e.g. error logs)</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>How we use your data</h2>
            <ul>
              <li>To provide and improve the OuraTime service</li>
              <li>To authenticate you and keep your account secure</li>
              <li>To sync your time entries across devices</li>
              <li>To send transactional emails (e.g. password resets, team invites)</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Data storage</h2>
            <p>
              Your data is stored securely using Supabase (PostgreSQL) with row-level security
              enabled. Only you and the team members you explicitly invite can access your data.
            </p>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Third-party services</h2>
            <ul>
              <li><strong style={{ color: "#e8e8e8" }}>Supabase</strong> — database and authentication</li>
              <li><strong style={{ color: "#e8e8e8" }}>Vercel</strong> — hosting and edge delivery</li>
            </ul>
            <p style={{ marginTop: "0.75rem" }}>
              We do not use advertising networks, analytics trackers, or sell data to any third party.
            </p>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Your rights</h2>
            <ul>
              <li>Export all your data at any time from the Reports page</li>
              <li>Delete your account and all associated data by contacting us</li>
              <li>OuraTime is open source — you can self-host and own your data entirely</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Contact</h2>
            <p>
              Questions about privacy? Open an issue on{" "}
              <a href="https://github.com/Apexium-Dev/ouratime" style={{ color: "#4db8b8" }}>
                GitHub
              </a>{" "}
              or visit our{" "}
              <a href="/contact" style={{ color: "#4db8b8" }}>contact page</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
