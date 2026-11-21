export type RepeatType = 'daily' | 'custom' | 'once';

export type CustomRepeatMode = 'interval' | 'weekdays';

export type TimerMode = 'stopwatch' | 'target';

export type ViewTab = 'today' | 'revisions' | 'analytics' | 'history';

export type LeetCodeDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface StudyTask {
  id: string;
  title: string;
  category: string;
  repeat: RepeatType;
  customRepeatMode?: CustomRepeatMode; // 'interval' (e.g. alternate/every N days) or 'weekdays'
  intervalDays?: number; // Default 2 (alternate days) when customRepeatMode === 'interval'
  daysOfWeek?: number[]; // 0=Sun..6=Sat when customRepeatMode === 'weekdays'
  paused?: boolean; // True when taking a break from this habit
  pausedSince?: string; // YYYY-MM-DD when break started
  color?: string; // Unique hex color for repeating habits; one-time tasks use default neutral color
  targetMinutes: number; // e.g., 30, 45, 60 (flexible — sessions can extend beyond this)
  startDate: string; // YYYY-MM-DD when habit tracking begins
  carryOverMissed: boolean; // If true, missed scheduled days appear as "Due from Yesterday"
  completedDates: string[]; // YYYY-MM-DD dates when marked complete
  skippedDates: string[]; // YYYY-MM-DD dates explicitly skipped/dismissed
  createdAt: string;
  archived?: boolean;
}

export interface StudySession {
  id: string;
  taskId: string;
  taskTitle: string;
  category: string;
  date: string; // YYYY-MM-DD when the study actually happened (for honest daily analytics)
  forDate?: string; // YYYY-MM-DD obligation date if catching up a missed day (defaults to date)
  revisionProblemId?: string; // Set if session was a LeetCode spaced-repetition revision
  durationSeconds: number;
  note?: string;
  loggedAt: string; // ISO timestamp
}

export interface ActiveTimerState {
  taskId: string;
  forDate: string; // YYYY-MM-DD obligation date being worked on (today or a missed previous day)
  revisionProblemId?: string; // Optional LeetCode problem ID when timing a revision
  mode: TimerMode;
  isRunning: boolean;
  accumulatedSeconds: number;
  startedAt: number | null; // epoch ms when last resumed
}

export interface LeetCodeReviewRecord {
  date: string; // YYYY-MM-DD
  solvedSolo: boolean; // true = solved completely on own (no AI), false = used AI / hints
  previousIntervalDays: number;
  nextIntervalDays: number;
  note?: string;
}

export interface LeetCodeProblem {
  id: string;
  problemNumber: string; // e.g. "121", "53"
  title?: string; // Optional name e.g. "Best Time to Buy and Sell Stock"
  difficulty: LeetCodeDifficulty;
  solvedDate: string; // YYYY-MM-DD when initially solved
  intervalDays: number; // Starts at 3; expands on solo solve, shrinks if AI/hints used
  nextReviewDate: string; // YYYY-MM-DD when next revision task appears
  soloStreak: number; // Consecutive independent solves without AI
  reviewHistory: LeetCodeReviewRecord[];
  note?: string;
  createdAt: string;
}

export interface ReminderSettings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // HH:MM 24h format e.g. "20:00"
  lastDailyReminderDate?: string; // YYYY-MM-DD so daily reminder fires once per day
}

