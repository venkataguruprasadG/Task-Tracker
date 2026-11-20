import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { LeetCodeDifficulty } from '../types/study';
import { addDaysToDateKey, formatMonthDay, getDateKey } from '../utils/storage';

interface LeetCodeLogModalProps {
  isOpen: boolean;
  contextLabel?: string;
  solvedDateKey: string;
  onClose: () => void;
  onSubmit: (data: {
    problemNumber: string;
    title: string;
    difficulty: LeetCodeDifficulty;
    note: string;
    solvedDate: string;
  }) => void;
}

export const LeetCodeLogModal: React.FC<LeetCodeLogModalProps> = ({
  isOpen,
  contextLabel,
  solvedDateKey,
  onClose,
  onSubmit,
}) => {
  const [problemNumber, setProblemNumber] = useState('');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<LeetCodeDifficulty>('Medium');
  const [note, setNote] = useState('');
  const [solvedDate, setSolvedDate] = useState(solvedDateKey || getDateKey());

  useEffect(() => {
    if (isOpen) {
      setProblemNumber('');
      setTitle('');
      setDifficulty('Medium');
      setNote('');
      setSolvedDate(solvedDateKey || getDateKey());
    }
  }, [isOpen, solvedDateKey]);

  if (!isOpen) return null;

  const firstRevisionDate = addDaysToDateKey(solvedDate || getDateKey(), 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = problemNumber.replace(/^#/, '').trim();
    if (!cleaned) return;
    onSubmit({
      problemNumber: cleaned,
      title: title.trim(),
      difficulty,
      note: note.trim(),
      solvedDate: solvedDate || getDateKey(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 dark:bg-black/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Log Solved LeetCode Problem
            </h2>
            {contextLabel && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{contextLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="lc-number"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Problem #
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400">
                  #
                </span>
                <input
                  id="lc-number"
                  type="text"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={problemNumber}
                  onChange={(e) => setProblemNumber(e.target.value)}
                  placeholder="121"
                  className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label
                htmlFor="lc-title"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Problem Name (optional)
              </label>
              <input
                id="lc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Best Time to Buy & Sell Stock"
                className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Difficulty
              </span>
              <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 rounded-lg">
                {(['Easy', 'Medium', 'Hard'] as LeetCodeDifficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      difficulty === level
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="lc-date"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Solved Date
              </label>
              <input
                id="lc-date"
                type="date"
                value={solvedDate}
                max={getDateKey()}
                onChange={(e) => setSolvedDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="lc-note"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Key pattern or takeaway (optional)
            </label>
            <input
              id="lc-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Track running min price in one pass"
              className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400">
            First revision scheduled automatically in{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">3 days</span> (
            <span className="font-mono tabular-nums">{formatMonthDay(firstRevisionDate)}</span>) — solve completely on your own.
          </div>

          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Save &amp; Schedule Revision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
