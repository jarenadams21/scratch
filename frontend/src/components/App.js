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
 * Public archive by default, hidden admin login for compose access
 */
export function App() {
  const isAdmin = isLoggedIn();
  const showAdminPanel = AppState.showAdminPanel || false;
  
  // Load public posts on mount (no auth required)
  if (AppState.entries.length === 0 && !AppState.loading) {
    updateState({ loading: true });
    
    getPosts('admin@harbinger.app') // Load from your admin account
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
    
    getPosts('admin@harbinger.app')
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
  
  // Toggle admin panel
  const toggleAdminPanel = () => {
    updateState({ showAdminPanel: !showAdminPanel });
  };
  
  // Handle admin login success
  const handleLoginSuccess = () => {
    updateState({ 
      showAdminPanel: false,
      currentView: 'compose'
    });
    // Reload entries as admin
    reloadEntries();
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    updateState({ 
      showAdminPanel: false,
      currentView: 'archive',
      selectedEntry: null
    });
  };
  
  // Switch between compose/archive views (admin only)
  const switchView = (view) => {
    updateState({ 
      currentView: view,
      selectedEntry: null
    });
  };
  
  console.log('[App] Rendering - Admin:', isAdmin, 'View:', AppState.currentView);
  
  // Render main app UI
  return createElement('div', { className: 'harbinger' },
    // Header
    createElement('header', { className: 'masthead-bar' },
      createElement('h1', { className: 'title-mark'}, 'HARBINGER'),
      createElement('nav', { className: 'nav-tabs' },
        // Admin-only: Compose tab
        isAdmin ? createElement('button', { 
          onClick: () => switchView('compose'),
          className: AppState.currentView === 'compose' ? 'tab active' : 'tab'
        }, 'COMPOSE') : null,
        
        // Always show Archive
        createElement('button', { 
          onClick: () => switchView('archive'),
          className: AppState.currentView === 'archive' ? 'tab active' : 'tab'
        }, 'ARCHIVE'),
        
        // Admin button or Logout
        isAdmin 
          ? createElement('button', { 
              onClick: handleLogout,
              className: 'tab logout'
            }, 'EXIT')
          : createElement('button', { 
              onClick: toggleAdminPanel,
              className: 'tab admin-btn'
            }, 'ADMIN')
      )
    ),
    
    // Admin login panel (overlay)
    showAdminPanel && !isAdmin
      ? createElement('div', { className: 'admin-panel-overlay', key: 'admin-overlay' },
          createElement('div', { className: 'admin-panel' },
            createElement('button', { 
              onClick: toggleAdminPanel,
              className: 'close-btn'
            }, '✕'),
            createElement(LoginForm, { 
              onAuthSuccess: handleLoginSuccess,
              hideSignup: true
            })
          )
        )
      : null,
    
    // Main content area
    createElement('main', { className: 'workspace' },
      AppState.loading 
        ? createElement('div', { className: 'loading-state', key: 'loading' }, 'LOADING...')
        : AppState.currentView === 'compose' && isAdmin
          ? createElement('div', { className: 'view-wrapper', key: 'compose-view' },
              createElement(EditorView, { onPostCreated: reloadEntries })
            )
          : createElement('div', { className: 'view-wrapper', key: 'archive-view' },
              createElement(ArchiveView, { 
                entries: AppState.entries, 
                onDeleted: isAdmin ? reloadEntries : null  // Only admin can delete
              })
            )
    )
  );
}
