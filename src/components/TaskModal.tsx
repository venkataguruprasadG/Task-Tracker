import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { RepeatType, StudyTask } from '../types/study';
import { getDateKey } from '../utils/storage';

interface TaskModalProps {
  isOpen: boolean;
  editingTask: StudyTask | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    category: string;
    repeat: RepeatType;
    targetMinutes: number;
    carryOverMissed: boolean;
    startDate: string;
  }) => void;
}

const TARGET_PRESETS = [
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  editingTask,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('NxtWave');
  const [repeat, setRepeat] = useState<RepeatType>('daily');
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [carryOverMissed, setCarryOverMissed] = useState(true);
  const [startDate, setStartDate] = useState(getDateKey());

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title);
        setCategory(editingTask.category);
        setRepeat(editingTask.repeat);
        setTargetMinutes(editingTask.targetMinutes);
        setCarryOverMissed(editingTask.carryOverMissed !== false);
        setStartDate(editingTask.startDate || getDateKey());
      } else {
        setTitle('');
        setCategory('NxtWave');
        setRepeat('daily');
        setTargetMinutes(60);
        setCarryOverMissed(true);
        setStartDate(getDateKey());
      }
    }
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category: category.trim() || 'General',
      repeat,
      targetMinutes: Math.max(5, Number(targetMinutes) || 30),
      carryOverMissed: repeat === 'daily' ? carryOverMissed : false,
      startDate: startDate || getDateKey(),
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
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {editingTask ? 'Edit Task' : 'New Learning Task'}
          </h2>
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
              htmlFor="task-title"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Task Name
            </label>
            <input
              id="task-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Daily LeetCode Problem"
              className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="task-category"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Course / Label
              </label>
              <input
                id="task-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. NxtWave, LeetCode, C++, DSA"
                className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Schedule
              </span>
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRepeat('daily')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    repeat === 'daily'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setRepeat('once')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    repeat === 'once'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  One-Time
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="task-target"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Target Duration (minutes)
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Flexible — can extend longer
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {TARGET_PRESETS.map((preset) => (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => setTargetMinutes(preset.minutes)}
                  className={`px-3 py-1.5 text-xs font-mono tabular-nums font-medium rounded-lg border transition-colors cursor-pointer ${
                    targetMinutes === preset.minutes
                      ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-800 dark:text-teal-300'
                      : 'bg-white dark:bg-[#0D1117] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <input
                id="task-target"
                type="number"
                min={5}
                max={600}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value))}
                className="w-20 bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-center text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          {repeat === 'daily' && (
            <div className="pt-1 space-y-3 border-t border-slate-100 dark:border-slate-800/80">
              <label className="flex items-start gap-3 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={carryOverMissed}
                  onChange={(e) => setCarryOverMissed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 accent-teal-600"
                />
                <div>
                  <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">
                    Carry over missed days
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    If you miss a day, it stays shown as &ldquo;Due from Yesterday&rdquo; until you complete both.
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="task-start-date"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Start tracking from
                </label>
                <input
                  id="task-start-date"
                  type="date"
                  value={startDate}
                  max={getDateKey()}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          )}

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
              {editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
