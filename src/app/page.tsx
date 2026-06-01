"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  MessageSquare,
  RefreshCw,
  Send,
  X,
  Check,
  Users,
  UserPlus,
} from "lucide-react";

/* ---- Types ------------------------------------------------ */

interface InternRef {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  taskId: string;
  internId: string;
  intern: InternRef;
}

interface CompletionRecord {
  id: string;
  taskId: string;
  internId: string;
  completedAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  frequency: string;
  target: number;
  unit: string;
  done: boolean;
  sortOrder: number;
  assignments: Assignment[];
  completions: CompletionRecord[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  tasks: Task[];
}

interface Intern {
  id: string;
  name: string;
  active: boolean;
  notes: string;
  sortOrder: number;
  startedAt: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface WeekRange {
  monday: string;
  sunday: string;
  monthStart: string;
  monthEnd: string;
  quarterStart: string;
  quarterEnd: string;
}

/* ---- Week helpers ----------------------------------------- */

function getMondayDate(d: Date): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  return result;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseWeekParam(param: string | null): Date {
  if (!param) return getMondayDate(new Date());
  const [y, m, d] = param.split("-").map(Number);
  return getMondayDate(new Date(y, m - 1, d));
}

function getSundayFromMonday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return sun;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ---- Helpers ---------------------------------------------- */

const FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "OneTime",
] as const;

function countCompletions(
  completions: CompletionRecord[],
  internId: string,
  frequency: string,
  weekRange: WeekRange | null
): number {
  if (!weekRange) return 0;

  let start: Date;
  let end: Date;

  if (frequency === "Weekly") {
    start = new Date(weekRange.monday);
    end = new Date(weekRange.sunday);
    end.setHours(23, 59, 59, 999);
  } else if (frequency === "Monthly") {
    start = new Date(weekRange.monthStart);
    end = new Date(weekRange.monthEnd);
  } else if (frequency === "Quarterly") {
    start = new Date(weekRange.quarterStart);
    end = new Date(weekRange.quarterEnd);
  } else if (frequency === "OneTime") {
    start = new Date(0);
    end = new Date(2099, 0, 1);
  } else {
    // Daily -- use selected week's monday through sunday for display
    start = new Date(weekRange.monday);
    end = new Date(weekRange.sunday);
    end.setHours(23, 59, 59, 999);
  }

  return completions.filter(
    (c) =>
      c.internId === internId &&
      new Date(c.completedAt) >= start &&
      new Date(c.completedAt) <= end
  ).length;
}

function freqLabel(f: string): string {
  const map: Record<string, string> = {
    Daily: "daily",
    Weekly: "weekly",
    Monthly: "monthly",
    Quarterly: "quarterly",
    OneTime: "one-time",
  };
  return map[f] || f;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---- Component -------------------------------------------- */

export default function InternsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [weekRange, setWeekRange] = useState<WeekRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingIntern, setEditingIntern] = useState<string | null>(null);
  const [weekSlideDir, setWeekSlideDir] = useState<"left" | "right">("right");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Week state -- read from URL on mount, write back on change
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return parseWeekParam(params.get("week"));
    }
    return getMondayDate(new Date());
  });

  const currentMonday = getMondayDate(new Date());
  const isCurrentWeek = isSameDay(selectedMonday, currentMonday);
  const selectedSunday = getSundayFromMonday(selectedMonday);
  const isPastWeek =
    selectedMonday.getTime() + 6 * 86400000 < new Date().setHours(0, 0, 0, 0);

  // Update URL when week changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (isCurrentWeek) {
      url.searchParams.delete("week");
    } else {
      url.searchParams.set("week", formatDateISO(selectedMonday));
    }
    window.history.replaceState({}, "", url.toString());
  }, [selectedMonday, isCurrentWeek]);

  // Keyboard shortcuts for week navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack if user is typing in an input/contenteditable
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = (e.target as HTMLElement).isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepWeek(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepWeek(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonday]);

  function stepWeek(dir: -1 | 1) {
    setWeekSlideDir(dir === 1 ? "right" : "left");
    setSelectedMonday((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  }

  function jumpToThisWeek() {
    setWeekSlideDir("right");
    setSelectedMonday(getMondayDate(new Date()));
  }

  // Fetch data scoped to selected week
  const fetchData = useCallback(async () => {
    try {
      const weekParam = formatDateISO(selectedMonday);
      const res = await fetch(`/api/state?week=${weekParam}`);
      const data = await res.json();
      setCategories(data.categories);
      setInterns(data.interns);
      setWeekRange(data.weekRange);
      setLastSync(new Date());
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonday]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chat history
  useEffect(() => {
    if (chatOpen) {
      fetch("/api/chat")
        .then((r) => r.json())
        .then(setChatMessages)
        .catch(console.error);
    }
  }, [chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  /* ---- API helpers ----------------------------------------- */

  const api = async (
    url: string,
    method: string,
    body?: Record<string, unknown>
  ) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  // Intern CRUD
  const addIntern = async () => {
    const count = interns.length;
    await api("/api/interns", "POST", { name: `Intern ${count + 1}` });
    fetchData();
  };

  const updateIntern = async (id: string, data: Record<string, unknown>) => {
    await api(`/api/interns/${id}`, "PATCH", data);
    fetchData();
  };

  const deleteIntern = async (id: string) => {
    const intern = interns.find((i) => i.id === id);
    if (
      !confirm(
        `Remove ${intern?.name || "this intern"}? Their completions will be deleted.`
      )
    )
      return;
    await api(`/api/interns/${id}`, "DELETE");
    if (filter === id) setFilter("All");
    fetchData();
  };

  // Task CRUD
  const addTask = async (categoryId: string) => {
    await api("/api/tasks", "POST", { categoryId, title: "New Task" });
    fetchData();
  };

  const updateTask = async (id: string, data: Record<string, unknown>) => {
    await api(`/api/tasks/${id}`, "PATCH", data);
    fetchData();
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await api(`/api/tasks/${id}`, "DELETE");
    fetchData();
  };

  // Category CRUD
  const addCategory = async () => {
    await api("/api/categories", "POST", {
      name: "New Category",
      color: "#6b7280",
    });
    fetchData();
  };

  const updateCategory = async (
    id: string,
    data: Record<string, unknown>
  ) => {
    await api(`/api/categories/${id}`, "PATCH", data);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (cat && cat.tasks.length > 0) {
      alert(
        `Cannot delete "${cat.name}" -- it has ${cat.tasks.length} task(s). Move or delete them first.`
      );
      return;
    }
    if (!confirm(`Delete category "${cat?.name}"?`)) return;
    await api(`/api/categories/${id}`, "DELETE");
    fetchData();
  };

  // Assignment toggle
  const toggleAssignment = async (
    taskId: string,
    internId: string,
    isAssigned: boolean
  ) => {
    if (isAssigned) {
      await api(`/api/tasks/${taskId}/assign/${internId}`, "DELETE");
    } else {
      await api(`/api/tasks/${taskId}/assign`, "POST", { internId });
    }
    fetchData();
  };

  // Complete -- backdate if viewing a past week
  const markComplete = async (taskId: string, internId: string) => {
    const url = isPastWeek
      ? `/api/tasks/${taskId}/complete?week=${formatDateISO(selectedMonday)}`
      : `/api/tasks/${taskId}/complete`;
    await api(url, "POST", { internId });
    fetchData();
  };

  // Chat
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatMessages((prev) => [
      ...prev,
      {
        id: "temp-" + Date.now(),
        role: "user",
        content: msg,
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      const res = await api("/api/chat", "POST", { message: msg });
      setChatMessages((prev) => [
        ...prev,
        {
          id: "resp-" + Date.now(),
          role: "assistant",
          content: res.reply || res.error || "No response",
          createdAt: new Date().toISOString(),
        },
      ]);
      if (res.applied && res.applied.length > 0) fetchData();
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: "Failed to get response.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  /* ---- Stats ---------------------------------------------- */

  const activeInterns = interns.filter((i) => i.active);
  const totalTasks = categories.reduce((a, c) => a + c.tasks.length, 0);

  /* ---- Per-category progress ------------------------------ */

  function getCategoryProgress(cat: Category): {
    completed: number;
    total: number;
    pct: number;
  } {
    let completed = 0;
    let total = 0;
    for (const task of cat.tasks) {
      const assignedInterns = task.assignments.map((a) => a.intern);
      for (const intern of assignedInterns) {
        total += task.target;
        const count = countCompletions(
          task.completions,
          intern.id,
          task.frequency,
          weekRange
        );
        completed += Math.min(count, task.target);
      }
    }
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, pct };
  }

  /* ---- Filter --------------------------------------------- */

  const filteredCategories = categories.map((cat) => ({
    ...cat,
    tasks:
      filter === "All"
        ? cat.tasks
        : cat.tasks.filter((t) =>
            t.assignments.some((a) => a.internId === filter)
          ),
  }));

  /* ---- Week label for completion button ------------------- */
  const weekLabel = `${formatDateShort(selectedMonday)} - ${formatDateShort(selectedSunday)}`;
  const completeButtonSuffix = isPastWeek ? ` for ${weekLabel}` : "";

  /* ---- Render --------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#999] text-sm">
          Loading interns...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 relative overflow-hidden">
      {/* Ambient gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06] blur-[120px]"
          style={{
            background: "radial-gradient(circle, #F59E0B, transparent 70%)",
            top: "-200px",
            left: "-100px",
            animation: "drift1 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[100px]"
          style={{
            background: "radial-gradient(circle, #0D9488, transparent 70%)",
            bottom: "-150px",
            right: "-100px",
            animation: "drift2 30s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[80px]"
          style={{
            background: "radial-gradient(circle, #f43f5e, transparent 70%)",
            top: "40%",
            left: "60%",
            animation: "drift3 20s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes drift1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(60px,40px); } }
        @keyframes drift2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-50px,-30px); } }
        @keyframes drift3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px,50px); } }
      `}</style>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-8">
        {/* Header + slim stats line */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5"
        >
          <h1 className="text-xl font-semibold tracking-[0.07em] text-[#1a1a1a]">
            HIGHLIFE INTERNS
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-[#999]">
              {activeInterns.length} intern{activeInterns.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[#ddd]">|</span>
            <span className="text-xs text-[#999]">
              {totalTasks} task{totalTasks !== 1 ? "s" : ""}
            </span>
            <span className="text-[#ddd]">|</span>
            <span className="text-xs text-[#999]">
              {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
            </span>
          </div>
        </motion.div>

        {/* ---- Week Navigator ---- */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mb-5"
        >
          <div className="bg-white border border-[#e8e8e6] rounded-xl px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex items-center justify-center gap-4">
            {/* Prev */}
            <button
              onClick={() => stepWeek(-1)}
              className="p-2 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
              title="Previous week (Left arrow)"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Week display */}
            <div className="flex flex-col items-center min-w-[220px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={formatDateISO(selectedMonday)}
                  initial={{
                    opacity: 0,
                    x: weekSlideDir === "right" ? 30 : -30,
                  }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{
                    opacity: 0,
                    x: weekSlideDir === "right" ? -30 : 30,
                  }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className="text-center"
                >
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[#bbb] mb-0.5">
                    Week of
                  </div>
                  <div
                    className="text-[15px] text-[#1a1a1a]"
                    style={{ fontStyle: "italic", fontWeight: 500 }}
                  >
                    {formatDateShort(selectedMonday)} &ndash;{" "}
                    {formatDateShort(selectedSunday)},{" "}
                    {selectedSunday.getFullYear()}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* "This Week" pill or jump-back button */}
              <div className="mt-1.5 h-5 flex items-center">
                {isCurrentWeek ? (
                  <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    This Week
                  </span>
                ) : (
                  <button
                    onClick={jumpToThisWeek}
                    className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f3] text-[#888] hover:bg-[#eee] hover:text-[#555] transition-all border border-[#e5e5e3]"
                  >
                    Jump to this week
                  </button>
                )}
              </div>
            </div>

            {/* Next */}
            <button
              onClick={() => stepWeek(1)}
              className="p-2 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
              title="Next week (Right arrow)"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>

        {/* Intern management panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="bg-white border border-[#eee] rounded-xl px-5 py-3.5 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <Users size={13} className="text-[#888]" />
            <span className="text-xs font-medium text-[#1a1a1a]">Interns</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {interns.map((intern) => (
              <div
                key={intern.id}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  intern.active
                    ? "bg-[#f0fdf4] border-emerald-200 text-emerald-700"
                    : "bg-[#fafafa] border-[#e5e5e5] text-[#999]"
                }`}
              >
                <div
                  className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{
                    background: intern.active ? "#10b981" : "#d4d4d4",
                    width: 18,
                    height: 18,
                  }}
                >
                  {intern.name.charAt(0).toUpperCase()}
                </div>
                {editingIntern === intern.id ? (
                  <input
                    autoFocus
                    defaultValue={intern.name}
                    className="bg-transparent border-none outline-none text-xs font-medium w-24"
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== intern.name) {
                        updateIntern(intern.id, { name });
                      }
                      setEditingIntern(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingIntern(null);
                    }}
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => setEditingIntern(intern.id)}
                    title="Click to rename"
                  >
                    {intern.name}
                  </span>
                )}
                <button
                  onClick={() => deleteIntern(intern.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all ml-0.5"
                  title="Remove intern"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={addIntern}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[#ccc] text-[#999] hover:border-[#aaa] hover:text-[#666] transition-all"
            >
              <UserPlus size={11} />
              Add
            </button>
          </div>
        </motion.div>

        {/* Filter row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="flex items-center gap-2 mb-5 flex-wrap"
        >
          <span className="text-xs text-[#999] mr-1">Filter:</span>
          <button
            onClick={() => setFilter("All")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filter === "All"
                ? "bg-[#1a1a1a] text-white shadow-sm"
                : "bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]"
            }`}
          >
            All
          </button>
          {interns.map((intern) => (
            <button
              key={intern.id}
              onClick={() => setFilter(intern.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filter === intern.id
                  ? "bg-[#1a1a1a] text-white shadow-sm"
                  : "bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]"
              }`}
            >
              {intern.name}
            </button>
          ))}
        </motion.div>

        {/* Category Cards -- Accordion (one open at a time) */}
        {filteredCategories.map((cat, ci) => {
          const isExpanded = openCat === cat.id;
          const progress = getCategoryProgress(cat);

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.2 + ci * 0.04,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="bg-white border border-[#eee] rounded-xl mb-3 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              {/* Category header */}
              <button
                onClick={() => {
                  setOpenCat((prev) => (prev === cat.id ? null : cat.id));
                }}
                className="w-full text-left px-5 py-3 hover:bg-[#fefefe] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: hexToRgba(cat.color, 0.15),
                      color: cat.color,
                    }}
                  >
                    {cat.tasks.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="text-sm font-semibold text-[#1a1a1a]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          className="editable-field"
                          onBlur={(e) => {
                            const name =
                              e.currentTarget.textContent?.trim() || "";
                            if (name && name !== cat.name) {
                              updateCategory(cat.id, { name });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                        >
                          {cat.name}
                        </span>
                      </div>
                      {/* Progress bar */}
                      {progress.total > 0 && (
                        <div className="flex items-center gap-1.5 flex-1 max-w-[140px]">
                          <div className="flex-1 h-1.5 bg-[#f0f0ef] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress.pct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              style={{
                                background:
                                  progress.pct >= 100
                                    ? "#10b981"
                                    : cat.color,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-[#bbb] font-medium tabular-nums">
                            {progress.pct}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cat.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateCategory(cat.id, { color: e.target.value })
                      }
                      className="w-5 h-5 rounded-full border-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                      title="Change color"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCategory(cat.id);
                      }}
                      className="p-1 rounded hover:bg-red-50 text-[#ddd] hover:text-red-400 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 size={12} />
                    </button>
                    {isExpanded ? (
                      <ChevronDown size={15} className="text-[#ccc]" />
                    ) : (
                      <ChevronRight size={15} className="text-[#ccc]" />
                    )}
                  </div>
                </div>
              </button>

              {/* Tasks */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    {cat.tasks.map((task) => {
                      const isTaskExpanded = expandedTasks.has(task.id);
                      const assignedInterns = task.assignments.map(
                        (a) => a.intern
                      );

                      return (
                        <div key={task.id} className="border-t border-[#f0f0ef]">
                          <div className="flex items-start gap-2 px-5 py-2 group hover:bg-[#fafaf8] transition-colors">
                            <div className="flex-1 min-w-0">
                              {/* Title */}
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                className="text-[13px] leading-snug editable-field text-[#1a1a1a]"
                                onBlur={(e) => {
                                  const newTitle =
                                    e.currentTarget.textContent?.trim() || "";
                                  if (newTitle && newTitle !== task.title) {
                                    updateTask(task.id, { title: newTitle });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  }
                                }}
                              >
                                {task.title}
                              </div>

                              {/* Meta badges */}
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                  style={{
                                    background: hexToRgba(cat.color, 0.1),
                                    color: cat.color,
                                  }}
                                >
                                  {freqLabel(task.frequency)} -- {task.target}{" "}
                                  {task.unit}
                                </span>

                                <select
                                  value={task.frequency}
                                  onChange={(e) =>
                                    updateTask(task.id, {
                                      frequency: e.target.value,
                                    })
                                  }
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f5f5f4] text-[#666] border-0 cursor-pointer appearance-none pr-3"
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath d='M0.5 1.5L3 4.5L5.5 1.5' stroke='%23999' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 3px center",
                                  }}
                                >
                                  {FREQUENCIES.map((f) => (
                                    <option key={f} value={f}>
                                      {f}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={task.categoryId}
                                  onChange={(e) =>
                                    updateTask(task.id, {
                                      categoryId: e.target.value,
                                    })
                                  }
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f5f5f4] text-[#666] border-0 cursor-pointer appearance-none pr-3"
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath d='M0.5 1.5L3 4.5L5.5 1.5' stroke='%23999' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 3px center",
                                  }}
                                >
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>

                                {/* Assignment chips */}
                                <div className="flex items-center gap-1 ml-1">
                                  {interns.map((intern) => {
                                    const isAssigned = task.assignments.some(
                                      (a) => a.internId === intern.id
                                    );
                                    return (
                                      <button
                                        key={intern.id}
                                        onClick={() =>
                                          toggleAssignment(
                                            task.id,
                                            intern.id,
                                            isAssigned
                                          )
                                        }
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                                          isAssigned
                                            ? "bg-emerald-500 text-white ring-2 ring-emerald-200"
                                            : "bg-[#eee] text-[#bbb] hover:bg-[#ddd]"
                                        }`}
                                        title={`${isAssigned ? "Unassign" : "Assign"} ${intern.name}`}
                                      >
                                        {intern.name.charAt(0).toUpperCase()}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Per-intern progress for this period */}
                              {assignedInterns.length > 0 && (
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  {assignedInterns.map((intern) => {
                                    const count = countCompletions(
                                      task.completions,
                                      intern.id,
                                      task.frequency,
                                      weekRange
                                    );
                                    const met = count >= task.target;
                                    const pct = Math.min(
                                      100,
                                      Math.round((count / task.target) * 100)
                                    );
                                    return (
                                      <div
                                        key={intern.id}
                                        className="flex items-center gap-1.5"
                                      >
                                        <div
                                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                          style={{
                                            background: met
                                              ? "#10b981"
                                              : "#d4d4d4",
                                          }}
                                        >
                                          {intern.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-14 h-1.5 bg-[#f0f0ef] rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-500"
                                              style={{
                                                width: `${pct}%`,
                                                background: met
                                                  ? "#10b981"
                                                  : cat.color,
                                              }}
                                            />
                                          </div>
                                          <span
                                            className={`text-[10px] font-medium ${
                                              met
                                                ? "text-emerald-600"
                                                : "text-[#999]"
                                            }`}
                                          >
                                            {count}/{task.target}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                              <button
                                onClick={() => {
                                  setExpandedTasks((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(task.id))
                                      next.delete(task.id);
                                    else next.add(task.id);
                                    return next;
                                  });
                                }}
                                className="p-1 rounded hover:bg-[#f0f0ef] text-[#bbb] hover:text-[#888] transition-colors"
                              >
                                {isTaskExpanded ? (
                                  <ChevronDown size={13} />
                                ) : (
                                  <ChevronRight size={13} />
                                )}
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="p-1 rounded hover:bg-red-50 text-[#ddd] hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded: completion log + mark complete */}
                          <AnimatePresence>
                            {isTaskExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-[#fafaf8]"
                              >
                                <div className="pl-7 pr-5 py-2.5 space-y-2.5">
                                  {/* Mark complete per intern */}
                                  <div>
                                    <div className="text-[11px] font-medium text-[#888] mb-1.5">
                                      Mark Complete{completeButtonSuffix}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {assignedInterns.map((intern) => {
                                        const count = countCompletions(
                                          task.completions,
                                          intern.id,
                                          task.frequency,
                                          weekRange
                                        );
                                        const met = count >= task.target;
                                        return (
                                          <button
                                            key={intern.id}
                                            onClick={() =>
                                              markComplete(
                                                task.id,
                                                intern.id
                                              )
                                            }
                                            disabled={met}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                              met
                                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default"
                                                : "bg-white border border-[#e5e5e5] text-[#555] hover:border-emerald-300 hover:bg-emerald-50"
                                            }`}
                                          >
                                            {met ? (
                                              <Check
                                                size={11}
                                                className="text-emerald-500"
                                              />
                                            ) : (
                                              <Plus size={11} />
                                            )}
                                            {intern.name} ({count}/
                                            {task.target})
                                          </button>
                                        );
                                      })}
                                      {assignedInterns.length === 0 && (
                                        <span className="text-xs text-[#bbb] italic">
                                          No interns assigned
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Recent completions log */}
                                  {task.completions.length > 0 && (
                                    <div>
                                      <div className="text-[11px] font-medium text-[#888] mb-1">
                                        Recent Completions
                                      </div>
                                      <div className="space-y-0.5 max-h-28 overflow-y-auto">
                                        {task.completions
                                          .slice(0, 10)
                                          .map((comp) => {
                                            const intern = interns.find(
                                              (i) => i.id === comp.internId
                                            );
                                            return (
                                              <div
                                                key={comp.id}
                                                className="flex items-center gap-2 text-[11px] text-[#888]"
                                              >
                                                <Check
                                                  size={10}
                                                  className="text-emerald-400"
                                                />
                                                <span className="font-medium text-[#555]">
                                                  {intern?.name || "Unknown"}
                                                </span>
                                                <span>
                                                  {new Date(
                                                    comp.completedAt
                                                  ).toLocaleDateString(
                                                    "en-US",
                                                    {
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "numeric",
                                                      minute: "2-digit",
                                                    }
                                                  )}
                                                </span>
                                              </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Task description */}
                                  {task.description && (
                                    <div className="text-[11px] text-[#999] italic">
                                      {task.description}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    <div className="border-t border-[#f0f0ef] px-5 py-2">
                      <button
                        onClick={() => addTask(cat.id)}
                        className="flex items-center gap-1.5 text-xs text-[#bbb] hover:text-[#888] transition-colors"
                      >
                        <Plus size={12} />
                        Add task
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Add Category */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-3"
        >
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 text-xs text-[#bbb] hover:text-[#888] transition-colors px-5 py-2"
          >
            <Plus size={12} />
            Add category
          </button>
        </motion.div>

        {/* Footer */}
        <div className="text-center pb-8 mt-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 text-xs text-[#bbb] hover:text-[#888] transition-colors"
          >
            <RefreshCw size={11} />
            {lastSync
              ? `Last synced ${lastSync.toLocaleTimeString()}`
              : "Click to refresh"}
          </button>
        </div>
      </div>

      {/* ---- Floating Chat FAB + Panel ---- */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-20 right-4 w-[360px] max-w-[calc(100vw-32px)] z-50"
          >
            <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#eee]">
                <div className="flex items-center gap-2">
                  <MessageSquare size={13} className="text-[#888]" />
                  <span className="text-xs font-medium text-[#1a1a1a]">
                    AI Intern Manager
                  </span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-[#ccc] hover:text-[#888] transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="h-48 overflow-y-auto px-4 py-3 space-y-2.5">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-[#bbb] italic">
                    Try: &quot;Add an intern named Marcus&quot; or &quot;Which
                    tasks are behind this week?&quot;
                  </p>
                )}
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`text-sm ${m.role === "user" ? "text-right" : ""}`}
                  >
                    <div
                      className={`inline-block max-w-[85%] px-3 py-1.5 rounded-lg ${
                        m.role === "user"
                          ? "bg-[#1a1a1a] text-white"
                          : "bg-[#f3f3f2] text-[#333]"
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-[12px]">
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#999]">
                    <div className="w-2 h-2 rounded-full bg-[#ccc] animate-pulse" />
                    Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-[#eee] px-3 py-2.5 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Ask the AI..."
                  className="flex-1 text-xs px-3 py-1.5 border border-[#e5e5e5] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all bg-[#fafaf8]"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-1.5 bg-[#1a1a1a] text-white rounded-lg text-xs hover:bg-[#333] disabled:opacity-40 transition-all flex items-center gap-1"
                >
                  <Send size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-[#1a1a1a] text-white shadow-lg flex items-center justify-center hover:bg-[#333] transition-all"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="AI Chat"
      >
        {chatOpen ? <X size={18} /> : <MessageSquare size={18} />}
      </motion.button>
    </div>
  );
}
