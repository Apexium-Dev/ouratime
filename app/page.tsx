import Link from "next/link";
import styles from "./page.module.css";

const features = [
  {
    title: "Distraction-Free Timer",
    desc: "One-click start/stop with description, project, and tags. No noise.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    title: "Team Collaboration",
    desc: "Invite members, assign roles, and see everyone's tracked time.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    title: "Visual Reports",
    desc: "Bar charts and breakdowns by day, project, tag, and team member.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
  },
  {
    title: "Project Management",
    desc: "Tags, descriptions, hourly rates, and shareable invite links.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    title: "Invoicing",
    desc: "Turn tracked hours into invoices and send them directly to clients.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>
      </svg>
    ),
  },
  {
    title: "Open Source & Free",
    desc: "Every feature is free forever. Self-host, fork, and make it yours.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
      </svg>
    ),
  },
];

const BARS = [40, 65, 50, 85, 60, 30, 20];
const DAYS = ["M","T","W","T","F","S","S"];

const ENTRIES = [
  { color: "#008080", desc: "Homepage wireframes", proj: "Website Redesign", dur: "2:34" },
  { color: "#8b5cf6", desc: "Fix invoice module",  proj: "OuraTime",         dur: "1:12" },
  { color: "#ec4899", desc: "Q4 campaign copy",    proj: "Marketing",        dur: "0:48" },
  { color: "#008080", desc: "Component library",   proj: "Website Redesign", dur: "3:07" },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroInner}>
          {/* Left */}
          <div className={styles.heroText}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              Free &amp; Open Source
            </div>
            <h1 className={styles.heroHeadline}>
              Track time.<br />
              <span className={styles.heroAccent}>Own your data.</span>
            </h1>
            <p className={styles.heroSub}>
              The open-source Clockify alternative for teams who value clarity.
              No paywalls. No bloat. Just the tools you actually use.
            </p>
            <div className={styles.heroCtas}>
              <Link href="/signup" className={styles.ctaPrimary}>
                Get started free
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
              </Link>
              <Link href="/#preview" className={styles.ctaGhost}>See it in action</Link>
            </div>
            <p className={styles.heroNote}>No credit card · Free forever</p>
          </div>

          {/* Right: floating stat cards */}
          <div className={styles.heroCards} aria-hidden="true">
            <div className={styles.floatCard}>
              <p className={styles.floatLabel}>Today&apos;s total</p>
              <p className={styles.floatVal}>04:23</p>
              <div className={styles.floatTrack}>
                <div className={styles.floatFill} style={{ width: "62%" }} />
              </div>
              <p className={styles.floatSub}>62% of daily goal</p>
            </div>

            <div className={`${styles.floatCard} ${styles.floatRunning}`}>
              <div className={styles.floatRunRow}>
                <span className={styles.floatDot} />
                <span className={styles.floatRunLbl}>Running</span>
                <span className={styles.floatRunTime}>01:47:22</span>
              </div>
              <p className={styles.floatRunDesc}>Homepage wireframes</p>
              <div className={styles.floatRunProj}>
                <span className={styles.floatProjDot} style={{ background: "#008080" }} />
                Website Redesign
              </div>
            </div>

            <div className={`${styles.floatCard} ${styles.floatStatsRow}`}>
              {[["12","Projects"],["38h","This week"],["5","Members"]].map(([v,l]) => (
                <div key={l} className={styles.floatStat}>
                  <span className={styles.floatStatVal}>{v}</span>
                  <span className={styles.floatStatLbl}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Dashboard preview ── */}
      <section className={styles.preview} id="preview">
        <div className={styles.previewInner}>
          <span className={styles.sectionLabel}>Product</span>
          <h2 className={styles.sectionHeadline}>Everything you need — nothing you don&apos;t</h2>
          <p className={styles.sectionSub}>
            A full-featured time tracker that feels lightweight. Built for individuals and teams.
          </p>

          {/* Browser frame */}
          <div className={styles.browser}>
            <div className={styles.browserBar}>
              <div className={styles.browserDots}>
                <span /><span /><span />
              </div>
              <div className={styles.browserUrl}>ouratime.app/dashboard</div>
            </div>

            <div className={styles.browserBody}>
              {/* Mock sidebar */}
              <div className={styles.mockSidebar}>
                <div className={styles.mockLogoRow}>
                  <div className={styles.mockLogoIcon} />
                  <span className={styles.mockLogoText}>OuraTime</span>
                </div>
                {["Timer","Timesheet","Dashboard","Reports","Projects","Inbox"].map((item, i) => (
                  <div key={item} className={`${styles.mockNavItem} ${i === 2 ? styles.mockNavActive : ""}`}>
                    <div className={styles.mockNavDot} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Mock main */}
              <div className={styles.mockMain}>
                <div className={styles.mockTopBar}>
                  <span className={styles.mockPageTitle}>Dashboard</span>
                  <div className={styles.mockTopRight}>
                    <div className={styles.mockPill} />
                    <div className={styles.mockAvatar}>M</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className={styles.mockStatsRow}>
                  {[["Today","04:23"],["This week","18:41"],["This month","72:08"]].map(([l,v]) => (
                    <div key={l} className={styles.mockStatCard}>
                      <p className={styles.mockStatLbl}>{l}</p>
                      <p className={styles.mockStatVal}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Chart + entries side by side */}
                <div className={styles.mockGrid}>
                  <div className={styles.mockChartCard}>
                    <p className={styles.mockCardTitle}>Weekly hours</p>
                    <div className={styles.mockChart}>
                      {BARS.map((h, i) => (
                        <div key={i} className={styles.mockBarCol}>
                          <div className={styles.mockBar} style={{ height: `${h}%` }} />
                          <span className={styles.mockBarDay}>{DAYS[i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.mockEntriesCard}>
                    <p className={styles.mockCardTitle}>Recent entries</p>
                    {ENTRIES.map((e, i) => (
                      <div key={i} className={styles.mockEntry}>
                        <div className={styles.mockEntryDot} style={{ background: e.color }} />
                        <div className={styles.mockEntryBody}>
                          <span className={styles.mockEntryDesc}>{e.desc}</span>
                          <span className={styles.mockEntryProj}>{e.proj}</span>
                        </div>
                        <span className={styles.mockEntryDur}>{e.dur}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className={styles.steps}>
        <div className={styles.stepsInner}>
          <span className={styles.sectionLabel}>How it works</span>
          <h2 className={styles.sectionHeadline}>Up and running in seconds</h2>
          <div className={styles.stepsGrid}>
            {[
              { n:"01", title:"Start the timer", desc:"One click to begin. Add a description and pick a project — or just let it run." },
              { n:"02", title:"Organize your work", desc:"Group time by project, add tags, invite your team, and manage roles." },
              { n:"03", title:"Read the reports", desc:"Weekly charts and breakdowns show exactly where your hours go." },
            ].map(s => (
              <div key={s.n} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.featuresSection} id="features">
        <div className={styles.featuresInner}>
          <span className={styles.sectionLabel}>Features</span>
          <h2 className={styles.sectionHeadline}>Built for real work</h2>
          <div className={styles.featuresGrid}>
            {features.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaBannerGrid} aria-hidden="true" />
        <div className={styles.ctaBannerInner}>
          <h2 className={styles.ctaBannerHeadline}>Ready to take back your time?</h2>
          <p className={styles.ctaBannerSub}>Free forever. No credit card required.</p>
          <Link href="/signup" className={styles.ctaPrimary}>
            Create free account
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerDots} aria-hidden="true" />
        <div className={styles.footerInner}>
          <div className={styles.footerBottom}>
            <div>
              <p className={styles.footerBrand}>OuraTime</p>
              <p className={styles.footerCopy}>© 2025 OuraTime. Open Source. Free forever.</p>
            </div>
            <div className={styles.footerLinks}>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/contact">Contact</Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
