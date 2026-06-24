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
  mealImageUploading: null, // 'YYYY-MM-DD' actively receiving a photo upload
  lightboxImage: null,       // { url, alt } currently shown full-screen, or null
  // Map of email -> { displayName, displayColor }. Populated lazily as
  // we encounter authors in posts/meals/etc.
  profiles: {},
  profilesLoading: false,
  // Inspiration board
  inspoBoards: [],
  inspoBoardsLoaded: false,
  inspoBoardsLoading: false,
  inspoItems: [],
  inspoItemsLoaded: false,
  inspoItemsLoading: false,
  inspoActiveBoard: 'all',                        // board id, or 'all'
  inspoFilters: { scenarios: [], seasons: [], colors: [], q: '' },
  inspoEditingId: null,                           // item id open in the tag editor, or null
  inspoUploading: false,
  // Outfits — peer collections inside the inspo tab. The active outfit (if any)
  // takes over the inspo main pane with its body-map editor; otherwise the
  // image grid shows for the active board.
  savedOutfits: [],
  outfitsLoaded: false,
  outfitsLoading: false,
  inspoActiveOutfitId: null,                      // selected outfit id, or null (= grid mode)
  outfitAssignSlot: null,                         // slot key awaiting a tap-pick, or null
  outfitPaletteQ: '',                             // outfit palette search text
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
