import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus } from 'lucide-react';
import { StudySession, StudyTask } from '../types/study';
import {
  calculateStreak,
  formatMinutesCompact,
  formatMonthDay,
  formatShortDay,
  getOffsetDateKey,
} from '../utils/storage';

interface AnalyticsViewProps {
  tasks: StudyTask[];
  sessions: StudySession[];
  theme: 'light' | 'dark';
  onOpenManualLog: (taskId: string) => void;
}

type RangeOption = 7 | 14 | 30;

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  sessions,
  theme,
  onOpenManualLog,
}) => {
  const [range, setRange] = useState<RangeOption>(7);
  const [taskFilter, setTaskFilter] = useState<string>('all');

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
      .filter((t) => t.repeat === 'daily' && !t.archived)
      .reduce((sum, t) => sum + t.targetMinutes, 0);
    return dailyTotal > 0 ? dailyTotal : 60;
  }, [tasks, taskFilter]);

  // Daily series for selected range
  const chartData = useMemo(() => {
    const minutesByDate = new Map<string, number>();
    for (const s of filteredSessions) {
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + s.durationSeconds / 60);
    }

    return Array.from({ length: range }).map((_, idx) => {
      const offset = -(range - 1 - idx);
      const dateKey = getOffsetDateKey(offset);
      const minutes = Math.round(minutesByDate.get(dateKey) || 0);
      return {
        dateKey,
        label: range === 7 ? formatShortDay(dateKey) : formatMonthDay(dateKey),
        fullDate: formatMonthDay(dateKey),
        minutes,
        hitTarget: minutes >= dailyTargetMinutes,
      };
    });
  }, [filteredSessions, range, dailyTargetMinutes]);

  // 28-day consistency grid
  const consistencyGrid = useMemo(() => {
    const minutesByDate = new Map<string, number>();
    for (const s of filteredSessions) {
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + s.durationSeconds / 60);
    }

    return Array.from({ length: 28 }).map((_, idx) => {
      const offset = -(27 - idx);
      const dateKey = getOffsetDateKey(offset);
      const minutes = Math.round(minutesByDate.get(dateKey) || 0);
      let level: 0 | 1 | 2 | 3 = 0;
      if (minutes > 0 && minutes < dailyTargetMinutes) level = 1;
      else if (minutes >= dailyTargetMinutes && minutes < dailyTargetMinutes * 1.4) level = 2;
      else if (minutes >= dailyTargetMinutes * 1.4) level = 3;

      return {
        dateKey,
        label: formatMonthDay(dateKey),
        minutes,
        level,
      };
    });
  }, [filteredSessions, dailyTargetMinutes]);

  // KPI metrics for selected range
  const stats = useMemo(() => {
    const totalMinutes = chartData.reduce((sum, d) => sum + d.minutes, 0);
    const activeDaysCount = chartData.filter((d) => d.minutes > 0).length;
    const targetMetDays = chartData.filter((d) => d.hitTarget).length;
    const avgMinutesPerDay = range > 0 ? Math.round(totalMinutes / range) : 0;

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
  }, [chartData, filteredSessions, range]);

  // Breakdown by task within selected range
  const taskBreakdown = useMemo(() => {
    const startDateKey = getOffsetDateKey(-(range - 1));
    const map = new Map<string, { title: string; category: string; minutes: number; count: number }>();

    for (const s of sessions) {
      if (s.date < startDateKey) continue;
      const existing = map.get(s.taskId) || {
        title: s.taskTitle,
        category: s.category,
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
  }, [sessions, range]);

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const tickColor = isDark ? '#94A3B8' : '#64748B';
  const barDefault = isDark ? '#334155' : '#CBD5E1';
  const barHit = isDark ? '#14B8A6' : '#0F766E';
  const barPartial = isDark ? '#0D9488' : '#5EEAD4';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Study Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track daily consistency, study duration, and how often you meet or extend past your target.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter analytics by task"
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Tasks</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-lg">
            {([7, 14, 30] as RangeOption[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  range === r
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {r} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Column Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y lg:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Studied</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatMinutesCompact(stats.totalMinutes)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last {range} days
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
              /{range}
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

      {/* Main Bar Chart */}
      <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Daily Study Duration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dashed line marks your {formatMinutesCompact(dailyTargetMinutes)} daily target
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-700 dark:bg-teal-400" />
              <span>Target met</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-300 dark:bg-teal-700" />
              <span>Partial</span>
            </span>
          </div>
        </div>

        {stats.totalMinutes === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No study sessions logged in the last {range} days
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Run the timer on Today or log a completed session manually to see your daily chart appear here.
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
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={range === 30 ? 4 : range === 14 ? 1 : 0}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="m"
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                  contentStyle={{
                    backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: isDark ? '#F1F5F9' : '#0F172A',
                  }}
                  formatter={(value: any) => [formatMinutesCompact(Number(value)), 'Studied']}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullDate || ''}
                />
                <ReferenceLine
                  y={dailyTargetMinutes}
                  stroke={isDark ? '#F59E0B' : '#D97706'}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.dateKey}
                      fill={
                        entry.minutes === 0
                          ? barDefault
                          : entry.hitTarget
                          ? barHit
                          : barPartial
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Bottom 2-Column Row: 28-Day Consistency & Time by Task */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 28-Day Consistency */}
        <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                28-Day Consistency
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every square represents one day of learning
              </p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {consistencyGrid.map((cell) => {
              const colorClass =
                cell.level === 0
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500'
                  : cell.level === 1
                  ? 'bg-teal-200 dark:bg-teal-900/70 text-teal-900 dark:text-teal-200'
                  : cell.level === 2
                  ? 'bg-teal-600 dark:bg-teal-600 text-white'
                  : 'bg-teal-800 dark:bg-teal-400 text-white dark:text-slate-950';

              return (
                <div
                  key={cell.dateKey}
                  title={`${cell.label}: ${formatMinutesCompact(cell.minutes)}`}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-mono tabular-nums transition-transform hover:scale-105 ${colorClass}`}
                >
                  <span>{cell.dateKey.slice(-2)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Less</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800" />
              <span className="w-3 h-3 rounded-xs bg-teal-200 dark:bg-teal-900/70" />
              <span className="w-3 h-3 rounded-xs bg-teal-600" />
              <span className="w-3 h-3 rounded-xs bg-teal-800 dark:bg-teal-400" />
            </div>
            <span>Extended</span>
          </div>
        </section>

        {/* Breakdown by Task */}
        <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Time by Task
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Total study time over the last {range} days
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
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate block">
                        {item.title}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {item.category} · {item.count} {item.count === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 shrink-0">
                      {formatMinutesCompact(item.minutes)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 dark:bg-teal-500 rounded-full"
                      style={{ width: `${item.sharePercent}%` }}
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
