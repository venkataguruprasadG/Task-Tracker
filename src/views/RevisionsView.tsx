import React, { useMemo, useState } from 'react';
import { Check, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { LeetCodeProblem } from '../types/study';
import {
  formatMonthDay,
  getDateKey,
  getDaysDifference,
  getNextRevisionInterval,
} from '../utils/storage';

interface RevisionsViewProps {
  problems: LeetCodeProblem[];
  onOpenAddProblem: () => void;
  onStartRevisionFocus: (problem: LeetCodeProblem) => void;
  onReviewProblem: (problemId: string, solvedSolo: boolean) => void;
  onDeleteProblem: (problemId: string) => void;
}

type RevisionFilter = 'due' | 'upcoming' | 'all';

export const RevisionsView: React.FC<RevisionsViewProps> = ({
  problems,
  onOpenAddProblem,
  onStartRevisionFocus,
  onReviewProblem,
  onDeleteProblem,
}) => {
  const [filter, setFilter] = useState<RevisionFilter>('all');
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayKey = getDateKey();

  const stats = useMemo(() => {
    const dueCount = problems.filter((p) => p.nextReviewDate <= todayKey).length;
    const allReviews = problems.flatMap((p) => p.reviewHistory);
    const soloReviews = allReviews.filter((r) => r.solvedSolo).length;
    const soloRate =
      allReviews.length > 0 ? Math.round((soloReviews / allReviews.length) * 100) : null;
    const masteredCount = problems.filter((p) => p.intervalDays >= 14 && p.soloStreak >= 2).length;
    return {
      total: problems.length,
      dueCount,
      soloRate,
      totalReviews: allReviews.length,
      masteredCount,
    };
  }, [problems, todayKey]);

  const filteredProblems = useMemo(() => {
    return problems
      .filter((p) => {
        if (filter === 'due' && p.nextReviewDate > todayKey) return false;
        if (filter === 'upcoming' && p.nextReviewDate <= todayKey) return false;
        if (query.trim()) {
          const q = query.toLowerCase().replace(/^#/, '');
          const matchNum = p.problemNumber.toLowerCase().includes(q);
          const matchTitle = (p.title || '').toLowerCase().includes(q);
          const matchNote = (p.note || '').toLowerCase().includes(q);
          return matchNum || matchTitle || matchNote;
        }
        return true;
      })
      .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
  }, [problems, filter, query, todayKey]);

  const getScheduleLabel = (nextReviewDate: string) => {
    const diff = getDaysDifference(todayKey, nextReviewDate);
    if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
    if (diff === 0) return 'Due Today';
    if (diff === 1) return `Tomorrow · ${formatMonthDay(nextReviewDate)}`;
    return `In ${diff} days · ${formatMonthDay(nextReviewDate)}`;
  };

  const getDifficultyClass = (diff: string) => {
    if (diff === 'Hard') return 'text-rose-600 dark:text-rose-400';
    if (diff === 'Medium') return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            LeetCode Revisions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Solved problems resurface in 3 days. Solve solo to stretch the cycle (3d → 7d → 14d → 30d) — needing AI shrinks it back.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddProblem}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Problem #</span>
        </button>
      </div>

      {/* 3-Stat Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Stored Problems
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.total}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {stats.masteredCount} strong retention (14d+)
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Due for Revision
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.dueCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {stats.dueCount > 0 ? 'Ready to solve without AI' : 'No revisions due today'}
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Independent Solve Rate
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {stats.soloRate !== null ? `${stats.soloRate}%` : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'} logged
          </div>
        </div>
      </section>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'All Problems', count: problems.length },
              { id: 'due', label: 'Due Now', count: stats.dueCount },
              { id: 'upcoming', label: 'Upcoming', count: problems.length - stats.dueCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono tabular-nums text-[11px] opacity-75">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by # number or title..."
            className="w-full bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stored Problems List */}
      {filteredProblems.length === 0 ? (
        <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl py-14 px-6 text-center space-y-2.5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {problems.length === 0
              ? 'No LeetCode problems stored yet'
              : 'No problems match this filter'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {problems.length === 0
              ? 'Complete Daily LeetCode Problem on Today (or click Add Problem #) and it will automatically schedule your 3-day solo revision.'
              : 'Try switching tabs or clearing your search.'}
          </p>
          {problems.length === 0 && (
            <button
              type="button"
              onClick={onOpenAddProblem}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Your First Problem #</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          {filteredProblems.map((problem) => {
            const isDue = problem.nextReviewDate <= todayKey;
            const nextSolo = getNextRevisionInterval(problem.intervalDays, true);
            const nextAssisted = getNextRevisionInterval(problem.intervalDays, false);

            return (
              <div
                key={problem.id}
                className="px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono tabular-nums text-sm font-semibold text-teal-700 dark:text-teal-400">
                      LC #{problem.problemNumber}
                    </span>
                    {problem.title && (
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {problem.title}
                      </span>
                    )}
                  </div>

                  {problem.note && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{problem.note}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <span
                      className={`font-medium ${
                        isDue
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {getScheduleLabel(problem.nextReviewDate)}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className={getDifficultyClass(problem.difficulty)}>
                      {problem.difficulty}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      Cycle {problem.intervalDays}d
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      Solved {formatMonthDay(problem.solvedDate)}
                    </span>
                    {problem.reviewHistory.length > 0 && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span
                          className="inline-flex items-center gap-1"
                          title="Recent review history (Teal = Solved Solo, Amber = Used AI/Hints)"
                        >
                          {problem.reviewHistory.slice(-6).map((rev, i) => (
                            <span
                              key={`${rev.date}-${i}`}
                              title={`${formatMonthDay(rev.date)}: ${
                                rev.solvedSolo ? 'Solved Solo' : 'Used AI / Hints'
                              } (${rev.previousIntervalDays}d → ${rev.nextIntervalDays}d)`}
                              className={`w-2 h-2 rounded-xs ${
                                rev.solvedSolo
                                  ? 'bg-teal-600 dark:bg-teal-400'
                                  : 'bg-amber-500 dark:bg-amber-400'
                              }`}
                            />
                          ))}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onStartRevisionFocus(problem)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Focus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onReviewProblem(problem.id, true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/15 dark:hover:bg-teal-500/25 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    title="Mark revised solo without AI"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Solo → {nextSolo}d</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onReviewProblem(problem.id, false)}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    title="Mark revised with AI or hints (shrinks interval)"
                  >
                    AI → {nextAssisted}d
                  </button>

                  {confirmDeleteId === problem.id ? (
                    <div className="flex items-center gap-1 pl-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteProblem(problem.id);
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
                      onClick={() => setConfirmDeleteId(problem.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Delete stored problem"
                      aria-label={`Delete LC #${problem.problemNumber}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
