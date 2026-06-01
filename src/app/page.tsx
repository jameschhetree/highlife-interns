"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MessageSquare,
  RefreshCw,
  Send,
  X,
  Check,
  Users,
  ListChecks,
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

/* ---- Helpers ---------------------------------------------- */

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Quarterly", "OneTime"] as const;

function getPeriodRange(frequency: string): { start: Date; end: Date } {
  const now = new Date();
  if (frequency === "Daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (frequency === "Weekly") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  if (frequency === "Monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  if (frequency === "Quarterly") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 1);
    return { start, end };
  }
  // OneTime — all time
  return { start: new Date(0), end: new Date(2099, 0, 1) };
}

function countCompletions(
  completions: CompletionRecord[],
  internId: string,
  frequency: string
): number {
  const { start, end } = getPeriodRange(frequency);
  return completions.filter(
    (c) =>
      c.internId === internId &&
      new Date(c.completedAt) >= start &&
      new Date(c.completedAt) < end
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingIntern, setEditingIntern] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setCategories(data.categories);
      setInterns(data.interns);
      setLastSync(new Date());
      if (firstLoad.current) {
        setExpandedCats(new Set(data.categories.map((c: Category) => c.id)));
        firstLoad.current = false;
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!confirm(`Remove ${intern?.name || "this intern"}? Their completions will be deleted.`)) return;
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
      alert(`Cannot delete "${cat.name}" -- it has ${cat.tasks.length} task(s). Move or delete them first.`);
      return;
    }
    if (!confirm(`Delete category "${cat?.name}"?`)) return;
    await api(`/api/categories/${id}`, "DELETE");
    fetchData();
  };

  // Assignment toggle
  const toggleAssignment = async (taskId: string, internId: string, isAssigned: boolean) => {
    if (isAssigned) {
      await api(`/api/tasks/${taskId}/assign/${internId}`, "DELETE");
    } else {
      await api(`/api/tasks/${taskId}/assign`, "POST", { internId });
    }
    fetchData();
  };

  // Complete
  const markComplete = async (taskId: string, internId: string) => {
    await api(`/api/tasks/${taskId}/complete`, "POST", { internId });
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

  /* ---- Stats ---------------------------------------------- */

  const activeInterns = interns.filter((i) => i.active);
  const totalTasks = categories.reduce((a, c) => a + c.tasks.length, 0);

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

  /* ---- Render --------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#999] text-sm">Loading interns...</div>
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-semibold tracking-[0.07em] text-[#1a1a1a]">
                HIGHLIFE INTERNS
              </h1>
              <p className="text-sm text-[#888]">
                Accountability Tracker
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#555] hover:border-[#ccc] hover:bg-[#f9f9f9] transition-all shadow-sm"
              >
                <MessageSquare size={15} />
                AI Chat
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          {[
            { label: "Active Interns", value: activeInterns.length, icon: Users },
            { label: "Tasks", value: totalTasks, icon: ListChecks },
            { label: "Categories", value: categories.length, icon: ListChecks },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-[#eee] rounded-xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="text-xs text-[#999] mb-0.5">{s.label}</div>
              <div className="text-2xl font-semibold text-[#1a1a1a]">{s.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Intern management panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white border border-[#eee] rounded-xl px-5 py-4 mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-[#888]" />
            <span className="text-sm font-medium text-[#1a1a1a]">Interns</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {interns.map((intern) => (
              <div
                key={intern.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  intern.active
                    ? "bg-[#f0fdf4] border-emerald-200 text-emerald-700"
                    : "bg-[#fafafa] border-[#e5e5e5] text-[#999]"
                }`}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: intern.active ? "#10b981" : "#d4d4d4" }}
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
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
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
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={addIntern}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-[#ccc] text-[#999] hover:border-[#aaa] hover:text-[#666] transition-all"
            >
              <UserPlus size={12} />
              Add Intern
            </button>
          </div>
        </motion.div>

        {/* Filter row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center gap-2 mb-6 flex-wrap"
        >
          <span className="text-xs text-[#999] mr-1">Filter:</span>
          <button
            onClick={() => setFilter("All")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === intern.id
                  ? "bg-[#1a1a1a] text-white shadow-sm"
                  : "bg-white border border-[#e5e5e5] text-[#666] hover:border-[#ccc]"
              }`}
            >
              {intern.name}
            </button>
          ))}
        </motion.div>

        {/* Chat Panel */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-white border border-[#e5e5e5] rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#eee]">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#888]" />
                    <span className="text-sm font-medium text-[#1a1a1a]">AI Intern Manager</span>
                  </div>
                  <button onClick={() => setChatOpen(false)} className="text-[#ccc] hover:text-[#888] transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="h-48 overflow-y-auto px-4 py-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-xs text-[#bbb] italic">
                      Try: &quot;Add an intern named Marcus&quot; or &quot;Which tasks are behind this week?&quot;
                    </p>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id} className={`text-sm ${m.role === "user" ? "text-right" : ""}`}>
                      <div
                        className={`inline-block max-w-[85%] px-3 py-2 rounded-lg ${
                          m.role === "user" ? "bg-[#1a1a1a] text-white" : "bg-[#f3f3f2] text-[#333]"
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-[13px]">{m.content}</div>
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
                <div className="border-t border-[#eee] px-4 py-3 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Ask the AI to manage interns and tasks..."
                    className="flex-1 text-sm px-3 py-2 border border-[#e5e5e5] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all bg-[#fafaf8]"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg text-sm hover:bg-[#333] disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Cards */}
        {filteredCategories.map((cat, ci) => {
          const isExpanded = expandedCats.has(cat.id);

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.25 + ci * 0.06,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="bg-white border border-[#eee] rounded-xl mb-4 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              {/* Category header */}
              <button
                onClick={() => {
                  setExpandedCats((prev) => {
                    const next = new Set(prev);
                    if (next.has(cat.id)) next.delete(cat.id);
                    else next.add(cat.id);
                    return next;
                  });
                }}
                className="w-full text-left px-5 py-4 hover:bg-[#fefefe] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: hexToRgba(cat.color, 0.15),
                      color: cat.color,
                    }}
                  >
                    {cat.tasks.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold text-[#1a1a1a]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        className="editable-field"
                        onBlur={(e) => {
                          const name = e.currentTarget.textContent?.trim() || "";
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
                    <div className="text-xs text-[#999]">
                      {cat.tasks.length} task{cat.tasks.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cat.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                      className="w-5 h-5 rounded-full border-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                      title="Change color"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCategory(cat.id);
                      }}
                      className="p-1 rounded hover:bg-red-50 text-[#ddd] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete category"
                    >
                      <Trash2 size={13} />
                    </button>
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-[#ccc]" />
                    ) : (
                      <ChevronRight size={16} className="text-[#ccc]" />
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
                      const assignedInterns = task.assignments.map((a) => a.intern);

                      return (
                        <div key={task.id} className="border-t border-[#f0f0ef]">
                          <div className="flex items-start gap-2.5 px-5 py-3 group hover:bg-[#fafaf8] transition-colors">
                            <div className="flex-1 min-w-0">
                              {/* Title */}
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                className="text-[13px] leading-relaxed editable-field text-[#1a1a1a]"
                                onBlur={(e) => {
                                  const newTitle = e.currentTarget.textContent?.trim() || "";
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
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                  style={{
                                    background: hexToRgba(cat.color, 0.1),
                                    color: cat.color,
                                  }}
                                >
                                  {freqLabel(task.frequency)} -- {task.target} {task.unit}
                                </span>

                                <select
                                  value={task.frequency}
                                  onChange={(e) => updateTask(task.id, { frequency: e.target.value })}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f5f5f4] text-[#666] border-0 cursor-pointer appearance-none pr-3"
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath d='M0.5 1.5L3 4.5L5.5 1.5' stroke='%23999' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 3px center",
                                  }}
                                >
                                  {FREQUENCIES.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                  ))}
                                </select>

                                <select
                                  value={task.categoryId}
                                  onChange={(e) => updateTask(task.id, { categoryId: e.target.value })}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#f5f5f4] text-[#666] border-0 cursor-pointer appearance-none pr-3"
                                  style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath d='M0.5 1.5L3 4.5L5.5 1.5' stroke='%23999' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 3px center",
                                  }}
                                >
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
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
                                        onClick={() => toggleAssignment(task.id, intern.id, isAssigned)}
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
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  {assignedInterns.map((intern) => {
                                    const count = countCompletions(
                                      task.completions,
                                      intern.id,
                                      task.frequency
                                    );
                                    const met = count >= task.target;
                                    const pct = Math.min(100, Math.round((count / task.target) * 100));
                                    return (
                                      <div key={intern.id} className="flex items-center gap-1.5">
                                        <div
                                          className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                          style={{ background: met ? "#10b981" : "#d4d4d4" }}
                                        >
                                          {intern.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-16 h-1.5 bg-[#f0f0ef] rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-500"
                                              style={{
                                                width: `${pct}%`,
                                                background: met ? "#10b981" : cat.color,
                                              }}
                                            />
                                          </div>
                                          <span
                                            className={`text-[10px] font-medium ${
                                              met ? "text-emerald-600" : "text-[#999]"
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
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => {
                                  setExpandedTasks((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(task.id)) next.delete(task.id);
                                    else next.add(task.id);
                                    return next;
                                  });
                                }}
                                className="p-1 rounded hover:bg-[#f0f0ef] text-[#bbb] hover:text-[#888] transition-colors"
                              >
                                {isTaskExpanded ? (
                                  <ChevronDown size={14} />
                                ) : (
                                  <ChevronRight size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="p-1 rounded hover:bg-red-50 text-[#ddd] hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={13} />
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
                                <div className="pl-8 pr-5 py-3 space-y-3">
                                  {/* Mark complete per intern */}
                                  <div>
                                    <div className="text-[11px] font-medium text-[#888] mb-2">
                                      Mark Complete
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {assignedInterns.map((intern) => {
                                        const count = countCompletions(
                                          task.completions,
                                          intern.id,
                                          task.frequency
                                        );
                                        const met = count >= task.target;
                                        return (
                                          <button
                                            key={intern.id}
                                            onClick={() => markComplete(task.id, intern.id)}
                                            disabled={met}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                              met
                                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default"
                                                : "bg-white border border-[#e5e5e5] text-[#555] hover:border-emerald-300 hover:bg-emerald-50"
                                            }`}
                                          >
                                            {met ? (
                                              <Check size={12} className="text-emerald-500" />
                                            ) : (
                                              <Plus size={12} />
                                            )}
                                            {intern.name} ({count}/{task.target})
                                          </button>
                                        );
                                      })}
                                      {assignedInterns.length === 0 && (
                                        <span className="text-xs text-[#bbb] italic">
                                          No interns assigned to this task
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Recent completions log */}
                                  {task.completions.length > 0 && (
                                    <div>
                                      <div className="text-[11px] font-medium text-[#888] mb-1.5">
                                        Recent Completions
                                      </div>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {task.completions.slice(0, 10).map((comp) => {
                                          const intern = interns.find(
                                            (i) => i.id === comp.internId
                                          );
                                          return (
                                            <div
                                              key={comp.id}
                                              className="flex items-center gap-2 text-[11px] text-[#888]"
                                            >
                                              <Check size={10} className="text-emerald-400" />
                                              <span className="font-medium text-[#555]">
                                                {intern?.name || "Unknown"}
                                              </span>
                                              <span>
                                                {new Date(comp.completedAt).toLocaleDateString(
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

                    <div className="border-t border-[#f0f0ef] px-5 py-2.5">
                      <button
                        onClick={() => addTask(cat.id)}
                        className="flex items-center gap-1.5 text-xs text-[#bbb] hover:text-[#888] transition-colors"
                      >
                        <Plus size={13} />
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
          className="mb-4"
        >
          <button
            onClick={addCategory}
            className="flex items-center gap-1.5 text-xs text-[#bbb] hover:text-[#888] transition-colors px-5 py-3"
          >
            <Plus size={13} />
            Add category
          </button>
        </motion.div>

        {/* Category legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2 flex-wrap mt-2 mb-8"
        >
          <span className="text-xs text-[#999]">Categories:</span>
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: hexToRgba(cat.color, 0.1),
                color: cat.color,
              }}
            >
              {cat.name}
            </span>
          ))}
        </motion.div>

        {/* Footer */}
        <div className="text-center pb-8">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 text-xs text-[#bbb] hover:text-[#888] transition-colors"
          >
            <RefreshCw size={12} />
            {lastSync
              ? `Last synced ${lastSync.toLocaleTimeString()}`
              : "Click to refresh from server"}
          </button>
        </div>
      </div>
    </div>
  );
}
