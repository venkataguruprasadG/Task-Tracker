import React, { useState } from 'react';
import { Bell, Clock, Volume2, X } from 'lucide-react';
import { ReminderSettings } from '../types/study';
import {
  getNotificationPermission,
  playTargetCompleteChime,
  requestNotificationPermission,
  sendDesktopNotification,
} from '../utils/sound';

interface ReminderSettingsModalProps {
  isOpen: boolean;
  settings: ReminderSettings;
  onUpdate: (next: ReminderSettings) => void;
  onClose: () => void;
  onTriggerTestToast: (message: string) => void;
}

export const ReminderSettingsModal: React.FC<ReminderSettingsModalProps> = ({
  isOpen,
  settings,
  onUpdate,
  onClose,
  onTriggerTestToast,
}) => {
  const [permission, setPermission] = useState(() => getNotificationPermission());

  if (!isOpen) return null;

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      onUpdate({ ...settings, notificationsEnabled: false });
      return;
    }

    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      onUpdate({ ...settings, notificationsEnabled: true });
      sendDesktopNotification(
        'Daily Study Notifications Enabled',
        'You will be notified when study targets finish or daily reminders fire.'
      );
    } else {
      onUpdate({ ...settings, notificationsEnabled: false });
      onTriggerTestToast(
        result === 'denied'
          ? 'Desktop notifications are blocked by your browser settings. In-app alerts will still appear.'
          : 'Desktop notifications are unavailable in this environment. In-app alerts will be used instead.'
      );
    }
  };

  const handleToggleDailyReminder = async (enabled: boolean) => {
    if (enabled && permission === 'default') {
      const result = await requestNotificationPermission();
      setPermission(result);
      onUpdate({
        ...settings,
        dailyReminderEnabled: true,
        notificationsEnabled: result === 'granted' ? true : settings.notificationsEnabled,
      });
      return;
    }
    onUpdate({ ...settings, dailyReminderEnabled: enabled });
  };

  const handleTestAlert = () => {
    if (settings.soundEnabled) {
      playTargetCompleteChime();
    }
    const sentNative = settings.notificationsEnabled
      ? sendDesktopNotification(
          'Target Reached · Daily Study',
          'Great focus! Your study target is complete — keep going for extra time if you want.'
        )
      : false;
    if (!sentNative) {
      onTriggerTestToast('Test alert: Target reached! Chime played.');
    }
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
              Reminders &amp; Sound
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gentle cues for finished targets and unfinished daily tasks
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Close reminder settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Sound Chime Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Volume2 className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Target completion chime
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Plays a soft bell when your timer hits a task&apos;s target duration (keeps counting extra time).
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Enable target completion chime"
              checked={settings.soundEnabled}
              onChange={(e) => onUpdate({ ...settings, soundEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded accent-teal-600 cursor-pointer shrink-0"
            />
          </div>

          {/* Desktop Notifications Toggle */}
          <div className="flex items-start justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-start gap-3">
              <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Desktop notifications
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shows a Windows / browser notification when a target finishes or your daily reminder triggers.
                </p>
                {permission === 'denied' && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-0.5">
                    Blocked in browser settings — in-app toast banners will still appear.
                  </p>
                )}
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Enable desktop notifications"
              checked={settings.notificationsEnabled && permission === 'granted'}
              onChange={(e) => handleToggleNotifications(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-teal-600 cursor-pointer shrink-0"
            />
          </div>

          {/* Daily Evening Reminder */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Daily unfinished-task reminder
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Reminds you once a day if any daily tasks or LeetCode revisions are still open.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                aria-label="Enable daily reminder"
                checked={settings.dailyReminderEnabled}
                onChange={(e) => handleToggleDailyReminder(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-teal-600 cursor-pointer shrink-0"
              />
            </div>

            {settings.dailyReminderEnabled && (
              <div className="pl-7 flex items-center justify-between gap-4">
                <label
                  htmlFor="daily-reminder-time"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Remind me at
                </label>
                <input
                  id="daily-reminder-time"
                  type="time"
                  value={settings.dailyReminderTime}
                  onChange={(e) =>
                    onUpdate({
                      ...settings,
                      dailyReminderTime: e.target.value || '20:00',
                      lastDailyReminderDate: undefined,
                    })
                  }
                  className="bg-slate-50 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTestAlert}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Test Chime &amp; Alert
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
