import { createElement } from '../engine/main.js';
import { isLoggedIn, logout } from '../lib/api.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { LoginForm } from './LoginForm.js';
import { EditorView } from './EditorView.js';
import { ArchiveView } from './ArchiveView.js';
import { AudioRecorder } from './AudioRecorder.js';
import { RecordingsView } from './RecordingsView.js';
import { AppState, updateState } from '../lib/state.js';
import { postLoader, audioLoader } from '../lib/loaders.js';

export function App() {
  const isAdmin        = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;

  postLoader.ensureLoaded();
  audioLoader.ensureLoaded();

  const toggleAdminPanel = () => updateState({ showAdminPanel: !showAdminPanel });

  const handleLoginSuccess = () => {
    updateState({ showAdminPanel: false, currentView: 'archive' });
    postLoader.reload();
    audioLoader.reload();
  };

  const handleLogout = () => {
    logout();
    updateState({ showAdminPanel: false, currentView: 'archive', selectedEntry: null, selectedAudio: null });
  };

  const switchView = (view) => updateState({ currentView: view, selectedEntry: null, selectedAudio: null });

  console.log('[App] Rendering - Admin:', isAdmin, 'View:', AppState.currentView);

  let workspaceContent;
  if (AppState.loading || AppState.audioLoading) {
    workspaceContent = createElement('div', { className: 'loading-state', key: 'loading' }, 'LOADING...');
  } else if (AppState.currentView === 'record' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'record-view' },
      createElement(AudioRecorder, { onTransmitted: () => { audioLoader.reload(); switchView('recordings'); } })
    );
  } else if (AppState.currentView === 'compose' && isAdmin) {
    workspaceContent = createElement('div', { className: 'view-wrapper', key: 'compose-view' },
      createElement(EditorView, { onPostCreated: () => { postLoader.reload(); switchView('archive'); } })
    );
  } else if (AppState.currentView === 'recordings') {
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

  return createElement('div', { className: 'harbinger' },
    createElement('header', { className: 'masthead-bar' },
      createElement('h1', { className: 'title-mark' }, 'HARBINGER'),
      createElement('nav', { className: 'nav-tabs' },

        isAdmin ? createElement('button', {
          onClick: () => switchView('compose'),
          className: AppState.currentView === 'compose' ? 'tab active' : 'tab',
        }, 'COMPOSE') : null,

        isAdmin ? createElement('button', {
          onClick: () => switchView('record'),
          className: AppState.currentView === 'record' ? 'tab active' : 'tab',
        }, 'RECORD') : null,

        createElement('button', {
          onClick: () => switchView('archive'),
          className: AppState.currentView === 'archive' ? 'tab active' : 'tab',
        }, 'ARCHIVE'),

        createElement('button', {
          onClick: () => switchView('recordings'),
          className: AppState.currentView === 'recordings' ? 'tab active' : 'tab',
        }, 'RECORDINGS'),

        isAdmin
          ? createElement('button', { onClick: handleLogout, className: 'tab logout' }, 'EXIT')
          : createElement('button', { onClick: toggleAdminPanel, className: 'tab admin-btn' }, 'ADMIN')
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

    createElement('main', { className: 'workspace' }, workspaceContent)
  );
}
