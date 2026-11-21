import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import { LeetCodeProblem, StudySession, StudyTask } from '../types/study';
import {
  calculateStreak,
  formatMinutesCompact,
  formatMonthDay,
  formatShortDay,
  getOffsetDateKey,
  getTaskColor,
  isRecurringTask,
  ONE_TIME_DEFAULT_COLOR,
} from '../utils/storage';
import { ActivityHeatmap } from '../components/ActivityHeatmap';

interface AnalyticsViewProps {
  tasks: StudyTask[];
  sessions: StudySession[];
  leetcodeProblems: LeetCodeProblem[];
  theme: 'light' | 'dark';
  onOpenManualLog: (taskId: string) => void;
}

type RangePreset = 7 | 14 | 30 | 'custom';
type LineChartMode = 'worm' | 'daily';

interface GraphSeries {
  key: string;
  label: string;
  color: string;
  isOneTime: boolean;
}

const ONE_TIME_SERIES_KEY = '__one_time_tasks__';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  sessions,
  leetcodeProblems,
  theme,
  onOpenManualLog,
}) => {
  const [preset, setPreset] = useState<RangePreset>(7);
  const [customDaysInput, setCustomDaysInput] = useState<string>('21');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [lineMode, setLineMode] = useState<LineChartMode>('worm');
  const [hiddenSeriesKeys, setHiddenSeriesKeys] = useState<Set<string>>(() => new Set());

  const parsedCustomDays = useMemo(() => {
    const n = parseInt(customDaysInput, 10);
    if (Number.isNaN(n)) return 7;
    return Math.max(1, Math.min(365, n));
  }, [customDaysInput]);

  const activeDays = preset === 'custom' ? parsedCustomDays : preset;

  const taskById = useMemo(() => {
    const map = new Map<string, StudyTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const filteredSessions = useMemo(() => {
    if (taskFilter === 'all') return sessions;
    return sessions.filter((s) => s.taskId === taskFilter);
  }, [sessions, taskFilter]);

  const dailyTargetMinutes = useMemo(() => {
    if (taskFilter !== 'all') {
      const task = tasks.find((t) => t.id === taskFilter);
      return task?.targetMinutes || 60;
    }
    const dailyTotal = tasks
      .filter((t) => isRecurringTask(t) && !t.archived && !t.paused)
      .reduce((sum, t) => sum + t.targetMinutes, 0);
    return dailyTotal > 0 ? dailyTotal : 60;
  }, [tasks, taskFilter]);

  // Build line series: one unique colored line per recurring habit (daily or custom) + one shared neutral line for one-time tasks
  const graphSeries = useMemo<GraphSeries[]>(() => {
    const startKey = getOffsetDateKey(-(activeDays - 1));
    const list: GraphSeries[] = [];

    const visibleTasks =
      taskFilter === 'all'
        ? tasks.filter((t) => !t.archived)
        : tasks.filter((t) => t.id === taskFilter);

    const recurringHabits = visibleTasks.filter((t) => isRecurringTask(t));
    recurringHabits.forEach((task, idx) => {
      list.push({
        key: task.id,
        label: task.title,
        color: getTaskColor(task, idx),
        isOneTime: false,
      });
    });

    const recurringHabitIdSet = new Set(recurringHabits.map((t) => t.id));
    const hasOneTimeTask = visibleTasks.some((t) => t.repeat === 'once');
    const hasOneTimeSessionInWindow = filteredSessions.some(
      (s) => s.date >= startKey && !recurringHabitIdSet.has(s.taskId)
    );

    if (hasOneTimeTask || hasOneTimeSessionInWindow) {
      list.push({
        key: ONE_TIME_SERIES_KEY,
        label:
          taskFilter !== 'all' && visibleTasks[0]?.repeat === 'once'
            ? visibleTasks[0].title
            : 'One-Time Tasks',
        color: ONE_TIME_DEFAULT_COLOR,
        isOneTime: true,
      });
    }

    return list;
  }, [tasks, filteredSessions, activeDays, taskFilter]);

  // Build daily and cumulative (cricket-worm) data points across activeDays
  const lineChartData = useMemo(() => {
    const dailyHabitIds = new Set(
      graphSeries.filter((s) => !s.isOneTime).map((s) => s.key)
    );

    // Map: dateKey -> seriesKey -> minutes
    const byDateAndSeries = new Map<string, Map<string, number>>();
    for (const s of filteredSessions) {
      const seriesKey = dailyHabitIds.has(s.taskId) ? s.taskId : ONE_TIME_SERIES_KEY;
      let dayMap = byDateAndSeries.get(s.date);
      if (!dayMap) {
        dayMap = new Map<string, number>();
        byDateAndSeries.set(s.date, dayMap);
      }
      dayMap.set(seriesKey, (dayMap.get(seriesKey) || 0) + s.durationSeconds / 60);
    }

    const runningTotals = new Map<string, number>();
    for (const ser of graphSeries) {
      runningTotals.set(ser.key, 0);
    }

    return Array.from({ length: activeDays }).map((_, idx) => {
      const offset = -(activeDays - 1 - idx);
      const dateKey = getOffsetDateKey(offset);
      const dayMap = byDateAndSeries.get(dateKey);

      const point: Record<string, string | number> = {
        dateKey,
        label: activeDays <= 7 ? formatShortDay(dateKey) : formatMonthDay(dateKey),
        fullDate: formatMonthDay(dateKey),
      };

      for (const ser of graphSeries) {
        const dayMins = Math.round(dayMap?.get(ser.key) || 0);
        const nextCum = (runningTotals.get(ser.key) || 0) + dayMins;
        runningTotals.set(ser.key, nextCum);

        point[`daily_${ser.key}`] = dayMins;
        point[`worm_${ser.key}`] = nextCum;
        point[ser.key] = lineMode === 'worm' ? nextCum : dayMins;
      }

      return point;
    });
  }, [filteredSessions, graphSeries, activeDays, lineMode]);

  // Pre-aggregate total minutes per date for summary KPIs and period comparison
  const minutesByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSessions) {
      map.set(s.date, (map.get(s.date) || 0) + s.durationSeconds / 60);
    }
    return map;
  }, [filteredSessions]);

  // Previous N-day comparison window (immediately preceding activeDays)
  const previousPeriod = useMemo(() => {
    let totalMinutes = 0;
    let activeDaysCount = 0;
    let targetMetDays = 0;

    for (let idx = 0; idx < activeDays; idx += 1) {
      const offset = -(activeDays * 2 - 1 - idx);
      const dateKey = getOffsetDateKey(offset);
      const minutes = Math.round(minutesByDate.get(dateKey) || 0);
      totalMinutes += minutes;
      if (minutes > 0) activeDaysCount += 1;
      if (minutes >= dailyTargetMinutes) targetMetDays += 1;
    }

    const avgMinutesPerDay = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
    return {
      totalMinutes,
      activeDaysCount,
      targetMetDays,
      avgMinutesPerDay,
      startLabel: formatMonthDay(getOffsetDateKey(-(activeDays * 2 - 1))),
      endLabel: formatMonthDay(getOffsetDateKey(-activeDays)),
    };
  }, [minutesByDate, activeDays, dailyTargetMinutes]);

  // KPI metrics for selected range
  const stats = useMemo(() => {
    let totalMinutes = 0;
    let activeDaysCount = 0;
    let targetMetDays = 0;

    for (let idx = 0; idx < activeDays; idx += 1) {
      const offset = -(activeDays - 1 - idx);
      const dateKey = getOffsetDateKey(offset);
      const minutes = Math.round(minutesByDate.get(dateKey) || 0);
      totalMinutes += minutes;
      if (minutes > 0) activeDaysCount += 1;
      if (minutes >= dailyTargetMinutes) targetMetDays += 1;
    }

    const avgMinutesPerDay = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;

    const allActiveDates = new Set<string>();
    for (const s of filteredSessions) {
      if (s.durationSeconds >= 60) allActiveDates.add(s.date);
    }
    const streak = calculateStreak(allActiveDates);

    return {
      totalMinutes,
      activeDaysCount,
      targetMetDays,
      avgMinutesPerDay,
      streak,
    };
  }, [minutesByDate, filteredSessions, activeDays, dailyTargetMinutes]);

  // LeetCode stats within current N-day window
  const leetCodePeriodStats = useMemo(() => {
    const startKey = getOffsetDateKey(-(activeDays - 1));
    let solvedCount = 0;
    let totalReviews = 0;
    let soloReviews = 0;

    for (const p of leetcodeProblems) {
      if (p.solvedDate >= startKey) {
        solvedCount += 1;
      }
      for (const rev of p.reviewHistory) {
        if (rev.date >= startKey) {
          totalReviews += 1;
          if (rev.solvedSolo) soloReviews += 1;
        }
      }
    }

    const soloRate = totalReviews > 0 ? Math.round((soloReviews / totalReviews) * 100) : null;
    return { solvedCount, totalReviews, soloReviews, soloRate };
  }, [leetcodeProblems, activeDays]);

  // Breakdown by task within selected range (colored by each task's chosen color)
  const taskBreakdown = useMemo(() => {
    const startDateKey = getOffsetDateKey(-(activeDays - 1));
    const map = new Map<
      string,
      { title: string; category: string; color: string; minutes: number; count: number }
    >();

    for (const s of sessions) {
      if (s.date < startDateKey) continue;
      const matchedTask = taskById.get(s.taskId);
      const color = matchedTask ? getTaskColor(matchedTask) : ONE_TIME_DEFAULT_COLOR;
      const existing = map.get(s.taskId) || {
        title: matchedTask?.title || s.taskTitle,
        category: matchedTask?.category || s.category,
        color,
        minutes: 0,
        count: 0,
      };
      existing.minutes += s.durationSeconds / 60;
      existing.count += 1;
      map.set(s.taskId, existing);
    }

    const items = Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data, minutes: Math.round(data.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);

    const maxMinutes = items[0]?.minutes || 1;
    return items.map((item) => ({
      ...item,
      sharePercent: Math.round((item.minutes / maxMinutes) * 100),
    }));
  }, [sessions, activeDays, taskById]);

  const toggleSeriesVisibility = (key: string) => {
    setHiddenSeriesKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Comparison deltas
  const minutesDelta = stats.totalMinutes - previousPeriod.totalMinutes;
  const minutesDeltaPct =
    previousPeriod.totalMinutes > 0
      ? Math.round((minutesDelta / previousPeriod.totalMinutes) * 100)
      : null;
  const avgDelta = stats.avgMinutesPerDay - previousPeriod.avgMinutesPerDay;
  const targetDelta = stats.targetMetDays - previousPeriod.targetMetDays;
  const topTask = taskBreakdown[0] || null;

  const xAxisInterval =
    activeDays <= 10
      ? 0
      : activeDays <= 20
      ? 1
      : activeDays <= 45
      ? Math.floor(activeDays / 7)
      : Math.floor(activeDays / 8);

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const tickColor = isDark ? '#94A3B8' : '#64748B';
  const currentRangeLabel = `${formatMonthDay(getOffsetDateKey(-(activeDays - 1)))} – Today`;

  const renderDelta = (delta: number, suffix: string, pct?: number | null) => {
    if (delta === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
          <Minus className="w-3 h-3" />
          <span>Same as prior</span>
        </span>
      );
    }
    const positive = delta > 0;
    const formattedMag =
      suffix === 'min' ? formatMinutesCompact(Math.abs(delta)) : `${Math.abs(delta)}${suffix}`;

    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-mono tabular-nums font-medium ${
          positive
            ? 'text-teal-700 dark:text-teal-400'
            : 'text-amber-700 dark:text-amber-400'
        }`}
      >
        {positive ? (
          <ArrowUpRight className="w-3.5 h-3.5" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5" />
        )}
        <span>
          {positive ? '+' : '-'}
          {formattedMag}
          {pct !== null && pct !== undefined ? ` (${positive ? '+' : ''}${pct}%)` : ''}
        </span>
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Activity Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compare each daily habit on its own color-coded trajectory line, or inspect any custom day range.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter analytics by task"
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Activities</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-lg">
            {([7, 14, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setPreset(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  preset === r
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {r}d
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                preset === 'custom'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Custom
            </button>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              preset === 'custom'
                ? 'bg-white dark:bg-[#141923] border-teal-400 dark:border-teal-500/60'
                : 'bg-white dark:bg-[#141923] border-slate-200 dark:border-slate-800'
            }`}
          >
            <input
              type="number"
              min={1}
              max={365}
              aria-label="Custom number of days"
              value={customDaysInput}
              onFocus={() => setPreset('custom')}
              onChange={(e) => {
                setCustomDaysInput(e.target.value);
                setPreset('custom');
              }}
              className="w-12 bg-transparent text-xs font-mono tabular-nums font-medium text-center text-slate-900 dark:text-slate-100 focus:outline-none"
              placeholder="21"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 pr-0.5">
              days
            </span>
          </div>
        </div>
      </div>

      {/* 4-Column Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y lg:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Logged</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatMinutesCompact(stats.totalMinutes)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last {activeDays} {activeDays === 1 ? 'day' : 'days'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Daily Average</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatMinutesCompact(stats.avgMinutesPerDay)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {stats.activeDaysCount} active {stats.activeDaysCount === 1 ? 'day' : 'days'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Target Met</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.targetMetDays}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              /{activeDays}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Goal {formatMinutesCompact(dailyTargetMinutes)}/day
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current Streak</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.streak.current}d
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Best {stats.streak.best}d
          </div>
        </div>
      </section>

      {/* Cricket-Worm Style Multi-Line Activity Graph */}
      <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {lineMode === 'worm'
                ? `Habit Progress Worm (${activeDays} ${activeDays === 1 ? 'Day' : 'Days'})`
                : `Daily Activity Lines (${activeDays} ${activeDays === 1 ? 'Day' : 'Days'})`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lineMode === 'worm'
                ? 'Cumulative minutes per habit across the selected days — click any label below to show or hide a line'
                : 'Minutes logged each day per habit color — one-time tasks share the neutral line'}
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800 rounded-lg self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setLineMode('worm')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                lineMode === 'worm'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Cumulative Worm
            </button>
            <button
              type="button"
              onClick={() => setLineMode('daily')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                lineMode === 'daily'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Daily Minutes
            </button>
          </div>
        </div>

        {/* Interactive Color-Coded Series Legend */}
        {graphSeries.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {graphSeries.map((ser) => {
              const isHidden = hiddenSeriesKeys.has(ser.key);
              return (
                <button
                  key={ser.key}
                  type="button"
                  onClick={() => toggleSeriesVisibility(ser.key)}
                  className={`inline-flex items-center gap-2 transition-opacity cursor-pointer ${
                    isHidden ? 'opacity-35 line-through' : 'opacity-100'
                  }`}
                  title={isHidden ? `Show ${ser.label}` : `Hide ${ser.label}`}
                >
                  <span
                    className="w-3 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: ser.color }}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {ser.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {stats.totalMinutes === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No sessions logged in the last {activeDays}{' '}
              {activeDays === 1 ? 'day' : 'days'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Run the timer on Today or log a session manually to watch each habit&apos;s colored line climb here.
            </p>
            <button
              type="button"
              onClick={() => onOpenManualLog(tasks[0]?.id || '')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Session</span>
            </button>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={xAxisInterval}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: number) =>
                    val >= 60 ? `${Math.round((val / 60) * 10) / 10}h` : `${val}m`
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload as Record<string, string | number> | undefined;
                    if (!row) return null;

                    const visibleItems = graphSeries
                      .filter((ser) => !hiddenSeriesKeys.has(ser.key))
                      .map((ser) => ({
                        ...ser,
                        value: Number(row[ser.key] || 0),
                        dayMins: Number(row[`daily_${ser.key}`] || 0),
                      }))
                      .sort((a, b) => b.value - a.value);

                    return (
                      <div className="bg-white dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3.5 py-2.5 text-xs min-w-[200px] space-y-2">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          {row.fullDate}
                        </div>
                        <div className="space-y-1.5">
                          {visibleItems.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-4"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-slate-700 dark:text-slate-300 truncate">
                                  {item.label}
                                </span>
                              </span>
                              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 shrink-0">
                                {formatMinutesCompact(item.value)}
                                {lineMode === 'worm' && item.dayMins > 0 && (
                                  <span className="text-[11px] text-teal-700 dark:text-teal-400 ml-1">
                                    (+{formatMinutesCompact(item.dayMins)})
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                {graphSeries.map((ser) => {
                  if (hiddenSeriesKeys.has(ser.key)) return null;
                  return (
                    <Line
                      key={ser.key}
                      type="monotone"
                      dataKey={ser.key}
                      name={ser.label}
                      stroke={ser.color}
                      strokeWidth={ser.isOneTime ? 2 : 2.5}
                      strokeDasharray={ser.isOneTime ? '5 4' : undefined}
                      dot={(dotProps) => {
                        const { cx, cy, payload, index } = dotProps;
                        if (typeof cx !== 'number' || typeof cy !== 'number') {
                          return <g key={`${ser.key}-empty-${index}`} />;
                        }
                        const dayMins = Number(payload?.[`daily_${ser.key}`] || 0);
                        // Show crisp marker dots on days where this habit had activity (like wickets/milestones on a cricket worm)
                        if (dayMins <= 0 || activeDays > 45) {
                          return <g key={`${ser.key}-none-${index}`} />;
                        }
                        return (
                          <circle
                            key={`${ser.key}-dot-${index}`}
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill={ser.color}
                            stroke={isDark ? '#141923' : '#FFFFFF'}
                            strokeWidth={1.5}
                          />
                        );
                      }}
                      activeDot={{
                        r: 5.5,
                        fill: ser.color,
                        stroke: isDark ? '#0D1117' : '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={true}
                      animationDuration={450}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Period Review Comparison Card (Current N Days vs Previous N Days) */}
      <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {activeDays}-Day Review vs. Previous {activeDays} {activeDays === 1 ? 'Day' : 'Days'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              {currentRangeLabel} compared with {previousPeriod.startLabel} – {previousPeriod.endLabel}
            </p>
          </div>
          {topTask && (
            <div className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
              <span>Top focus:</span>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: topTask.color }}
              />
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {topTask.title}
              </span>
              <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400">
                ({formatMinutesCompact(topTask.minutes)})
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0D1117] border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Logged Time</div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatMinutesCompact(stats.totalMinutes)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                vs {formatMinutesCompact(previousPeriod.totalMinutes)}
              </span>
            </div>
            <div>{renderDelta(minutesDelta, 'min', minutesDeltaPct)}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0D1117] border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Daily Average</div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {formatMinutesCompact(stats.avgMinutesPerDay)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                vs {formatMinutesCompact(previousPeriod.avgMinutesPerDay)}
              </span>
            </div>
            <div>{renderDelta(avgDelta, 'min')}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0D1117] border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Days Target Met</div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {stats.targetMetDays}d
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                vs {previousPeriod.targetMetDays}d
              </span>
            </div>
            <div>{renderDelta(targetDelta, 'd')}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0D1117] border border-slate-100 dark:border-slate-800/80 space-y-1.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">LeetCode Solo Rate</div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {leetCodePeriodStats.soloRate !== null
                  ? `${leetCodePeriodStats.soloRate}%`
                  : '—'}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {leetCodePeriodStats.solvedCount} solved
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {leetCodePeriodStats.totalReviews > 0
                ? `${leetCodePeriodStats.soloReviews}/${leetCodePeriodStats.totalReviews} revisions solo`
                : 'No revisions in window'}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom 2-Column Row: 30-Day Activity Heatmap & Time by Task */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityHeatmap
          sessions={filteredSessions}
          dailyTargetMinutes={dailyTargetMinutes}
        />

        {/* Breakdown by Task */}
        <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Time by Activity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Total time logged over the last {activeDays}{' '}
              {activeDays === 1 ? 'day' : 'days'}
            </p>
          </div>

          {taskBreakdown.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No sessions recorded yet for this period.
            </div>
          ) : (
            <div className="space-y-4">
              {taskBreakdown.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate">{item.title}</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 pl-4.5 block">
                        {item.category} · {item.count}{' '}
                        {item.count === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 shrink-0">
                      {formatMinutesCompact(item.minutes)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.sharePercent}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
