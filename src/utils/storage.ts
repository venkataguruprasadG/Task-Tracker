import { ActiveTimerState, LeetCodeProblem, StudySession, StudyTask } from '../types/study';

const TASKS_KEY = 'daily_study_tasks_v1';
const SESSIONS_KEY = 'daily_study_sessions_v1';
const TIMER_KEY = 'daily_study_active_timer_v1';
const THEME_KEY = 'daily_study_theme_v1';
const LEETCODE_PROBLEMS_KEY = 'daily_study_leetcode_problems_v1';
const LEETCODE_MIGRATION_KEY = 'daily_study_migrated_leetcode_v1';
const CPP_DSA_MIGRATION_KEY = 'daily_study_migrated_cpp_dsa_v1';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateKey(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return getDateKey(d);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

export function getDaysDifference(fromDateKey: string, toDateKey: string): number {
  const [y1, m1, d1] = fromDateKey.split('-').map(Number);
  const [y2, m2, d2] = toDateKey.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

export function formatReadableDate(dateKey: string): string {
  const today = getDateKey();
  const yesterday = getOffsetDateKey(-1);
  const tomorrow = getOffsetDateKey(1);
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  if (dateKey === tomorrow) return 'Tomorrow';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDueFromLabel(missedDateKey: string, todayKey: string = getDateKey()): string {
  const diff = getDaysDifference(missedDateKey, todayKey);
  if (diff === 1) return 'Due from Yesterday';
  if (diff > 1) return `Due from ${diff} days ago · ${formatMonthDay(missedDateKey)}`;
  return `Due ${formatMonthDay(missedDateKey)}`;
}

export function formatShortDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function formatMonthDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatMinutesCompact(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  if (rounded <= 0) return '0m';
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function formatSecondsHuman(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return totalSeconds === 0 ? '0m' : `${Math.round(totalSeconds)}s`;
  }
  return formatMinutesCompact(totalSeconds / 60);
}

export function getElapsedTimerSeconds(timer: ActiveTimerState | null, nowMs: number = Date.now()): number {
  if (!timer) return 0;
  if (!timer.isRunning || timer.startedAt === null) {
    return timer.accumulatedSeconds;
  }
  const delta = Math.max(0, Math.floor((nowMs - timer.startedAt) / 1000));
  return timer.accumulatedSeconds + delta;
}

export function isLeetCodeTask(task: StudyTask | null | undefined): boolean {
  if (!task) return false;
  return (
    task.id === 'task-leetcode-daily' ||
    task.category.toLowerCase().includes('leetcode') ||
    task.title.toLowerCase().includes('leetcode')
  );
}

/**
 * Adaptive spaced repetition cycle for LeetCode problems:
 * Starts at 3 days.
 * - Solved completely on your own (no AI): expands cycle (1 -> 2 -> 3 -> 7 -> 14 -> 30 -> 60 days)
 * - Needed AI / hints: shrinks cycle (60 -> 14, 30 -> 7, 14 -> 3, 7 -> 2, 3 -> 1, 2 -> 1, 1 -> 1 day)
 */
const INTERVAL_LADDER = [1, 2, 3, 7, 14, 30, 60];

export function getNextRevisionInterval(currentIntervalDays: number, solvedSolo: boolean): number {
  let idx = INTERVAL_LADDER.findIndex((d) => d >= currentIntervalDays);
  if (idx === -1) idx = INTERVAL_LADDER.length - 1;

  if (solvedSolo) {
    const nextIdx = Math.min(INTERVAL_LADDER.length - 1, idx + 1);
    return INTERVAL_LADDER[nextIdx];
  } else {
    // Shrink repetition cycle when AI or hints were needed
    if (currentIntervalDays >= 30) return 7;
    if (currentIntervalDays >= 14) return 3;
    if (currentIntervalDays >= 7) return 2;
    return 1;
  }
}

export function getMissedDatesForTask(
  task: StudyTask,
  todayKey: string = getDateKey(),
  maxLookbackDays: number = 14
): string[] {
  if (task.repeat !== 'daily' || task.archived || task.carryOverMissed === false) {
    return [];
  }

  const startKey = task.startDate || task.createdAt.slice(0, 10) || todayKey;
  if (startKey >= todayKey) return [];

  const completedSet = new Set(task.completedDates || []);
  const skippedSet = new Set(task.skippedDates || []);
  const missed: string[] = [];

  for (let offset = 1; offset <= maxLookbackDays; offset += 1) {
    const checkKey = getOffsetDateKey(-offset);
    if (checkKey < startKey) break;
    if (!completedSet.has(checkKey) && !skippedSet.has(checkKey)) {
      missed.push(checkKey);
    }
  }

  return missed;
}

export function calculateStreak(activeDates: Set<string>): { current: number; best: number } {
  if (activeDates.size === 0) return { current: 0, best: 0 };

  const today = getDateKey();
  const yesterday = getOffsetDateKey(-1);
  let current = 0;

  if (activeDates.has(today) || activeDates.has(yesterday)) {
    let offset = activeDates.has(today) ? 0 : -1;
    while (activeDates.has(getOffsetDateKey(offset))) {
      current += 1;
      offset -= 1;
    }
  }

  const sorted = Array.from(activeDates).sort();
  let best = 0;
  let run = 0;
  let prevTime: number | null = null;

  for (const key of sorted) {
    const [y, m, d] = key.split('-').map(Number);
    const curTime = Date.UTC(y, m - 1, d);
    if (prevTime !== null && curTime - prevTime === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prevTime = curTime;
  }

  return { current, best };
}

export function getDefaultTasks(): StudyTask[] {
  const today = getDateKey();
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'task-nxtwave-daily',
      title: 'NxtWave Daily Learning',
      category: 'NxtWave',
      repeat: 'daily',
      targetMinutes: 60,
      startDate: today,
      carryOverMissed: true,
      completedDates: [],
      skippedDates: [],
      createdAt: nowIso,
    },
    {
      id: 'task-leetcode-daily',
      title: 'Daily LeetCode Problem',
      category: 'LeetCode',
      repeat: 'daily',
      targetMinutes: 45,
      startDate: today,
      carryOverMissed: true,
      completedDates: [],
      skippedDates: [],
      createdAt: nowIso,
    },
    {
      id: 'task-cpp-daily',
      title: 'C++ Daily Topic',
      category: 'C++',
      repeat: 'daily',
      targetMinutes: 45,
      startDate: today,
      carryOverMissed: true,
      completedDates: [],
      skippedDates: [],
      createdAt: nowIso,
    },
    {
      id: 'task-dsa-daily',
      title: 'DSA Daily Topic',
      category: 'DSA',
      repeat: 'daily',
      targetMinutes: 45,
      startDate: today,
      carryOverMissed: true,
      completedDates: [],
      skippedDates: [],
      createdAt: nowIso,
    },
  ];
}

function normalizeTask(raw: Partial<StudyTask>): StudyTask {
  const today = getDateKey();
  const created = raw.createdAt || new Date().toISOString();
  return {
    id: raw.id || generateId(),
    title: raw.title || 'Untitled Task',
    category: raw.category || 'General',
    repeat: raw.repeat === 'once' ? 'once' : 'daily',
    targetMinutes: Math.max(5, Number(raw.targetMinutes) || 45),
    startDate: raw.startDate || created.slice(0, 10) || today,
    carryOverMissed: raw.carryOverMissed !== undefined ? raw.carryOverMissed : true,
    completedDates: Array.isArray(raw.completedDates) ? raw.completedDates : [],
    skippedDates: Array.isArray(raw.skippedDates) ? raw.skippedDates : [],
    createdAt: created,
    archived: raw.archived,
  };
}

export function loadTasks(): StudyTask[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) {
      const defaults = getDefaultTasks();
      localStorage.setItem(TASKS_KEY, JSON.stringify(defaults));
      localStorage.setItem(LEETCODE_MIGRATION_KEY, '1');
      localStorage.setItem(CPP_DSA_MIGRATION_KEY, '1');
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultTasks();

    const normalized = parsed.map((item) => normalizeTask(item));
    let didMutate = false;

    if (!localStorage.getItem(LEETCODE_MIGRATION_KEY)) {
      const hasLeetCode = normalized.some(
        (t) =>
          t.id === 'task-leetcode-daily' ||
          t.title.toLowerCase().includes('leetcode')
      );
      if (!hasLeetCode) {
        normalized.push({
          id: 'task-leetcode-daily',
          title: 'Daily LeetCode Problem',
          category: 'LeetCode',
          repeat: 'daily',
          targetMinutes: 45,
          startDate: getDateKey(),
          carryOverMissed: true,
          completedDates: [],
          skippedDates: [],
          createdAt: new Date().toISOString(),
        });
        didMutate = true;
      }
      localStorage.setItem(LEETCODE_MIGRATION_KEY, '1');
    }

    if (!localStorage.getItem(CPP_DSA_MIGRATION_KEY)) {
      const today = getDateKey();
      const nowIso = new Date().toISOString();

      const hasCpp = normalized.some(
        (t) =>
          t.id === 'task-cpp-daily' ||
          t.title.toLowerCase().includes('c++') ||
          t.category.toLowerCase() === 'c++'
      );
      if (!hasCpp) {
        normalized.push({
          id: 'task-cpp-daily',
          title: 'C++ Daily Topic',
          category: 'C++',
          repeat: 'daily',
          targetMinutes: 45,
          startDate: today,
          carryOverMissed: true,
          completedDates: [],
          skippedDates: [],
          createdAt: nowIso,
        });
        didMutate = true;
      }

      const hasDsa = normalized.some(
        (t) =>
          t.id === 'task-dsa-daily' ||
          /\bdsa\b/i.test(t.title) ||
          t.category.toLowerCase() === 'dsa'
      );
      if (!hasDsa) {
        normalized.push({
          id: 'task-dsa-daily',
          title: 'DSA Daily Topic',
          category: 'DSA',
          repeat: 'daily',
          targetMinutes: 45,
          startDate: today,
          carryOverMissed: true,
          completedDates: [],
          skippedDates: [],
          createdAt: nowIso,
        });
        didMutate = true;
      }

      localStorage.setItem(CPP_DSA_MIGRATION_KEY, '1');
    }

    if (didMutate) {
      localStorage.setItem(TASKS_KEY, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return getDefaultTasks();
  }
}

export function saveTasks(tasks: StudyTask[]): void {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function loadSessions(): StudySession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: StudySession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function loadLeetCodeProblems(): LeetCodeProblem[] {
  try {
    const raw = localStorage.getItem(LEETCODE_PROBLEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeetCodeProblems(problems: LeetCodeProblem[]): void {
  localStorage.setItem(LEETCODE_PROBLEMS_KEY, JSON.stringify(problems));
}

export function loadActiveTimer(): ActiveTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveTimerState>;
    if (!parsed.taskId) return null;
    return {
      taskId: parsed.taskId,
      forDate: parsed.forDate || getDateKey(),
      revisionProblemId: parsed.revisionProblemId,
      mode: parsed.mode === 'target' ? 'target' : 'stopwatch',
      isRunning: Boolean(parsed.isRunning),
      accumulatedSeconds: Number(parsed.accumulatedSeconds) || 0,
      startedAt: parsed.startedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function saveActiveTimer(timer: ActiveTimerState | null): void {
  if (!timer) {
    localStorage.removeItem(TIMER_KEY);
  } else {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  }
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
