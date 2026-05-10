import { AppState, updateState } from './state.js';
import { getPosts, getAudioPosts, getTraits, getMealEntries } from './api.js';

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
