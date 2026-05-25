import styles from "../legal.module.css";

export const metadata = { title: "Terms of Service — OuraTime" };

export default function Terms() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.label}>Legal</span>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.meta}>Last updated: May 2025</p>

        <div className={styles.body}>
          <div className={styles.section}>
            <h2>Acceptance</h2>
            <p>
              By using OuraTime you agree to these terms. OuraTime is free and open-source software
              provided as-is. If you don&apos;t agree, please don&apos;t use the service.
            </p>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>The service</h2>
            <ul>
              <li>OuraTime provides time tracking, reporting, and team collaboration tools</li>
              <li>The hosted version is free with no usage limits</li>
              <li>You may self-host OuraTime under the terms of its open-source license</li>
              <li>We reserve the right to change or discontinue any part of the service with notice</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Your account</h2>
            <ul>
              <li>You are responsible for keeping your account credentials secure</li>
              <li>You must not share your account or use another person&apos;s account</li>
              <li>You must provide accurate information when signing up</li>
              <li>You must be at least 13 years old to use OuraTime</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Your data</h2>
            <p>
              You own all data you create in OuraTime — time entries, projects, descriptions,
              and reports. We do not claim any rights over your content. See our{" "}
              <a href="/privacy" style={{ color: "#4db8b8" }}>Privacy Policy</a> for details
              on how we handle it.
            </p>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use OuraTime for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to other users&apos; data</li>
              <li>Abuse or overload the service infrastructure</li>
              <li>Reverse-engineer the hosted service to bypass its security</li>
            </ul>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Disclaimer</h2>
            <p>
              OuraTime is provided &quot;as is&quot; without warranty of any kind. We are not liable
              for any loss of data, lost profits, or other damages arising from your use of the service.
              Use it at your own risk.
            </p>
          </div>

          <hr className={styles.divider} />

          <div className={styles.section}>
            <h2>Open source</h2>
            <p>
              OuraTime is open source. The source code is available on{" "}
              <a href="https://github.com/Apexium-Dev/ouratime" style={{ color: "#4db8b8" }}>
                GitHub
              </a>{" "}
              under its respective license. Self-hosting is encouraged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
