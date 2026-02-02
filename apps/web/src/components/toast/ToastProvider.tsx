'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from '@/components/Toast';

export type ToastOptions = {
  title: string;
  message?: string;
  actionHref?: string;
  actionLabel?: string;
  durationMs?: number;
};

type ToastState = ToastOptions & {
  open: boolean;
  id: number;
};

type AuthRequiredToastOptions = {
  message?: string;
  redirectTo?: string;
};

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
  showAuthRequiredToast: (opts?: AuthRequiredToastOptions) => void;
  closeToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function buildAuthLoginHref(redirectTo: string): string {
  const encoded = encodeURIComponent(redirectTo);
  return `/.auth/login/aad?post_login_redirect_uri=${encoded}`;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    id: 0,
    title: '',
  });

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, open: false }));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    setToast((prev) => ({
      ...opts,
      open: true,
      id: prev.id + 1,
    }));
  }, []);

  const showAuthRequiredToast = useCallback((opts?: AuthRequiredToastOptions) => {
    const redirectTo = opts?.redirectTo ?? '/';
    showToast({
      title: 'Sign in required',
      message: opts?.message ?? 'Sign in with Microsoft Entra ID to continue.',
      actionHref: buildAuthLoginHref(redirectTo),
      actionLabel: 'Sign in →',
      durationMs: 6000,
    });
  }, [showToast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      showAuthRequiredToast,
      closeToast,
    }),
    [showToast, showAuthRequiredToast, closeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      <Toast
        key={toast.id}
        open={toast.open}
        title={toast.title}
        message={toast.message}
        actionHref={toast.actionHref}
        actionLabel={toast.actionLabel}
        durationMs={toast.durationMs}
        onClose={closeToast}
      />
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
