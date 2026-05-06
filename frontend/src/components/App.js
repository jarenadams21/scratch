import { createElement } from '../engine/main.js';
import { isLoggedIn, logout, getPosts, getAudioPosts } from '../lib/api.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { MOCK_USER } from '../data/mock-data.js';
import { LoginForm } from './LoginForm.js';
import { EditorView } from './EditorView.js';
import { ArchiveView } from './ArchiveView.js';
import { AudioRecorder } from './AudioRecorder.js';
import { RecordingsView } from './RecordingsView.js';
import { AppState, updateState } from '../lib/state.js';

export function App() {
  const isAdmin        = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;

  // ── Load paper entries once ──────────────────────────────────────────────
  if (!AppState.postsLoaded && !AppState.loading) {
    updateState({ loading: true, postsLoaded: true });
    getPosts()
      .then(entries => updateState({ entries, loading: false, error: null }))
      .catch(err   => updateState({ error: err.message, loading: false }));
  }

  // ── Load audio entries once ──────────────────────────────────────────────
  if (!AppState.audioLoaded && !AppState.audioLoading) {
    updateState({ audioLoading: true, audioLoaded: true });
    getAudioPosts()
      .then(audioEntries => updateState({ audioEntries, audioLoading: false }))
      .catch(()           => updateState({ audioLoading: false }));
  }

  const reloadEntries = () => {
    updateState({ loading: true });
    getPosts()
      .then(entries => updateState({ entries, loading: false, error: null }))
      .catch(err   => updateState({ error: err.message, loading: false }));
  };

  const reloadAudio = () => {
    updateState({ audioLoading: true });
    getAudioPosts()
      .then(audioEntries => updateState({ audioEntries, audioLoading: false }))
      .catch(()           => updateState({ audioLoading: false }));
  };

  const toggleAdminPanel = () => updateState({ showAdminPanel: !showAdminPanel });

  const handleLoginSuccess = () => {
    updateState({ showAdminPanel: false, currentView: 'archive' });
    reloadEntries();
    reloadAudio();
  };

  const handleLogout = () => {
    logout();
    updateState({ showAdminPanel: false, currentView: 'archive', selectedEntry: null, selectedAudio: null });
  };

  const switchView = (view) => updateState({ currentView: view, selectedEntry: null, selectedAudio: null });

  console.log('[App] Rendering - Admin:', isAdmin, 'View:', AppState.currentView);

  // ── Workspace content ────────────────────────────────────────────────────
  let workspaceContent;
  if (AppState.loading || AppState.audioLoading) {
    workspaceContent = createElement('div', { className: 'loading-state', key: 'loading' }, 'LOADING...');
  } else if (AppState.currentView === 'record' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'record-view' },
      createElement(AudioRecorder, { onTransmitted: () => { reloadAudio(); switchView('recordings'); } })
    );
  } else if (AppState.currentView === 'compose' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'compose-view' },
      createElement(EditorView, { onPostCreated: () => { reloadEntries(); switchView('archive'); } })
    );
  } else if (AppState.currentView === 'recordings') {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'recordings-view' },
      createElement(RecordingsView, {
        entries: AppState.audioEntries,
        onDeleted: reloadAudio,
      })
    );
  } else {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'archive-view' },
      createElement(ArchiveView, {
        entries: AppState.entries,
        onDeleted: isAdmin ? reloadEntries : null,
      })
    );
  }

  return createElement('div', { className: 'harbinger' },
    createElement('header', { className: 'masthead-bar' },
      createElement('h1', { className: 'title-mark' }, 'HARBINGER'),
      createElement('nav', { className: 'nav-tabs' },

        // Admin compose tabs
        isAdmin ? createElement('button', {
          onClick: () => switchView('compose'),
          className: AppState.currentView === 'compose' ? 'tab active' : 'tab',
        }, 'COMPOSE') : null,

        isAdmin ? createElement('button', {
          onClick: () => switchView('record'),
          className: AppState.currentView === 'record' ? 'tab active' : 'tab',
        }, 'RECORD') : null,

        // Always visible
        createElement('button', {
          onClick: () => switchView('archive'),
          className: AppState.currentView === 'archive' ? 'tab active' : 'tab',
        }, 'ARCHIVE'),

        createElement('button', {
          onClick: () => switchView('recordings'),
          className: AppState.currentView === 'recordings' ? 'tab active' : 'tab',
        }, 'RECORDINGS'),

        // Auth tab
        isAdmin
          ? createElement('button', { onClick: handleLogout, className: 'tab logout' }, 'EXIT')
          : createElement('button', { onClick: toggleAdminPanel, className: 'tab admin-btn' }, 'ADMIN')
      )
    ),

    // Admin login overlay
    showAdminPanel && !isAdmin
      ? createElement('div', { className: 'admin-panel-overlay', key: 'admin-overlay' },
          createElement('div', { className: 'admin-panel' },
            createElement('button', { onClick: toggleAdminPanel, className: 'close-btn' }, '✕'),
            createElement(LoginForm, { onAuthSuccess: handleLoginSuccess, hideSignup: true })
          )
        )
      : null,

    createElement('main', { className: 'workspace' }, workspaceContent)
  );
}
