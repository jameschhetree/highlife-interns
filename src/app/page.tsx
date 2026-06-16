"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  Link,
  ExternalLink,
  Settings,
  CheckCircle2,
  Circle,
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
  notes?: string;
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

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "OneTime"] as const;

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

function getCompletionNotes(
  completions: CompletionRecord[],
  internId: string,
  frequency: string,
  weekRange: WeekRange | null
): CompletionRecord[] {
  if (!weekRange) return [];
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
    start = new Date(weekRange.monday);
    end = new Date(weekRange.sunday);
    end.setHours(23, 59, 59, 999);
  }
  return completions.filter(
    (c) =>
      c.internId === internId &&
      new Date(c.completedAt) >= start &&
      new Date(c.completedAt) <= end &&
      c.notes
  );
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

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
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
  const [showAdmin, setShowAdmin] = useState(false);
  const [editingIntern, setEditingIntern] = useState<string | null>(null);
  const [weekSlideDir, setWeekSlideDir] = useState<"left" | "right">("right");
  const [completingTask, setCompletingTask] = useState<{
    taskId: string;
    internId: string;
  } | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const url = new URL(window.location.href);
    if (isCurrentWeek) {
      url.searchParams.delete("week");
    } else {
      url.searchParams.set("week", formatDateISO(selectedMonday));
    }
    window.history.replaceState({}, "", url.toString());
  }, [selectedMonday, isCurrentWeek]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  const api = async (url: string, method: string, body?: Record<string, unknown>) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const addIntern = async () => {
    await api("/api/interns", "POST", { name: `Intern ${interns.length + 1}` });
    fetchData();
  };

  const updateIntern = async (id: string, data: Record<string, unknown>) => {
    await api(`/api/interns/${id}`, "PATCH", data);
    fetchData();
  };

  const deleteIntern = async (id: string) => {
    const intern = interns.find((i) => i.id === id);
    if (!confirm(`Remove ${intern?.name || "this intern"}? Their completions will be deleted.`)) return;
    await api(`/api/interns/${id}`, "DELETE");
    if (filter === id) setFilter("All");
    fetchData();
  };

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

  const addCategory = async () => {
    await api("/api/categories", "POST", { name: "New Category", color: "#6b7280" });
    fetchData();
  };

  const updateCategory = async (id: string, data: Record<string, unknown>) => {
    await api(`/api/categories/${id}`, "PATCH", data);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (cat && cat.tasks.length > 0) {
      alert(`Cannot delete "${cat.name}" — it has ${cat.tasks.length} task(s).`);
      return;
    }
    if (!confirm(`Delete category "${cat?.name}"?`)) return;
    await api(`/api/categories/${id}`, "DELETE");
    fetchData();
  };

  const toggleAssignment = async (taskId: string, internId: string, isAssigned: boolean) => {
    if (isAssigned) {
      await api(`/api/tasks/${taskId}/assign/${internId}`, "DELETE");
    } else {
      await api(`/api/tasks/${taskId}/assign`, "POST", { internId });
    }
    fetchData();
  };

  const markComplete = async (taskId: string, internId: string, notes?: string) => {
    const url = isPastWeek
      ? `/api/tasks/${taskId}/complete?week=${formatDateISO(selectedMonday)}`
      : `/api/tasks/${taskId}/complete`;
    await api(url, "POST", { internId, ...(notes ? { notes } : {}) });
    setCompletingTask(null);
    setCompletionNotes("");
    fetchData();
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatMessages((prev) => [
      ...prev,
      { id: "temp-" + Date.now(), role: "user", content: msg, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await api("/api/chat", "POST", { message: msg });
      setChatMessages((prev) => [
        ...prev,
        { id: "resp-" + Date.now(), role: "assistant", content: res.reply || res.error || "No response", createdAt: new Date().toISOString() },
      ]);
      if (res.applied && res.applied.length > 0) fetchData();
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: "err-" + Date.now(), role: "assistant", content: "Failed to get response.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  /* ---- Stats ------------------------------------------------ */

  const activeInterns = interns.filter((i) => i.active);
  const totalTasks = categories.reduce((a, c) => a + c.tasks.length, 0);

  const filteredCategories = categories.map((cat) => ({
    ...cat,
    tasks:
      filter === "All"
        ? cat.tasks
        : cat.tasks.filter((t) => t.assignments.some((a) => a.internId === filter)),
  }));

  const filterIntern = filter !== "All" ? interns.find((i) => i.id === filter) : null;

  // Overall progress for the filtered view
  let totalTarget = 0;
  let totalDone = 0;
  for (const cat of filteredCategories) {
    for (const task of cat.tasks) {
      const relevantInterns = filter === "All"
        ? task.assignments.map((a) => a.intern)
        : task.assignments.filter((a) => a.internId === filter).map((a) => a.intern);
      for (const intern of relevantInterns) {
        totalTarget += task.target;
        totalDone += Math.min(
          countCompletions(task.completions, intern.id, task.frequency, weekRange),
          task.target
        );
      }
    }
  }
  const overallPct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;

  const weekLabel = `${formatDateShort(selectedMonday)} – ${formatDateShort(selectedSunday)}, ${selectedSunday.getFullYear()}`;

  /* ---- Render ----------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="animate-pulse text-[#999] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-5"
        >
          <div>
            <h1 className="text-lg font-semibold tracking-[0.06em] text-[#1a1a1a]">
              HIGHLIFE INTERNS
            </h1>
            <p className="text-xs text-[#999] mt-0.5">
              {activeInterns.length} intern{activeInterns.length !== 1 ? "s" : ""} · {totalTasks} tasks
            </p>
          </div>
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className={`p-2 rounded-lg transition-all ${
              showAdmin ? "bg-[#1a1a1a] text-white" : "text-[#bbb] hover:text-[#888] hover:bg-white"
            }`}
            title="Admin settings"
          >
            <Settings size={16} />
          </button>
        </motion.div>

        {/* Week Navigator */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white border border-[#e8e8e6] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-4 flex items-center justify-between"
        >
          <button
            onClick={() => stepWeek(-1)}
            className="p-1.5 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={formatDateISO(selectedMonday)}
                initial={{ opacity: 0, x: weekSlideDir === "right" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: weekSlideDir === "right" ? -20 : 20 }}
                transition={{ duration: 0.15 }}
              >
                <div className="text-[13px] font-medium text-[#1a1a1a]">{weekLabel}</div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-0.5 h-4 flex items-center justify-center">
              {isCurrentWeek ? (
                <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  This Week
                </span>
              ) : (
                <button
                  onClick={jumpToThisWeek}
                  className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f3] text-[#888] hover:bg-[#eee] border border-[#e5e5e3] transition-all"
                >
                  Jump to this week
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => stepWeek(1)}
            className="p-1.5 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </motion.div>

        {/* Intern filter tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-1.5 mb-4 overflow-x-auto"
        >
          <button
            onClick={() => setFilter("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              filter === "All"
                ? "bg-[#1a1a1a] text-white shadow-sm"
                : "bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]"
            }`}
          >
            All Interns
          </button>
          {interns.map((intern) => (
            <button
              key={intern.id}
              onClick={() => setFilter(intern.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                filter === intern.id
                  ? "bg-[#1a1a1a] text-white shadow-sm"
                  : "bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]"
              }`}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                style={{
                  background: filter === intern.id ? "rgba(255,255,255,0.3)" : "#10b981",
                  color: filter === intern.id ? "#fff" : "#fff",
                }}
              >
                {intern.name.charAt(0).toUpperCase()}
              </span>
              {intern.name}
            </button>
          ))}
        </motion.div>

        {/* Overall progress bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border border-[#e8e8e6] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-5"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[#1a1a1a]">
              {filterIntern ? `${filterIntern.name}'s Progress` : "Team Progress"}
            </span>
            <span className="text-xs font-medium text-[#999]">
              {totalDone}/{totalTarget} · {overallPct}%
            </span>
          </div>
          <div className="h-2 bg-[#f0f0ef] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                background:
                  overallPct >= 100
                    ? "#10b981"
                    : overallPct >= 50
                    ? "#f59e0b"
                    : "#ef4444",
              }}
            />
          </div>
        </motion.div>

        {/* Admin panel (hidden by default) */}
        <AnimatePresence>
          {showAdmin && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-white border border-[#eee] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={12} className="text-[#888]" />
                  <span className="text-xs font-medium text-[#1a1a1a]">Manage Interns</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {interns.map((intern) => (
                    <div
                      key={intern.id}
                      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-[#f0fdf4] border-emerald-200 text-emerald-700"
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                        style={{ background: "#10b981", width: 16, height: 16 }}
                      >
                        {intern.name.charAt(0).toUpperCase()}
                      </span>
                      {editingIntern === intern.id ? (
                        <input
                          autoFocus
                          defaultValue={intern.name}
                          className="bg-transparent border-none outline-none text-xs font-medium w-20"
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (name && name !== intern.name) updateIntern(intern.id, { name });
                            setEditingIntern(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingIntern(null);
                          }}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline"
                          onClick={() => setEditingIntern(intern.id)}
                        >
                          {intern.name}
                        </span>
                      )}
                      <button
                        onClick={() => deleteIntern(intern.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addIntern}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[#ccc] text-[#999] hover:border-[#aaa] hover:text-[#666] transition-all"
                  >
                    <UserPlus size={10} />
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task Checklist — flat, scannable */}
        {filteredCategories.map((cat, ci) => {
          if (cat.tasks.length === 0) return null;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + ci * 0.04 }}
              className="mb-4"
            >
              {/* Category header */}
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: cat.color }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#999]">
                  {cat.name}
                </span>
                <span className="text-[10px] text-[#ccc]">
                  {cat.tasks.length} task{cat.tasks.length !== 1 ? "s" : ""}
                </span>
                {showAdmin && (
                  <>
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                      className="w-3 h-3 rounded border-0 cursor-pointer"
                    />
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="text-[#ddd] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </div>

              {/* Tasks */}
              <div className="bg-white border border-[#e8e8e6] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {cat.tasks.map((task, ti) => {
                  const relevantInterns =
                    filter === "All"
                      ? task.assignments.map((a) => a.intern)
                      : task.assignments
                          .filter((a) => a.internId === filter)
                          .map((a) => a.intern);

                  return (
                    <div
                      key={task.id}
                      className={`px-4 py-3 ${ti > 0 ? "border-t border-[#f0f0ef]" : ""} group`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {showAdmin ? (
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                className="text-[13px] font-medium text-[#1a1a1a] outline-none"
                                onBlur={(e) => {
                                  const t = e.currentTarget.textContent?.trim() || "";
                                  if (t && t !== task.title) updateTask(task.id, { title: t });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  }
                                }}
                              >
                                {task.title}
                              </span>
                            ) : (
                              <span className="text-[13px] font-medium text-[#1a1a1a]">
                                {task.title}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{
                                background: hexToRgba(cat.color, 0.1),
                                color: cat.color,
                              }}
                            >
                              {freqLabel(task.frequency)} · {task.target} {task.unit}
                            </span>
                            {showAdmin && (
                              <>
                                <select
                                  value={task.frequency}
                                  onChange={(e) => updateTask(task.id, { frequency: e.target.value })}
                                  className="text-[10px] px-1 py-0.5 rounded bg-[#f5f5f4] text-[#666] border-0 cursor-pointer"
                                >
                                  {FREQUENCIES.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => deleteTask(task.id)}
                                  className="opacity-0 group-hover:opacity-100 text-[#ddd] hover:text-red-400 transition-all"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </>
                            )}
                          </div>

                          {task.description && !showAdmin && (
                            <p className="text-[11px] text-[#999] mt-1 leading-relaxed line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          {/* Intern completion chips */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {relevantInterns.map((intern) => {
                              const count = countCompletions(
                                task.completions,
                                intern.id,
                                task.frequency,
                                weekRange
                              );
                              const met = count >= task.target;
                              const isCompleting =
                                completingTask?.taskId === task.id &&
                                completingTask?.internId === intern.id;
                              const notes = getCompletionNotes(
                                task.completions,
                                intern.id,
                                task.frequency,
                                weekRange
                              );

                              return (
                                <div key={intern.id} className="flex flex-col gap-1">
                                  <button
                                    onClick={() => {
                                      if (met) return;
                                      setCompletingTask({ taskId: task.id, internId: intern.id });
                                      setCompletionNotes("");
                                    }}
                                    disabled={met}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                                      met
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                        : "bg-[#fafaf8] text-[#666] border border-[#e5e5e5] hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer"
                                    }`}
                                  >
                                    {met ? (
                                      <CheckCircle2 size={12} className="text-emerald-500" />
                                    ) : (
                                      <Circle size={12} className="text-[#ccc]" />
                                    )}
                                    {filter === "All" ? intern.name : ""} {count}/{task.target}
                                  </button>

                                  {/* Completion form */}
                                  <AnimatePresence>
                                    {isCompleting && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <input
                                            autoFocus
                                            type="text"
                                            value={completionNotes}
                                            onChange={(e) => setCompletionNotes(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") markComplete(task.id, intern.id, completionNotes);
                                              if (e.key === "Escape") setCompletingTask(null);
                                            }}
                                            placeholder="Add link or note (optional)"
                                            className="text-[11px] px-2 py-1 border border-[#e5e5e5] rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 bg-white w-48"
                                          />
                                          <button
                                            onClick={() => markComplete(task.id, intern.id, completionNotes)}
                                            className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-medium hover:bg-emerald-600 transition-all"
                                          >
                                            <Check size={10} />
                                          </button>
                                          <button
                                            onClick={() => setCompletingTask(null)}
                                            className="px-1 py-1 text-[#ccc] hover:text-[#888] transition-all"
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  {/* Show submitted notes/links */}
                                  {notes.map((n) => (
                                    <div key={n.id} className="flex items-center gap-1 text-[10px] text-[#888]">
                                      {isUrl(n.notes || "") ? (
                                        <>
                                          <Link size={9} className="text-[#bbb] shrink-0" />
                                          <a
                                            href={n.notes}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline truncate max-w-[160px]"
                                          >
                                            {n.notes}
                                          </a>
                                          <ExternalLink size={8} className="text-blue-400 shrink-0" />
                                        </>
                                      ) : (
                                        <>
                                          <Check size={9} className="text-emerald-400 shrink-0" />
                                          <span className="truncate max-w-[200px]">{n.notes}</span>
                                        </>
                                      )}
                                    </div>
                                  ))}

                                  {/* Assignment toggle in admin */}
                                  {showAdmin && (
                                    <div className="flex gap-0.5">
                                      {interns.map((int) => {
                                        const isAssigned = task.assignments.some(
                                          (a) => a.internId === int.id
                                        );
                                        return (
                                          <button
                                            key={int.id}
                                            onClick={() =>
                                              toggleAssignment(task.id, int.id, isAssigned)
                                            }
                                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold transition-all ${
                                              isAssigned
                                                ? "bg-emerald-500 text-white ring-1 ring-emerald-200"
                                                : "bg-[#eee] text-[#bbb] hover:bg-[#ddd]"
                                            }`}
                                            title={`${isAssigned ? "Unassign" : "Assign"} ${int.name}`}
                                          >
                                            {int.name.charAt(0).toUpperCase()}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {showAdmin && (
                  <div className="border-t border-[#f0f0ef] px-4 py-2">
                    <button
                      onClick={() => addTask(cat.id)}
                      className="flex items-center gap-1 text-[11px] text-[#bbb] hover:text-[#888] transition-colors"
                    >
                      <Plus size={10} />
                      Add task
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {showAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
            <button
              onClick={addCategory}
              className="flex items-center gap-1 text-[11px] text-[#bbb] hover:text-[#888] transition-colors px-1"
            >
              <Plus size={10} />
              Add category
            </button>
          </motion.div>
        )}

        {/* Sync footer */}
        <div className="text-center pb-4 mt-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 text-[10px] text-[#ccc] hover:text-[#888] transition-colors"
          >
            <RefreshCw size={10} />
            {lastSync ? `Synced ${lastSync.toLocaleTimeString()}` : "Refresh"}
          </button>
        </div>
      </div>

      {/* Chat FAB + Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 w-[340px] max-w-[calc(100vw-32px)] z-50"
          >
            <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#eee]">
                <div className="flex items-center gap-2">
                  <MessageSquare size={12} className="text-[#888]" />
                  <span className="text-xs font-medium text-[#1a1a1a]">AI Assistant</span>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-[#ccc] hover:text-[#888]">
                  <X size={14} />
                </button>
              </div>
              <div className="h-48 overflow-y-auto px-4 py-3 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-[11px] text-[#bbb] italic">
                    Try: &quot;Add an intern named Marcus&quot; or &quot;Which tasks are behind?&quot;
                  </p>
                )}
                {chatMessages.map((m) => (
                  <div key={m.id} className={`text-[12px] ${m.role === "user" ? "text-right" : ""}`}>
                    <div
                      className={`inline-block max-w-[85%] px-3 py-1.5 rounded-lg whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#1a1a1a] text-white"
                          : "bg-[#f3f3f2] text-[#333]"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-[#999]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ccc] animate-pulse" />
                    Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t border-[#eee] px-3 py-2 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Ask anything..."
                  className="flex-1 text-[11px] px-2.5 py-1.5 border border-[#e5e5e5] rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-[#fafaf8]"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-2.5 py-1.5 bg-[#1a1a1a] text-white rounded-lg text-[11px] hover:bg-[#333] disabled:opacity-40 transition-all"
                >
                  <Send size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full bg-[#1a1a1a] text-white shadow-lg flex items-center justify-center hover:bg-[#333] transition-all"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {chatOpen ? <X size={16} /> : <MessageSquare size={16} />}
      </motion.button>
    </div>
  );
}
