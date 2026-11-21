import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { CustomRepeatMode, RepeatType, StudyTask } from '../types/study';
import {
  getDateKey,
  HABIT_COLOR_PALETTE,
  isRecurringTask,
  ONE_TIME_DEFAULT_COLOR,
  pickNextUniqueHabitColor,
} from '../utils/storage';

interface TaskModalProps {
  isOpen: boolean;
  editingTask: StudyTask | null;
  existingTasks: StudyTask[];
  onClose: () => void;
  onSave: (data: {
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
  }) => void;
}

const TARGET_PRESETS = [
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
];

const INTERVAL_PRESETS = [
  { label: 'Alternate (2d)', days: 2 },
  { label: 'Every 3d', days: 3 },
  { label: 'Every 4d', days: 4 },
  { label: 'Weekly (7d)', days: 7 },
];

const WEEKDAYS = [
  { index: 0, short: 'S', label: 'Sun' },
  { index: 1, short: 'M', label: 'Mon' },
  { index: 2, short: 'T', label: 'Tue' },
  { index: 3, short: 'W', label: 'Wed' },
  { index: 4, short: 'T', label: 'Thu' },
  { index: 5, short: 'F', label: 'Fri' },
  { index: 6, short: 'S', label: 'Sat' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  editingTask,
  existingTasks,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [repeat, setRepeat] = useState<RepeatType>('daily');
  const [customRepeatMode, setCustomRepeatMode] = useState<CustomRepeatMode>('interval');
  const [intervalDays, setIntervalDays] = useState<number>(2);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [paused, setPaused] = useState<boolean>(false);
  const [color, setColor] = useState(HABIT_COLOR_PALETTE[0].hex);
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [carryOverMissed, setCarryOverMissed] = useState(true);
  const [startDate, setStartDate] = useState(getDateKey());

  const usedHabitColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of existingTasks) {
      if (isRecurringTask(t) && t.id !== editingTask?.id && t.color) {
        map.set(t.color.toLowerCase(), t.title);
      }
    }
    return map;
  }, [existingTasks, editingTask?.id]);

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title);
        setCategory(editingTask.category);
        setRepeat(editingTask.repeat);
        setCustomRepeatMode(editingTask.customRepeatMode || 'interval');
        setIntervalDays(editingTask.intervalDays || 2);
        setDaysOfWeek(
          editingTask.daysOfWeek && editingTask.daysOfWeek.length > 0
            ? editingTask.daysOfWeek
            : [1, 3, 5]
        );
        setPaused(Boolean(editingTask.paused));
        setColor(
          isRecurringTask(editingTask)
            ? editingTask.color || pickNextUniqueHabitColor(existingTasks, editingTask.id)
            : pickNextUniqueHabitColor(existingTasks, editingTask.id)
        );
        setTargetMinutes(editingTask.targetMinutes);
        setCarryOverMissed(editingTask.carryOverMissed !== false);
        setStartDate(editingTask.startDate || getDateKey());
      } else {
        setTitle('');
        setCategory('');
        setRepeat('daily');
        setCustomRepeatMode('interval');
        setIntervalDays(2);
        setDaysOfWeek([1, 3, 5]);
        setPaused(false);
        setColor(pickNextUniqueHabitColor(existingTasks));
        setTargetMinutes(60);
        setCarryOverMissed(true);
        setStartDate(getDateKey());
      }
    }
  }, [isOpen, editingTask, existingTasks]);

  if (!isOpen) return null;

  const isHabit = repeat === 'daily' || repeat === 'custom';
  const colorOwner = usedHabitColors.get(color.toLowerCase());

  const toggleWeekday = (dayIdx: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(dayIdx)) {
        // Keep at least 1 weekday selected
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIdx);
      }
      return [...prev, dayIdx].sort((a, b) => a - b);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      category: category.trim() || title.trim(),
      repeat,
      customRepeatMode: repeat === 'custom' ? customRepeatMode : undefined,
      intervalDays:
        repeat === 'custom' && customRepeatMode === 'interval'
          ? Math.max(2, Math.min(30, Number(intervalDays) || 2))
          : undefined,
      daysOfWeek:
        repeat === 'custom' && customRepeatMode === 'weekdays'
          ? daysOfWeek.length > 0
            ? daysOfWeek
            : [1, 3, 5]
          : undefined,
      paused: isHabit ? paused : false,
      color: isHabit ? color : ONE_TIME_DEFAULT_COLOR,
      targetMinutes: Math.max(5, Number(targetMinutes) || 30),
      carryOverMissed: isHabit ? carryOverMissed : false,
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
        className="w-full max-w-md bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {editingTask ? 'Edit Task' : 'New Activity / Habit'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                placeholder="e.g. YouTube Channel, NxtWave"
                className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="task-category"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Category / Label
              </label>
              <input
                id="task-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. YouTube, DSA, C++"
                className="w-full bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 3-Way Schedule Selector */}
          <div className="space-y-2.5">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Repetition Schedule
            </span>
            <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800 rounded-lg">
              {(
                [
                  { id: 'daily', label: 'Daily' },
                  { id: 'custom', label: 'Custom Days' },
                  { id: 'once', label: 'One-Time' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRepeat(opt.id)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    repeat === opt.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom Repetition Options */}
            {repeat === 'custom' && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomRepeatMode('interval')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      customRepeatMode === 'interval'
                        ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-800 dark:text-teal-300'
                        : 'bg-white dark:bg-[#141923] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Alternate / Every N Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomRepeatMode('weekdays')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      customRepeatMode === 'weekdays'
                        ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-800 dark:text-teal-300'
                        : 'bg-white dark:bg-[#141923] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Specific Weekdays
                  </button>
                </div>

                {customRepeatMode === 'interval' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {INTERVAL_PRESETS.map((p) => (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => setIntervalDays(p.days)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                            intervalDays === p.days
                              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                              : 'bg-white dark:bg-[#141923] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>Repeat every</span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        aria-label="Repeat every N days"
                        value={intervalDays}
                        onChange={(e) => setIntervalDays(Number(e.target.value))}
                        className="w-16 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-mono tabular-nums text-center text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                      <span>days (from start date)</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-7 gap-1.5">
                      {WEEKDAYS.map((day) => {
                        const active = daysOfWeek.includes(day.index);
                        return (
                          <button
                            key={day.index}
                            type="button"
                            onClick={() => toggleWeekday(day.index)}
                            title={day.label}
                            aria-pressed={active}
                            className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              active
                                ? 'bg-teal-700 dark:bg-teal-600 text-white'
                                : 'bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500">Quick:</span>
                      <button
                        type="button"
                        onClick={() => setDaysOfWeek([1, 3, 5])}
                        className="text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        Mon / Wed / Fri
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => setDaysOfWeek([2, 4, 6])}
                        className="text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        Tue / Thu / Sat
                      </button>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => setDaysOfWeek([0, 6])}
                        className="text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                      >
                        Weekends
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Graph Line Color Picker */}
          {isHabit ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Graph Line Color
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {colorOwner ? `Also used by ${colorOwner}` : color.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {HABIT_COLOR_PALETTE.map((swatch) => {
                  const isSelected = color.toLowerCase() === swatch.hex.toLowerCase();
                  const isTaken = usedHabitColors.has(swatch.hex.toLowerCase());
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setColor(swatch.hex)}
                      title={
                        isTaken
                          ? `${swatch.name} (used by ${usedHabitColors.get(swatch.hex.toLowerCase())})`
                          : swatch.name
                      }
                      aria-label={`Select ${swatch.name} color`}
                      style={{ backgroundColor: swatch.hex }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer relative ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-[#141923] scale-105'
                          : isTaken
                          ? 'opacity-45 hover:opacity-90'
                          : 'hover:scale-105'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.75]" />}
                    </button>
                  );
                })}

                <label
                  title="Pick custom color"
                  className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] font-mono text-slate-500 dark:text-slate-400 hover:border-slate-500 cursor-pointer overflow-hidden relative"
                >
                  <span>+</span>
                  <input
                    type="color"
                    aria-label="Custom hex color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Both daily and custom-schedule habits plot as their own colored line on the Analytics worm graph.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0D1117] border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: ONE_TIME_DEFAULT_COLOR }}
              />
              <span>
                One-time tasks automatically share the default neutral line color on the Analytics graph.
              </span>
            </div>
          )}

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

          {isHabit && (
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
                    Carry over missed scheduled days
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Only scheduled days carry over — off-days and break days are never counted as missed.
                  </span>
                </div>
              </label>

              {editingTask && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paused}
                    onChange={(e) => setPaused(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-600 accent-amber-600"
                  />
                  <div>
                    <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">
                      On break (pause this habit)
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Hides it from today&apos;s targets and pauses carryover until you resume.
                    </span>
                  </div>
                </label>
              )}

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
