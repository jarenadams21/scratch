// Application State Management
// Single source of truth for the entire app

export const AppState = {
  user: null,
  entries: [],
  loading: false,
  postsLoaded: false,
  error: null,
  currentView: 'archive',
  selectedEntry: null,
  showAdminPanel: false,
  // Audio state
  audioEntries: [],
  audioLoaded: false,
  audioLoading: false,
  selectedAudio: null,
  // Feature traits — generic on/off flags per admin (e.g. { calendar: true })
  traits: {},
  traitsLoaded: false,
  traitsLoading: false,
  // Shared meal calendar
  mealEntries: [],
  mealLoaded: false,
  mealLoading: false,
  mealMonth: null,        // 'YYYY-MM' currently shown
  selectedMealDate: null, // 'YYYY-MM-DD' currently being edited
  // Map of email -> { displayName, displayColor }. Populated lazily as
  // we encounter authors in posts/meals/etc.
  profiles: {},
  profilesLoading: false,
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
