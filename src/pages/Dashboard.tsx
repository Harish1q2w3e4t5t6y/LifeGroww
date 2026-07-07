import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  ArrowLeft, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check,
  Flame, Zap, Moon, Sun, Settings as SettingsIcon,
} from "lucide-react";
import { useHabitStore, computeStats } from "@/lib/habit-store";
import { useAppSettings, getReportLayoutRows } from "@/hooks/useAppSettings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useSync } from "@/context/SyncContext";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

const EMOJI_SUGGESTIONS = ["💪","📚","🏃","💧","🧘","💰","🍎","🎯","💻","😴","⏰","🥗","🚴","☕","✍️","🎨","🌱","🔥"];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const ACCENT_COLORS = {
  blue: "oklch(0.65 0.18 250)",
  green: "oklch(0.76 0.17 158)", // default
  purple: "oklch(0.68 0.18 290)",
  orange: "oklch(0.74 0.18 55)",
  red: "oklch(0.65 0.22 25)",
  pink: "oklch(0.70 0.22 340)"
};

const CARD_SIZE_CONFIGS = {
  small: {
    "--card-padding": "0.5rem",
    "--card-gap": "0.375rem",
    "--font-base": "11px",
    "--stat-val-size": "1.125rem",
    "--donut-size": "85px",
  },
  medium: {
    "--card-padding": "0.75rem",
    "--card-gap": "0.5rem",
    "--font-base": "13px",
    "--stat-val-size": "1.25rem",
    "--donut-size": "110px",
  },
  large: {
    "--card-padding": "1rem",
    "--card-gap": "0.75rem",
    "--font-base": "15px",
    "--stat-val-size": "1.5rem",
    "--donut-size": "130px",
  },
};

function Panel({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-[oklch(0.20_0.006_260)] dark:bg-[oklch(0.20_0.006_260)] flex flex-col min-h-0 overflow-hidden ${className}`}>
      {title && (
        <div 
          className="text-[10px] uppercase tracking-widest text-white/50 shrink-0"
          style={{
            paddingLeft: "var(--card-padding)",
            paddingRight: "var(--card-padding)",
            paddingTop: "calc(var(--card-padding) * 0.6)",
            paddingBottom: "calc(var(--card-padding) * 0.4)",
            fontSize: "calc(var(--font-base) * 0.75)"
          }}
        >
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent, style }: { label: string; value: string | number; accent?: string; style?: React.CSSProperties }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[oklch(0.20_0.006_260)] flex flex-col justify-center min-w-0" style={{ padding: "var(--card-padding)", ...style }}>
      <div className="uppercase tracking-widest text-white/50 truncate" style={{ fontSize: "calc(var(--font-base) * 0.7)" }}>{label}</div>
      <div className={`font-semibold tabular-nums ${accent ?? "text-white"}`} style={{ fontSize: "var(--stat-val-size)" }}>{value}</div>
    </div>
  );
}

function Donut({ pct }: { pct: number }) {
  const r = 42, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: "var(--donut-size)", height: "var(--donut-size)" }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="1.5" /></filter>
        </defs>
        <circle cx="50" cy="50" r={r} stroke="oklch(1 0 0 / 8%)" strokeWidth="8" fill="none" />
        <circle
          cx="50" cy="50" r={r}
          stroke="var(--dashboard-accent)" strokeWidth="8" fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          filter="url(#glow)"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-semibold tabular-nums text-white" style={{ fontSize: "calc(var(--font-base) * 1.5)" }}>{pct}%</div>
          <div className="uppercase tracking-widest text-white/50" style={{ fontSize: "calc(var(--font-base) * 0.7)" }}>Overall</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : undefined;

  const {
    store, monthData, daysCount, toggleCheck,
    addHabit, updateHabit, deleteHabit, moveHabit, setDayMeta, toggleTheme,
  } = useHabitStore(year, month);

  const stats = useMemo(() => computeStats(monthData, daysCount, todayDay), [monthData, daysCount, todayDay]);
  const [newHabit, setNewHabit] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  const { reportLayout } = useAppSettings();
  const gridRows = getReportLayoutRows(reportLayout);

  const days = Array.from({ length: daysCount }, (_, i) => i + 1);
  const todayLog = todayDay ? monthData.days[todayDay] : undefined;
  const isDark = store.theme === "dark";

  // Habit Game Appearance settings from central SyncContext
  const { settings, updateSetting } = useSync();
  const habitgame = settings.habitgame || { accentColor: "green", cardSize: "medium" };
  const accentColor = (habitgame.accentColor && habitgame.accentColor in ACCENT_COLORS)
    ? (habitgame.accentColor as keyof typeof ACCENT_COLORS)
    : "green";
  const cardSize = (habitgame.cardSize && habitgame.cardSize in CARD_SIZE_CONFIGS)
    ? (habitgame.cardSize as keyof typeof CARD_SIZE_CONFIGS)
    : "medium";

  const accentValue = ACCENT_COLORS[accentColor];
  const sizeConfig = CARD_SIZE_CONFIGS[cardSize];

  const chartData = stats.perDay.map((d) => ({ day: d.day, pct: d.pct }));
  const wellnessData = days.map((d) => {
    const log = monthData.days[d];
    return { day: d, mood: log?.mood ?? null, sleep: log?.sleep ?? null };
  });

  return (
    <div className={`h-screen w-screen overflow-y-auto lg:overflow-hidden flex flex-col ${isDark ? "" : "light"}`}
      style={{
        background: isDark ? "oklch(0.16 0.005 260)" : "oklch(0.99 0.003 260)",
        color: isDark ? "oklch(0.94 0.005 260)" : "oklch(0.18 0.01 260)",
        fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
        fontSize: "var(--font-base)",
        "--dashboard-accent": accentValue,
        "--dashboard-accent-dark": "oklch(0.16 0.005 260)",
        ...sizeConfig
      } as React.CSSProperties}
    >
      {/* Header */}
      <header className="h-11 shrink-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 border-b border-white/10 overflow-hidden">
        <Link to="/" className="h-7 w-7 grid place-items-center rounded-md border border-white/10 hover:bg-white/5 shrink-0" title="Back to Matrix">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-6 w-6 rounded-md grid place-items-center" style={{ background: "var(--dashboard-accent)", color: "var(--dashboard-accent-dark)" }}>
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </div>
          <span className="font-semibold tracking-tight hidden sm:inline">HabitGame</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select value={year} onChange={(e) => setYear(+e.target.value)}
            className="h-7 rounded-md bg-white/5 border border-white/10 px-1 sm:px-2 text-xs outline-none">
            {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
              <option key={y} value={y} className="bg-neutral-900">{y}</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(+e.target.value)}
            className="h-7 rounded-md bg-white/5 border border-white/10 px-1 sm:px-2 text-xs outline-none">
            {MONTHS.map((m, i) => <option key={m} value={i} className="bg-neutral-900">{m}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          <SyncStatusIndicator />
          <span className="h-7 px-1.5 sm:px-2.5 rounded-full inline-flex items-center gap-1 text-[11px] sm:text-xs bg-white/5 border border-white/10" style={{ color: "oklch(0.78 0.16 70)" }}>
            <Flame className="h-3.5 w-3.5" /> <span className="tabular-nums">{stats.currentStreak}</span>
          </span>
          <span className="h-7 px-1.5 sm:px-2.5 rounded-full inline-flex items-center gap-1 text-[11px] sm:text-xs bg-white/5 border border-white/10" style={{ color: "oklch(0.78 0.16 70)" }}>
            <Zap className="h-3.5 w-3.5" /> <span className="tabular-nums">{stats.completed * 10}</span>
          </span>
          <button onClick={toggleTheme} className="h-7 w-7 grid place-items-center rounded-md border border-white/10 hover:bg-white/5 shrink-0">
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-7 w-7 grid place-items-center rounded-md border border-white/10 hover:bg-white/5 shrink-0" title="Dashboard Settings">
                <SettingsIcon className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 space-y-4 bg-neutral-950 border border-white/10 text-white rounded-lg shadow-xl z-50">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Habit Game Settings</div>
              
              {/* Accent Color */}
              <div className="space-y-1.5">
                <div className="text-[9px] uppercase tracking-wide text-white/50">Dashboard Accent Color</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(ACCENT_COLORS) as Array<keyof typeof ACCENT_COLORS>).map((colorName) => (
                    <button
                      key={colorName}
                      onClick={() => {
                        updateSetting("habitgame", { accentColor: colorName, cardSize });
                      }}
                      className={`h-5 w-5 rounded-full border grid place-items-center transition-all ${
                        accentColor === colorName ? "border-white scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ background: ACCENT_COLORS[colorName] }}
                      title={colorName.charAt(0).toUpperCase() + colorName.slice(1)}
                    >
                      {accentColor === colorName && <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Size */}
              <div className="space-y-1.5">
                <div className="text-[9px] uppercase tracking-wide text-white/50">Dashboard Card Size</div>
                <div className="grid grid-cols-3 gap-1">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        updateSetting("habitgame", { accentColor, cardSize: size });
                      }}
                      className={`h-6 rounded border text-[10px] font-medium transition-colors ${
                        cardSize === size
                          ? "border-white bg-white/15 text-white"
                          : "border-white/10 hover:bg-white/5 text-white/60"
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Appearance */}
              <button
                onClick={() => {
                  updateSetting("habitgame", { accentColor: "green", cardSize: "medium" });
                  toast.success("Appearance settings reset!");
                }}
                className="w-full h-7 flex items-center justify-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 rounded transition-colors"
              >
                Reset Appearance
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 shrink-0" style={{ gap: "var(--card-gap)", padding: "var(--card-gap)" }}>
        <Stat label="Goal" value={stats.goal} />
        <Stat label="Completed" value={stats.completed} style={{ color: "var(--dashboard-accent)" }} />
        <Stat label="Left" value={stats.left} />
        <Stat label="Overall %" value={`${stats.pct}%`} />
        <Stat label="Today %" value={`${stats.today.pct}%`} />
        <Stat label="Consistency" value={`${stats.consistency}%`} />
      </div>

      {/* Main grid */}
      <div
        className="flex-1 min-h-0 grid grid-cols-12 lg:[grid-template-rows:var(--grid-rows)]"
        style={{
          "--grid-rows": gridRows,
          gap: "var(--card-gap)",
          paddingLeft: "var(--card-gap)",
          paddingRight: "var(--card-gap)",
          paddingBottom: "var(--card-gap)",
        } as React.CSSProperties}
      >
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-2 row-span-1 lg:row-span-2 rounded-lg border border-white/10 bg-[oklch(0.20_0.006_260)] flex flex-col min-h-[240px] lg:min-h-0">
          <div
            className="text-[10px] uppercase tracking-widest text-white/50 shrink-0"
            style={{
              paddingLeft: "var(--card-padding)",
              paddingRight: "var(--card-padding)",
              paddingTop: "calc(var(--card-padding) * 0.6)",
              paddingBottom: "calc(var(--card-padding) * 0.4)",
              fontSize: "calc(var(--font-base) * 0.75)"
            }}
          >
            My Habits
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1" style={{ paddingLeft: "var(--card-padding)", paddingRight: "var(--card-padding)" }}>
            {monthData.habits.map((h) => {
              const isEditing = editingId === h.id;
              const commitEdit = () => {
                updateHabit(h.id, {
                  name: editValue.trim() || h.name,
                  emoji: (editEmoji.trim() || h.emoji).slice(0, 4),
                });
                setEditingId(null);
              };
              return (
                <div key={h.id} className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-white/5">
                  {isEditing ? (
                    <input
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      className="w-7 text-center bg-white/5 border border-white/20 rounded text-sm outline-none"
                      maxLength={4}
                      aria-label="Emoji"
                    />
                  ) : (
                    <span className="text-base leading-none w-5 text-center">{h.emoji}</span>
                  )}
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-transparent outline-none text-xs px-1 border-b border-white/20"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(h.id); setEditValue(h.name); setEditEmoji(h.emoji); }}
                      className="flex-1 text-left text-xs truncate"
                      title={h.name}
                    >{h.name}</button>
                  )}
                  {isEditing ? (
                    <button onClick={commitEdit} className="text-[var(--dashboard-accent)] p-0.5" title="Save">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-white/50">
                      <button onClick={() => moveHabit(h.id, -1)} className="hover:text-white p-0.5"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => moveHabit(h.id, 1)} className="hover:text-white p-0.5"><ArrowDown className="h-3 w-3" /></button>
                      <button
                        onClick={() => { setEditingId(h.id); setEditValue(h.name); setEditEmoji(h.emoji); }}
                        className="hover:text-white p-0.5"
                        title="Edit name & emoji"
                      ><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => deleteHabit(h.id)} className="hover:text-red-400 p-0.5"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-white/10 space-y-1.5 shrink-0" style={{ padding: "var(--card-padding)" }}>
            <div className="flex gap-1 items-center flex-wrap">
              {EMOJI_SUGGESTIONS.slice(0, 10).map((e) => (
                <button
                  key={e}
                  onClick={() => setNewEmoji(e)}
                  className={`text-sm leading-none h-5 w-5 grid place-items-center rounded transition-all ${newEmoji === e ? "bg-white/15 scale-110" : "hover:bg-white/10 opacity-70"}`}
                  title={e}
                >{e}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                maxLength={4}
                className="w-8 text-center bg-white/5 border border-white/10 rounded-md h-7 text-sm outline-none focus:border-white/30"
                aria-label="Emoji"
                title="Emoji"
              />
              <input
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addHabit(newHabit, newEmoji.trim() || "✨");
                    setNewHabit("");
                    setNewEmoji("✨");
                  }
                }}
                placeholder="New habit..."
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 h-7 text-xs outline-none focus:border-white/30"
              />
              <button
                onClick={() => {
                  addHabit(newHabit, newEmoji.trim() || "✨");
                  setNewHabit("");
                  setNewEmoji("✨");
                }}
                className="h-7 w-7 grid place-items-center rounded-md shrink-0"
                style={{ background: "var(--dashboard-accent)", color: "var(--dashboard-accent-dark)" }}
              ><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>

        {/* Tracker grid */}
        <Panel className="col-span-12 lg:col-span-7 row-span-1 min-h-[300px] lg:min-h-0" title={`Tracker · ${MONTHS[month]} ${year}`}>
          <div className="h-full overflow-auto w-full max-w-full">
            <table className="text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10" style={{ background: "oklch(0.20 0.006 260)" }}>
                <tr>
                  <th
                    className="sticky left-0 z-20 text-left font-medium text-white/60 min-w-[140px]"
                    style={{
                      background: "oklch(0.20 0.006 260)",
                      paddingLeft: "var(--card-padding)",
                      paddingRight: "var(--card-padding)",
                      paddingTop: "calc(var(--card-padding) * 0.5)",
                      paddingBottom: "calc(var(--card-padding) * 0.5)",
                    }}
                  >
                    Habit
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="font-medium text-center w-6"
                      style={{
                        paddingTop: "calc(var(--card-padding) * 0.5)",
                        paddingBottom: "calc(var(--card-padding) * 0.5)",
                        color: d === todayDay ? "var(--dashboard-accent)" : "rgba(255,255,255,0.4)"
                      }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthData.habits.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.02]">
                    <td
                      className="sticky left-0 z-10 whitespace-nowrap"
                      style={{
                        background: "oklch(0.20 0.006 260)",
                        paddingLeft: "var(--card-padding)",
                        paddingRight: "var(--card-padding)",
                        paddingTop: "calc(var(--card-padding) * 0.3)",
                        paddingBottom: "calc(var(--card-padding) * 0.3)",
                      }}
                    >
                      <span className="mr-1.5">{h.emoji}</span>
                      <span className="text-white/80">{h.name}</span>
                    </td>
                    {days.map((d) => {
                      const checked = !!monthData.days[d]?.checks?.[h.id];
                      const isToday = d === todayDay;
                      return (
                        <td
                          key={d}
                          style={{
                            paddingTop: "calc(var(--card-padding) * 0.3)",
                            paddingBottom: "calc(var(--card-padding) * 0.3)",
                            backgroundColor: isToday ? "color-mix(in oklab, var(--dashboard-accent) 6%, transparent)" : "transparent"
                          }}
                        >
                          <button
                            onClick={() => toggleCheck(h.id, d)}
                            className={`h-4 w-4 rounded transition-all active:scale-90 grid place-items-center border ${
                              checked
                                ? "border-transparent"
                                : "border-white/10 bg-white/[0.03] hover:border-[var(--dashboard-accent)]"
                            }`}
                            style={checked ? {
                              background: "var(--dashboard-accent)",
                              boxShadow: "0 0 8px -2px color-mix(in oklab, var(--dashboard-accent) 70%, transparent)",
                            } : {}}
                            aria-label={`${h.name} day ${d}`}
                          >
                            {checked && <Check className="h-2.5 w-2.5 text-[oklch(0.16_0.005_260)]" strokeWidth={4} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Donut + weekly */}
        <div className="col-span-12 lg:col-span-3 row-span-1 flex flex-col sm:flex-row lg:flex-col min-h-0" style={{ gap: "var(--card-gap)" }}>
          <Panel className="flex-1 min-h-[120px] sm:min-h-0" title="Overall Progress">
            <div className="h-full flex items-center gap-3" style={{ paddingLeft: "var(--card-padding)", paddingRight: "var(--card-padding)" }}>
              <Donut pct={stats.pct} />
              <div className="flex-1 grid grid-cols-2 gap-1.5 text-xs">
                <MiniStat label="Today" value={`${stats.today.done}/${stats.today.total}`} />
                <MiniStat label="Streak" value={String(stats.currentStreak)} />
                <MiniStat label="Longest" value={String(stats.longestStreak)} />
                <MiniStat label="Left" value={String(stats.left)} />
              </div>
            </div>
          </Panel>
          <Panel className="flex-1 min-h-[120px] sm:min-h-0" title="Weekly">
            <div className="h-full flex items-end justify-around gap-2" style={{ paddingLeft: "calc(var(--card-padding) * 1.3)", paddingRight: "calc(var(--card-padding) * 1.3)", paddingBottom: "var(--card-padding)" }}>
              {stats.weeks.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="text-[9px] tabular-nums text-white/50">{w}%</div>
                  <div className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, w)}%`,
                      background: "var(--dashboard-accent)",
                      boxShadow: "0 0 10px -3px var(--dashboard-accent)",
                    }}
                  />
                  <div className="text-[9px] text-white/50">W{i + 1}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Daily chart */}
        <Panel className="col-span-12 md:col-span-6 lg:col-span-4 row-span-1" title="Daily Progress">
          <div className="h-full min-h-[180px] lg:min-h-0" style={{ padding: "var(--card-gap)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="oklch(1 0 0 / 6%)" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "oklch(0.62 0.01 260)" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "oklch(0.62 0.01 260)" }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.006 260)", border: "1px solid oklch(1 0 0 / 10%)", fontSize: 11 }} />
                <Bar dataKey="pct" fill="var(--dashboard-accent)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Analysis */}
        <Panel className="col-span-12 md:col-span-6 lg:col-span-4 row-span-1" title="Analysis">
          <div className="h-full min-h-[180px] lg:min-h-0 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "oklch(0.20 0.006 260)" }}>
                <tr className="text-white/50 text-[10px] uppercase">
                  <th
                    className="text-left font-medium"
                    style={{
                      paddingLeft: "var(--card-padding)",
                      paddingRight: "var(--card-padding)",
                      paddingTop: "calc(var(--card-padding) * 0.5)",
                      paddingBottom: "calc(var(--card-padding) * 0.5)",
                    }}
                  >
                    Habit
                  </th>
                  <th className="text-right px-2">G</th>
                  <th className="text-right px-2">A</th>
                  <th className="px-2 w-1/3">Progress</th>
                  <th className="text-right px-3">%</th>
                </tr>
              </thead>
              <tbody>
                {stats.analysis.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.03]">
                    <td
                      style={{
                        paddingLeft: "var(--card-padding)",
                        paddingRight: "var(--card-padding)",
                        paddingTop: "calc(var(--card-padding) * 0.5)",
                        paddingBottom: "calc(var(--card-padding) * 0.5)",
                      }}
                      className="whitespace-nowrap"
                    >
                      <span className="mr-1.5">{a.emoji}</span>
                      {a.name}
                    </td>
                    <td className="text-right tabular-nums px-2 text-white/70">{a.goal}</td>
                    <td className="text-right tabular-nums px-2 text-white/70">{a.achieved}</td>
                    <td className="px-2">
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${a.pct}%`, background: "var(--dashboard-accent)" }} />
                      </div>
                    </td>
                    <td className="text-right tabular-nums px-3 text-white/80">{a.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Wellness + today */}
        <div className="col-span-12 lg:col-span-2 row-span-1 flex flex-col sm:flex-row lg:flex-col min-h-0" style={{ gap: "var(--card-gap)" }}>
          <Panel className="flex-1 min-h-[140px] sm:min-h-0" title="Wellness">
            <div className="h-full min-h-[120px] sm:min-h-0" style={{ padding: "calc(var(--card-gap) * 0.5)" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wellnessData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: "oklch(0.62 0.01 260)" }} interval={4} />
                  <YAxis tick={{ fontSize: 8, fill: "oklch(0.62 0.01 260)" }} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.006 260)", border: "1px solid oklch(1 0 0 / 10%)", fontSize: 10 }} />
                  <Line type="monotone" dataKey="mood" stroke="var(--dashboard-accent)" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="sleep" stroke="oklch(0.78 0.16 70)" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="flex-1 min-h-[140px] sm:min-h-0" title={`Today · Day ${todayDay ?? "-"}`}>
            <div className="space-y-2 text-xs h-full overflow-auto" style={{ padding: "var(--card-gap)" }}>
              <div>
                <div className="text-[10px] text-white/50 mb-1">Mood</div>
                <div className="flex justify-between">
                  {["😞","😕","😐","🙂","😄"].map((e, i) => (
                    <button
                      key={i}
                      disabled={!todayDay}
                      onClick={() => todayDay && setDayMeta(todayDay, { mood: i + 1 })}
                      className={`text-lg leading-none transition-transform ${todayLog?.mood === i + 1 ? "scale-125" : "opacity-50 hover:opacity-100"}`}
                    >{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/50 mb-1 flex justify-between">
                  <span>Sleep</span><span className="tabular-nums">{todayLog?.sleep ?? 0}h</span>
                </div>
                <input
                  type="range" min={0} max={12} step={0.5}
                  value={todayLog?.sleep ?? 0}
                  disabled={!todayDay}
                  onChange={(e) => todayDay && setDayMeta(todayDay, { sleep: +e.target.value })}
                  className="w-full bg-transparent"
                  style={{ accentColor: "var(--dashboard-accent)" }}
                />
              </div>
              <div>
                <div className="text-[10px] text-white/50 mb-1">Notes</div>
                <textarea
                  value={todayLog?.notes ?? ""}
                  disabled={!todayDay}
                  onChange={(e) => todayDay && setDayMeta(todayDay, { notes: e.target.value })}
                  placeholder="Reflection..."
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-md p-1.5 text-xs outline-none resize-none focus:border-white/30"
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 border border-white/10 px-2 py-1">
      <div className="uppercase tracking-widest text-white/50" style={{ fontSize: "calc(var(--font-base) * 0.7)" }}>{label}</div>
      <div className="font-semibold tabular-nums" style={{ fontSize: "calc(var(--font-base) * 1.05)" }}>{value}</div>
    </div>
  );
}
