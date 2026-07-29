"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, ChevronLeft, ChevronRight } from "lucide-react";

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

/* ---- Completion counting ---------------------------------- */

function countCompletions(
  completions: CompletionRecord[],
  internId: string,
  frequency: string,
  weekRange: WeekRange | null
): number {
  if (!weekRange) return 0;
  const [start, end] = getRange(frequency, weekRange);
  return completions.filter(
    (c) =>
      c.internId === internId &&
      new Date(c.completedAt) >= start &&
      new Date(c.completedAt) <= end
  ).length;
}

function getRange(frequency: string, weekRange: WeekRange): [Date, Date] {
  if (frequency === "Monthly") {
    return [new Date(weekRange.monthStart), new Date(weekRange.monthEnd)];
  }
  if (frequency === "Quarterly") {
    return [new Date(weekRange.quarterStart), new Date(weekRange.quarterEnd)];
  }
  if (frequency === "OneTime") {
    return [new Date(0), new Date(2099, 0, 1)];
  }
  const end = new Date(weekRange.sunday);
  end.setHours(23, 59, 59, 999);
  return [new Date(weekRange.monday), end];
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

/* ---- Component -------------------------------------------- */

export default function InternsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [weekRange, setWeekRange] = useState<WeekRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [weeklySummary, setWeeklySummary] = useState("");
  const [summaryDirty, setSummaryDirty] = useState(false);
  const [weekSlideDir, setWeekSlideDir] = useState<"left" | "right">("right");

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

  const weekLabel = `${formatDateShort(selectedMonday)} – ${formatDateShort(selectedSunday)}, ${selectedSunday.getFullYear()}`;
  const weekKey = formatDateISO(selectedMonday);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (isCurrentWeek) {
      url.searchParams.delete("week");
    } else {
      url.searchParams.set("week", weekKey);
    }
    window.history.replaceState({}, "", url.toString());
  }, [weekKey, isCurrentWeek]);

  function stepWeek(dir: -1 | 1) {
    setWeekSlideDir(dir === 1 ? "right" : "left");
    setSelectedMonday((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?week=${weekKey}`);
      const data = await res.json();
      setCategories(data.categories);
      setInterns(data.interns);
      setWeekRange(data.weekRange);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedInternId) {
      const key = `hl-summary-${selectedInternId}-${weekKey}`;
      const saved = localStorage.getItem(key);
      setWeeklySummary(saved || "");
      setSummaryDirty(false);
    }
  }, [selectedInternId, weekKey]);

  /* ---- API helpers ----------------------------------------- */

  const api = async (url: string, method: string, body?: Record<string, unknown>) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const markComplete = async (taskId: string, internId: string, notes?: string) => {
    const url = isPastWeek
      ? `/api/tasks/${taskId}/complete?week=${weekKey}`
      : `/api/tasks/${taskId}/complete`;
    await api(url, "POST", { internId, ...(notes ? { notes } : {}) });
    setCompletingTask(null);
    setCompletionNotes("");
    fetchData();
  };

  const undoComplete = async (taskId: string, internId: string) => {
    await api(`/api/tasks/${taskId}/complete`, "DELETE", { internId });
    fetchData();
  };

  const saveSummary = () => {
    if (!selectedInternId) return;
    const key = `hl-summary-${selectedInternId}-${weekKey}`;
    localStorage.setItem(key, weeklySummary);
    setSummaryDirty(false);
  };

  /* ---- Derived data --------------------------------------- */

  const activeInterns = interns.filter((i) => i.active);
  const selectedIntern = activeInterns.find((i) => i.id === selectedInternId);

  function getInternStats(internId: string) {
    let total = 0;
    let done = 0;
    for (const cat of categories) {
      for (const task of cat.tasks) {
        if (!task.assignments.some((a) => a.internId === internId)) continue;
        total += task.target;
        done += Math.min(
          countCompletions(task.completions, internId, task.frequency, weekRange),
          task.target
        );
      }
    }
    return { total, done };
  }

  function getInternTasks(internId: string) {
    const grouped: { category: Category; tasks: Task[] }[] = [];
    for (const cat of categories) {
      const tasks = cat.tasks.filter((t) =>
        t.assignments.some((a) => a.internId === internId)
      );
      if (tasks.length > 0) {
        grouped.push({ category: cat, tasks });
      }
    }
    return grouped;
  }

  /* ---- Render: Loading ------------------------------------ */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="animate-pulse text-[#999] text-sm">Loading...</div>
      </div>
    );
  }

  /* ---- Render: View 2 — Intern Report --------------------- */

  if (selectedIntern) {
    const taskGroups = getInternTasks(selectedIntern.id);
    const stats = getInternStats(selectedIntern.id);

    return (
      <div className="min-h-screen bg-[#fafaf8] pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Back + Header */}
            <button
              onClick={() => setSelectedInternId(null)}
              className="flex items-center gap-1.5 text-sm text-[#888] hover:text-[#1a1a1a] transition-colors mb-4 py-2 -ml-1"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <h1 className="text-xl font-semibold text-[#1a1a1a] mb-1">
              {selectedIntern.name}&rsquo;s Weekly Report
            </h1>
            <p className="text-sm text-[#888] mb-1">{weekLabel}</p>
            <p className="text-xs text-[#aaa] mb-6">
              {stats.done}/{stats.total} tasks completed
            </p>

            {/* Task groups by category */}
            {taskGroups.map(({ category, tasks }) => (
              <div key={category.id} className="mb-6">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: category.color }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#999]">
                    {category.name}
                  </span>
                </div>

                <div className="bg-white border border-[#e8e8e6] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  {tasks.map((task, ti) => {
                    const count = countCompletions(
                      task.completions,
                      selectedIntern.id,
                      task.frequency,
                      weekRange
                    );
                    const met = count >= task.target;
                    const isExpanded = completingTask === task.id;

                    return (
                      <div
                        key={task.id}
                        className={ti > 0 ? "border-t border-[#f0f0ef]" : ""}
                      >
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          {/* Checkbox area */}
                          <button
                            onClick={() => {
                              if (met) {
                                undoComplete(task.id, selectedIntern.id);
                              } else {
                                setCompletingTask(isExpanded ? null : task.id);
                                setCompletionNotes("");
                              }
                            }}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              met
                                ? "bg-emerald-500 text-white"
                                : "border-2 border-[#d5d5d5] text-transparent hover:border-emerald-400"
                            }`}
                          >
                            <Check size={14} strokeWidth={3} />
                          </button>

                          {/* Task info */}
                          <div className="flex-1 min-w-0">
                            <span
                              className={`text-sm font-medium block ${
                                met ? "text-[#999] line-through" : "text-[#1a1a1a]"
                              }`}
                            >
                              {task.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#f0f0ef] text-[#888]">
                                {freqLabel(task.frequency)}
                              </span>
                              {task.target > 1 && (
                                <span className="text-[10px] text-[#aaa]">
                                  {count}/{task.target}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Completion notes input */}
                        <AnimatePresence>
                          {isExpanded && !met && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 flex items-center gap-2">
                                <input
                                  autoFocus
                                  type="text"
                                  value={completionNotes}
                                  onChange={(e) => setCompletionNotes(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      markComplete(task.id, selectedIntern.id, completionNotes);
                                    if (e.key === "Escape") setCompletingTask(null);
                                  }}
                                  placeholder="Add note or link (optional)"
                                  className="flex-1 text-sm px-3 py-2 border border-[#e5e5e5] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white"
                                />
                                <button
                                  onClick={() =>
                                    markComplete(task.id, selectedIntern.id, completionNotes)
                                  }
                                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                                >
                                  Done
                                </button>
                                <button
                                  onClick={() => setCompletingTask(null)}
                                  className="p-2 text-[#ccc] hover:text-[#888] transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {taskGroups.length === 0 && (
              <div className="text-center py-12 text-[#bbb] text-sm">
                No tasks assigned this week.
              </div>
            )}

            {/* Weekly Summary */}
            <div className="mt-8 mb-6">
              <label className="block text-sm font-semibold text-[#1a1a1a] mb-2">
                Weekly Summary
              </label>
              <textarea
                value={weeklySummary}
                onChange={(e) => {
                  setWeeklySummary(e.target.value);
                  setSummaryDirty(true);
                }}
                placeholder="What did you accomplish this week? Any blockers or highlights?"
                rows={4}
                className="w-full text-sm px-4 py-3 border border-[#e5e5e5] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[#ccc]">
                  Saved locally per intern per week
                </span>
                <button
                  onClick={saveSummary}
                  disabled={!summaryDirty}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    summaryDirty
                      ? "bg-[#1a1a1a] text-white hover:bg-[#333]"
                      : "bg-[#f0f0ef] text-[#bbb] cursor-default"
                  }`}
                >
                  Save Summary
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---- Render: View 1 — Landing / Intern Grid ------------- */

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-xl font-semibold tracking-[0.08em] text-[#1a1a1a]">
            HIGHLIFE INTERNS
          </h1>
          <p className="text-sm text-[#999] mt-1">Weekly Report</p>
        </motion.div>

        {/* Week Navigator */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white border border-[#e8e8e6] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-8 flex items-center justify-between"
        >
          <button
            onClick={() => stepWeek(-1)}
            className="p-2 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={weekKey}
                initial={{ opacity: 0, x: weekSlideDir === "right" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: weekSlideDir === "right" ? -20 : 20 }}
                transition={{ duration: 0.15 }}
              >
                <div className="text-sm font-medium text-[#1a1a1a]">{weekLabel}</div>
              </motion.div>
            </AnimatePresence>
            {isCurrentWeek ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 inline-block">
                This Week
              </span>
            ) : (
              <button
                onClick={() => {
                  setWeekSlideDir("right");
                  setSelectedMonday(getMondayDate(new Date()));
                }}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f3] text-[#888] hover:bg-[#eee] border border-[#e5e5e3] transition-all mt-1 inline-block"
              >
                Jump to this week
              </button>
            )}
          </div>
          <button
            onClick={() => stepWeek(1)}
            className="p-2 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </motion.div>

        {/* Intern cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeInterns.map((intern, i) => {
            const { total, done } = getInternStats(intern.id);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <motion.button
                key={intern.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                onClick={() => setSelectedInternId(intern.id)}
                className="bg-white border border-[#e8e8e6] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#d0d0ce] transition-all text-left active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {intern.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-[#1a1a1a] truncate">
                      {intern.name}
                    </div>
                    <div className="text-xs text-[#999]">
                      {done}/{total} tasks done
                    </div>
                  </div>
                </div>
                <div className="h-1.5 bg-[#f0f0ef] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{
                      background:
                        pct >= 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>

        {activeInterns.length === 0 && (
          <div className="text-center py-16 text-[#bbb] text-sm">
            No active interns found.
          </div>
        )}
      </div>
    </div>
  );
}
