import React, { useState } from 'react';
import { Check, Pause, PictureInPicture2, Play, Plus, RotateCcw } from 'lucide-react';
import { ActiveTimerState, LeetCodeProblem, StudyTask, TimerMode } from '../types/study';
import {
  formatClock,
  formatDueFromLabel,
  formatMinutesCompact,
  formatReadableDate,
  getDateKey,
  getNextRevisionInterval,
} from '../utils/storage';

interface FocusTimerCardProps {
  tasks: StudyTask[];
  selectedTaskId: string;
  selectedForDate: string;
  activeRevisionProblem: LeetCodeProblem | null;
  onSelectTask: (taskId: string, forDate?: string) => void;
  onClearRevisionFocus: () => void;
  timer: ActiveTimerState | null;
  elapsedSeconds: number;
  loggedSecondsForSelection: number;
  timerMode: TimerMode;
  onChangeMode: (mode: TimerMode) => void;
  onStart: (taskId: string, forDate: string, revisionProblemId?: string) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onFinishAndSave: (note: string, revisionOutcome?: 'solo' | 'assisted') => void;
  onOpenManualLog: (taskId: string, forDate?: string) => void;
  onEnterMiniMode: () => void;
  isElectron: boolean;
}

export const FocusTimerCard: React.FC<FocusTimerCardProps> = ({
  tasks,
  selectedTaskId,
  selectedForDate,
  activeRevisionProblem,
  onSelectTask,
  onClearRevisionFocus,
  timer,
  elapsedSeconds,
  loggedSecondsForSelection,
  timerMode,
  onChangeMode,
  onStart,
  onPause,
  onResume,
  onReset,
  onFinishAndSave,
  onOpenManualLog,
  onEnterMiniMode,
  isElectron,
}) => {
  const [showSaveNote, setShowSaveNote] = useState(false);
  const [sessionNote, setSessionNote] = useState('');

  const todayKey = getDateKey();
  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;
  const effectiveForDate = selectedForDate || todayKey;
  const isCatchUp = !activeRevisionProblem && effectiveForDate < todayKey;
  const isRevision = Boolean(activeRevisionProblem);

  const isThisSelectionActive =
    timer !== null &&
    activeTask !== null &&
    timer.taskId === activeTask.id &&
    timer.forDate === effectiveForDate &&
    (timer.revisionProblemId || undefined) === (activeRevisionProblem?.id || undefined);

  const isRunning = isThisSelectionActive && timer.isRunning;
  const currentElapsed = isThisSelectionActive ? elapsedSeconds : 0;

  const targetSeconds = (activeTask?.targetMinutes || 45) * 60;
  const totalSelectionSeconds = loggedSecondsForSelection + currentElapsed;
  const progressPercent = Math.min(100, Math.round((totalSelectionSeconds / targetSeconds) * 100));
  const extraMinutes =
    totalSelectionSeconds > targetSeconds
      ? Math.floor((totalSelectionSeconds - targetSeconds) / 60)
      : 0;

  let mainDisplay = formatClock(currentElapsed);
  let isOvertime = false;
  let modeSubtitle = isRevision
    ? 'Revise and solve completely on your own — no AI or hints'
    : 'Counts up freely — extend as long as you want';

  if (timerMode === 'target') {
    const remaining = targetSeconds - totalSelectionSeconds;
    if (remaining >= 0) {
      mainDisplay = formatClock(remaining);
      modeSubtitle = 'Remaining toward target (continues into extra time if you keep going)';
    } else {
      isOvertime = true;
      mainDisplay = `+${formatClock(Math.abs(remaining))}`;
      modeSubtitle = 'Target reached — counting extra study time';
    }
  }

  const handlePrimaryToggle = () => {
    if (!activeTask) return;
    setShowSaveNote(false);
    if (!isThisSelectionActive) {
      onStart(activeTask.id, effectiveForDate, activeRevisionProblem?.id);
    } else if (isRunning) {
      onPause();
    } else {
      onResume();
    }
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    onFinishAndSave(sessionNote.trim());
    setSessionNote('');
    setShowSaveNote(false);
  };

  const handleConfirmRevisionSave = (outcome: 'solo' | 'assisted') => {
    onFinishAndSave(sessionNote.trim(), outcome);
    setSessionNote('');
    setShowSaveNote(false);
  };

  const soloNextDays = activeRevisionProblem
    ? getNextRevisionInterval(activeRevisionProblem.intervalDays, true)
    : 7;
  const assistedNextDays = activeRevisionProblem
    ? getNextRevisionInterval(activeRevisionProblem.intervalDays, false)
    : 1;

  return (
    <section
      className={`bg-white dark:bg-[#141923] border rounded-2xl p-6 sm:p-8 space-y-6 transition-colors ${
        isRevision
          ? 'border-teal-300 dark:border-teal-500/40'
          : isCatchUp
          ? 'border-amber-300 dark:border-amber-500/40'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Row: Task Selector & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          {isRevision && activeRevisionProblem ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-medium text-teal-700 dark:text-teal-400">
                  LeetCode Revision
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {activeRevisionProblem.intervalDays}d cycle
                </span>
                {!isRunning && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={onClearRevisionFocus}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      Back to daily tasks
                    </button>
                  </>
                )}
              </div>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                LC #{activeRevisionProblem.problemNumber}
                {activeRevisionProblem.title ? ` · ${activeRevisionProblem.title}` : ''}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <label
                  htmlFor="focus-task-select"
                  className="font-medium text-slate-500 dark:text-slate-400"
                >
                  {isCatchUp ? 'Catching up' : 'Currently focusing on'}
                </label>
                {isCatchUp && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {formatDueFromLabel(effectiveForDate, todayKey)}
                    </span>
                    {!isRunning && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectTask(activeTask?.id || '', todayKey)}
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 underline cursor-pointer"
                        >
                          Switch to Today
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {tasks.length > 0 ? (
                <select
                  id="focus-task-select"
                  value={activeTask?.id || ''}
                  onChange={(e) => onSelectTask(e.target.value, todayKey)}
                  disabled={isRunning}
                  className="w-full sm:max-w-sm bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none disabled:opacity-65 cursor-pointer"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({formatMinutesCompact(t.targetMinutes)}/day)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Create a task to start tracking study time.
                </p>
              )}
            </>
          )}
        </div>

        {/* Mode Segmented Control & Mini Focus Trigger */}
        <div className="flex items-center gap-2 self-start sm:self-end shrink-0 flex-wrap">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeMode('stopwatch')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                timerMode === 'stopwatch'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Open Timer
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('target')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                timerMode === 'target'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Target Countdown
            </button>
          </div>

          <button
            type="button"
            onClick={onEnterMiniMode}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-[#0D1117] dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
            title={
              isElectron
                ? 'Switch to compact always-on-top mini window'
                : 'Open compact floating mini timer'
            }
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
            <span>{isElectron ? 'Pin Mini' : 'Mini Timer'}</span>
          </button>
        </div>
      </div>

      {/* Center Readout */}
      <div className="py-4 sm:py-6 flex flex-col items-center text-center space-y-3">
        <div
          className={`font-mono tabular-nums text-5xl sm:text-6xl font-semibold tracking-tight leading-none ${
            isOvertime
              ? 'text-teal-700 dark:text-teal-400'
              : isRunning
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {mainDisplay}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">{modeSubtitle}</p>

        {/* Primary Controls */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={!activeTask}
            onClick={handlePrimaryToggle}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap ${
              isRunning
                ? 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900'
                : 'bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {currentElapsed > 0
                    ? 'Resume'
                    : isRevision
                    ? 'Start Revision'
                    : isCatchUp
                    ? 'Start Catch-Up'
                    : 'Start Session'}
                </span>
              </>
            )}
          </button>

          {currentElapsed > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  if (isRunning) onPause();
                  setShowSaveNote(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                <span>Finish &amp; Save</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSaveNote(false);
                  onReset();
                }}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Reset timer"
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline Finish & Save Note Bar */}
      {showSaveNote && currentElapsed > 0 && (
        <form
          onSubmit={handleConfirmSave}
          className="p-4 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
        >
          <input
            type="text"
            autoFocus
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder={
              isRevision
                ? 'Optional note on this revision attempt...'
                : 'Optional note: What did you solve or learn? (e.g. LC #53 Kadane)'
            }
            className="w-full bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />

          {isRevision && activeRevisionProblem ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Did you solve LC #{activeRevisionProblem.problemNumber} completely on your own?
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmRevisionSave('solo')}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Solved Solo (next in {soloNextDays}d)
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmRevisionSave('assisted')}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Used AI / Hints (retry in {assistedNextDays}d)
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveNote(false)}
                  className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveNote(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Save {formatClock(currentElapsed)}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Progress Bar & Manual Log Link */}
      {activeTask && !isRevision && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 flex-wrap">
              <span>
                {isCatchUp
                  ? `${formatReadableDate(effectiveForDate)} carryover on ${activeTask.title}`
                  : `Today’s progress on ${activeTask.title}`}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatMinutesCompact(totalSelectionSeconds / 60)} /{' '}
                {formatMinutesCompact(activeTask.targetMinutes)}
              </span>
              {extraMinutes > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span className="font-mono tabular-nums font-medium text-teal-700 dark:text-teal-400">
                    +{formatMinutesCompact(extraMinutes)} extra
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenManualLog(activeTask.id, effectiveForDate)}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log time manually</span>
            </button>
          </div>

          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCatchUp
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-teal-600 dark:bg-teal-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
};
