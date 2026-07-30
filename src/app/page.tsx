"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";

interface Intern {
  id: string;
  name: string;
  active: boolean;
}

const SHARED_DELIVERABLES = [
  {
    id: "weekly-update",
    label: "Weekly Update",
    description: "Wednesday team meeting update",
  },
  {
    id: "deep-clean",
    label: "Weekly Deep Clean",
    description: "Complete weekly deep clean",
  },
  {
    id: "workshop",
    label: "Workshop with Jaco or Jojo",
    description: "Pick a day/time for at least 1hr to work with Jaco or Jojo",
  },
  {
    id: "sessions",
    label: "Sit in on 2 Sessions",
    description: "Attend at least 2 sessions this week",
  },
];

const PROJECT_BY_NAME: Record<string, { label: string; description: string }> = {
  Ando: { label: "Shoot & Post 1x", description: "Shoot and post content at least 1x this week" },
  Koriq: { label: "Shoot & Post 1x", description: "Shoot and post content at least 1x this week" },
  Tre: { label: "Shoot & Post 1x", description: "Shoot and post content at least 1x this week" },
  Jenny: { label: "Shoot & Post 1x", description: "Shoot and post content at least 1x this week" },
  Thomas: { label: "Outreach to 15 Clients", description: "Reach out to 15 clients this week" },
  Mekhi: { label: "Outreach to 15 Clients", description: "Reach out to 15 clients this week" },
};

function getDeliverables(internName: string) {
  const project = PROJECT_BY_NAME[internName] || { label: "Weekly Project Deliverable", description: "Complete your assigned project deliverable" };
  return [
    ...SHARED_DELIVERABLES.slice(0, 3),
    { id: "project-deliverable", label: project.label, description: project.description },
    SHARED_DELIVERABLES[3],
  ];
}

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

function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return sun;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type DeliverableState = Record<string, { done: boolean; notes: string }>;

function loadState(internId: string, weekKey: string): DeliverableState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`hl-report-${internId}-${weekKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(internId: string, weekKey: string, state: DeliverableState) {
  localStorage.setItem(`hl-report-${internId}-${weekKey}`, JSON.stringify(state));
}

export default function InternsPage() {
  const [interns, setInterns] = useState<Intern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);
  const [deliverables, setDeliverables] = useState<DeliverableState>({});
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");

  const [monday, setMonday] = useState(() => getMondayDate(new Date()));
  const sunday = getSunday(monday);
  const weekKey = formatDateISO(monday);
  const isCurrentWeek = isSameDay(monday, getMondayDate(new Date()));
  const weekLabel = `${formatDateShort(monday)} – ${formatDateShort(sunday)}, ${sunday.getFullYear()}`;

  const fetchInterns = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?week=${weekKey}`);
      const data = await res.json();
      setInterns((data.interns || []).filter((i: Intern) => i.active));
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    fetchInterns();
  }, [fetchInterns]);

  useEffect(() => {
    if (selectedInternId) {
      setDeliverables(loadState(selectedInternId, weekKey));
    }
  }, [selectedInternId, weekKey]);

  function stepWeek(dir: -1 | 1) {
    setSlideDir(dir === 1 ? "right" : "left");
    setMonday((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  }

  function toggleDeliverable(id: string) {
    if (!selectedInternId) return;
    const current = deliverables[id] || { done: false, notes: "" };
    const next = { ...deliverables, [id]: { ...current, done: !current.done } };
    setDeliverables(next);
    saveState(selectedInternId, weekKey, next);
  }

  function updateNotes(id: string, notes: string) {
    if (!selectedInternId) return;
    const current = deliverables[id] || { done: false, notes: "" };
    const next = { ...deliverables, [id]: { ...current, notes } };
    setDeliverables(next);
    saveState(selectedInternId, weekKey, next);
  }

  function getInternProgress(intern: Intern): number {
    const state = loadState(intern.id, weekKey);
    const dels = getDeliverables(intern.name);
    return dels.filter((d) => state[d.id]?.done).length;
  }

  const selectedIntern = interns.find((i) => i.id === selectedInternId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="animate-pulse text-[#999] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-16">

        <AnimatePresence mode="wait">
          {selectedIntern ? (
            <motion.div
              key="report"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.2 }}
            >
              {/* Back + Header */}
              <button
                onClick={() => setSelectedInternId(null)}
                className="flex items-center gap-2 text-[13px] text-[#999] hover:text-[#555] transition-colors mb-6"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
                {selectedIntern.name}
              </h1>
              <p className="text-sm text-[#999] mb-8">Weekly Report · {weekLabel}</p>

              {/* Week nav */}
              <div className="flex items-center justify-between bg-white border border-[#e8e8e6] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
                <button
                  onClick={() => stepWeek(-1)}
                  className="p-1.5 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={weekKey}
                      initial={{ opacity: 0, x: slideDir === "right" ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: slideDir === "right" ? -20 : 20 }}
                      transition={{ duration: 0.15 }}
                      className="text-[13px] font-medium text-[#1a1a1a]"
                    >
                      {weekLabel}
                    </motion.div>
                  </AnimatePresence>
                  {isCurrentWeek && (
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 inline-block">
                      This Week
                    </span>
                  )}
                </div>
                <button
                  onClick={() => stepWeek(1)}
                  className="p-1.5 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Deliverables */}
              <div className="space-y-3">
                {getDeliverables(selectedIntern.name).map((d) => {
                  const state = deliverables[d.id] || { done: false, notes: "" };
                  return (
                    <div
                      key={d.id}
                      className="bg-white border border-[#e8e8e6] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    >
                      <div
                        onClick={() => toggleDeliverable(d.id)}
                        className="flex items-start gap-3 cursor-pointer select-none"
                      >
                        <div className="mt-0.5">
                          {state.done ? (
                            <CheckCircle2 size={22} className="text-emerald-500" />
                          ) : (
                            <Circle size={22} className="text-[#d1d5db]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div
                            className={`text-[15px] font-semibold transition-colors ${
                              state.done ? "text-emerald-600 line-through" : "text-[#1a1a1a]"
                            }`}
                          >
                            {d.label}
                          </div>
                          <div className="text-[12px] text-[#999] mt-0.5">{d.description}</div>
                        </div>
                      </div>

                      <textarea
                        value={state.notes}
                        onChange={(e) => updateNotes(d.id, e.target.value)}
                        placeholder="Add notes (optional)..."
                        rows={2}
                        className="mt-3 w-full text-[13px] px-3 py-2 border border-[#e8e8e6] rounded-lg bg-[#fafaf8] text-[#333] placeholder-[#ccc] focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 resize-none"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Progress */}
              <div className="mt-6 text-center">
                {(() => {
                  const dels = getDeliverables(selectedIntern.name);
                  return (
                    <span className="text-[13px] font-medium text-[#999]">
                      {dels.filter((d) => deliverables[d.id]?.done).length}/{dels.length} completed
                    </span>
                  );
                })()}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="landing"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-xl font-bold tracking-[0.08em] text-[#1a1a1a]">
                  HIGHLIFE INTERNS
                </h1>
                <p className="text-sm text-[#999] mt-1">Weekly Report</p>
                <p className="text-xs text-[#bbb] mt-0.5">{weekLabel}</p>
              </div>

              {/* Week nav */}
              <div className="flex items-center justify-between bg-white border border-[#e8e8e6] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
                <button
                  onClick={() => stepWeek(-1)}
                  className="p-1.5 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={weekKey}
                      initial={{ opacity: 0, x: slideDir === "right" ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: slideDir === "right" ? -20 : 20 }}
                      transition={{ duration: 0.15 }}
                      className="text-[13px] font-medium text-[#1a1a1a]"
                    >
                      {weekLabel}
                    </motion.div>
                  </AnimatePresence>
                  {isCurrentWeek && (
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 inline-block">
                      This Week
                    </span>
                  )}
                </div>
                <button
                  onClick={() => stepWeek(1)}
                  className="p-1.5 rounded-lg hover:bg-[#f5f5f3] text-[#999] hover:text-[#555] transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Intern cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {interns.map((intern, i) => {
                  const dels = getDeliverables(intern.name);
                  const done = getInternProgress(intern);
                  const pct = Math.round((done / dels.length) * 100);
                  return (
                    <motion.button
                      key={intern.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedInternId(intern.id)}
                      className="bg-white border border-[#e8e8e6] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-left hover:border-[#ccc] hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {intern.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-[16px] font-semibold text-[#1a1a1a]">
                          {intern.name}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-[#999]">
                          {done}/{dels.length} done
                        </span>
                        <span className="text-[11px] font-medium text-[#999]">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#f0f0ef] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 100 ? "#10b981" : pct > 0 ? "#f59e0b" : "#e5e7eb",
                          }}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {interns.length === 0 && (
                <div className="text-center py-16 text-[#bbb] text-sm">
                  No active interns found.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
