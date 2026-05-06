export let AppState = {
  currentView: 'home',
};

let stateListeners = [];

export function updateState(updates) {
  Object.assign(AppState, updates);
  stateListeners.forEach(cb => cb(AppState));
}

export function subscribeToState(callback) {
  stateListeners.push(callback);
  return () => { stateListeners = stateListeners.filter(cb => cb !== callback); };
}
