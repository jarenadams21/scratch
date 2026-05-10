import { createElement } from '../engine/main.js';
import { createPost } from '../lib/api.js';
import { AppState } from '../lib/state.js';
import { DEFAULT_VISIBILITY_FALLBACK } from './SettingsView.js';

export function EditorView({ onPostCreated }) {
  // Default audience comes from the admin's own trait. Falls back to
  // 'admins' (the system-wide cautious default) until they explicitly
  // change it under SETTINGS → DEFAULT AUDIENCE.
  const defaultVis = AppState.traits?.defaultVisibility ?? DEFAULT_VISIBILITY_FALLBACK;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title      = e.target.elements['title'].value.trim();
    const content    = e.target.elements['content'].value.trim();
    const visibility = e.target.elements['visibility'].value;
    if (!title || !content) {
      alert('Headline and body required');
      return;
    }
    try {
      await createPost(title, content, null, visibility);
      e.target.reset();
      if (onPostCreated) onPostCreated();
    } catch (err) {
      alert('Transmission failed: ' + err.message);
    }
  };

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return createElement('div', { className: 'editor-sheet' },
    createElement('div', { className: 'sheet-header' },
      createElement('span', { className: 'date-stamp' }, date.toUpperCase()),
      createElement('span', { className: 'date-stamp' }, 'COMPOSE')
    ),
    createElement('form', {
      className: 'typewriter-form',
      onSubmit: handleSubmit,
      // Remount the form if the resolved default changes mid-session — the
      // radio's `defaultChecked` doesn't reflect post-mount, so we need a
      // fresh DOM tree to apply the new default.
      key: `editor-${defaultVis}`,
    },
      createElement('input', {
        type: 'text',
        name: 'title',
        placeholder: 'HEADLINE',
        className: 'headline-input',
        autocomplete: 'off'
      }),
      createElement('textarea', {
        name: 'content',
        placeholder: 'Begin transmission...',
        className: 'body-text'
      }),
      createElement('div', { className: 'visibility-row' },
        createElement('span', { className: 'visibility-label' }, 'AUDIENCE'),
        createElement('label', { className: 'visibility-option' },
          createElement('input', {
            type: 'radio', name: 'visibility', value: 'public',
            defaultChecked: defaultVis === 'public',
          }),
          createElement('span', null, 'PUBLIC')
        ),
        createElement('label', { className: 'visibility-option' },
          createElement('input', {
            type: 'radio', name: 'visibility', value: 'admins',
            defaultChecked: defaultVis === 'admins',
          }),
          createElement('span', null, 'ADMINS ONLY')
        )
      ),
      createElement('div', { className: 'editor-footer' },
        createElement('button', {
          type: 'submit',
          className: 'publish-btn'
        }, '▶  TRANSMIT')
      )
    )
  );
}
