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
import { AboutView } from './AboutView.js';
import { CalendarView } from './CalendarView.js';
import { InspoView } from './InspoView.js';
import { Lightbox } from './Lightbox.js';
import { AppState, updateState } from '../lib/state.js';
import {
  postLoader, audioLoader, traitsLoader, mealLoader, inspoBoardsLoader,
  inspoItemsLoader, outfitsLoader, shelvesLoader, appearanceLoader,
  sourcesLoader,
  aboutLoader,
} from '../lib/loaders.js';
import {
  applyAppearance, PALETTE_OPTIONS,
} from '../lib/appearance.js';
import {
  applyReadingSize, READING_SIZE_OPTIONS,
} from '../lib/reading-preferences.js';

let paletteLabelHideTimer = null;
let paletteSelectionTimer = null;
let paletteViewportHandlerInstalled = false;
let hoveredPalette = null;
let focusedPalette = null;
const paletteNodes = new Map();
const readingSizeNodes = new Map();
let readingSizeToggleNode = null;
let focusReadingSizeOnOpen = false;

function paletteOverlayPosition(node, estimatedHeight = 52) {
  const rect = node.getBoundingClientRect();
  const halfWidth = 74;
  const left = Math.min(
    window.innerWidth - halfWidth - 8,
    Math.max(halfWidth + 8, rect.left + (rect.width / 2)),
  );
  const below = rect.bottom + estimatedHeight + 8 <= window.innerHeight;
  return {
    left,
    top: below ? rect.bottom + 6 : rect.top - 6,
    placement: below ? 'below' : 'above',
  };
}

function showPaletteLabel(option, node, mode = 'preview', replaceSelected = false) {
  clearTimeout(paletteLabelHideTimer);
  if (
    mode === 'preview'
    && AppState.paletteLabel?.mode === 'selected'
    && AppState.paletteLabel.palette === option.id
    && !replaceSelected
  ) return;
  if (mode === 'preview') clearTimeout(paletteSelectionTimer);
  const position = paletteOverlayPosition(node);
  const current = AppState.paletteLabel;
  if (
    current?.visible
    && current.palette === option.id
    && current.mode === mode
    && current.left === position.left
    && current.top === position.top
  ) return;
  updateState({
    paletteLabel: {
      palette: option.id,
      name: option.name,
      hex: option.hex,
      mode,
      visible: true,
      ...position,
    },
  });
}

function hidePaletteLabel(palette, force = false) {
  if (
    AppState.paletteLabel?.palette === palette
    && (force || AppState.paletteLabel.mode !== 'selected')
  ) {
    updateState({
      paletteLabel: { ...AppState.paletteLabel, visible: false },
    });
    clearTimeout(paletteLabelHideTimer);
    paletteLabelHideTimer = setTimeout(() => {
      if (
        AppState.paletteLabel?.palette === palette
        && !AppState.paletteLabel.visible
      ) {
        updateState({ paletteLabel: null });
      }
    }, 150);
  }
}

function dismissPaletteLabel() {
  clearTimeout(paletteLabelHideTimer);
  clearTimeout(paletteSelectionTimer);
  if (AppState.paletteLabel) updateState({ paletteLabel: null });
}

function showPaletteSelection(option, node) {
  clearTimeout(paletteSelectionTimer);
  showPaletteLabel(option, node, 'selected');
  paletteSelectionTimer = setTimeout(() => {
    if (
      AppState.paletteLabel?.palette !== option.id
      || AppState.paletteLabel.mode !== 'selected'
    ) return;
    const activeNode = paletteNodes.get(option.id);
    if (
      activeNode?.isConnected
      && (hoveredPalette === option.id || focusedPalette === option.id)
    ) {
      showPaletteLabel(option, activeNode, 'preview', true);
    } else {
      hidePaletteLabel(option.id, true);
    }
  }, 900);
}

function handlePaletteEnter(option, node) {
  hoveredPalette = option.id;
  showPaletteLabel(option, node);
}

function handlePaletteLeave(option) {
  if (hoveredPalette === option.id) hoveredPalette = null;
  if (focusedPalette !== option.id) hidePaletteLabel(option.id);
}

function handlePaletteFocus(option, node) {
  focusedPalette = node.matches(':focus-visible') ? option.id : null;
  if (focusedPalette) showPaletteLabel(option, node);
}

function handlePaletteBlur(option) {
  if (focusedPalette === option.id) focusedPalette = null;
  if (hoveredPalette !== option.id) hidePaletteLabel(option.id);
}

function installPaletteViewportHandler() {
  if (paletteViewportHandlerInstalled || typeof window === 'undefined') return;
  paletteViewportHandlerInstalled = true;
  window.addEventListener('resize', dismissPaletteLabel);
}

export function App() {
  installPaletteViewportHandler();
  const isAdmin        = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;
  const traits         = AppState.traits || {};

  // Inspiration is experimental, owner-only, and off unless explicitly
  // enabled in Settings. Public visitors only receive Archive and Sources.
  const inspoEnabled = isAdmin && !!traits.inspo;

  postLoader.ensureLoaded();
  shelvesLoader.ensureLoaded();
  sourcesLoader.ensureLoaded();
  aboutLoader.ensureLoaded();
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
      editorPublishPending: false,
      readingSizeMenuOpen: false,
      entryOrganizerOpen: false,
      aboutEditing: false,
      aboutEditorMode: 'write',
      aboutBuffer: null,
      aboutActiveSectionId: null,
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
      editorPublishPending: false,
      readingSizeMenuOpen: false,
      selectedAudio: null,
      audioEntries: [],
      audioLoaded: false,
      traits: {},
      traitsLoaded: false,
      mealEntries: [],
      mealLoaded: false,
      selectedMealDate: null,
      sourceEditorOpen: false,
      entryOrganizerOpen: false,
      aboutEditing: false,
      aboutEditorMode: 'write',
      aboutBuffer: null,
      aboutActiveSectionId: null,
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
    entryOrganizerOpen: false,
    aboutEditing: view === 'about' ? AppState.aboutEditing : false,
    aboutEditorMode: view === 'about' ? AppState.aboutEditorMode : 'write',
    aboutBuffer: view === 'about' ? AppState.aboutBuffer : null,
    aboutActiveSectionId: view === 'about' ? AppState.aboutActiveSectionId : null,
    editingEntry: view === 'compose' ? AppState.editingEntry : null,
    editorMode: view === 'compose' ? 'write' : AppState.editorMode,
    editorPublishPending: false,
    readingSizeMenuOpen: false,
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

  const selectReadingSize = (size, optionNode) => {
    const menu = optionNode?.closest?.('.reading-size-menu');
    if (menu) {
      menu.hidden = true;
      menu.setAttribute('aria-hidden', 'true');
    }
    const readingSize = applyReadingSize(size);
    updateState({
      readingSize,
      readingSizeMenuOpen: false,
    });
    requestAnimationFrame(() => readingSizeToggleNode?.focus());
  };

  const toggleReadingSizeMenu = () => {
    const open = !AppState.readingSizeMenuOpen;
    focusReadingSizeOnOpen = open;
    updateState({ readingSizeMenuOpen: open });
  };

  const handleReadingSizeKeyDown = (event, index) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      updateState({ readingSizeMenuOpen: false });
      requestAnimationFrame(() => readingSizeToggleNode?.focus());
      return;
    }
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = READING_SIZE_OPTIONS.length - 1;
    else {
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      nextIndex = (index + direction + READING_SIZE_OPTIONS.length) % READING_SIZE_OPTIONS.length;
    }
    const option = READING_SIZE_OPTIONS[nextIndex];
    readingSizeNodes.get(option.id)?.focus();
    applyReadingSize(option.id);
    updateState({ readingSize: option.id });
  };

  const selectPalette = (option, node) => {
    updateAppearance({
      ...AppState.appearance,
      palette: option.id,
    });
    showPaletteSelection(option, node);
  };

  const handlePaletteKeyDown = (event, index) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = PALETTE_OPTIONS.length - 1;
    else {
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      nextIndex = (index + direction + PALETTE_OPTIONS.length) % PALETTE_OPTIONS.length;
    }
    const option = PALETTE_OPTIONS[nextIndex];
    const node = paletteNodes.get(option.id);
    if (!node) return;
    node.focus();
    selectPalette(option, node);
  };

  const calendarEnabled = isAdmin && !!traits.calendar;

  console.log('[App] Rendering - Admin:', isAdmin, 'View:', AppState.currentView, 'Calendar:', calendarEnabled);

  let workspaceContent;
  // Only block on audioLoading when we're actually showing audio.
  const isAudioView = AppState.currentView === 'recordings' || AppState.currentView === 'record';
  const isAboutView = AppState.currentView === 'about';
  if (AppState.loading || (isAudioView && AppState.audioLoading) || (isAboutView && AppState.aboutLoading)) {
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
  } else if (AppState.currentView === 'about') {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'about-view' },
      createElement(AboutView, {})
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
  navTabs.push(createElement('button', {
    onClick: () => switchView('archive'),
    className: AppState.currentView === 'archive' ? 'tab active' : 'tab',
  }, 'ARCHIVE'));
  navTabs.push(createElement('button', {
    onClick: () => switchView('sources'),
    className: AppState.currentView === 'sources' ? 'tab active' : 'tab',
  }, 'SOURCES'));
  navTabs.push(createElement('button', {
    onClick: () => switchView('about'),
    className: AppState.currentView === 'about' ? 'tab active' : 'tab',
  }, 'ABOUT'));
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
          createElement('div', { className: 'reading-size-control' },
            createElement('button', {
              type: 'button',
              className: AppState.readingSizeMenuOpen ? 'reading-size-toggle active' : 'reading-size-toggle',
              onClick: toggleReadingSizeMenu,
              title: `Text size: ${AppState.readingSize}`,
              'aria-label': `Text size: ${AppState.readingSize}`,
              'aria-expanded': AppState.readingSizeMenuOpen ? 'true' : 'false',
              'aria-controls': 'reading-size-menu',
              ref: node => { readingSizeToggleNode = node; },
            }, 'Aa')
          ),
          createElement('div', {
            className: 'palette-swatches',
            role: 'radiogroup',
            'aria-label': 'Accent color',
            onScroll: dismissPaletteLabel,
          },
            ...PALETTE_OPTIONS.map((option, index) => {
              const selected = AppState.appearance?.palette === option.id;
              const described = AppState.paletteLabel?.palette === option.id
                && AppState.paletteLabel.visible
                && AppState.paletteLabel.mode === 'preview';
              return createElement('button', {
                type: 'button',
                key: option.id,
                role: 'radio',
                className: selected ? 'palette-swatch active' : 'palette-swatch',
                style: `--swatch-color:${option.hex};--swatch-check:${option.check};`,
                onClick: event => selectPalette(option, event.currentTarget),
                onMouseEnter: event => handlePaletteEnter(option, event.currentTarget),
                onMouseLeave: () => handlePaletteLeave(option),
                onFocus: event => handlePaletteFocus(option, event.currentTarget),
                onBlur: () => handlePaletteBlur(option),
                onKeyDown: event => handlePaletteKeyDown(event, index),
                'aria-label': option.name,
                'aria-checked': selected ? 'true' : 'false',
                ...(described ? { 'aria-describedby': 'palette-label' } : {}),
                ref: node => { paletteNodes.set(option.id, node); },
              },
                createElement('span', { className: 'palette-swatch-chip', 'aria-hidden': 'true' },
                  createElement('span', { className: 'palette-swatch-check' }, '✓')
                )
              );
            })
          )
        )
      )
    ),

    AppState.readingSizeMenuOpen
      ? createElement('div', {
          id: 'reading-size-menu',
          className: 'reading-size-menu',
          role: 'radiogroup',
          'aria-label': 'Website text size',
        },
          createElement('span', { className: 'reading-size-label' }, 'TEXT SIZE'),
          createElement('div', { className: 'reading-size-options' },
            ...READING_SIZE_OPTIONS.map((option, index) => {
              const selected = AppState.readingSize === option.id;
              return createElement('button', {
                type: 'button',
                key: option.id,
                role: 'radio',
                className: selected ? 'reading-size-option active' : 'reading-size-option',
                onClick: event => selectReadingSize(option.id, event.currentTarget),
                onKeyDown: event => handleReadingSizeKeyDown(event, index),
                'aria-label': `${option.label} website text`,
                'aria-checked': selected ? 'true' : 'false',
                tabIndex: selected ? 0 : -1,
                ref: node => {
                  readingSizeNodes.set(option.id, node);
                  if (node && selected && focusReadingSizeOnOpen) {
                    focusReadingSizeOnOpen = false;
                    requestAnimationFrame(() => node.focus());
                  }
                },
              },
                createElement('span', { 'aria-hidden': 'true' }, option.label.toUpperCase()),
                selected ? createElement('span', { className: 'reading-size-check', 'aria-hidden': 'true' }, '✓') : null
              );
            })
          )
        )
      : null,

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
      : null,

    AppState.paletteLabel
      ? createElement('div', {
          id: 'palette-label',
          role: AppState.paletteLabel.mode === 'selected' ? 'status' : 'tooltip',
          className: [
            'palette-label',
            AppState.paletteLabel.mode === 'selected' ? 'is-selected' : '',
            AppState.paletteLabel.visible ? '' : 'is-leaving',
          ].filter(Boolean).join(' '),
          'aria-live': AppState.paletteLabel.mode === 'selected' ? 'polite' : 'off',
          'data-placement': AppState.paletteLabel.placement,
          style: `left:${AppState.paletteLabel.left}px;top:${AppState.paletteLabel.top}px;`,
        },
          createElement('strong', null, AppState.paletteLabel.name),
          createElement('span', null,
            AppState.paletteLabel.mode === 'selected' ? 'SELECTED' : AppState.paletteLabel.hex
          )
        )
      : null
  );
}
