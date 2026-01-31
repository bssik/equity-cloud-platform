'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMarketDataSource } from '@/lib/marketDataClient';

type HealthResponse = {
  status?: 'ok' | 'degraded';
  utc_time?: string;
  configured?: {
    alpha_vantage?: boolean;
    finnhub?: boolean;
  };
  ready?: {
    quote?: boolean;
    history?: boolean;
    sma?: boolean;
    news?: boolean;
  };
};

type HealthState =
  | { kind: 'checking' }
  | { kind: 'ready'; detail?: string }
  | { kind: 'degraded'; detail?: string }
  | { kind: 'offline'; detail?: string };

function buildDetail(payload: HealthResponse | null): string | undefined {
  if (!payload) return undefined;

  const parts: string[] = [];

  if (payload.status) parts.push(`status=${payload.status}`);

  const configured = payload.configured;
  if (configured) {
    if (typeof configured.alpha_vantage === 'boolean') {
      parts.push(`alpha_vantage=${configured.alpha_vantage ? 'ok' : 'missing'}`);
    }
    if (typeof configured.finnhub === 'boolean') {
      parts.push(`finnhub=${configured.finnhub ? 'ok' : 'missing'}`);
    }
  }

  return parts.length ? parts.join(' · ') : undefined;
}

export default function ApiHealthPill() {
  const source = getMarketDataSource();
  const shouldRender = source === 'api';

  const [state, setState] = useState<HealthState>({ kind: 'checking' });

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setState({ kind: 'checking' });

      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        let payload: HealthResponse | null = null;
        try {
          payload = (await response.json()) as HealthResponse;
        } catch {
          payload = null;
        }

        const detail = buildDetail(payload);

        if (response.ok) {
          setState({ kind: 'ready', detail });
          return;
        }

        if (response.status === 503) {
          setState({ kind: 'degraded', detail });
          return;
        }

        setState({ kind: 'offline', detail: detail ?? `http=${response.status}` });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ kind: 'offline', detail: 'unreachable' });
      }
    }

    void run();

    return () => controller.abort();
  }, [shouldRender]);

  const ui = useMemo(() => {
    switch (state.kind) {
      case 'checking':
        return {
          label: 'API: CHECKING',
          className:
            'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-900/10 dark:border-gray-800 dark:text-gray-400',
        };
      case 'ready':
        return {
          label: 'API: READY',
          className:
            'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900 dark:text-emerald-400',
        };
      case 'degraded':
        return {
          label: 'API: DEGRADED',
          className:
            'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900 dark:text-amber-400',
        };
      case 'offline':
        return {
          label: 'API: OFFLINE',
          className:
            'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-900 dark:text-red-400',
        };
      default:
        return null;
    }
  }, [state.kind]);

  if (!shouldRender) return null;
  if (!ui) return null;

  const detail = state.kind === 'checking' ? undefined : state.detail;

  return (
    <div
      className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border font-mono text-[10px] sm:text-xs ${ui.className}`}
      title={detail}
      aria-label={detail ? `${ui.label} (${detail})` : ui.label}
    >
      {ui.label}
    </div>
  );
}
