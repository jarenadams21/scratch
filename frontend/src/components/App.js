import { createElement } from '../engine/main.js';
import { isLoggedIn, logout, setAppearance } from '../lib/api.js';
import { LoginForm } from './LoginForm.js';
import { EditorView } from './EditorView.js';
import { ArchiveView } from './ArchiveView.js';
import { AudioRecorder } from './AudioRecorder.js';
import { RecordingsView } from './RecordingsView.js';
import { SettingsView } from './SettingsView.js';
import { ShelfManager } from './ShelfManager.js';
import { SourcesView } from './SourcesView.js';
import { CalendarView } from './CalendarView.js';
import { InspoView } from './InspoView.js';
import { Lightbox } from './Lightbox.js';
import { AppState, updateState } from '../lib/state.js';
import {
  postLoader, audioLoader, traitsLoader, mealLoader, inspoBoardsLoader,
  inspoItemsLoader, outfitsLoader, shelvesLoader, appearanceLoader,
  sourcesLoader,
} from '../lib/loaders.js';
import {
  applyAppearance, PALETTE_LABELS, PALETTES,
} from '../lib/appearance.js';

export function App() {
  const isAdmin        = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;
  const traits         = AppState.traits || {};

  // Inspiration is experimental, owner-only, and off unless explicitly
  // enabled in Settings. Public visitors only receive Archive and Sources.
  const inspoEnabled = isAdmin && !!traits.inspo;

  postLoader.ensureLoaded();
  shelvesLoader.ensureLoaded();
  sourcesLoader.ensureLoaded();
  appearanceLoader.ensureLoaded();
  applyAppearance(AppState.appearance, false);
  if (isAdmin) {
    audioLoader.ensureLoaded();
    traitsLoader.ensureLoaded();
    if (traits.calendar) mealLoader.ensureLoaded();
    if (inspoEnabled) {
      inspoBoardsLoader.ensureLoaded();
      inspoItemsLoader.ensureLoaded();
      outfitsLoader.ensureLoaded();
    }
  }

  const closeAdminPanel = () => {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    updateState({ showAdminPanel: false });
  };

  const handleLoginSuccess = () => {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    updateState({
      showAdminPanel: false,
      currentView: 'archive',
      editingEntry: null,
      editorMode: 'write',
      editorBuffer: null,
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
      editingEntry: null,
      editorMode: 'write',
      editorBuffer: null,
      selectedAudio: null,
      audioEntries: [],
      audioLoaded: false,
      traits: {},
      traitsLoaded: false,
      mealEntries: [],
      mealLoaded: false,
      selectedMealDate: null,
      sourceEditorOpen: false,
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
      shelves: [],
      shelvesLoaded: false,
    });
  };

  const switchView = (view) => updateState({
    currentView: view,
    selectedEntry: null,
    selectedAudio: null,
    selectedMealDate: null,
    inspoEditingId: null,
    outfitAssignSlot: null,
    sourceEditorOpen: view === 'sources' ? AppState.sourceEditorOpen : false,
    editingEntry: view === 'compose' ? AppState.editingEntry : null,
    editorMode: view === 'compose' ? 'write' : AppState.editorMode,
  });

  const updateAppearance = async (next) => {
    const appearance = applyAppearance(next);
    updateState({ appearance, appearanceIsPersonal: true });
    if (!isAdmin) return;
    try {
      await setAppearance(appearance.theme, appearance.palette);
      updateState({ siteAppearance: appearance });
    } catch (err) {
      alert('Your appearance was saved in this browser, but the site default could not be updated: ' + err.message);
    }
  };

  const toggleTheme = () => updateAppearance({
    ...AppState.appearance,
    theme: AppState.appearance?.theme === 'dark' ? 'light' : 'dark',
  });

  const selectPalette = (palette) => updateAppearance({
    ...AppState.appearance,
    palette,
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
  } else if (AppState.currentView === 'sources') {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'sources-view' },
      createElement(SourcesView, {})
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
  navTabs.push(createElement('button', {
    onClick: () => switchView('sources'),
    className: AppState.currentView === 'sources' ? 'tab active' : 'tab',
  }, 'SOURCES'));
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
        createElement('nav', {
          className: 'nav-tabs',
          'aria-label': 'Primary navigation',
          tabIndex: 0,
        }, ...navTabs),
        createElement('div', {
          className: 'appearance-controls',
          'aria-label': 'Website appearance',
        },
          createElement('button', {
            type: 'button',
            onClick: toggleTheme,
            className: 'theme-toggle',
            title: 'Toggle light and dark theme',
            'aria-label': 'Toggle light and dark theme',
          }, AppState.appearance?.theme === 'dark' ? '☼' : '◐'),
          ...PALETTES.map(palette => createElement('button', {
            type: 'button',
            key: palette,
            onClick: () => selectPalette(palette),
            className: AppState.appearance?.palette === palette
              ? `palette-swatch palette-${palette} active`
              : `palette-swatch palette-${palette}`,
            title: `Use ${PALETTE_LABELS[palette]} colors`,
            'aria-label': `Use ${PALETTE_LABELS[palette]} colors`,
            'aria-pressed': AppState.appearance?.palette === palette,
          }, createElement('span', { 'aria-hidden': 'true' })))
        )
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
      : null,

    isAdmin && AppState.shelfManagerOpen
      ? createElement(ShelfManager, { key: 'shelf-manager' })
      : null
  );
}
