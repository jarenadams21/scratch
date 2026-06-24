import { AppState, updateState } from './state.js';
import { getPosts, getAudioPosts, getTraits, getMealEntries, getProfiles, getInspoBoards, getInspos, getOutfits } from './api.js';

export function makeLoader({ fetchFn, stateKey, loadingKey, loadedKey, errorKey }) {
  function load() {
    updateState({ [loadingKey]: true });
    fetchFn()
      .then(data => {
        const update = { [stateKey]: data, [loadingKey]: false };
        if (errorKey) update[errorKey] = null;
        updateState(update);
      })
      .catch(err => {
        const update = { [loadingKey]: false };
        if (errorKey) update[errorKey] = err.message;
        updateState(update);
      });
  }

  return {
    ensureLoaded() {
      if (!AppState[loadedKey] && !AppState[loadingKey]) {
        updateState({ [loadingKey]: true, [loadedKey]: true });
        load();
      }
    },
    reload: load,
  };
}

export const postLoader = makeLoader({
  fetchFn: getPosts,
  stateKey: 'entries',
  loadingKey: 'loading',
  loadedKey: 'postsLoaded',
  errorKey: 'error',
});

export const audioLoader = makeLoader({
  fetchFn: getAudioPosts,
  stateKey: 'audioEntries',
  loadingKey: 'audioLoading',
  loadedKey: 'audioLoaded',
});

// Traits come back wrapped: { traits: { calendar: true } }. Unwrap to flat object.
export const traitsLoader = makeLoader({
  fetchFn: () => getTraits().then(r => r?.traits || {}),
  stateKey: 'traits',
  loadingKey: 'traitsLoading',
  loadedKey: 'traitsLoaded',
});

// Loads meal entries for the month currently in AppState.mealMonth ('YYYY-MM').
// Falls back to the current month if not set.
function monthRange(monthStr) {
  const [yearStr, mStr] = (monthStr || '').split('-');
  const now = new Date();
  const year = Number(yearStr) || now.getFullYear();
  const month = Number(mStr) || (now.getMonth() + 1);
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate:   `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export const mealLoader = makeLoader({
  fetchFn: () => {
    const { startDate, endDate } = monthRange(AppState.mealMonth);
    return getMealEntries(startDate, endDate);
  },
  stateKey: 'mealEntries',
  loadingKey: 'mealLoading',
  loadedKey: 'mealLoaded',
});

export const inspoBoardsLoader = makeLoader({
  fetchFn: getInspoBoards,
  stateKey: 'inspoBoards',
  loadingKey: 'inspoBoardsLoading',
  loadedKey: 'inspoBoardsLoaded',
});

export const inspoItemsLoader = makeLoader({
  fetchFn: getInspos,
  stateKey: 'inspoItems',
  loadingKey: 'inspoItemsLoading',
  loadedKey: 'inspoItemsLoaded',
});

export const outfitsLoader = makeLoader({
  fetchFn: getOutfits,
  stateKey: 'savedOutfits',
  loadingKey: 'outfitsLoading',
  loadedKey: 'outfitsLoaded',
});

// Profiles loader: on-demand. Given a list of emails, fetch any we don't
// already have in AppState.profiles and merge the result. De-duped + idempotent
// so it's safe to call from inside any view's render path.
const _inflightProfileFetches = new Set();
export function ensureProfilesFor(emails) {
  const known = AppState.profiles || {};
  const missing = [...new Set((emails || []).filter(e => typeof e === 'string' && e && !known[e] && !_inflightProfileFetches.has(e)))];
  if (missing.length === 0) return;
  for (const e of missing) _inflightProfileFetches.add(e);
  updateState({ profilesLoading: true });
  getProfiles(missing).then(res => {
    const incoming = res?.profiles || {};
    updateState({
      profiles: { ...(AppState.profiles || {}), ...incoming },
      profilesLoading: false,
    });
  }).catch(() => {
    updateState({ profilesLoading: false });
  }).finally(() => {
    for (const e of missing) _inflightProfileFetches.delete(e);
  });
}

// Helper for consumers — given an email, return its profile or a synthesized
// fallback. Never throws; never returns null.
export function profileFor(email) {
  const p = (AppState.profiles || {})[email];
  return {
    displayName: p?.displayName || 'Operator',
    displayColor: p?.displayColor || null,
  };
}
