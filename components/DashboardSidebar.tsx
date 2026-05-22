"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  defaultConfig,
  loadSidebarConfig,
  saveSidebarConfig,
  type SidebarEntry,
} from "@/lib/sidebarConfig";
import { supabase } from "@/lib/supabase";
import styles from "./DashboardSidebar.module.css";

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    exact: true,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    exact: false,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/inbox",
    label: "Inbox",
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/invoices",
    label: "Invoices",
    exact: false,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    exact: false,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    href: "/dashboard/projects",
    label: "Projects",
    exact: false,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/tags",
    label: "Tags",
    exact: false,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/dashboard/team",
    label: "Team",
    exact: false,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [config, setConfig] = useState<SidebarEntry[]>(defaultConfig);
  const dragHref = useRef<string | null>(null);
  const [dropHref, setDropHref] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setConfig(loadSidebarConfig());
    const handler = () => setConfig(loadSidebarConfig());
    window.addEventListener("ouratime:sidebar-changed", handler);
    return () =>
      window.removeEventListener("ouratime:sidebar-changed", handler);
  }, []);

  useEffect(() => {
    supabase.rpc("get_unread_count").then(({ data }) => setUnread(Number(data ?? 0)));
    const unsub = supabase.channel("notif-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        supabase.rpc("get_unread_count").then(({ data }) => setUnread(Number(data ?? 0)));
      })
      .subscribe();
    return () => { supabase.removeChannel(unsub); };
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleDrop = (targetHref: string) => {
    const from = dragHref.current;
    if (!from || from === targetHref) return;

    const next = [...config];
    const fromIdx = next.findIndex((e) => e.href === from);
    const toIdx = next.findIndex((e) => e.href === targetHref);
    const [item] = next.splice(fromIdx, 1);
    next.splice(fromIdx < toIdx ? toIdx - 1 : toIdx, 0, item);

    dragHref.current = null;
    setDropHref(null);
    setConfig(next);
    saveSidebarConfig(next);
  };

  const visibleNav = config
    .filter((e) => e.visible)
    .map((e) => NAV.find((n) => n.href === e.href))
    .filter(Boolean) as typeof NAV;

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {visibleNav.map((item) => (
          <div
            key={item.href}
            className={[
              styles.navItem,
              dropHref === item.href && dragHref.current !== item.href
                ? styles.navItemDropTarget
                : "",
            ].join(" ")}
            draggable
            onDragStart={(e) => {
              dragHref.current = item.href;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropHref !== item.href) setDropHref(item.href);
            }}
            onDragLeave={() => setDropHref(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(item.href);
            }}
            onDragEnd={() => {
              dragHref.current = null;
              setDropHref(null);
            }}
          >
            <Link
              href={item.href}
              className={`${styles.item} ${isActive(item.href, item.exact) ? styles.itemActive : ""}`}
              draggable={false}
            >
              <span className={styles.dragHandle}>
                <svg width="9" height="14" viewBox="0 0 9 14" fill="currentColor">
                  <circle cx="2" cy="2" r="1.4" />
                  <circle cx="7" cy="2" r="1.4" />
                  <circle cx="2" cy="7" r="1.4" />
                  <circle cx="7" cy="7" r="1.4" />
                  <circle cx="2" cy="12" r="1.4" />
                  <circle cx="7" cy="12" r="1.4" />
                </svg>
              </span>
              {item.icon}
              {item.label}
              {item.href === "/dashboard/inbox" && unread > 0 && (
                <span className={styles.badge}>{unread > 9 ? "9+" : unread}</span>
              )}
            </Link>
          </div>
        ))}
      </nav>

      <div className={styles.bottom}>
        <Link
          href="/dashboard/settings"
          className={`${styles.item} ${isActive("/dashboard/settings") ? styles.itemActive : ""}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </Link>
      </div>
    </aside>
  );
}
