import { createElement } from '../engine/main.js';
import { isLoggedIn, logout, getPosts } from '../lib/api.js';
import { CONFIG, devLog } from '../config/flags-runtime.js';
import { MOCK_USER } from '../data/mock-data.js';
import { LoginForm } from './LoginForm.js';
import { EditorView } from './EditorView.js';
import { ArchiveView } from './ArchiveView.js';
import { AppState, updateState } from '../lib/state.js';

/**
 * Main Application Component
 * Manages authentication, view routing, and data loading
 */
export function App() {
  // Auto-login in DEV mode
  if (CONFIG.DEV && !isLoggedIn()) {
    devLog('Auto-login as:', MOCK_USER.email);
    localStorage.setItem('authToken', MOCK_USER.token);
  }
  
  // Not logged in - show login form
  if (!isLoggedIn()) {
    return createElement(LoginForm, {
      onAuthSuccess: () => {
        updateState({ user: 'authenticated' });
      }
    });
  }
  
  // Load entries if needed (only once on mount)
  if (AppState.entries.length === 0 && !AppState.loading) {
    updateState({ loading: true });
    
    getPosts()
      .then(entries => {
        updateState({ 
          entries, 
          loading: false,
          error: null 
        });
      })
      .catch(err => {
        updateState({ 
          error: err.message, 
          loading: false 
        });
      });
  }
  
  // Reload entries after create/delete
  const reloadEntries = () => {
    updateState({ loading: true });
    
    getPosts()
      .then(entries => {
        updateState({ 
          entries, 
          loading: false,
          error: null 
        });
      })
      .catch(err => {
        updateState({ 
          error: err.message, 
          loading: false 
        });
      });
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    updateState({ 
      user: null, 
      entries: [],
      currentView: 'compose' 
    });
  };
  
  // Switch between compose/archive views
  const switchView = (view) => {
    updateState({ 
      currentView: view,
      selectedEntry: null // Clear selection when switching views
    });
  };
  
  // Dev indicator badge
  const devIndicator = CONFIG.DEV && CONFIG.SHOW_DEV_BADGES
    ? createElement('span', { className: 'dev-indicator' }, '[DEV]')
    : null;
  
  console.log('[App] Rendering with view:', AppState.currentView, 'logged in:', isLoggedIn());
  
  // Render main app UI
  return createElement('div', { className: 'harbinger' },
    // Header with navigation
    createElement('header', { className: 'masthead-bar' },
      createElement('h1', { className: 'title-mark' }, 'HARBINGER'),
      createElement('nav', { className: 'nav-tabs' },
        devIndicator,
        createElement('button', { 
          onClick: () => switchView('compose'),
          className: AppState.currentView === 'compose' ? 'tab active' : 'tab'
        }, 'COMPOSE'),
        createElement('button', { 
          onClick: () => switchView('archive'),
          className: AppState.currentView === 'archive' ? 'tab active' : 'tab'
        }, 'ARCHIVE'),
        createElement('button', { 
          onClick: handleLogout,
          className: 'tab logout'
        }, 'EXIT')
      )
    ),
    
    // Main content area - wrap each view in its own keyed container
    createElement('main', { className: 'workspace' },
      AppState.loading 
        ? createElement('div', { className: 'loading-state', key: 'loading' }, 'LOADING...')
        : AppState.currentView === 'compose'
          ? createElement('div', { className: 'view-wrapper', key: 'compose-view' },
              createElement(EditorView, { onPostCreated: reloadEntries })
            )
          : createElement('div', { className: 'view-wrapper', key: 'archive-view' },
              createElement(ArchiveView, { entries: AppState.entries, onDeleted: reloadEntries })
            )
    )
  );
}
