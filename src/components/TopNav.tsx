import React from 'react';
import { Bell, Moon, Plus, Sun } from 'lucide-react';
import { ViewTab } from '../types/study';
import { formatClock } from '../utils/storage';

interface TopNavProps {
  activeTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  onOpenNewTask: () => void;
  onOpenReminders: () => void;
  hasRemindersActive: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isTimerRunning: boolean;
  timerSeconds: number;
  dueRevisionsCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTask,
  onOpenReminders,
  hasRemindersActive,
  theme,
  onToggleTheme,
  isTimerRunning,
  timerSeconds,
  dueRevisionsCount,
}) => {
  const navItems: { id: ViewTab; label: string; count?: number }[] = [
    { id: 'today', label: 'Today' },
    {
      id: 'revisions',
      label: 'Revisions',
      count: dueRevisionsCount > 0 ? dueRevisionsCount : undefined,
    },
    { id: 'analytics', label: 'Analytics' },
    { id: 'history', label: 'History' },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#0D1117]/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('today')}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Daily Study
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav aria-label="Main navigation" className="h-full flex items-center gap-4 sm:gap-7">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative h-full flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                    {item.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-teal-600 dark:bg-teal-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Single Primary Action */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {isTimerRunning && activeTab !== 'today' && (
            <button
              type="button"
              onClick={() => onSelectTab('today')}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono tabular-nums font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap cursor-pointer mr-1"
              title="Return to running timer"
            >
              <span>Running</span>
              <span>{formatClock(timerSeconds)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenReminders}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              hasRemindersActive
                ? 'text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="Reminders and sound settings"
            title="Reminders & sound"
          >
            <Bell className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenNewTask}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>
    </header>
  );
};
