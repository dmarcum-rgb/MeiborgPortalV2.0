/**
 * Module-level store for McLeod pull state.
 * Lives outside React so pull progress survives component unmount/remount.
 *
 * Each report type ('ar' | 'ap' | 'collections' | 'unbilled' | 'carrier') has:
 *   - pulling: boolean — fetch in progress
 *   - result: unknown | null — last successful payload
 *   - error: string | null
 *
 * Components subscribe on mount, unsubscribe on unmount.
 * When they remount they immediately get the current state.
 */

export type ReportKey = 'ar' | 'ap' | 'collections' | 'unbilled' | 'carrier';

export interface PullState {
  pulling: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any | null;
  error: string | null;
}

type Listener = (state: PullState) => void;

const store: Record<ReportKey, PullState> = {
  ar:          { pulling: false, result: null, error: null },
  ap:          { pulling: false, result: null, error: null },
  collections: { pulling: false, result: null, error: null },
  unbilled:    { pulling: false, result: null, error: null },
  carrier:     { pulling: false, result: null, error: null },
};

const listeners: Record<ReportKey, Set<Listener>> = {
  ar:          new Set(),
  ap:          new Set(),
  collections: new Set(),
  unbilled:    new Set(),
  carrier:     new Set(),
};

function notify(key: ReportKey) {
  for (const fn of listeners[key]) fn({ ...store[key] });
}

export function getState(key: ReportKey): PullState {
  return { ...store[key] };
}

export function subscribe(key: ReportKey, fn: Listener): () => void {
  listeners[key].add(fn);
  return () => listeners[key].delete(fn);
}

export function setPulling(key: ReportKey, pulling: boolean) {
  store[key] = { ...store[key], pulling };
  notify(key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setResult(key: ReportKey, result: any) {
  store[key] = { pulling: false, result, error: null };
  notify(key);
}

export function setError(key: ReportKey, error: string) {
  store[key] = { ...store[key], pulling: false, error };
  notify(key);
}

export function clearResult(key: ReportKey) {
  store[key] = { pulling: false, result: null, error: null };
  notify(key);
}
