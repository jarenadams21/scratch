import { AppState, updateState } from './state.js';
import { getPosts, getAudioPosts } from './api.js';

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
