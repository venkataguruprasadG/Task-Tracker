import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { StudyTask } from '../types/study';
import { formatDueFromLabel, getDateKey } from '../utils/storage';

interface ManualLogModalProps {
  isOpen: boolean;
  tasks: StudyTask[];
  defaultTaskId: string;
  defaultForDate?: string;
  onClose: () => void;
  onLog: (data: {
    taskId: string;
    minutes: number;
    date: string;
    forDate: string;
    note: string;
  }) => void;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export const ManualLogModal: React.FC<ManualLogModalProps> = ({
  isOpen,
  tasks,
  defaultTaskId,
  defaultForDate,
  onClose,
  onLog,
}) => {
  const todayKey = getDateKey();
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [minutes, setMinutes] = useState(30);
  const [date, setDate] = useState(todayKey);
  const [note, setNote] = useState('');

  const effectiveForDate = defaultForDate || date;
  const isCatchUp = Boolean(defaultForDate && defaultForDate < todayKey);

  useEffect(() => {
    if (isOpen) {
      const targetTask = tasks.find((t) => t.id === defaultTaskId) || tasks[0];
      setTaskId(targetTask?.id || '');
      setMinutes(targetTask?.targetMinutes || 30);
      setDate(todayKey);
      setNote('');
    }
  }, [isOpen, defaultTaskId, tasks, todayKey]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || minutes <= 0) return;
    onLog({
      taskId,
      minutes: Math.max(1, Number(minutes)),
      date,
      forDate: defaultForDate || date,
      note: note.trim(),
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
              Log Study Session
            </h2>
            {isCatchUp && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Completing carryover · {formatDueFromLabel(effectiveForDate, todayKey)}
              </p>
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
          <div className="space-y-1.5">
            <label
              htmlFor="manual-task"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Task
            </label>
            <select
              id="manual-task"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              disabled={isCatchUp}
              className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none disabled:opacity-70"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="manual-minutes"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Duration (minutes)
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMinutes(preset)}
                  className={`px-3 py-1.5 text-xs font-mono tabular-nums font-medium rounded-lg border transition-colors cursor-pointer ${
                    minutes === preset
                      ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-800 dark:text-teal-300'
                      : 'bg-white dark:bg-[#0D1117] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                </button>
              ))}
              <input
                id="manual-minutes"
                type="number"
                min={1}
                max={720}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-20 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-center text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="manual-date"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              {isCatchUp ? 'Date you studied' : 'Date'}
            </label>
            <input
              id="manual-date"
              type="date"
              required
              value={date}
              max={todayKey}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="manual-note"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              What did you cover? (optional)
            </label>
            <input
              id="manual-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Solved LC #121 Best Time to Buy and Sell Stock"
              className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
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
              Save Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
