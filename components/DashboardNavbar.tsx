"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CreateProjectModal } from "./CreateProjectModal";
import { FocusTimer } from "./FocusTimer";
import { TagPicker, type Tag } from "./TagPicker";
import styles from "./DashboardNavbar.module.css";

const FOCUS_MODE_KEY = "ouratime:focus-mode";
const FOCUS_ANIM_KEY = "ouratime:focus-animations";

function getFocusSetting(key: string, defaultVal = true): boolean {
  if (typeof window === "undefined") return defaultVal;
  const v = localStorage.getItem(key);
  return v === null ? defaultVal : v === "true";
}

interface Project   { id: string; name: string; color: string; }
interface Task      { id: string; name: string; project_id: string; }
interface Workspace { id: string; name: string; }

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DashboardNavbar() {
  // User
  const [userName,    setUserName]    = useState("");
  const [userInitial, setUserInitial] = useState("");
  const [userAvatar,  setUserAvatar]  = useState<string | null>(null);

  // Workspaces
  const [workspaces, setWorkspaces]               = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

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

  // Focus mode
  const [showFocus, setShowFocus]     = useState(false);
  const [focusEnabled, setFocusEnabled] = useState(true);
  const [focusAnimations, setFocusAnimations] = useState(true);

  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const suggestionsRef   = useRef<HTMLDivElement>(null);
  const projectDropRef   = useRef<HTMLDivElement>(null);
  const activeEntryIdRef = useRef<string | null>(null);
  const elapsedRef       = useRef<number>(0);

  // Keep refs in sync so async handlers always see current values
  useEffect(() => { activeEntryIdRef.current = activeEntryId; }, [activeEntryId]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Load focus settings from localStorage
  useEffect(() => {
    setFocusEnabled(getFocusSetting(FOCUS_MODE_KEY, true));
    setFocusAnimations(getFocusSetting(FOCUS_ANIM_KEY, true));
    function onSettingsChange() {
      setFocusEnabled(getFocusSetting(FOCUS_MODE_KEY, true));
      setFocusAnimations(getFocusSetting(FOCUS_ANIM_KEY, true));
    }
    window.addEventListener("ouratime:focus-settings-changed", onSettingsChange);
    return () => window.removeEventListener("ouratime:focus-settings-changed", onSettingsChange);
  }, []);

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
        .from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
      const name = data?.full_name || user.email?.split("@")[0] || "User";
      setUserName(name);
      setUserInitial(name[0].toUpperCase());
      if (data?.avatar_url) setUserAvatar(data.avatar_url);
    });
  }, []);

  // ── Load workspaces ───────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("workspace_members")
        .select("workspaces(id, name)")
        .eq("user_id", user.id);
      setWorkspaces(
        (data ?? []).map(m => m.workspaces as unknown as Workspace).filter(Boolean)
      );
    });
  }, []);

  // ── Load projects ──────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name, color, is_favorite")
      .eq("archived", false)
      .order("is_favorite", { ascending: false })
      .order("created_at");
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

  // ── Reload projects when changed from another page ────────
  useEffect(() => {
    window.addEventListener("ouratime:projects-changed", loadProjects);
    return () => window.removeEventListener("ouratime:projects-changed", loadProjects);
  }, [loadProjects]);

  // ── Keyboard shortcut: Shift+Space to start / stop ────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey || e.code !== "Space") return;
      const active = document.activeElement as HTMLElement;
      if (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.tagName === "SELECT" ||
        active?.isContentEditable
      ) return;
      e.preventDefault();
      if (running) handleStop();
      else if (description.trim()) handleStart();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, description]);

  // ── Core start logic (accepts explicit params to avoid stale state) ──────────
  const startWith = useCallback(async (
    desc: string,
    project: Project | null,
    tags: Tag[],
    bill: boolean,
  ) => {
    const trimmed = desc.trim();
    if (!trimmed) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let taskId: string | null = null;
    if (project) {
      const exactMatch = tasks.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exactMatch) {
        taskId = exactMatch.id;
      } else {
        const { data: newTask } = await supabase
          .from("tasks")
          .insert({ user_id: user.id, project_id: project.id, name: trimmed })
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
        user_id:      user.id,
        project_id:   project?.id ?? null,
        task_id:      taskId,
        description:  trimmed,
        started_at:   new Date().toISOString(),
        billable:     bill,
        workspace_id: selectedWorkspace?.id ?? null,
      })
      .select().single();

    if (entry) {
      if (tags.length > 0) {
        await supabase.from("time_entry_tags").insert(
          tags.map((t) => ({ time_entry_id: entry.id, tag_id: t.id }))
        );
      }
      setActiveEntryId(entry.id);
      setElapsed(0);
      setRunning(true);
      setShowSuggestions(false);
      window.dispatchEvent(new CustomEvent("ouratime:timer-changed"));
      if (getFocusSetting(FOCUS_MODE_KEY, true)) setShowFocus(true);
    }
  }, [tasks, selectedWorkspace, setTasks]);

  // ── Start ──────────────────────────────────────────────────
  const handleStart = () =>
    startWith(description, selectedProject, selectedTags, billable);

  // ── Timer interval ─────────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // ── Resume event from dashboard ───────────────────────────
  useEffect(() => {
    async function handle(e: Event) {
      const { description: desc, project, tags, billable: b } =
        (e as CustomEvent).detail;
      const d = desc ?? "";
      const p = project ?? null;
      const t = tags ?? [];
      const bill = b ?? true;

      // Stop current timer if one is running
      if (activeEntryIdRef.current) {
        const stoppedAt = new Date().toISOString();
        await supabase.from("time_entries").update({
          stopped_at: stoppedAt,
          duration:   elapsedRef.current,
        }).eq("id", activeEntryIdRef.current);
        setRunning(false);
        setActiveEntryId(null);
        setElapsed(0);
      }

      setDescription(d);
      setSelectedTask(null);
      setSelectedProject(p);
      setSelectedTags(t);
      setBillable(bill);
      startWith(d, p, t, bill);
    }
    window.addEventListener("ouratime:resume", handle);
    return () => window.removeEventListener("ouratime:resume", handle);
  }, [startWith]);

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
    setSelectedWorkspace(null);
    setBillable(true);
    setElapsed(0);
    setShowFocus(false);
    window.dispatchEvent(new CustomEvent("ouratime:timer-changed"));
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
      {showFocus && running && (
        <FocusTimer
          elapsed={elapsed}
          description={description}
          project={selectedProject}
          animations={focusAnimations}
          onStop={() => { setShowFocus(false); handleStop(); }}
          onMinimize={() => setShowFocus(false)}
        />
      )}

      <header className={`${styles.navbar} ${scrolled ? styles.navbarScrolled : ""}`}>
        <div className={styles.container}>

          {/* ── User ── */}
          <div className={styles.user}>
            <div className={styles.avatar}>
              {userAvatar
                ? <img src={userAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
                : userInitial}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userGreeting}>Hey,</span>
              <span className={styles.userName}>{userName}</span>
            </div>
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

              {showSuggestions && !running && (
                <div className={styles.entryPanel}>

                  {/* Tasks section — only when a project is selected */}
                  {selectedProject && (
                    <div className={styles.panelBlock}>
                      <p className={styles.panelLabel}>
                        <span className={styles.taskDot} style={{ background: selectedProject.color }} />
                        Tasks in {selectedProject.name}
                      </p>
                      {filteredTasks.map((task) => (
                        <button
                          key={task.id}
                          className={styles.suggestionItem}
                          onMouseDown={() => pickTask(task)}
                        >
                          <span className={styles.taskDot} style={{ background: selectedProject.color }} />
                          {task.name}
                        </button>
                      ))}
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
                        <p className={styles.suggestionsEmpty}>No tasks yet — type a name to create one</p>
                      )}
                    </div>
                  )}

                  {selectedProject && <div className={styles.panelDivider} />}

                  {/* Project picker section */}
                  <div className={styles.panelBlock}>
                    <p className={styles.panelLabel}>Project</p>
                    <div className={styles.projectChips}>
                      <button
                        className={`${styles.projectChip} ${!selectedProject ? styles.projectChipNone : ""}`}
                        onMouseDown={() => setSelectedProject(null)}
                      >
                        <span className={styles.projectChipDotEmpty} />
                        No project
                      </button>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          className={`${styles.projectChip} ${selectedProject?.id === p.id ? styles.projectChipActive : ""}`}
                          onMouseDown={() => setSelectedProject(p)}
                          style={selectedProject?.id === p.id ? { borderColor: p.color, background: p.color + "18" } : {}}
                        >
                          <span className={styles.projectChipDot} style={{ background: p.color }} />
                          {p.name}
                        </button>
                      ))}
                      <button
                        className={`${styles.projectChip} ${styles.projectChipCreate}`}
                        onMouseDown={() => { setShowSuggestions(false); setShowProjectModal(true); }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        New project
                      </button>
                    </div>
                  </div>

                  {/* Workspace / team picker — only if user belongs to at least one workspace */}
                  {workspaces.length > 0 && (
                    <>
                      <div className={styles.panelDivider} />
                      <div className={styles.panelBlock}>
                        <p className={styles.panelLabel}>Team</p>
                        <div className={styles.projectChips}>
                          <button
                            className={`${styles.projectChip} ${!selectedWorkspace ? styles.projectChipNone : ""}`}
                            onMouseDown={() => setSelectedWorkspace(null)}
                          >
                            <span className={styles.projectChipDotEmpty} />
                            Personal
                          </button>
                          {workspaces.map((ws) => (
                            <button
                              key={ws.id}
                              className={`${styles.projectChip} ${selectedWorkspace?.id === ws.id ? styles.projectChipActive : ""}`}
                              onMouseDown={() => setSelectedWorkspace(ws)}
                            >
                              {ws.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

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
              <button className={styles.stopBtn} onClick={handleStop} title="Stop timer (⇧ Space)">
                <span className={styles.stopIcon} />
                Stop
              </button>
            ) : (
              <button
                className={styles.startBtn}
                onClick={handleStart}
                disabled={!description.trim()}
                title="Start timer (⇧ Space)"
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
