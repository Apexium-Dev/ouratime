export const NAV_ITEMS = [
  { href: "/dashboard",           label: "Dashboard",  exact: true  },
  { href: "/dashboard/calendar",  label: "Calendar",   exact: false },
  { href: "/dashboard/reports",   label: "Reports",    exact: false },
  { href: "/dashboard/projects",  label: "Projects",   exact: false },
  { href: "/dashboard/tags",      label: "Tags",       exact: false },
  { href: "/dashboard/team",      label: "Team",       exact: false },
] as const;

export type NavHref = (typeof NAV_ITEMS)[number]["href"];
export type SidebarEntry = { href: string; visible: boolean };

const KEY = "ouratime:sidebar";

export function loadSidebarConfig(): SidebarEntry[] {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultConfig();
    const parsed: SidebarEntry[] = JSON.parse(raw);
    // Keep saved order, drop unknowns, append any new items at end
    const merged: SidebarEntry[] = [];
    for (const entry of parsed) {
      if (NAV_ITEMS.some(n => n.href === entry.href)) merged.push(entry);
    }
    for (const item of NAV_ITEMS) {
      if (!merged.some(e => e.href === item.href)) {
        merged.push({ href: item.href, visible: true });
      }
    }
    return merged;
  } catch {
    return defaultConfig();
  }
}

export function saveSidebarConfig(config: SidebarEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("ouratime:sidebar-changed"));
}

export function defaultConfig(): SidebarEntry[] {
  return NAV_ITEMS.map(item => ({ href: item.href, visible: true }));
}
