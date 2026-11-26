import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  ActiveTimerState,
  CustomRepeatMode,
  LeetCodeDifficulty,
  LeetCodeProblem,
  ReminderSettings,
  RepeatType,
  StudySession,
  StudyTask,
  TimerMode,
  ViewTab,
} from './types/study';
import {
  addDaysToDateKey,
  allocateSessionSeconds,
  formatClock,
  formatDueFromLabel,
  formatReadableDate,
  formatSecondsHuman,
  generateId,
  getDateKey,
  getDaysDifference,
  getElapsedTimerSeconds,
  getNextRevisionInterval,
  isLeetCodeTask,
  isRecurringTask,
  isTaskScheduledOnDate,
  loadActiveTimer,
  loadLeetCodeProblems,
  loadReminderSettings,
  loadSessions,
  loadTasks,
  loadTheme,
  ONE_TIME_DEFAULT_COLOR,
  saveActiveTimer,
  saveLeetCodeProblems,
  saveReminderSettings,
  saveSessions,
  saveTasks,
  saveTheme,
} from './utils/storage';
import { playTargetCompleteChime, sendDesktopNotification } from './utils/sound';
import { TopNav } from './components/TopNav';
import { TaskModal } from './components/TaskModal';
import { ManualLogModal } from './components/ManualLogModal';
import { LeetCodeLogModal } from './components/LeetCodeLogModal';
import { ReminderSettingsModal } from './components/ReminderSettingsModal';
import { MiniTimerBar } from './components/MiniTimerBar';
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
  const [pendingLcPrompts, setPendingLcPrompts] = useState<
    { taskId: string; dateKey: string }[]
  >([]);

  // Reminders, sound chime & notification toast
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() =>
    loadReminderSettings()
  );
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [toastBanner, setToastBanner] = useState<{
    id: number;
    title: string;
    body?: string;
  } | null>(null);

  // Mini Focus Mode (Electron always-on-top compact window + Web floating mini bar)
  const isElectron = Boolean(typeof window !== 'undefined' && window.electronAPI?.isElectron);
  const [electronMiniActive, setElectronMiniActive] = useState(false);
  const [webFloatingMiniOpen, setWebFloatingMiniOpen] = useState(false);
  const [floatingDismissed, setFloatingDismissed] = useState(false);

  const chimedKeysRef = useRef<Set<string>>(new Set());
  const prevTotalSecondsRef = useRef<number>(0);

  const showToast = (title: string, body?: string) => {
    const id = Date.now();
    setToastBanner({ id, title, body });
    window.setTimeout(() => {
      setToastBanner((current) => (current?.id === id ? null : current));
    }, 6500);
  };

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

  useEffect(() => {
    saveReminderSettings(reminderSettings);
  }, [reminderSettings]);

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

  // Re-show floating bar when switching tabs with an active timer
  useEffect(() => {
    setFloatingDismissed(false);
  }, [activeTab]);

  // Target completion sound chime & desktop notification (fires once when crossing target)
  const loggedSecondsForActiveSelection = useMemo(() => {
    const activeId = timer?.taskId || selectedTaskId;
    const activeDate = timer?.forDate || selectedForDate || getDateKey();
    if (timer?.revisionProblemId || activeRevisionProblem) return 0;
    return sessions
      .filter(
        (s) =>
          !s.revisionProblemId && s.taskId === activeId && (s.forDate || s.date) === activeDate
      )
      .reduce((sum, s) => sum + s.durationSeconds, 0);
  }, [sessions, timer, selectedTaskId, selectedForDate, activeRevisionProblem]);

  useEffect(() => {
    if (!timer?.isRunning || timer.revisionProblemId) {
      prevTotalSecondsRef.current = 0;
      return;
    }

    const activeTask = tasks.find((t) => t.id === timer.taskId);
    if (!activeTask) return;

    const targetSeconds = activeTask.targetMinutes * 60;
    const currentTotal = loggedSecondsForActiveSelection + elapsedSeconds;
    const key = `${timer.taskId}__${timer.forDate}`;

    if (
      prevTotalSecondsRef.current > 0 &&
      prevTotalSecondsRef.current < targetSeconds &&
      currentTotal >= targetSeconds &&
      !chimedKeysRef.current.has(key)
    ) {
      chimedKeysRef.current.add(key);
      if (reminderSettings.soundEnabled) {
        playTargetCompleteChime();
      }
      const msg = `${activeTask.title} hit its ${activeTask.targetMinutes}m target — keep going for extra time or save whenever ready.`;
      if (reminderSettings.notificationsEnabled) {
        sendDesktopNotification('Target Reached · Daily Study', msg);
      }
      showToast(`Target reached · ${activeTask.title}`, 'Timer continues counting extra study time.');
    }

    prevTotalSecondsRef.current = currentTotal;
  }, [
    timer?.isRunning,
    timer?.taskId,
    timer?.forDate,
    timer?.revisionProblemId,
    elapsedSeconds,
    loggedSecondsForActiveSelection,
    tasks,
    reminderSettings.soundEnabled,
    reminderSettings.notificationsEnabled,
  ]);

  // Daily unfinished-task reminder clock check (runs every 30 seconds)
  useEffect(() => {
    if (!reminderSettings.dailyReminderEnabled) return;

    const checkDailyReminder = () => {
      const todayKey = getDateKey();
      if (reminderSettings.lastDailyReminderDate === todayKey) return;

      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      if (nowHHMM < reminderSettings.dailyReminderTime) return;

      const pendingDaily = tasks.filter(
        (t) =>
          isRecurringTask(t) &&
          isTaskScheduledOnDate(t, todayKey) &&
          !t.completedDates.includes(todayKey)
      ).length;
      const pendingRevisions = leetcodeProblems.filter(
        (p) => p.nextReviewDate <= todayKey
      ).length;

      if (pendingDaily === 0 && pendingRevisions === 0) return;

      const parts: string[] = [];
      if (pendingDaily > 0) {
        parts.push(`${pendingDaily} daily ${pendingDaily === 1 ? 'task' : 'tasks'}`);
      }
      if (pendingRevisions > 0) {
        parts.push(
          `${pendingRevisions} LeetCode ${pendingRevisions === 1 ? 'revision' : 'revisions'}`
        );
      }
      const body = `Still open today: ${parts.join(' and ')}.`;

      if (reminderSettings.soundEnabled) {
        playTargetCompleteChime();
      }
      if (reminderSettings.notificationsEnabled) {
        sendDesktopNotification('Daily Study Reminder', body);
      }
      showToast('Daily Study Reminder', body);

      setReminderSettings((prev) => ({
        ...prev,
        lastDailyReminderDate: todayKey,
      }));
    };

    checkDailyReminder();
    const id = window.setInterval(checkDailyReminder, 30000);
    return () => window.clearInterval(id);
  }, [
    reminderSettings.dailyReminderEnabled,
    reminderSettings.dailyReminderTime,
    reminderSettings.lastDailyReminderDate,
    reminderSettings.soundEnabled,
    reminderSettings.notificationsEnabled,
    tasks,
    leetcodeProblems,
  ]);

  const handleEnterMiniMode = async () => {
    if (isElectron && window.electronAPI) {
      const active = await window.electronAPI.setMiniMode(true);
      setElectronMiniActive(active);
    } else {
      setWebFloatingMiniOpen(true);
      setFloatingDismissed(false);
    }
  };

  const handleExitMiniMode = async () => {
    if (isElectron && window.electronAPI && electronMiniActive) {
      await window.electronAPI.setMiniMode(false);
      setElectronMiniActive(false);
    }
    setWebFloatingMiniOpen(false);
    setActiveTab('today');
  };

  const markTaskDatesComplete = (taskId: string, dateKeys: string[]) => {
    if (dateKeys.length === 0) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const completedSet = new Set(t.completedDates);
        for (const key of dateKeys) completedSet.add(key);
        const dateKeySet = new Set(dateKeys);
        return {
          ...t,
          completedDates: Array.from(completedSet),
          skippedDates: (t.skippedDates || []).filter((d) => !dateKeySet.has(d)),
        };
      })
    );
  };

  const markTaskDateComplete = (taskId: string, dateKey: string) => {
    markTaskDatesComplete(taskId, [dateKey]);
  };

  const enqueueLeetCodePrompts = (prompts: { taskId: string; dateKey: string }[]) => {
    if (prompts.length === 0) return;
    if (!lcModalOpen) {
      const [first, ...rest] = prompts;
      setLcModalTaskId(first.taskId);
      setLcModalDateKey(first.dateKey);
      setLcModalOpen(true);
      if (rest.length > 0) {
        setPendingLcPrompts((prev) => [...prev, ...rest]);
      }
    } else {
      setPendingLcPrompts((prev) => [...prev, ...prompts]);
    }
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

    // Revision sessions always log directly without affecting daily/carryover allocations
    if (revProblem) {
      const newSession: StudySession = {
        id: generateId(),
        taskId: task.id,
        taskTitle: `Revise LC #${revProblem.problemNumber}${revProblem.title ? ` · ${revProblem.title}` : ''}`,
        category: 'LeetCode Revision',
        date: studyDateKey,
        revisionProblemId: revProblem.id,
        durationSeconds,
        note: note || undefined,
        loggedAt: new Date().toISOString(),
      };
      setSessions((prev) => [newSession, ...prev]);
      return;
    }

    // Waterfall allocation: fill primary day up to target -> spill extra into remaining due days -> leftover back to primary
    const allocations = allocateSessionSeconds(
      task,
      durationSeconds,
      studyDateKey,
      forDateKey,
      sessions
    );

    if (allocations.length === 0) return;

    const nowIso = new Date().toISOString();
    const createdSessions: StudySession[] = allocations.map((alloc) => ({
      id: generateId(),
      taskId: task.id,
      taskTitle: task.title,
      category: task.category,
      date: studyDateKey,
      forDate: alloc.forDate !== studyDateKey ? alloc.forDate : undefined,
      durationSeconds: alloc.seconds,
      note: note || undefined,
      loggedAt: nowIso,
    }));

    setSessions((prev) => [...createdSessions, ...prev]);

    const datesCompletedNow = allocations
      .filter((a) => a.completesDate)
      .map((a) => a.forDate);

    if (datesCompletedNow.length > 0) {
      if (isLeetCodeTask(task)) {
        enqueueLeetCodePrompts(
          datesCompletedNow.map((dateKey) => ({ taskId: task.id, dateKey }))
        );
      } else {
        markTaskDatesComplete(task.id, datesCompletedNow);
      }
    }

    // Friendly confirmation when extra time automatically flowed into missed due days
    const overflowAllocs = allocations.filter((a) => a.isOverflow);
    if (overflowAllocs.length > 0) {
      const totalOverflowSeconds = overflowAllocs.reduce((sum, a) => sum + a.seconds, 0);
      const clearedCount = overflowAllocs.filter((a) => a.completesDate).length;
      const primaryAlloc = allocations.find((a) => !a.isOverflow);

      const dueSummary =
        overflowAllocs.length === 1
          ? formatDueFromLabel(overflowAllocs[0].forDate, studyDateKey)
          : `${overflowAllocs.length} due days`;

      const title =
        clearedCount > 0
          ? `Cleared ${clearedCount === 1 && overflowAllocs.length === 1 ? dueSummary : `${clearedCount} due ${clearedCount === 1 ? 'day' : 'days'}`}`
          : `Extra time applied to ${dueSummary}`;

      const parts = [
        `${formatSecondsHuman(totalOverflowSeconds)} allocated to ${dueSummary}`,
      ];
      if (primaryAlloc && primaryAlloc.seconds > 0) {
        parts.push(
          `${formatSecondsHuman(primaryAlloc.seconds)} on ${formatReadableDate(primaryAlloc.forDate)}`
        );
      }

      showToast(title, parts.join(' · '));
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

  const collectSkippedBreakDays = (
    existingSkipped: string[],
    pausedSince: string | undefined,
    todayKey: string
  ): string[] => {
    if (!pausedSince || pausedSince >= todayKey) return existingSkipped;
    const set = new Set(existingSkipped);
    const totalDays = Math.min(90, getDaysDifference(pausedSince, todayKey));
    for (let i = 0; i < totalDays; i += 1) {
      set.add(addDaysToDateKey(pausedSince, i));
    }
    return Array.from(set);
  };

  // Task CRUD
  const handleSaveTask = (data: {
    title: string;
    category: string;
    repeat: RepeatType;
    customRepeatMode?: CustomRepeatMode;
    intervalDays?: number;
    daysOfWeek?: number[];
    paused: boolean;
    color: string;
    targetMinutes: number;
    carryOverMissed: boolean;
    startDate: string;
  }) => {
    const todayKey = getDateKey();
    const isHabit = data.repeat === 'daily' || data.repeat === 'custom';
    const resolvedColor = isHabit ? data.color : ONE_TIME_DEFAULT_COLOR;

    if (editingTask) {
      const wasPaused = Boolean(editingTask.paused);
      const nextPaused = isHabit ? data.paused : false;
      const nextSkipped =
        wasPaused && !nextPaused
          ? collectSkippedBreakDays(editingTask.skippedDates || [], editingTask.pausedSince, todayKey)
          : editingTask.skippedDates || [];

      if (!wasPaused && nextPaused && timer?.taskId === editingTask.id && !timer.revisionProblemId) {
        setTimer(null);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: data.title,
                category: data.category,
                repeat: data.repeat,
                customRepeatMode: data.repeat === 'custom' ? data.customRepeatMode : undefined,
                intervalDays: data.repeat === 'custom' ? data.intervalDays : undefined,
                daysOfWeek: data.repeat === 'custom' ? data.daysOfWeek : undefined,
                paused: nextPaused,
                pausedSince: nextPaused ? editingTask.pausedSince || todayKey : undefined,
                skippedDates: nextSkipped,
                color: resolvedColor,
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
        customRepeatMode: data.repeat === 'custom' ? data.customRepeatMode : undefined,
        intervalDays: data.repeat === 'custom' ? data.intervalDays : undefined,
        daysOfWeek: data.repeat === 'custom' ? data.daysOfWeek : undefined,
        paused: false,
        color: resolvedColor,
        targetMinutes: data.targetMinutes,
        startDate: data.startDate || todayKey,
        carryOverMissed: data.carryOverMissed,
        completedDates: [],
        skippedDates: [],
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
      if (!timer?.isRunning) {
        setSelectedRevisionProblemId(null);
        setSelectedTaskId(newTask.id);
        setSelectedForDate(todayKey);
      }
    }
  };

  const handleTogglePauseTask = (taskId: string) => {
    const todayKey = getDateKey();
    const target = tasks.find((t) => t.id === taskId);
    if (!target || !isRecurringTask(target)) return;

    const nextPaused = !target.paused;
    if (nextPaused && timer?.taskId === taskId && !timer.revisionProblemId) {
      setTimer(null);
    }

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (nextPaused) {
          return {
            ...t,
            paused: true,
            pausedSince: todayKey,
          };
        }
        return {
          ...t,
          paused: false,
          pausedSince: undefined,
          skippedDates: collectSkippedBreakDays(t.skippedDates || [], t.pausedSince, todayKey),
        };
      })
    );

    showToast(
      nextPaused ? `Paused · ${target.title}` : `Resumed · ${target.title}`,
      nextPaused
        ? 'Taking a break — no missed days will build up while paused.'
        : 'Back on schedule from today.'
    );
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

  const activeMiniTask =
    tasks.find((t) => t.id === (timer?.taskId || selectedTaskId)) || tasks[0] || null;
  const activeMiniRevision =
    (timer?.revisionProblemId
      ? leetcodeProblems.find((p) => p.id === timer.revisionProblemId)
      : activeRevisionProblem) || null;

  const handleMiniStart = () => {
    if (!activeMiniTask) return;
    handleStartTimer(
      activeMiniTask.id,
      selectedForDate || getDateKey(),
      activeMiniRevision?.id
    );
  };

  const handleMiniQuickFinish = () => {
    if (!timer) return;
    // If finishing a revision, expand to full window so user can pick Solo vs Used AI
    if (timer.revisionProblemId) {
      handleExitMiniMode();
      handlePauseTimer();
      showToast('Revision paused', 'Record Solved Solo or Used AI / Hints in the timer card.');
      return;
    }
    handleFinishTimer('');
  };

  if (electronMiniActive) {
    return (
      <MiniTimerBar
        variant="window"
        task={activeMiniTask}
        revisionProblem={activeMiniRevision}
        timer={timer}
        elapsedSeconds={elapsedSeconds}
        loggedSecondsForSelection={loggedSecondsForActiveSelection}
        timerMode={timerMode}
        onStart={handleMiniStart}
        onPause={handlePauseTimer}
        onResume={handleResumeTimer}
        onFinishQuick={handleMiniQuickFinish}
        onExpand={handleExitMiniMode}
      />
    );
  }

  const showFloatingMini =
    webFloatingMiniOpen ||
    (Boolean(timer) && activeTab !== 'today' && !floatingDismissed);

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0D1117] text-slate-900 dark:text-slate-100 transition-colors">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewTask={() => {
          setEditingTask(null);
          setTaskModalOpen(true);
        }}
        onOpenReminders={() => setReminderModalOpen(true)}
        hasRemindersActive={
          reminderSettings.dailyReminderEnabled || reminderSettings.notificationsEnabled
        }
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        isTimerRunning={Boolean(timer?.isRunning)}
        timerSeconds={elapsedSeconds}
        dueRevisionsCount={dueRevisionsCount}
      />

      <main className="pb-20">
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
            onTogglePauseTask={handleTogglePauseTask}
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
            onEnterMiniMode={handleEnterMiniMode}
            isElectron={isElectron}
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
            leetcodeProblems={leetcodeProblems}
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

      {/* Floating Compact Mini Focus Timer (Web mode or active timer on non-Today tabs) */}
      {showFloatingMini && (
        <MiniTimerBar
          variant="floating"
          task={activeMiniTask}
          revisionProblem={activeMiniRevision}
          timer={timer}
          elapsedSeconds={elapsedSeconds}
          loggedSecondsForSelection={loggedSecondsForActiveSelection}
          timerMode={timerMode}
          onStart={handleMiniStart}
          onPause={handlePauseTimer}
          onResume={handleResumeTimer}
          onFinishQuick={handleMiniQuickFinish}
          onExpand={handleExitMiniMode}
          onCloseFloating={() => {
            setWebFloatingMiniOpen(false);
            setFloatingDismissed(true);
          }}
        />
      )}

      {/* Calm In-App Notification Toast */}
      {toastBanner && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-50 max-w-sm bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl shadow-xl px-4 py-3 flex items-start gap-3 border border-slate-800 dark:border-slate-200"
        >
          <Bell className="w-4 h-4 text-teal-400 dark:text-teal-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-xs font-semibold">{toastBanner.title}</div>
            {toastBanner.body && (
              <div className="text-xs text-slate-300 dark:text-slate-600">{toastBanner.body}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="p-0.5 text-slate-400 hover:text-white dark:hover:text-slate-900 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <TaskModal
        isOpen={taskModalOpen}
        editingTask={editingTask}
        existingTasks={tasks}
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
          if (pendingLcPrompts.length > 0) {
            const [next, ...rest] = pendingLcPrompts;
            setPendingLcPrompts(rest);
            setLcModalTaskId(next.taskId);
            setLcModalDateKey(next.dateKey);
            setLcModalOpen(true);
          } else {
            setLcModalOpen(false);
            setLcModalTaskId(null);
          }
        }}
        onSubmit={handleSaveLeetCodeProblem}
      />

      <ReminderSettingsModal
        isOpen={reminderModalOpen}
        settings={reminderSettings}
        onUpdate={setReminderSettings}
        onClose={() => setReminderModalOpen(false)}
        onTriggerTestToast={(msg) => showToast('Reminder Alert', msg)}
      />
    </div>
  );
}
