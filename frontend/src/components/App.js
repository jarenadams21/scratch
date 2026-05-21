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
import { Lightbox } from './Lightbox.js';
import { AppState, updateState } from '../lib/state.js';
import { postLoader, audioLoader, traitsLoader, mealLoader } from '../lib/loaders.js';

export function App() {
  const isAdmin        = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;
  const traits         = AppState.traits || {};

  postLoader.ensureLoaded();
  if (isAdmin) {
    audioLoader.ensureLoaded();
    traitsLoader.ensureLoaded();
    if (traits.calendar) mealLoader.ensureLoaded();
  }

  const toggleAdminPanel = () => updateState({ showAdminPanel: !showAdminPanel });

  const handleLoginSuccess = () => {
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
    });
  };

  const switchView = (view) => updateState({
    currentView: view,
    selectedEntry: null,
    selectedAudio: null,
    selectedMealDate: null,
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
  if (isAdmin) {
    navTabs.push(createElement('button', {
      onClick: () => switchView('settings'),
      className: AppState.currentView === 'settings' ? 'tab active' : 'tab',
    }, 'SETTINGS'));
    navTabs.push(createElement('button', { onClick: handleLogout, className: 'tab logout' }, 'EXIT'));
  } else {
    navTabs.push(createElement('button', { onClick: toggleAdminPanel, className: 'tab admin-btn' }, 'ADMIN'));
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
            createElement('button', { onClick: toggleAdminPanel, className: 'close-btn' }, '✕'),
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
