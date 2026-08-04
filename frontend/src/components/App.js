import { createElement } from '../engine/main.js';
import { isLoggedIn, logout } from '../lib/api.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { LoginForm } from './LoginForm.js';
import { EditorView } from './EditorView.js';
import { ArchiveView } from './ArchiveView.js';
import { AudioRecorder } from './AudioRecorder.js';
import { RecordingsView } from './RecordingsView.js';
import { SettingsView } from './SettingsView.js';
import { CalendarView } from './CalendarView.js';
import { InspoView } from './InspoView.js';
import { Lightbox } from './Lightbox.js';
import { AppState, updateState } from '../lib/state.js';
import { postLoader, audioLoader, traitsLoader, mealLoader, inspoBoardsLoader, inspoItemsLoader, outfitsLoader } from '../lib/loaders.js';

export function App() {
  const isAdmin        = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;
  const traits         = AppState.traits || {};

  // Inspiration space (boards + outfits). The owner unlocks editing via the
  // `inspo` trait (or the DEV flag locally); public boards/outfits are visible
  // to anyone — logged out included — exactly like public posts. The server is
  // the real authority: it returns only public collections to non-admins and
  // rejects every write that isn't from a logged-in admin.
  const inspoOwnerOn = isAdmin && ((CONFIG.DEV && CONFIG.INSPO) || !!traits.inspo);

  postLoader.ensureLoaded();
  // Always load the (cheap, public-filtered) collection lists so public
  // boards/outfits can surface for visitors too — not gated on the trait.
  inspoBoardsLoader.ensureLoaded();
  inspoItemsLoader.ensureLoaded();
  outfitsLoader.ensureLoaded();
  if (isAdmin) {
    audioLoader.ensureLoaded();
    traitsLoader.ensureLoaded();
    if (traits.calendar) mealLoader.ensureLoaded();
  }

  // Anyone sees the tab when public collections exist; the owner also sees it
  // (to curate) whenever they've enabled the feature.
  const hasPublic = (AppState.inspoBoards || []).some(b => b.visibility === 'public')
    || (AppState.savedOutfits || []).some(o => o.visibility === 'public');
  const inspoEnabled = inspoOwnerOn || hasPublic;

  const closeAdminPanel = () => {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    updateState({ showAdminPanel: false });
  };

  const handleLoginSuccess = () => {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    updateState({
      showAdminPanel: false,
      currentView: 'archive',
      traitsLoaded: false,
      mealLoaded: false,
    });
    postLoader.reload();
    audioLoader.reload();
    traitsLoader.reload();
  };

  const handleLogout = () => {
    logout();
    updateState({
      showAdminPanel: false,
      currentView: 'archive',
      selectedEntry: null,
      selectedAudio: null,
      audioEntries: [],
      audioLoaded: false,
      traits: {},
      traitsLoaded: false,
      mealEntries: [],
      mealLoaded: false,
      selectedMealDate: null,
      inspoBoards: [],
      inspoItems: [],
      inspoBoardsLoaded: false,
      inspoItemsLoaded: false,
      inspoActiveBoard: 'all',
      inspoActiveOutfitId: null,
      inspoFilters: { scenarios: [], seasons: [], colors: [], q: '' },
      inspoEditingId: null,
      savedOutfits: [],
      outfitsLoaded: false,
      outfitAssignSlot: null,
    });
  };

  const switchView = (view) => updateState({
    currentView: view,
    selectedEntry: null,
    selectedAudio: null,
    selectedMealDate: null,
    inspoEditingId: null,
    outfitAssignSlot: null,
  });

  const calendarEnabled = isAdmin && !!traits.calendar;

  console.log('[App] Rendering - Admin:', isAdmin, 'View:', AppState.currentView, 'Calendar:', calendarEnabled);

  let workspaceContent;
  // Only block on audioLoading when we're actually showing audio.
  const isAudioView = AppState.currentView === 'recordings' || AppState.currentView === 'record';
  if (AppState.loading || (isAudioView && AppState.audioLoading)) {
    workspaceContent = createElement('div', { className: 'loading-state', key: 'loading' }, 'LOADING...');
  } else if (AppState.currentView === 'record' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'record-view' },
      createElement(AudioRecorder, { onTransmitted: () => { audioLoader.reload(); switchView('recordings'); } })
    );
  } else if (AppState.currentView === 'compose' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'compose-view' },
      createElement(EditorView, { onPostCreated: () => { postLoader.reload(); switchView('archive'); } })
    );
  } else if (AppState.currentView === 'settings' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'settings-view' },
      createElement(SettingsView, {
        onChanged: (next) => {
          // If calendar got turned on, kick a load so the tab is ready.
          if (next?.calendar && !AppState.mealLoaded) mealLoader.reload();
        },
      })
    );
  } else if (AppState.currentView === 'calendar' && calendarEnabled) {
    workspaceContent = createElement('div', { className: 'view-wrapper view-wrapper-calendar', key: 'calendar-view' },
      createElement(CalendarView, {})
    );
  } else if (AppState.currentView === 'inspo' && inspoEnabled) {
    workspaceContent = createElement('div', { className: 'view-wrapper view-wrapper-inspo', key: 'inspo-view' },
      createElement(InspoView, { readOnly: !isAdmin })
    );
  } else if (AppState.currentView === 'recordings' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'recordings-view' },
      createElement(RecordingsView, {
        entries: AppState.audioEntries,
        onDeleted: () => audioLoader.reload(),
      })
    );
  } else {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'archive-view' },
      createElement(ArchiveView, {
        entries: AppState.entries,
        onDeleted: isAdmin ? () => postLoader.reload() : null,
      })
    );
  }

  // Build nav tabs as an array so they can wrap into the scrollable second row.
  const navTabs = [];
  if (isAdmin) {
    navTabs.push(createElement('button', {
      onClick: () => switchView('compose'),
      className: AppState.currentView === 'compose' ? 'tab active' : 'tab',
    }, 'COMPOSE'));
    navTabs.push(createElement('button', {
      onClick: () => switchView('record'),
      className: AppState.currentView === 'record' ? 'tab active' : 'tab',
    }, 'RECORD'));
  }
  navTabs.push(createElement('button', {
    onClick: () => switchView('archive'),
    className: AppState.currentView === 'archive' ? 'tab active' : 'tab',
  }, 'ARCHIVE'));
  if (isAdmin) {
    navTabs.push(createElement('button', {
      onClick: () => switchView('recordings'),
      className: AppState.currentView === 'recordings' ? 'tab active' : 'tab',
    }, 'RECORDINGS'));
  }
  if (calendarEnabled) {
    navTabs.push(createElement('button', {
      onClick: () => switchView('calendar'),
      className: AppState.currentView === 'calendar' ? 'tab active tab-calendar' : 'tab tab-calendar',
    }, 'CALENDAR'));
  }
  if (inspoEnabled) {
    navTabs.push(createElement('button', {
      onClick: () => switchView('inspo'),
      className: AppState.currentView === 'inspo' ? 'tab active tab-inspo' : 'tab tab-inspo',
    }, 'INSPO'));
  }
  if (isAdmin) {
    navTabs.push(createElement('button', {
      onClick: () => switchView('settings'),
      className: AppState.currentView === 'settings' ? 'tab active' : 'tab',
    }, 'SETTINGS'));
    navTabs.push(createElement('button', { onClick: handleLogout, className: 'tab logout' }, 'EXIT'));
  }

  return createElement('div', { className: 'harbinger' },
    createElement('header', { className: 'masthead-bar' },
      createElement('div', { className: 'masthead-row masthead-row-title' },
        createElement('h1', { className: 'title-mark' }, 'HARBINGER'),
        createElement('p', { className: 'title-description' }, 'The views expressed in this website are my own, and for them I accept full responsibility')
      ),
      createElement('div', { className: 'masthead-row masthead-row-nav' },
        createElement('nav', { className: 'nav-tabs' }, ...navTabs)
      )
    ),

    showAdminPanel && !isAdmin
      ? createElement('div', { className: 'admin-panel-overlay', key: 'admin-overlay' },
          createElement('div', { className: 'admin-panel' },
            createElement('button', { onClick: closeAdminPanel, className: 'close-btn' }, '✕'),
            createElement(LoginForm, { onAuthSuccess: handleLoginSuccess, hideSignup: true })
          )
        )
      : null,

    createElement('main', { className: 'workspace' }, workspaceContent),

    AppState.lightboxImage
      ? createElement(Lightbox, { key: 'lightbox', image: AppState.lightboxImage })
      : null
  );
}
