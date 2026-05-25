"use client";
import { useEffect } from "react";

const THEME_KEY = "ouratime:theme";

export function ThemeProvider() {
  useEffect(() => {
    const apply = () => {
      const theme = localStorage.getItem(THEME_KEY) ?? "light";
      document.documentElement.setAttribute("data-theme", theme);
    };
    apply();
    window.addEventListener("ouratime:theme-changed", apply);
    return () => window.removeEventListener("ouratime:theme-changed", apply);
  }, []);
  return null;
}

export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(THEME_KEY) as "light" | "dark") ?? "light";
}

export function setTheme(theme: "light" | "dark") {
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent("ouratime:theme-changed"));
}
