"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./TagPicker.module.css";

const TAG_COLORS = [
  "#008080", "#0ea5e9", "#8b5cf6", "#ec4899",
  "#f97316", "#eab308", "#22c55e", "#ef4444",
  "#64748b", "#a16207",
];

export interface Tag { id: string; name: string; color: string; }

interface Props {
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
  disabled?: boolean;
}

export function TagPicker({ selectedTags, onChange, disabled }: Props) {
  const [allTags, setAllTags]       = useState<Tag[]>([]);
  const [search, setSearch]         = useState("");
  const [open, setOpen]             = useState(false);
  const [creating, setCreating]     = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load tags on mount
  useEffect(() => {
    supabase.from("tags").select("id, name, color").order("name")
      .then(({ data }) => setAllTags(data ?? []));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedTags.find((s) => s.id === t.id)
  );

  const exactExists = allTags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  );

  const toggle = (tag: Tag) => {
    const already = selectedTags.find((t) => t.id === tag.id);
    onChange(already ? selectedTags.filter((t) => t.id !== tag.id) : [...selectedTags, tag]);
  };

  const createTag = async () => {
    const name = search.trim();
    if (!name || creating) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const color = TAG_COLORS[allTags.length % TAG_COLORS.length];
    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name, color })
      .select().single();

    if (!error && data) {
      setAllTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...selectedTags, data]);
      setSearch("");
    }
    setCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); createTag(); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Tags"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>

        {selectedTags.length === 0 ? (
          <span className={styles.placeholder}>Tags</span>
        ) : (
          <span className={styles.pills}>
            {selectedTags.map((t) => (
              <span key={t.id} className={styles.pill} style={{ background: t.color + "22", color: t.color }}>
                {t.name}
              </span>
            ))}
          </span>
        )}

        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.chevron}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrap}>
            <input
              ref={inputRef}
              className={styles.searchInput}
              placeholder="Search or create tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Selected tags */}
          {selectedTags.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Selected</p>
              {selectedTags.map((tag) => (
                <button
                  key={tag.id}
                  className={`${styles.tagRow} ${styles.tagRowSelected}`}
                  onMouseDown={() => toggle(tag)}
                >
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  <span className={styles.tagName}>{tag.name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={styles.checkIcon}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </button>
              ))}
              {filtered.length > 0 && <div className={styles.divider} />}
            </div>
          )}

          {/* Filtered existing tags */}
          {filtered.length > 0 && (
            <div className={styles.section}>
              {selectedTags.length === 0 && <p className={styles.sectionLabel}>All tags</p>}
              {filtered.map((tag) => (
                <button
                  key={tag.id}
                  className={styles.tagRow}
                  onMouseDown={() => toggle(tag)}
                >
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  <span className={styles.tagName}>{tag.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Create option */}
          {search.trim() && !exactExists && (
            <>
              {(filtered.length > 0 || selectedTags.length > 0) && <div className={styles.divider} />}
              <button
                className={`${styles.tagRow} ${styles.tagRowCreate}`}
                onMouseDown={createTag}
                disabled={creating}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {creating ? "Creating…" : `Create "${search.trim()}"`}
              </button>
            </>
          )}

          {allTags.length === 0 && !search && (
            <p className={styles.empty}>Type a name to create your first tag</p>
          )}
        </div>
      )}
    </div>
  );
}
