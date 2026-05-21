"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CreateProjectModal } from "./CreateProjectModal";
import { TagPicker, type Tag } from "./TagPicker";
import styles from "./DashboardNavbar.module.css";

interface Project { id: string; name: string; color: string; }
interface Task    { id: string; name: string; project_id: string; }

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DashboardNavbar() {
  // User
  const [userName, setUserName]   = useState("");
  const [userInitial, setUserInitial] = useState("");

  // Projects
  const [projects, setProjects]         = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectDrop, setShowProjectDrop]  = useState(false);

  // Task search
  const [description, setDescription]   = useState("");
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask]  = useState<Task | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Tags
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  // Billable
  const [billable, setBillable] = useState(true);

  // Timer
  const [running, setRunning]         = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [scrolled, setScrolled]       = useState(false);

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const projectDropRef = useRef<HTMLDivElement>(null);

  // ── Scroll shadow ──────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Load user ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single();
      const name = data?.full_name || user.email?.split("@")[0] || "User";
      setUserName(name);
      setUserInitial(name[0].toUpperCase());
    });
  }, []);

  // ── Load projects ──────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects").select("id, name, color").order("created_at");
    setProjects(data ?? []);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Load tasks when project changes ───────────────────────
  useEffect(() => {
    if (!selectedProject) { setTasks([]); return; }
    supabase
      .from("tasks")
      .select("id, name, project_id")
      .eq("project_id", selectedProject.id)
      .order("created_at")
      .then(({ data }) => setTasks(data ?? []));
  }, [selectedProject]);

  // ── Filter tasks as user types ─────────────────────────────
  useEffect(() => {
    if (!description.trim()) { setFilteredTasks(tasks); return; }
    const q = description.toLowerCase();
    setFilteredTasks(tasks.filter((t) => t.name.toLowerCase().includes(q)));
  }, [description, tasks]);

  // ── Click outside to close dropdowns ──────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node))
        setShowSuggestions(false);
      if (projectDropRef.current && !projectDropRef.current.contains(e.target as Node))
        setShowProjectDrop(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Timer interval ─────────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // ── Start ──────────────────────────────────────────────────
  const handleStart = async () => {
    if (!description.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let taskId: string | null = selectedTask?.id ?? null;

    // Create task if it doesn't exist yet
    if (!taskId && selectedProject) {
      const exactMatch = tasks.find(
        (t) => t.name.toLowerCase() === description.trim().toLowerCase()
      );
      if (exactMatch) {
        taskId = exactMatch.id;
      } else {
        const { data: newTask } = await supabase
          .from("tasks")
          .insert({ user_id: user.id, project_id: selectedProject.id, name: description.trim() })
          .select().single();
        if (newTask) {
          taskId = newTask.id;
          setTasks((prev) => [...prev, newTask]);
        }
      }
    }

    const { data: entry } = await supabase
      .from("time_entries")
      .insert({
        user_id:     user.id,
        project_id:  selectedProject?.id ?? null,
        task_id:     taskId,
        description: description.trim(),
        started_at:  new Date().toISOString(),
        billable,
      })
      .select().single();

    if (entry) {
      // Save tags
      if (selectedTags.length > 0) {
        await supabase.from("time_entry_tags").insert(
          selectedTags.map((t) => ({ time_entry_id: entry.id, tag_id: t.id }))
        );
      }
      setActiveEntryId(entry.id);
      setElapsed(0);
      setRunning(true);
      setShowSuggestions(false);
    }
  };

  // ── Stop ───────────────────────────────────────────────────
  const handleStop = async () => {
    setRunning(false);
    if (!activeEntryId) return;

    const stoppedAt = new Date().toISOString();
    await supabase.from("time_entries").update({
      stopped_at: stoppedAt,
      duration:   elapsed,
    }).eq("id", activeEntryId);

    setActiveEntryId(null);
    setDescription("");
    setSelectedTask(null);
    setSelectedTags([]);
    setBillable(true);
    setElapsed(0);
  };

  // ── Select task from suggestion ────────────────────────────
  const pickTask = (task: Task) => {
    setSelectedTask(task);
    setDescription(task.name);
    setShowSuggestions(false);
  };

  const exactExists = tasks.some(
    (t) => t.name.toLowerCase() === description.trim().toLowerCase()
  );
  const showCreateOption = description.trim() && !exactExists;

  return (
    <>
      <header className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ""}`}>
        <div className={styles.container}>

          {/* ── User ── */}
          <div className={styles.user}>
            <div className={styles.avatar}>{userInitial}</div>
            <div className={styles.userInfo}>
              <span className={styles.userGreeting}>Hey,</span>
              <span className={styles.userName}>{userName}</span>
            </div>
            <Link href="/dashboard/settings" className={styles.settingsLink} title="Settings">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </Link>
          </div>

          {/* ── Description / task search ── */}
          <div className={styles.timerSection}>
            <div className={styles.descriptionWrap} ref={suggestionsRef}>
              <input
                className={styles.descriptionInput}
                type="text"
                placeholder="What are you working on?"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setSelectedTask(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && description.trim()) {
                    setShowSuggestions(false);
                    handleStart();
                  }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                disabled={running}
              />

              {showSuggestions && !running && selectedProject && (
                <div className={styles.suggestions}>
                  {filteredTasks.length > 0 && (
                    <>
                      <p className={styles.suggestionsLabel}>Tasks in {selectedProject.name}</p>
                      {filteredTasks.map((task) => (
                        <button
                          key={task.id}
                          className={styles.suggestionItem}
                          onMouseDown={() => pickTask(task)}
                        >
                          <span
                            className={styles.taskDot}
                            style={{ background: selectedProject.color }}
                          />
                          {task.name}
                        </button>
                      ))}
                    </>
                  )}
                  {showCreateOption && (
                    <button
                      className={`${styles.suggestionItem} ${styles.suggestionCreate}`}
                      onMouseDown={() => setShowSuggestions(false)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Create &ldquo;{description.trim()}&rdquo;
                    </button>
                  )}
                  {!filteredTasks.length && !showCreateOption && (
                    <p className={styles.suggestionsEmpty}>No tasks yet</p>
                  )}
                </div>
              )}

              {showSuggestions && !running && !selectedProject && (
                <div className={styles.suggestions}>
                  <p className={styles.suggestionsEmpty}>Select a project first to search tasks</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Controls ── */}
          <div className={styles.controls}>

            {/* Project picker */}
            <div className={styles.projectWrap} ref={projectDropRef}>
              <button
                className={styles.projectBtn}
                onClick={() => !running && setShowProjectDrop((v) => !v)}
                disabled={running}
              >
                {selectedProject ? (
                  <>
                    <span
                      className={styles.projectDot}
                      style={{ background: selectedProject.color }}
                    />
                    {selectedProject.name}
                  </>
                ) : (
                  <>
                    <span className={styles.projectDotEmpty} />
                    No project
                  </>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showProjectDrop && (
                <div className={styles.projectDropdown}>
                  {projects.length > 0 && (
                    <>
                      <p className={styles.suggestionsLabel}>Your projects</p>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          className={`${styles.suggestionItem} ${selectedProject?.id === p.id ? styles.suggestionItemActive : ""}`}
                          onMouseDown={() => { setSelectedProject(p); setShowProjectDrop(false); }}
                        >
                          <span className={styles.taskDot} style={{ background: p.color }} />
                          {p.name}
                        </button>
                      ))}
                      <div className={styles.dropdownDivider} />
                    </>
                  )}
                  <button
                    className={`${styles.suggestionItem} ${styles.suggestionCreate}`}
                    onMouseDown={() => { setShowProjectDrop(false); setShowProjectModal(true); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    New project
                  </button>
                </div>
              )}
            </div>

            <TagPicker
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              disabled={running}
            />

            <button
              className={`${styles.billableBtn} ${billable ? styles.billableBtnOn : ""}`}
              onClick={() => !running && setBillable((v) => !v)}
              disabled={running}
              title={billable ? "Billable — click to mark non-billable" : "Non-billable — click to mark billable"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              {billable ? "Billable" : "Non-billable"}
            </button>

            {running && (
              <span className={styles.timer}>{formatTime(elapsed)}</span>
            )}

            {running ? (
              <button className={styles.stopBtn} onClick={handleStop}>
                <span className={styles.stopIcon} />
                Stop
              </button>
            ) : (
              <button
                className={styles.startBtn}
                onClick={handleStart}
                disabled={!description.trim()}
              >
                <svg width="11" height="13" viewBox="0 0 12 14" fill="currentColor">
                  <path d="M0 0l12 7-12 7V0z" />
                </svg>
                Start
              </button>
            )}
          </div>

        </div>
      </header>

      {showProjectModal && (
        <CreateProjectModal
          onClose={() => setShowProjectModal(false)}
          onCreate={(p) => {
            setProjects((prev) => [...prev, p]);
            setSelectedProject(p);
          }}
        />
      )}
    </>
  );
}
