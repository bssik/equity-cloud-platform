'use client';

import { useEffect } from 'react';

export type ToastProps = {
  open: boolean;
  title: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
  durationMs?: number;
  onClose: () => void;
};

export default function Toast({
  open,
  title,
  message,
  actionHref,
  actionLabel,
  durationMs = 6000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    if (durationMs <= 0) return;

    const timer = setTimeout(() => {
      onClose();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f10] shadow-lg"
      role="status"
      aria-live="polite"
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
            {message ? (
              <div className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400">{message}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 text-xs font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111]"
            aria-label="Dismiss"
          >
            Close
          </button>
        </div>

        {actionHref ? (
          <div className="mt-3 flex items-center justify-end">
            <a
              href={actionHref}
              className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              {actionLabel ?? 'OK'}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
