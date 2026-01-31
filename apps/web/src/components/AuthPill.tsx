'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchAuthMe } from '@/lib/api';

type AuthState =
  | { kind: 'checking' }
  | { kind: 'unavailable' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; userDetails?: string };

export default function AuthPill() {
  const [state, setState] = useState<AuthState>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setState({ kind: 'checking' });
      const result = await fetchAuthMe();
      if (cancelled) return;

      if (!result.available) {
        setState({ kind: 'unavailable' });
        return;
      }

      if (!result.authenticated) {
        setState({ kind: 'anonymous' });
        return;
      }

      setState({ kind: 'authenticated', userDetails: result.userDetails });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const ui = useMemo(() => {
    switch (state.kind) {
      case 'checking':
        return {
          label: 'AUTH: CHECKING',
          href: undefined,
          title: 'Checking authentication status',
          className:
            'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900/10 dark:border-gray-800 dark:text-gray-400',
        };
      case 'unavailable':
        return {
          label: 'AUTH: OFF',
          href: undefined,
          title: 'Auth endpoints unavailable (run via Azure Static Web Apps to enable /.auth/*)',
          className:
            'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900 dark:text-amber-400',
        };
      case 'anonymous':
        return {
          label: 'SIGN IN',
          href: '/.auth/login/aad?post_login_redirect_uri=/',
          title: 'Sign in to create and manage watchlists',
          className:
            'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/10 dark:border-blue-900 dark:text-blue-400',
        };
      case 'authenticated':
        return {
          label: 'SIGNED IN',
          href: '/.auth/logout?post_logout_redirect_uri=/',
          title: state.userDetails ? `Signed in as ${state.userDetails} (click to sign out)` : 'Signed in (click to sign out)',
          className:
            'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900 dark:text-emerald-400',
        };
      default:
        return null;
    }
  }, [state]);

  if (!ui) return null;

  const baseClass = `inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border font-mono text-[10px] sm:text-xs ${ui.className}`;

  if (ui.href) {
    return (
      <a className={baseClass} href={ui.href} title={ui.title} aria-label={ui.title}>
        {ui.label}
      </a>
    );
  }

  return (
    <div className={baseClass} title={ui.title} aria-label={ui.title}>
      {ui.label}
    </div>
  );
}
