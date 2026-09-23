/**
 * Historial en LocalStorage (versióned).
 */

const KEY = 'simplexlab-history';
const VERSION = 1;
const MAX = 20;

function canUseStorage() {
  try {
    const k = '__simplexlab_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadHistory() {
  if (!canUseStorage()) return { items: [], available: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { items: [], available: true };
    const data = JSON.parse(raw);
    if (data.version !== VERSION || !Array.isArray(data.items)) {
      return { items: [], available: true };
    }
    return { items: data.items, available: true };
  } catch {
    return { items: [], available: true };
  }
}

export function saveHistoryItem(entry) {
  if (!canUseStorage()) return { ok: false, available: false };
  const { items } = loadHistory();
  const next = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      ...entry,
    },
    ...items,
  ].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, items: next }));
  return { ok: true, available: true, items: next };
}

export function removeHistoryItem(id) {
  if (!canUseStorage()) return { ok: false, available: false };
  const { items } = loadHistory();
  const next = items.filter((i) => i.id !== id);
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, items: next }));
  return { ok: true, available: true, items: next };
}

export function clearHistory() {
  if (!canUseStorage()) return { ok: false, available: false };
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, items: [] }));
  return { ok: true, available: true, items: [] };
}

export function storageAvailable() {
  return canUseStorage();
}
