// Application State Management
// Single source of truth for the entire app

export const AppState = {
  user: null,
  entries: [],
  loading: false,
  error: null,
  currentView: 'archive', // Default: public archive view
  selectedEntry: null, // For archive reading pane
  showAdminPanel: false, // Admin login overlay
};

// State update callbacks (to trigger re-render)
let stateListeners = [];

export function subscribeToState(callback) {
  stateListeners.push(callback);
  return () => {
    stateListeners = stateListeners.filter(cb => cb !== callback);
  };
}

export function updateState(updates) {
  Object.assign(AppState, updates);
  stateListeners.forEach(cb => cb(AppState));
}

export function getState() {
  return AppState;
}
