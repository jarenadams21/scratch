import { createElement, render, useState } from './main.tsx';
import { signup, login, logout, isLoggedIn, getPosts, createPost, deletePost } from './api.js';

// ─── State ──────────────────────────────────────────────────────────────────

let state = {
  user: null,
  entries: [],
  loading: false,
  error: null,
  view: 'edit', // 'edit' or 'archive'
};

// ─── Components ─────────────────────────────────────────────────────────────

function LoginForm({ onLogin, onSignup }) {
  let emailInput;
  let passwordInput;
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(emailInput.value, passwordInput.value);
      onLogin();
    } catch (err) {
      alert('Invalid credentials');
    }
  };
  
  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await signup(emailInput.value, passwordInput.value);
      onSignup();
    } catch (err) {
      alert('Account creation failed');
    }
  };
  
  return createElement('div', { className: 'typewriter-login' },
    createElement('div', { className: 'paper-sheet' },
      createElement('h1', { className: 'masthead' }, 'HARBINGER'),
      createElement('div', { className: 'subhead' }, 'A Journal of Thought'),
      createElement('div', { className: 'login-line' }, '─────────────────────'),
      createElement('form', { className: 'credentials' },
        createElement('input', {
          type: 'email',
          placeholder: 'OPERATOR',
          ref: (el) => emailInput = el,
          className: 'typewriter-input'
        }),
        createElement('input', {
          type: 'password',
          placeholder: 'PASSWORD',
          ref: (el) => passwordInput = el,
          className: 'typewriter-input'
        }),
        createElement('div', { className: 'button-row' },
          ditorView({ onSubmit }) {
  let titleInput;
  let contentInput;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const title = titleInput.value;
    const content = contentInput.value;
    
    if (!title || !content) return;
    
    try {
      await createPost(title, content, null);
      titleInput.value = '';
      contentInput.value = '';
      onSubmit();
    } catch (err) {
      alert('Transmission failed');
    }
  };
  
  const date = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return createElement('div', { className: 'editor-sheet' },
    createElement('div', { className: 'sheet-header' },
      createElement('div', { className: 'date-stamp' }, date.toUpperCase())
    ),
    createElement('form', { onSubmit: handleSubmit, className: 'typewriter-form' },
      createElement('input', {
        type: 'text',
        placeholder: 'HEADLINE',
        ref: (el) => titleInput = el,
        className: 'headline-input'
      }),
      createElement('textarea', {
        placeholder: 'Begin typing...',
        rows: '20',
        ref: (el) => contentInput = el,
        className: 'body-text'
      }),
      createElement('button', { 
        type: 'submit',
        className: 'publish-btn'
      }, '▶ PUBLISH')
    ArchiveEntry({ entry, onDelete }) {
  const handleDelete = async () => {
    if (!confirm('Destroy this record?')) return;
    
    try {
      await deletePost(entry.entryId, entry.createdAt);
      onDelete();
    } catch (err) {
      alert('Deletion failed');
    }
  };
  
  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  return createElement('div', { className: 'archive-entry' },
    createElement('div', { className: 'archive-header' },
      createElement('h3', { className: 'archive-title' }, entry.title.toUpperCase()),
      createElement('div', { className: 'archive-date' }, date.toUpperCase())
    ),
    createElement('div', { className: 'archive-body' }, entry.content),
    createElement('button', { 
      onClick: handleDelete, 
      className: 'destroy-btn' 
    }, 'X')
  );
}

function ArchiveView({ entries, onDelete }) {
  if (!entries || entries.length === 0) {
    return createElement('div', { className: 'archive-sheet' },
      createElement('div', { className: 'empty-archive' }, 'NO RECORDS FOUND')
    );
  }
  
  return createElement('div', { className: 'archive-sheet' },
    createElement('div', { className: 'archive-header-bar' },
      createElement('h2', null, 'ARCHIVES'),
      createElement('div', { className: 'record-count' }, `${entries.length} RECORDS`)
    ),
    createElement('div', { className: 'archive-list' },
      ...entries.map(entry => ArchiveEntry({ entry, onDelete }))
    
  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    
    try {
      await deletePost(entry.entryId, entry.createdAt);
      onDelete();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };
  
  const date = new Date(entry.createdAt).toLocaleDateString();
  
  return createElement('div', { className: 'entry' },
    createElement('h3', null, entry.title),
    createElement('div', { className: 'meta' },
      entry.mood && `${entry.mood} · `,
      date
    ),
    createElement('p', null, entry.content),
  const switchView = (view) => {
    state.view = view;
    renderApp();
  };
  
  return createElement('div', { className: 'harbinger' },
    createElement('header', { className: 'masthead-bar' },
      createElement('h1', { className: 'title-mark' }, 'HARBINGER'),
      createElement('nav', { className: 'nav-tabs' },
        createElement('button', { 
          onClick: () => switchView('edit'),
          className: state.view === 'edit' ? 'tab active' : 'tab'
        }, 'COMPOSE'),
        createElement('button', { 
          onClick: () => switchView('archive'),
          className: state.view === 'archive' ? 'tab active' : 'tab'
        }, 'ARCHIVE'),
        createElement('button', { 
          onClick: handleLogout,
          className: 'tab logout'
        }, 'EXIT')
      )
    ),
    createElement('main', { className: 'workspace' },
      state.loading 
        ? createElement('div', { className: 'loading-state' }, 'LOADING...')
        : state.view === 'edit'
          ? EditorView({ onSubmit: reloadEntries })
          : ArchiveView({ entries: state.entries, onDelete: reloadEntries }
  // Load posts if needed
  if (state.entries.length === 0 && !state.loading) {
    state.loading = true;
    getPosts()
      .then(entries => {
        state.entries = entries;
        state.loading = false;
        renderApp();
      })
      .catch(err => {
        state.error = err.message;
        state.loading = false;
        renderApp();
      });
  }
  
  const reloadEntries = () => {
    state.loading = true;
    getPosts()
      .then(entries => {
        state.entries = entries;
        state.loading = false;
        renderApp();
      });
  };
  
  const handleLogout = () => {
    logout();
    state.entries = [];
    renderApp();
  };
  
  return createElement('div', { className: 'app' },
    createElement('header', null,
      createElement('h1', null, '📔 Journal'),
      createElement('button', { onClick: handleLogout }, 'Logout')
    ),
    createElement('main', null,
      EntryForm({ onSubmit: reloadEntries }),
      createElement('div', { className: 'entries' },
        state.loading && createElement('p', null, 'Loading...'),
        state.entries.map(entry =>
          Entry({ entry, onDelete: reloadEntries })
        )
      )
    )
  );
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderApp() {
  render(App(), document.getElementById('root'));
}

renderApp();
