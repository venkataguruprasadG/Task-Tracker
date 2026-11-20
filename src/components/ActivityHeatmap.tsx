import React, { useMemo, useState } from 'react';
import { StudySession } from '../types/study';
import {
  formatMinutesCompact,
  formatSecondsHuman,
  getDateKey,
  getOffsetDateKey,
} from '../utils/storage';

interface ActivityHeatmapProps {
  sessions: StudySession[];
  dailyTargetMinutes: number;
}

interface DaySummary {
  dateKey: string;
  dayNumber: string;
  fullDateLabel: string;
  isToday: boolean;
  totalSeconds: number;
  totalMinutes: number;
  sessionCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  taskBreakdown: { label: string; seconds: number }[];
}

function formatFullWeekdayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  sessions,
  dailyTargetMinutes,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const todayKey = getDateKey();
  const safeTarget = Math.max(15, dailyTargetMinutes);

  const days = useMemo<DaySummary[]>(() => {
    const byDate = new Map<
      string,
      {
        totalSeconds: number;
        sessionCount: number;
        byTask: Map<string, number>;
      }
    >();

    for (const s of sessions) {
      const entry = byDate.get(s.date) || {
        totalSeconds: 0,
        sessionCount: 0,
        byTask: new Map<string, number>(),
      };
      entry.totalSeconds += s.durationSeconds;
      entry.sessionCount += 1;
      const taskLabel = s.category || s.taskTitle;
      entry.byTask.set(taskLabel, (entry.byTask.get(taskLabel) || 0) + s.durationSeconds);
      byDate.set(s.date, entry);
    }

    return Array.from({ length: 30 }).map((_, idx) => {
      const offset = -(29 - idx);
      const dateKey = getOffsetDateKey(offset);
      const bucket = byDate.get(dateKey);
      const totalSeconds = bucket?.totalSeconds || 0;
      const totalMinutes = totalSeconds / 60;
      const sessionCount = bucket?.sessionCount || 0;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (totalSeconds > 0) {
        const ratio = totalMinutes / safeTarget;
        if (ratio < 0.4) level = 1;
        else if (ratio < 0.85) level = 2;
        else if (ratio < 1.3) level = 3;
        else level = 4;
      }

      const taskBreakdown = bucket
        ? Array.from(bucket.byTask.entries())
            .map(([label, seconds]) => ({ label, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
        : [];

      return {
        dateKey,
        dayNumber: dateKey.slice(-2),
        fullDateLabel: formatFullWeekdayDate(dateKey),
        isToday: dateKey === todayKey,
        totalSeconds,
        totalMinutes,
        sessionCount,
        level,
        taskBreakdown,
      };
    });
  }, [sessions, safeTarget, todayKey]);

  const activeDaysCount = useMemo(
    () => days.filter((d) => d.totalSeconds > 0).length,
    [days]
  );
  const total30DayMinutes = useMemo(
    () => days.reduce((sum, d) => sum + d.totalMinutes, 0),
    [days]
  );

  const levelClasses: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-transparent',
    1: 'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900',
    2: 'bg-emerald-300 dark:bg-emerald-800/85 text-emerald-950 dark:text-emerald-100 border border-emerald-400/40 dark:border-emerald-700/60',
    3: 'bg-emerald-500 dark:bg-emerald-600 text-white border border-emerald-600/30 dark:border-emerald-500/40',
    4: 'bg-emerald-700 dark:bg-emerald-400 text-white dark:text-slate-950 border border-emerald-800/40 dark:border-emerald-300/60',
  };

  return (
    <section className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            30-Day Activity Heatmap
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hover any day to view recorded study time and session breakdown
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {activeDaysCount}/30 active · {formatMinutesCompact(total30DayMinutes)}
        </div>
      </div>

      {/* 30-Day Grid (3 rows x 10 cols on sm+, 5 rows x 6 cols on mobile) */}
      <div
        className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-1"
        onMouseLeave={() => setHoveredKey(null)}
      >
        {days.map((day, index) => {
          const isHovered = hoveredKey === day.dateKey;
          const colInTen = index % 10;
          const alignClass =
            colInTen <= 1
              ? 'left-0'
              : colInTen >= 8
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2';

          return (
            <div key={day.dateKey} className="relative">
              <button
                type="button"
                onMouseEnter={() => setHoveredKey(day.dateKey)}
                onMouseLeave={() =>
                  setHoveredKey((prev) => (prev === day.dateKey ? null : prev))
                }
                onFocus={() => setHoveredKey(day.dateKey)}
                onBlur={() =>
                  setHoveredKey((prev) => (prev === day.dateKey ? null : prev))
                }
                aria-label={`${day.fullDateLabel}: ${
                  day.totalSeconds > 0
                    ? `${formatSecondsHuman(day.totalSeconds)} across ${day.sessionCount} ${
                        day.sessionCount === 1 ? 'session' : 'sessions'
                      }`
                    : 'No study time recorded'
                }`}
                className={`w-full aspect-square rounded-lg flex items-center justify-center text-[11px] font-mono tabular-nums transition-transform duration-150 cursor-default focus:outline-none ${
                  levelClasses[day.level]
                } ${
                  day.isToday
                    ? 'ring-1.5 ring-slate-900/45 dark:ring-slate-200/60'
                    : ''
                } ${isHovered ? 'scale-105 z-10' : ''}`}
              >
                {day.dayNumber}
              </button>

              {/* Hover / Focus Summary Tooltip */}
              {isHovered && (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full mb-2.5 z-30 w-52 rounded-xl bg-slate-900 dark:bg-slate-950 text-slate-50 border border-slate-700/80 shadow-xl px-3.5 py-2.5 text-left ${alignClass}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span className="font-medium text-white">
                      {day.fullDateLabel}
                    </span>
                    {day.isToday && (
                      <span className="text-[10px] font-mono text-emerald-400">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="font-mono tabular-nums text-sm font-semibold text-white">
                      {day.totalSeconds > 0
                        ? formatSecondsHuman(day.totalSeconds)
                        : 'No activity'}
                    </span>
                    {day.sessionCount > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {day.sessionCount}{' '}
                        {day.sessionCount === 1 ? 'session' : 'sessions'}
                      </span>
                    )}
                  </div>

                  {day.totalSeconds > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                      {day.taskBreakdown.slice(0, 3).map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-slate-300 truncate">
                            {item.label}
                          </span>
                          <span className="font-mono tabular-nums text-emerald-400 shrink-0">
                            {formatSecondsHuman(item.seconds)}
                          </span>
                        </div>
                      ))}
                      {day.taskBreakdown.length > 3 && (
                        <div className="text-[10px] text-slate-400">
                          +{day.taskBreakdown.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Green Intensity Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
        <span>{days[0]?.fullDateLabel}</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800/80" />
          <span className="w-3 h-3 rounded-xs bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-200/80 dark:border-emerald-900" />
          <span className="w-3 h-3 rounded-xs bg-emerald-300 dark:bg-emerald-800/85" />
          <span className="w-3 h-3 rounded-xs bg-emerald-500 dark:bg-emerald-600" />
          <span className="w-3 h-3 rounded-xs bg-emerald-700 dark:bg-emerald-400" />
          <span>More</span>
        </div>
        <span>Today</span>
      </div>
    </section>
  );
};
