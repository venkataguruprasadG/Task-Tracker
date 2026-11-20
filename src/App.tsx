import { useEffect, useMemo, useState } from 'react';
import {
  ActiveTimerState,
  LeetCodeDifficulty,
  LeetCodeProblem,
  RepeatType,
  StudySession,
  StudyTask,
  TimerMode,
  ViewTab,
} from './types/study';
import {
  addDaysToDateKey,
  formatClock,
  formatReadableDate,
  generateId,
  getDateKey,
  getElapsedTimerSeconds,
  getNextRevisionInterval,
  isLeetCodeTask,
  loadActiveTimer,
  loadLeetCodeProblems,
  loadSessions,
  loadTasks,
  loadTheme,
  saveActiveTimer,
  saveLeetCodeProblems,
  saveSessions,
  saveTasks,
  saveTheme,
} from './utils/storage';
import { TopNav } from './components/TopNav';
import { TaskModal } from './components/TaskModal';
import { ManualLogModal } from './components/ManualLogModal';
import { LeetCodeLogModal } from './components/LeetCodeLogModal';
import { TodayView } from './views/TodayView';
import { RevisionsView } from './views/RevisionsView';
import { AnalyticsView } from './views/AnalyticsView';
import { HistoryView } from './views/HistoryView';

export default function App() {
  const [tasks, setTasks] = useState<StudyTask[]>(() => loadTasks());
  const [sessions, setSessions] = useState<StudySession[]>(() => loadSessions());
  const [leetcodeProblems, setLeetcodeProblems] = useState<LeetCodeProblem[]>(() =>
    loadLeetCodeProblems()
  );
  const [timer, setTimer] = useState<ActiveTimerState | null>(() => loadActiveTimer());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [timerMode, setTimerMode] = useState<TimerMode>('stopwatch');
  const [activeTab, setActiveTab] = useState<ViewTab>('today');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());

  const [selectedTaskId, setSelectedTaskId] = useState<string>(() => {
    const savedTimer = loadActiveTimer();
    if (savedTimer?.taskId) return savedTimer.taskId;
    const initialTasks = loadTasks();
    return initialTasks[0]?.id || '';
  });

  const [selectedForDate, setSelectedForDate] = useState<string>(() => {
    const savedTimer = loadActiveTimer();
    return savedTimer?.forDate || getDateKey();
  });

  const [selectedRevisionProblemId, setSelectedRevisionProblemId] = useState<string | null>(() => {
    const savedTimer = loadActiveTimer();
    return savedTimer?.revisionProblemId || null;
  });

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);

  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [manualLogTaskId, setManualLogTaskId] = useState('');
  const [manualLogForDate, setManualLogForDate] = useState<string | undefined>(undefined);

  // LeetCode Problem Number prompt (opens when completing a LeetCode task or clicking Add Problem #)
  const [lcModalOpen, setLcModalOpen] = useState(false);
  const [lcModalTaskId, setLcModalTaskId] = useState<string | null>(null);
  const [lcModalDateKey, setLcModalDateKey] = useState<string>(getDateKey());

  // Apply light / dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  // Persist data
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveLeetCodeProblems(leetcodeProblems);
  }, [leetcodeProblems]);

  useEffect(() => {
    saveActiveTimer(timer);
  }, [timer]);

  // Keep selectedTaskId valid
  useEffect(() => {
    if (!tasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0]?.id || '');
      setSelectedForDate(getDateKey());
    }
  }, [tasks, selectedTaskId]);

  // Live 1-second timestamp tick while timer is running
  useEffect(() => {
    if (!timer?.isRunning) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timer?.isRunning]);

  const elapsedSeconds = getElapsedTimerSeconds(timer, nowMs);

  const activeRevisionProblem = useMemo(
    () => leetcodeProblems.find((p) => p.id === selectedRevisionProblemId) || null,
    [leetcodeProblems, selectedRevisionProblemId]
  );

  const dueRevisionsCount = useMemo(() => {
    const today = getDateKey();
    return leetcodeProblems.filter((p) => p.nextReviewDate <= today).length;
  }, [leetcodeProblems]);

  // Sync browser tab title while timer runs
  useEffect(() => {
    if (timer?.isRunning) {
      if (timer.revisionProblemId) {
        const revProb = leetcodeProblems.find((p) => p.id === timer.revisionProblemId);
        document.title = `${formatClock(elapsedSeconds)} · Revise LC #${revProb?.problemNumber || ''}`;
      } else {
        const activeTask = tasks.find((t) => t.id === timer.taskId);
        document.title = `${formatClock(elapsedSeconds)} · ${activeTask?.title || 'Daily Study'}`;
      }
    } else {
      document.title = 'Daily Study — Academic Task Tracker';
    }
  }, [timer?.isRunning, timer?.taskId, timer?.revisionProblemId, elapsedSeconds, tasks, leetcodeProblems]);

  const markTaskDateComplete = (taskId: string, dateKey: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (t.completedDates.includes(dateKey)) return t;
        return {
          ...t,
          completedDates: [...t.completedDates, dateKey],
          skippedDates: (t.skippedDates || []).filter((d) => d !== dateKey),
        };
      })
    );
  };

  const handleReviewProblem = (problemId: string, solvedSolo: boolean, note?: string) => {
    const todayKey = getDateKey();
    setLeetcodeProblems((prev) =>
      prev.map((p) => {
        if (p.id !== problemId) return p;
        const nextInterval = getNextRevisionInterval(p.intervalDays, solvedSolo);
        const nextDate = addDaysToDateKey(todayKey, nextInterval);
        return {
          ...p,
          intervalDays: nextInterval,
          nextReviewDate: nextDate,
          soloStreak: solvedSolo ? p.soloStreak + 1 : 0,
          reviewHistory: [
            ...p.reviewHistory,
            {
              date: todayKey,
              solvedSolo,
              previousIntervalDays: p.intervalDays,
              nextIntervalDays: nextInterval,
              note: note || undefined,
            },
          ],
        };
      })
    );

    if (selectedRevisionProblemId === problemId) {
      setSelectedRevisionProblemId(null);
    }
  };

  const recordSession = (
    taskId: string,
    durationSeconds: number,
    studyDateKey: string,
    forDateKey: string,
    note?: string,
    revisionProblemId?: string
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || durationSeconds <= 0) return;

    const revProblem = revisionProblemId
      ? leetcodeProblems.find((p) => p.id === revisionProblemId)
      : null;

    const newSession: StudySession = {
      id: generateId(),
      taskId: task.id,
      taskTitle: revProblem
        ? `Revise LC #${revProblem.problemNumber}${revProblem.title ? ` · ${revProblem.title}` : ''}`
        : task.title,
      category: revProblem ? 'LeetCode Revision' : task.category,
      date: studyDateKey,
      forDate: !revProblem && forDateKey !== studyDateKey ? forDateKey : undefined,
      revisionProblemId: revProblem?.id,
      durationSeconds,
      note: note || undefined,
      loggedAt: new Date().toISOString(),
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);

    // For normal / carryover daily tasks (not revisions), auto-complete once target is met
    if (!revProblem) {
      const totalSecondsForObligation = updatedSessions
        .filter(
          (s) => !s.revisionProblemId && s.taskId === task.id && (s.forDate || s.date) === forDateKey
        )
        .reduce((sum, s) => sum + s.durationSeconds, 0);

      if (
        totalSecondsForObligation >= task.targetMinutes * 60 &&
        !task.completedDates.includes(forDateKey)
      ) {
        if (isLeetCodeTask(task)) {
          // Prompt for LeetCode problem # so it enters the 3-day spaced repetition queue
          setLcModalTaskId(task.id);
          setLcModalDateKey(forDateKey);
          setLcModalOpen(true);
        } else {
          markTaskDateComplete(task.id, forDateKey);
        }
      }
    }
  };

  const handleSelectTask = (taskId: string, forDate?: string) => {
    setSelectedRevisionProblemId(null);
    setSelectedTaskId(taskId);
    setSelectedForDate(forDate || getDateKey());
  };

  const handleSelectRevisionProblem = (problem: LeetCodeProblem) => {
    const lcTask = tasks.find((t) => isLeetCodeTask(t)) || tasks[0];
    if (!lcTask) return;
    setSelectedRevisionProblemId(problem.id);
    setSelectedTaskId(lcTask.id);
    setSelectedForDate(getDateKey());
    setActiveTab('today');
    handleStartTimer(lcTask.id, getDateKey(), problem.id);
  };

  const handleStartTimer = (taskId: string, forDate: string, revisionProblemId?: string) => {
    setSelectedTaskId(taskId);
    setSelectedForDate(forDate);
    setSelectedRevisionProblemId(revisionProblemId || null);
    const now = Date.now();

    if (
      timer &&
      (timer.taskId !== taskId ||
        timer.forDate !== forDate ||
        (timer.revisionProblemId || undefined) !== (revisionProblemId || undefined))
    ) {
      const prevElapsed = getElapsedTimerSeconds(timer, now);
      if (prevElapsed >= 10) {
        recordSession(
          timer.taskId,
          prevElapsed,
          getDateKey(),
          timer.forDate,
          undefined,
          timer.revisionProblemId
        );
      }
    }

    const isSameSelection =
      timer &&
      timer.taskId === taskId &&
      timer.forDate === forDate &&
      (timer.revisionProblemId || undefined) === (revisionProblemId || undefined);

    setTimer({
      taskId,
      forDate,
      revisionProblemId,
      mode: timerMode,
      isRunning: true,
      accumulatedSeconds: isSameSelection ? getElapsedTimerSeconds(timer, now) : 0,
      startedAt: now,
    });
    setNowMs(now);
  };

  const handlePauseTimer = () => {
    if (!timer || !timer.isRunning) return;
    const now = Date.now();
    const total = getElapsedTimerSeconds(timer, now);
    setTimer({
      ...timer,
      isRunning: false,
      accumulatedSeconds: total,
      startedAt: null,
    });
    setNowMs(now);
  };

  const handleResumeTimer = () => {
    if (!timer || timer.isRunning) return;
    const now = Date.now();
    setTimer({
      ...timer,
      isRunning: true,
      startedAt: now,
    });
    setNowMs(now);
  };

  const handleResetTimer = () => {
    setTimer(null);
  };

  const handleFinishTimer = (note: string, revisionOutcome?: 'solo' | 'assisted') => {
    if (!timer) return;
    const finalSeconds = getElapsedTimerSeconds(timer, Date.now());
    const finishedForDate = timer.forDate;
    const finishedRevisionId = timer.revisionProblemId;
    const todayKey = getDateKey();

    if (finalSeconds > 0) {
      recordSession(
        timer.taskId,
        finalSeconds,
        todayKey,
        finishedForDate,
        note,
        finishedRevisionId
      );
    }

    if (finishedRevisionId && revisionOutcome) {
      handleReviewProblem(finishedRevisionId, revisionOutcome === 'solo', note);
    }

    setTimer(null);
    if (finishedForDate !== todayKey) {
      setSelectedForDate(todayKey);
    }
  };

  // Task CRUD
  const handleSaveTask = (data: {
    title: string;
    category: string;
    repeat: RepeatType;
    targetMinutes: number;
    carryOverMissed: boolean;
    startDate: string;
  }) => {
    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: data.title,
                category: data.category,
                repeat: data.repeat,
                targetMinutes: data.targetMinutes,
                carryOverMissed: data.carryOverMissed,
                startDate: data.startDate,
              }
            : t
        )
      );
      setEditingTask(null);
    } else {
      const newTask: StudyTask = {
        id: generateId(),
        title: data.title,
        category: data.category,
        repeat: data.repeat,
        targetMinutes: data.targetMinutes,
        startDate: data.startDate || getDateKey(),
        carryOverMissed: data.carryOverMissed,
        completedDates: [],
        skippedDates: [],
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
      if (!timer?.isRunning) {
        setSelectedRevisionProblemId(null);
        setSelectedTaskId(newTask.id);
        setSelectedForDate(getDateKey());
      }
    }
  };

  // Clicking checkbox on a task (intercepts LeetCode tasks when checking complete to ask for problem #)
  const handleToggleCompleteDate = (taskId: string, dateKey: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const alreadyCompleted = task.completedDates.includes(dateKey);
    if (!alreadyCompleted && isLeetCodeTask(task)) {
      setLcModalTaskId(task.id);
      setLcModalDateKey(dateKey);
      setLcModalOpen(true);
      return;
    }

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const exists = t.completedDates.includes(dateKey);
        return {
          ...t,
          completedDates: exists
            ? t.completedDates.filter((d) => d !== dateKey)
            : [...t.completedDates, dateKey],
          skippedDates: (t.skippedDates || []).filter((d) => d !== dateKey),
        };
      })
    );

    if (selectedTaskId === taskId && selectedForDate === dateKey && dateKey !== getDateKey()) {
      setSelectedForDate(getDateKey());
    }
  };

  // Save submitted LeetCode problem number + schedule 3-day revision + mark task date complete
  const handleSaveLeetCodeProblem = (data: {
    problemNumber: string;
    title: string;
    difficulty: LeetCodeDifficulty;
    note: string;
    solvedDate: string;
  }) => {
    const firstReviewDate = addDaysToDateKey(data.solvedDate, 3);

    setLeetcodeProblems((prev) => {
      // If same problem number already exists, update its metadata & reset next review if earlier
      const existing = prev.find(
        (p) => p.problemNumber.toLowerCase() === data.problemNumber.toLowerCase()
      );
      if (existing) {
        return prev.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                title: data.title || p.title,
                difficulty: data.difficulty,
                note: data.note || p.note,
                solvedDate: data.solvedDate,
                intervalDays: 3,
                nextReviewDate: firstReviewDate,
              }
            : p
        );
      }

      const newProblem: LeetCodeProblem = {
        id: generateId(),
        problemNumber: data.problemNumber,
        title: data.title || undefined,
        difficulty: data.difficulty,
        solvedDate: data.solvedDate,
        intervalDays: 3,
        nextReviewDate: firstReviewDate,
        soloStreak: 0,
        reviewHistory: [],
        note: data.note || undefined,
        createdAt: new Date().toISOString(),
      };
      return [newProblem, ...prev];
    });

    if (lcModalTaskId) {
      markTaskDateComplete(lcModalTaskId, lcModalDateKey);
      if (
        selectedTaskId === lcModalTaskId &&
        selectedForDate === lcModalDateKey &&
        lcModalDateKey !== getDateKey()
      ) {
        setSelectedForDate(getDateKey());
      }
    }
  };

  const handleDeleteLeetCodeProblem = (problemId: string) => {
    if (timer?.revisionProblemId === problemId) {
      setTimer(null);
    }
    if (selectedRevisionProblemId === problemId) {
      setSelectedRevisionProblemId(null);
    }
    setLeetcodeProblems((prev) => prev.filter((p) => p.id !== problemId));
  };

  const handleSkipMissedDate = (taskId: string, dateKey: string) => {
    if (timer?.taskId === taskId && timer?.forDate === dateKey && !timer.revisionProblemId) {
      setTimer(null);
    }
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const skipped = t.skippedDates || [];
        if (skipped.includes(dateKey)) return t;
        return { ...t, skippedDates: [...skipped, dateKey] };
      })
    );
    if (selectedTaskId === taskId && selectedForDate === dateKey) {
      setSelectedForDate(getDateKey());
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (timer?.taskId === taskId) {
      setTimer(null);
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleManualLog = (data: {
    taskId: string;
    minutes: number;
    date: string;
    forDate: string;
    note: string;
  }) => {
    recordSession(data.taskId, data.minutes * 60, data.date, data.forDate, data.note);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleExportBackup = () => {
    const payload = JSON.stringify(
      { version: 3, tasks, sessions, leetcodeProblems },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-study-backup-${getDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonText: string): boolean => {
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed.tasks) && Array.isArray(parsed.sessions)) {
        setTasks(parsed.tasks);
        setSessions(parsed.sessions);
        if (Array.isArray(parsed.leetcodeProblems)) {
          setLeetcodeProblems(parsed.leetcodeProblems);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const lcModalContextLabel = lcModalTaskId
    ? `Completing Daily LeetCode Problem (${formatReadableDate(lcModalDateKey)})`
    : 'Add a solved problem directly to your spaced repetition queue';

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 transition-colors">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewTask={() => {
          setEditingTask(null);
          setTaskModalOpen(true);
        }}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        isTimerRunning={Boolean(timer?.isRunning)}
        timerSeconds={elapsedSeconds}
        dueRevisionsCount={dueRevisionsCount}
      />

      <main className="pb-16">
        {activeTab === 'today' && (
          <TodayView
            tasks={tasks}
            sessions={sessions}
            leetcodeProblems={leetcodeProblems}
            selectedTaskId={selectedTaskId}
            selectedForDate={selectedForDate}
            activeRevisionProblem={activeRevisionProblem}
            onSelectTask={handleSelectTask}
            onSelectRevisionProblem={handleSelectRevisionProblem}
            onClearRevisionFocus={() => setSelectedRevisionProblemId(null)}
            timer={timer}
            elapsedSeconds={elapsedSeconds}
            timerMode={timerMode}
            onChangeMode={setTimerMode}
            onStartTimer={handleStartTimer}
            onPauseTimer={handlePauseTimer}
            onResumeTimer={handleResumeTimer}
            onResetTimer={handleResetTimer}
            onFinishTimer={handleFinishTimer}
            onToggleCompleteDate={handleToggleCompleteDate}
            onSkipMissedDate={handleSkipMissedDate}
            onReviewProblem={handleReviewProblem}
            onOpenNewTask={() => {
              setEditingTask(null);
              setTaskModalOpen(true);
            }}
            onOpenEditTask={(task) => {
              setEditingTask(task);
              setTaskModalOpen(true);
            }}
            onDeleteTask={handleDeleteTask}
            onOpenManualLog={(taskId, forDate) => {
              setManualLogTaskId(taskId);
              setManualLogForDate(forDate);
              setManualLogOpen(true);
            }}
          />
        )}

        {activeTab === 'revisions' && (
          <RevisionsView
            problems={leetcodeProblems}
            onOpenAddProblem={() => {
              setLcModalTaskId(null);
              setLcModalDateKey(getDateKey());
              setLcModalOpen(true);
            }}
            onStartRevisionFocus={handleSelectRevisionProblem}
            onReviewProblem={handleReviewProblem}
            onDeleteProblem={handleDeleteLeetCodeProblem}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            tasks={tasks}
            sessions={sessions}
            theme={theme}
            onOpenManualLog={(taskId) => {
              setManualLogTaskId(taskId);
              setManualLogForDate(undefined);
              setManualLogOpen(true);
            }}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            tasks={tasks}
            sessions={sessions}
            onDeleteSession={handleDeleteSession}
            onOpenManualLog={(taskId) => {
              setManualLogTaskId(taskId);
              setManualLogForDate(undefined);
              setManualLogOpen(true);
            }}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        )}
      </main>

      <TaskModal
        isOpen={taskModalOpen}
        editingTask={editingTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      <ManualLogModal
        isOpen={manualLogOpen}
        tasks={tasks}
        defaultTaskId={manualLogTaskId || selectedTaskId}
        defaultForDate={manualLogForDate}
        onClose={() => {
          setManualLogOpen(false);
          setManualLogForDate(undefined);
        }}
        onLog={handleManualLog}
      />

      <LeetCodeLogModal
        isOpen={lcModalOpen}
        contextLabel={lcModalContextLabel}
        solvedDateKey={lcModalDateKey}
        onClose={() => {
          setLcModalOpen(false);
          setLcModalTaskId(null);
        }}
        onSubmit={handleSaveLeetCodeProblem}
      />
    </div>
  );
}
