import React from 'react';
import { formatMinutesCompact } from '../utils/storage';

export interface DailyProgressTaskItem {
  id: string;
  title: string;
  category: string;
  targetMinutes: number;
  doneSeconds: number;
  isCompleted: boolean;
  isActive: boolean;
}

interface DailyProgressWidgetProps {
  items: DailyProgressTaskItem[];
  onSelectTask: (taskId: string) => void;
}

export const DailyProgressWidget: React.FC<DailyProgressWidgetProps> = ({
  items,
  onSelectTask,
}) => {
  const totalTargetMinutes = items.reduce((sum, item) => sum + item.targetMinutes, 0);
  const totalDoneSeconds = items.reduce((sum, item) => sum + item.doneSeconds, 0);
  const totalTargetSeconds = totalTargetMinutes * 60;

  const totalDoneMinutesExact = totalDoneSeconds / 60;
  const totalDoneMinutesDisplay = Math.floor(totalDoneMinutesExact);

  const rawPercent =
    totalTargetSeconds > 0
      ? Math.round((totalDoneSeconds / totalTargetSeconds) * 100)
      : 0;
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));
  const isGoalReached = totalTargetSeconds > 0 && totalDoneSeconds >= totalTargetSeconds;

  const remainingMinutes = Math.max(
    0,
    Math.ceil((totalTargetSeconds - totalDoneSeconds) / 60)
  );
  const extraMinutes =
    totalDoneSeconds > totalTargetSeconds
      ? Math.floor((totalDoneSeconds - totalTargetSeconds) / 60)
      : 0;

  const completedTasksCount = items.filter((i) => i.isCompleted).length;

  // SVG Ring geometry
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  const doneLabel =
    totalDoneSeconds > 0 && totalDoneSeconds < 60
      ? `${totalDoneSeconds}s`
      : `${totalDoneMinutesDisplay} min`;

  return (
    <section
      aria-label="Daily Progress"
      className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Visual Circular Completion Ring */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg
              className="w-20 h-20 -rotate-90"
              viewBox="0 0 80 80"
              role="img"
              aria-label={`${rawPercent}% of daily target minutes completed`}
            >
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                strokeWidth="6.5"
                className="stroke-slate-100 dark:stroke-slate-800"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={`transition-all duration-500 ease-out ${
                  isGoalReached
                    ? 'stroke-emerald-600 dark:stroke-emerald-400'
                    : 'stroke-teal-600 dark:stroke-teal-400'
                }`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono tabular-nums text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                {rawPercent}%
              </span>
            </div>
          </div>

          {/* Mobile Title Summary beside ring */}
          <div className="sm:hidden space-y-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Daily Progress
            </h2>
            <p className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 font-medium">
              {doneLabel} / {totalTargetMinutes} min
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {totalTargetMinutes === 0
                ? 'No tasks scheduled today'
                : isGoalReached
                ? extraMinutes > 0
                  ? `Goal reached · +${extraMinutes} min extra`
                  : 'Daily minute target reached'
                : `${remainingMinutes} min remaining`}
            </p>
          </div>
        </div>

        {/* Progress Details & Horizontal Bar */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="hidden sm:flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Daily Progress
              </h2>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 text-xs">
                ·
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {completedTasksCount} of {items.length}{' '}
                {items.length === 1 ? 'task' : 'tasks'} completed
              </span>
            </div>

            <div className="flex items-baseline gap-2 font-mono tabular-nums text-xs shrink-0">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {doneLabel}
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                / {totalTargetMinutes} min
              </span>
              {totalTargetMinutes > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  {isGoalReached ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      {extraMinutes > 0 ? `+${extraMinutes} min extra` : 'Goal met'}
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      {remainingMinutes} min left
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Horizontal Progress Bar */}
          <div
            className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={clampedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily minutes completion progress"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isGoalReached
                  ? 'bg-emerald-600 dark:bg-emerald-400'
                  : 'bg-teal-600 dark:bg-teal-500'
              }`}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>

          {/* Compact Per-Task Minute Breakdown */}
          {items.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 pt-1">
              {items.map((item) => {
                const taskPct = Math.min(
                  100,
                  item.targetMinutes > 0
                    ? Math.round((item.doneSeconds / (item.targetMinutes * 60)) * 100)
                    : 0
                );
                const doneMins = Math.floor(item.doneSeconds / 60);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTask(item.id)}
                    className="group text-left space-y-1 cursor-pointer focus:outline-none"
                    title={`Focus on ${item.title}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`truncate font-medium transition-colors ${
                          item.isActive
                            ? 'text-teal-700 dark:text-teal-400'
                            : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white'
                        }`}
                      >
                        {item.category || item.title}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        {doneMins}m/{formatMinutesCompact(item.targetMinutes)}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          taskPct >= 100
                            ? 'bg-emerald-600 dark:bg-emerald-400'
                            : 'bg-teal-600/80 dark:bg-teal-500/80'
                        }`}
                        style={{ width: `${taskPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
