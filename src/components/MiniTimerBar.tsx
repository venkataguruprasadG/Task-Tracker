import React from 'react';
import { Check, Maximize2, Pause, Play, X } from 'lucide-react';
import { ActiveTimerState, LeetCodeProblem, StudyTask, TimerMode } from '../types/study';
import { formatClock, formatMinutesCompact } from '../utils/storage';

interface MiniTimerBarProps {
  variant: 'window' | 'floating';
  task: StudyTask | null;
  revisionProblem: LeetCodeProblem | null;
  timer: ActiveTimerState | null;
  elapsedSeconds: number;
  loggedSecondsForSelection: number;
  timerMode: TimerMode;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinishQuick: () => void;
  onExpand: () => void;
  onCloseFloating?: () => void;
}

export const MiniTimerBar: React.FC<MiniTimerBarProps> = ({
  variant,
  task,
  revisionProblem,
  timer,
  elapsedSeconds,
  loggedSecondsForSelection,
  timerMode,
  onStart,
  onPause,
  onResume,
  onFinishQuick,
  onExpand,
  onCloseFloating,
}) => {
  const isRunning = Boolean(timer?.isRunning);
  const currentElapsed = timer ? elapsedSeconds : 0;
  const targetSeconds = (task?.targetMinutes || 45) * 60;
  const totalSelectionSeconds = loggedSecondsForSelection + currentElapsed;
  const progressPercent = revisionProblem
    ? 0
    : Math.min(100, Math.round((totalSelectionSeconds / targetSeconds) * 100));

  let mainDisplay = formatClock(currentElapsed);
  let isOvertime = false;

  if (timerMode === 'target' && !revisionProblem) {
    const remaining = targetSeconds - totalSelectionSeconds;
    if (remaining >= 0) {
      mainDisplay = formatClock(remaining);
    } else {
      isOvertime = true;
      mainDisplay = `+${formatClock(Math.abs(remaining))}`;
    }
  }

  const label = revisionProblem
    ? `Revise LC #${revisionProblem.problemNumber}${revisionProblem.title ? ` · ${revisionProblem.title}` : ''}`
    : task?.title || 'Select a study task';

  const handleToggle = () => {
    if (!timer) {
      onStart();
    } else if (isRunning) {
      onPause();
    } else {
      onResume();
    }
  };

  if (variant === 'window') {
    return (
      <div className="min-h-screen w-full bg-[#F7F8FA] dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 p-4 flex flex-col justify-between select-none">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
              {revisionProblem ? 'LeetCode Revision · Mini Focus' : 'Always on Top · Mini Focus'}
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {label}
            </div>
          </div>

          <button
            type="button"
            onClick={onExpand}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Expand full window"
            aria-label="Expand full window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div
            className={`font-mono tabular-nums text-3xl font-bold tracking-tight leading-none ${
              isOvertime
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {mainDisplay}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!task}
              onClick={handleToggle}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                isRunning
                  ? 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900'
                  : 'bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{currentElapsed > 0 ? 'Resume' : 'Start'}</span>
                </>
              )}
            </button>

            {currentElapsed > 0 && (
              <button
                type="button"
                onClick={onFinishQuick}
                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 transition-colors cursor-pointer"
                title="Finish and save session"
                aria-label="Finish and save session"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!revisionProblem && task && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 dark:bg-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{formatMinutesCompact(totalSelectionSeconds / 60)} logged</span>
              <span>Target {formatMinutesCompact(task.targetMinutes)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Floating docked mini timer (web mode or background tab)
  return (
    <aside
      aria-label="Mini Focus Timer"
      className="fixed bottom-4 right-4 z-40 w-[336px] max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#141923]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-xl p-3.5 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
            {isRunning ? 'Focus Timer Running' : 'Mini Focus Timer'}
          </div>
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {label}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onExpand}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Open full timer view"
            aria-label="Open full timer view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          {onCloseFloating && (
            <button
              type="button"
              onClick={onCloseFloating}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Hide mini timer"
              aria-label="Hide mini timer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          className={`font-mono tabular-nums text-2xl font-bold tracking-tight leading-none ${
            isOvertime
              ? 'text-teal-700 dark:text-teal-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          {mainDisplay}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!task}
            onClick={handleToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${
              isRunning
                ? 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900'
                : 'bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{currentElapsed > 0 ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>

          {currentElapsed > 0 && (
            <button
              type="button"
              onClick={onFinishQuick}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer"
              title="Finish and save session"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {!revisionProblem && task && (
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 dark:bg-teal-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </aside>
  );
};
