import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Flame,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  ActiveTimerState,
  LeetCodeProblem,
  StudySession,
  StudyTask,
  TimerMode,
} from '../types/study';
import {
  calculateStreak,
  formatDueFromLabel,
  formatMinutesCompact,
  formatReadableDate,
  formatSecondsHuman,
  getDateKey,
  getDaysDifference,
  getMissedDatesForTask,
  getNextRevisionInterval,
  getTaskColor,
  isLeetCodeTask,
} from '../utils/storage';
import { FocusTimerCard } from '../components/FocusTimerCard';
import {
  DailyProgressTaskItem,
  DailyProgressWidget,
} from '../components/DailyProgressWidget';

interface TodayViewProps {
  tasks: StudyTask[];
  sessions: StudySession[];
  leetcodeProblems: LeetCodeProblem[];
  selectedTaskId: string;
  selectedForDate: string;
  activeRevisionProblem: LeetCodeProblem | null;
  onSelectTask: (taskId: string, forDate?: string) => void;
  onSelectRevisionProblem: (problem: LeetCodeProblem) => void;
  onClearRevisionFocus: () => void;
  timer: ActiveTimerState | null;
  elapsedSeconds: number;
  timerMode: TimerMode;
  onChangeMode: (mode: TimerMode) => void;
  onStartTimer: (taskId: string, forDate: string, revisionProblemId?: string) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onFinishTimer: (note: string, revisionOutcome?: 'solo' | 'assisted') => void;
  onToggleCompleteDate: (taskId: string, dateKey: string) => void;
  onSkipMissedDate: (taskId: string, dateKey: string) => void;
  onReviewProblem: (problemId: string, solvedSolo: boolean) => void;
  onOpenNewTask: () => void;
  onOpenEditTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenManualLog: (taskId: string, forDate?: string) => void;
  onEnterMiniMode: () => void;
  isElectron: boolean;
}

export const TodayView: React.FC<TodayViewProps> = ({
  tasks,
  sessions,
  leetcodeProblems,
  selectedTaskId,
  selectedForDate,
  activeRevisionProblem,
  onSelectTask,
  onSelectRevisionProblem,
  onClearRevisionFocus,
  timer,
  elapsedSeconds,
  timerMode,
  onChangeMode,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onFinishTimer,
  onToggleCompleteDate,
  onSkipMissedDate,
  onReviewProblem,
  onOpenNewTask,
  onOpenEditTask,
  onDeleteTask,
  onOpenManualLog,
  onEnterMiniMode,
  isElectron,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const todayKey = getDateKey();

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Logged seconds per (taskId + obligationDate)
  const secondsByTaskAndForDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.revisionProblemId) continue;
      const targetDate = s.forDate || s.date;
      const key = `${s.taskId}__${targetDate}`;
      map.set(key, (map.get(key) || 0) + s.durationSeconds);
    }
    return map;
  }, [sessions]);

  const todaySessions = useMemo(
    () =>
      sessions
        .filter((s) => s.date === todayKey)
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    [sessions, todayKey]
  );

  const totalTodayLoggedSeconds = useMemo(() => {
    const saved = todaySessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    return saved + (timer ? elapsedSeconds : 0);
  }, [todaySessions, timer, elapsedSeconds]);

  // All missed carryover items across daily repeating tasks
  const missedCarryoverItems = useMemo(() => {
    const list: { task: StudyTask; missedDate: string }[] = [];
    for (const task of tasks) {
      const missedDates = getMissedDatesForTask(task, todayKey);
      for (const missedDate of missedDates) {
        list.push({ task, missedDate });
      }
    }
    return list.sort((a, b) => b.missedDate.localeCompare(a.missedDate));
  }, [tasks, todayKey]);

  // LeetCode problems due for revision today or overdue
  const dueRevisions = useMemo(() => {
    return leetcodeProblems
      .filter((p) => p.nextReviewDate <= todayKey)
      .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
  }, [leetcodeProblems, todayKey]);

  // Problems solved today (shown quietly under Daily LeetCode Problem)
  const solvedTodayProblems = useMemo(
    () => leetcodeProblems.filter((p) => p.solvedDate === todayKey),
    [leetcodeProblems, todayKey]
  );

  // Overall study streak
  const overallStreak = useMemo(() => {
    const activeDates = new Set<string>();
    for (const s of sessions) {
      if (s.durationSeconds >= 60) activeDates.add(s.date);
    }
    for (const t of tasks) {
      for (const d of t.completedDates) activeDates.add(d);
    }
    return calculateStreak(activeDates);
  }, [sessions, tasks]);

  const taskStreakMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      const dates = new Set<string>(t.completedDates);
      for (const s of sessions) {
        if (s.taskId === t.id && s.durationSeconds >= 60) {
          dates.add(s.forDate || s.date);
        }
      }
      map.set(t.id, calculateStreak(dates).current);
    }
    return map;
  }, [tasks, sessions]);

  const dailyTasks = useMemo(
    () => tasks.filter((t) => t.repeat === 'daily' && !t.archived),
    [tasks]
  );
  const oneTimeTasks = useMemo(
    () => tasks.filter((t) => t.repeat === 'once' && !t.archived),
    [tasks]
  );

  const dailyTargetTotalMinutes = useMemo(
    () => dailyTasks.reduce((sum, t) => sum + t.targetMinutes, 0),
    [dailyTasks]
  );

  const dailyCompletedCount = useMemo(
    () => dailyTasks.filter((t) => t.completedDates.includes(todayKey)).length,
    [dailyTasks, todayKey]
  );

  const dailyProgressItems = useMemo<DailyProgressTaskItem[]>(() => {
    const activeOneTimeForToday = oneTimeTasks.filter(
      (t) => t.completedDates.length === 0 || t.completedDates.includes(todayKey)
    );
    const todaysTasks = [...dailyTasks, ...activeOneTimeForToday];

    return todaysTasks.map((task, idx) => {
      const savedSecs = secondsByTaskAndForDate.get(`${task.id}__${todayKey}`) || 0;
      const liveSecs =
        timer && !timer.revisionProblemId && timer.taskId === task.id && timer.forDate === todayKey
          ? elapsedSeconds
          : 0;
      const isRunningThis =
        timer !== null &&
        !timer.revisionProblemId &&
        timer.taskId === task.id &&
        timer.forDate === todayKey &&
        timer.isRunning;

      return {
        id: task.id,
        title: task.title,
        category: task.category,
        color: getTaskColor(task, idx),
        targetMinutes: task.targetMinutes,
        doneSeconds: savedSecs + liveSecs,
        isCompleted: task.completedDates.includes(todayKey),
        isActive: isRunningThis,
      };
    });
  }, [dailyTasks, oneTimeTasks, todayKey, secondsByTaskAndForDate, timer, elapsedSeconds]);

  const selectedLoggedSeconds = activeRevisionProblem
    ? 0
    : secondsByTaskAndForDate.get(`${selectedTaskId}__${selectedForDate || todayKey}`) || 0;

  const renderTaskRow = (task: StudyTask) => {
    const isDoneToday = task.completedDates.includes(todayKey);
    const savedSecs = secondsByTaskAndForDate.get(`${task.id}__${todayKey}`) || 0;
    const liveSecs =
      timer && !timer.revisionProblemId && timer.taskId === task.id && timer.forDate === todayKey
        ? elapsedSeconds
        : 0;
    const totalSecs = savedSecs + liveSecs;
    const targetSecs = task.targetMinutes * 60;
    const pct = Math.min(100, Math.round((totalSecs / targetSecs) * 100));
    const extraMins = totalSecs > targetSecs ? Math.floor((totalSecs - targetSecs) / 60) : 0;
    const isRunningThis =
      timer !== null &&
      !timer.revisionProblemId &&
      timer.taskId === task.id &&
      timer.forDate === todayKey &&
      timer.isRunning;
    const streak = taskStreakMap.get(task.id) || 0;
    const missedCountForThis = missedCarryoverItems.filter((m) => m.task.id === task.id).length;
    const isLc = isLeetCodeTask(task);
    const taskColor = getTaskColor(task);

    return (
      <div
        key={task.id}
        className={`px-5 py-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isRunningThis
            ? 'bg-teal-50/60 dark:bg-teal-950/20'
            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/35'
        }`}
      >
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onToggleCompleteDate(task.id, todayKey)}
            className="mt-0.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer shrink-0"
            aria-label={
              isDoneToday
                ? `Unmark ${task.title}`
                : isLc
                ? `Complete ${task.title} and log LeetCode problem number`
                : `Mark ${task.title} complete for today`
            }
          >
            {isDoneToday ? (
              <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: taskColor }}
                  title={task.repeat === 'daily' ? 'Habit line color' : 'Default one-time color'}
                />
                <span
                  className={`text-sm font-medium ${
                    isDoneToday
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {task.title}
                </span>
                {isRunningThis && (
                  <span className="text-xs font-mono text-teal-700 dark:text-teal-400 font-medium">
                    · Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                <span>{task.category}</span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  {task.repeat === 'daily' && <Repeat className="w-3 h-3" />}
                  <span>{task.repeat === 'daily' ? 'Repeats daily' : 'One-time'}</span>
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  Target {formatMinutesCompact(task.targetMinutes)}
                </span>
                {task.repeat === 'daily' && streak > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                      {streak}d streak
                    </span>
                  </>
                )}
                {isLc && solvedTodayProblems.length > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-teal-700 dark:text-teal-400 font-medium">
                      Logged {solvedTodayProblems.map((p) => `#${p.problemNumber}`).join(', ')}
                    </span>
                  </>
                )}
                {missedCountForThis > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      {missedCountForThis} missed due above
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Subtle Inline Progress */}
            <div className="flex items-center gap-3 max-w-sm">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: taskColor }}
                />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                {formatMinutesCompact(totalSecs / 60)}
                {extraMins > 0
                  ? ` (+${formatMinutesCompact(extraMins)})`
                  : ` / ${formatMinutesCompact(task.targetMinutes)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Row Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pl-8 sm:pl-0">
          <button
            type="button"
            onClick={() => {
              onClearRevisionFocus();
              onSelectTask(task.id, todayKey);
              if (!isRunningThis) onStartTimer(task.id, todayKey);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-500/15 text-slate-800 hover:text-teal-800 dark:text-slate-200 dark:hover:text-teal-300 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunningThis ? 'Running' : 'Focus'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenManualLog(task.id, todayKey)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            title="Log minutes manually"
          >
            + Log
          </button>

          <button
            type="button"
            onClick={() => onOpenEditTask(task)}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Edit task"
            aria-label={`Edit ${task.title}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {confirmDeleteId === task.id ? (
            <div className="flex items-center gap-1 pl-1">
              <button
                type="button"
                onClick={() => {
                  onDeleteTask(task.id);
                  setConfirmDeleteId(null);
                }}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium rounded cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(task.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Delete task"
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Page Greeting & Date */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {todayFormatted}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Show up daily, run the timer, and revise LeetCode problems independently.
          </p>
        </div>
      </div>

      {/* Daily Progress Widget */}
      <DailyProgressWidget
        items={dailyProgressItems}
        onSelectTask={(taskId) => {
          onClearRevisionFocus();
          onSelectTask(taskId, todayKey);
        }}
      />

      {/* Primary Focal Anchor: Study Timer */}
      <FocusTimerCard
        tasks={tasks.filter((t) => !t.archived)}
        selectedTaskId={selectedTaskId}
        selectedForDate={selectedForDate}
        activeRevisionProblem={activeRevisionProblem}
        onSelectTask={onSelectTask}
        onClearRevisionFocus={onClearRevisionFocus}
        timer={timer}
        elapsedSeconds={elapsedSeconds}
        loggedSecondsForSelection={selectedLoggedSeconds}
        timerMode={timerMode}
        onChangeMode={onChangeMode}
        onStart={onStartTimer}
        onPause={onPauseTimer}
        onResume={onResumeTimer}
        onReset={onResetTimer}
        onFinishAndSave={onFinishTimer}
        onOpenManualLog={onOpenManualLog}
        onEnterMiniMode={onEnterMiniMode}
        isElectron={isElectron}
      />

      {/* Clean 3-Stat Daily Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Studied Today
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatSecondsHuman(totalTodayLoggedSeconds)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {dailyTargetTotalMinutes > 0
              ? `Daily target ${formatMinutesCompact(dailyTargetTotalMinutes)}`
              : 'No daily target set'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Daily Streak</span>
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {overallStreak.current}{' '}
            <span className="text-sm font-sans font-normal text-slate-500 dark:text-slate-400">
              {overallStreak.current === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Best streak {overallStreak.best}d
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Today&apos;s Daily Tasks
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {dailyCompletedCount}{' '}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              / {dailyTasks.length}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {dueRevisions.length > 0 ? (
              <span className="text-teal-700 dark:text-teal-400 font-medium">
                {dueRevisions.length} LeetCode {dueRevisions.length === 1 ? 'revision' : 'revisions'} due
              </span>
            ) : missedCarryoverItems.length > 0 ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                {missedCarryoverItems.length} carryover from earlier
              </span>
            ) : (
              'All caught up'
            )}
          </div>
        </div>
      </section>

      {/* LeetCode Revisions Due Today (Spaced Repetition) */}
      {dueRevisions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                LeetCode Revisions Due
              </h2>
              <span className="text-xs font-mono tabular-nums text-teal-700 dark:text-teal-400 font-medium">
                {dueRevisions.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Solve completely on your own to extend the cycle
            </span>
          </div>

          <div className="bg-white dark:bg-[#141923] border border-teal-200 dark:border-teal-500/35 rounded-2xl divide-y divide-teal-100 dark:divide-slate-800/80 overflow-hidden">
            {dueRevisions.map((problem) => {
              const overdueDays = getDaysDifference(problem.nextReviewDate, todayKey);
              const nextSolo = getNextRevisionInterval(problem.intervalDays, true);
              const nextAssisted = getNextRevisionInterval(problem.intervalDays, false);
              const isTimingThis =
                timer !== null && timer.revisionProblemId === problem.id && timer.isRunning;

              return (
                <div
                  key={problem.id}
                  className={`px-5 py-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isTimingThis
                      ? 'bg-teal-50/70 dark:bg-teal-950/25'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono tabular-nums text-sm font-semibold text-teal-700 dark:text-teal-400">
                        LC #{problem.problemNumber}
                      </span>
                      {problem.title && (
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {problem.title}
                        </span>
                      )}
                      {isTimingThis && (
                        <span className="text-xs font-mono text-teal-700 dark:text-teal-400 font-medium">
                          · Active
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Revise this problem and solve completely on your own.
                    </p>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className={overdueDays > 0 ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}>
                        {overdueDays > 0 ? `Overdue ${overdueDays}d` : 'Due Today'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span>{problem.difficulty}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        Current cycle {problem.intervalDays}d
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {problem.reviewHistory.length} previous{' '}
                        {problem.reviewHistory.length === 1 ? 'review' : 'reviews'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectRevisionProblem(problem)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isTimingThis ? 'Running' : 'Focus'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onReviewProblem(problem.id, true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      title={`Solved on your own without AI — moves next revision to ${nextSolo} days`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Solved Solo (→ {nextSolo}d)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onReviewProblem(problem.id, false)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      title={`Used AI or hints — shrinks repetition cycle to ${nextAssisted} day${nextAssisted === 1 ? '' : 's'}`}
                    >
                      Used AI / Hints (→ {nextAssisted}d)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Carryover / Missed From Previous Days */}
      {missedCarryoverItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Due From Previous Days
              </h2>
              <span className="text-xs font-mono tabular-nums text-amber-700 dark:text-amber-400 font-medium">
                {missedCarryoverItems.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Complete these along with today&apos;s tasks
            </span>
          </div>

          <div className="bg-white dark:bg-[#141923] border border-amber-200 dark:border-amber-500/30 rounded-2xl divide-y divide-amber-100 dark:divide-slate-800/80 overflow-hidden">
            {missedCarryoverItems.map(({ task, missedDate }) => {
              const savedSecs = secondsByTaskAndForDate.get(`${task.id}__${missedDate}`) || 0;
              const liveSecs =
                timer && !timer.revisionProblemId && timer.taskId === task.id && timer.forDate === missedDate
                  ? elapsedSeconds
                  : 0;
              const totalSecs = savedSecs + liveSecs;
              const targetSecs = task.targetMinutes * 60;
              const pct = Math.min(100, Math.round((totalSecs / targetSecs) * 100));
              const isRunningThis =
                timer !== null &&
                !timer.revisionProblemId &&
                timer.taskId === task.id &&
                timer.forDate === missedDate &&
                timer.isRunning;

              return (
                <div
                  key={`${task.id}-${missedDate}`}
                  className={`px-5 py-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isRunningThis
                      ? 'bg-amber-50/70 dark:bg-amber-950/20'
                      : 'hover:bg-amber-50/40 dark:hover:bg-slate-800/35'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onToggleCompleteDate(task.id, missedDate)}
                      className="mt-0.5 text-amber-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer shrink-0"
                      title={`Mark ${task.title} complete for ${formatReadableDate(missedDate)}`}
                      aria-label={`Mark ${task.title} complete for ${formatReadableDate(missedDate)}`}
                    >
                      <Circle className="w-5 h-5" />
                    </button>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {task.title}
                          </span>
                          {isRunningThis && (
                            <span className="text-xs font-mono text-amber-700 dark:text-amber-400 font-medium">
                              · Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {formatDueFromLabel(missedDate, todayKey)}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">{task.category}</span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            Target {formatMinutesCompact(task.targetMinutes)}
                          </span>
                        </div>
                      </div>

                      {totalSecs > 0 && (
                        <div className="flex items-center gap-3 max-w-sm">
                          <div className="flex-1 h-1.5 bg-amber-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                            {formatMinutesCompact(totalSecs / 60)} /{' '}
                            {formatMinutesCompact(task.targetMinutes)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-8 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClearRevisionFocus();
                        onSelectTask(task.id, missedDate);
                        if (!isRunningThis) onStartTimer(task.id, missedDate);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isRunningThis ? 'Running' : 'Focus'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenManualLog(task.id, missedDate)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      + Log
                    </button>

                    <button
                      type="button"
                      onClick={() => onSkipMissedDate(task.id, missedDate)}
                      className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Skip this missed day"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Daily Repeating Tasks (Today) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Today&apos;s Daily Learning
          </h2>
          <button
            type="button"
            onClick={onOpenNewTask}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add task</span>
          </button>
        </div>

        {dailyTasks.length === 0 ? (
          <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No daily repeating tasks yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add daily habits like &ldquo;NxtWave Daily Learning&rdquo; or &ldquo;Daily LeetCode Problem&rdquo;.
            </p>
            <button
              type="button"
              onClick={onOpenNewTask}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Daily Task</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
            {dailyTasks.map(renderTaskRow)}
          </div>
        )}
      </section>

      {/* One-Time Tasks */}
      {oneTimeTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            One-Time Tasks
          </h2>
          <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
            {oneTimeTasks.map(renderTaskRow)}
          </div>
        </section>
      )}

      {/* Today's Logged Sessions */}
      {todaySessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Logged Today
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {todaySessions.length} {todaySessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
            {todaySessions.map((session) => (
              <div
                key={session.id}
                className="px-5 py-3.5 flex items-center justify-between gap-4 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {session.taskTitle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                    <span>{session.category}</span>
                    {session.forDate && session.forDate !== session.date && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="text-amber-700 dark:text-amber-400">
                          Catch-up for {formatReadableDate(session.forDate)}
                        </span>
                      </>
                    )}
                    {session.note && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="truncate">{session.note}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs font-medium text-teal-700 dark:text-teal-400 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatSecondsHuman(session.durationSeconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
