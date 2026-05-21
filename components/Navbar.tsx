"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import styles from "./Navbar.module.css";

const appLinks = [
  { href: "/timer", label: "Timer" },
  { href: "/timesheet", label: "Timesheet" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/projects", label: "Projects" },
];

const marketingLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#method", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => setDropdownOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const hiddenPages = ["/login", "/signup", "/forgot-password", "/verify-email", "/auth/callback", "/onboarding/profile", "/onboarding/customize"];
  if (hiddenPages.includes(pathname) || pathname.startsWith("/dashboard")) return null;

  const links = user ? appLinks : marketingLinks;

  return (
    <nav className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ""}`}>
      <div className={styles.container}>
        {/* Left: logo + links */}
        <div className={styles.left}>
          <Link href="/" className={styles.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="OurATime" height={28} />
          </Link>
          <ul className={styles.navLinks}>
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`${styles.navLink} ${pathname === href ? styles.navLinkActive : ""}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: auth */}
        <div className={styles.right}>
          {user ? (
            <div className={styles.userMenu} ref={dropdownRef}>
              <button
                className={styles.avatar}
                onClick={() => setDropdownOpen((p) => !p)}
                aria-label="User menu"
              >
                {user.email?.[0].toUpperCase()}
              </button>
              {dropdownOpen && (
                <div className={styles.dropdown}>
                  <span className={styles.dropdownEmail}>{user.email}</span>
                  <Link href="/settings" className={styles.dropdownItem}>Settings</Link>
                  <button
                    onClick={handleLogout}
                    className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className={styles.loginBtn}>Sign in</Link>
              <Link href="/signup" className={styles.signupBtn}>
                Get started
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
