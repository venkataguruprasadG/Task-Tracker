import React, { useMemo, useRef, useState } from 'react';
import { Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { StudySession, StudyTask } from '../types/study';
import { formatReadableDate, formatSecondsHuman } from '../utils/storage';

interface HistoryViewProps {
  tasks: StudyTask[];
  sessions: StudySession[];
  onDeleteSession: (sessionId: string) => void;
  onOpenManualLog: (taskId: string) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  tasks,
  sessions,
  onDeleteSession,
  onOpenManualLog,
  onExportBackup,
  onImportBackup,
}) => {
  const [query, setQuery] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.loggedAt.localeCompare(a.loggedAt);
    });
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (s) =>
        s.taskTitle.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.note || '').toLowerCase().includes(q)
    );
  }, [sessions, query]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; totalSeconds: number; items: StudySession[] }[] = [];
    const map = new Map<string, { date: string; totalSeconds: number; items: StudySession[] }>();

    for (const s of filteredSessions) {
      let group = map.get(s.date);
      if (!group) {
        group = { date: s.date, totalSeconds: 0, items: [] };
        map.set(s.date, group);
        groups.push(group);
      }
      group.totalSeconds += s.durationSeconds;
      group.items.push(s);
    }
    return groups;
  }, [filteredSessions]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportBackup(String(reader.result || ''));
      setImportMessage(ok ? 'Backup restored successfully.' : 'Invalid backup file.');
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Session History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Every study session and learning note saved locally in your browser.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenManualLog(tasks[0]?.id || '')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Past Session</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by task, course, or note..."
          className="w-full bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Session List */}
      {groupedByDate.length === 0 ? (
        <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl py-14 px-6 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {query ? 'No sessions match your search' : 'No study sessions logged yet'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {query
              ? 'Try another search term.'
              : 'Start a study session from Today or log one manually to build your history.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <section key={group.date} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {formatReadableDate(group.date)}
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Total {formatSecondsHuman(group.totalSeconds)}
                </span>
              </div>

              <div className="bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
                {group.items.map((session) => (
                  <div
                    key={session.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {session.taskTitle}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {session.category}
                        </span>
                        {session.forDate && session.forDate !== session.date && (
                          <>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                              Catch-up for {formatReadableDate(session.forDate)}
                            </span>
                          </>
                        )}
                      </div>
                      {session.note && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {session.note}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono tabular-nums font-medium text-teal-700 dark:text-teal-400">
                        {formatSecondsHuman(session.durationSeconds)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Delete session"
                        aria-label="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Quiet Local Backup Row */}
      <section className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div>
          <span>Data is stored locally in your browser.</span>
          {importMessage && (
            <span className="ml-2 text-teal-700 dark:text-teal-400 font-medium">
              {importMessage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#141923] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </section>
    </div>
  );
};
