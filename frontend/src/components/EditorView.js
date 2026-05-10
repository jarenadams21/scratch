import { createElement } from '../engine/main.js';
import { createPost } from '../lib/api.js';

const VIS_PREF_KEY = 'harbinger.defaultVisibility';
function readDefaultVisibility() {
  try {
    const v = localStorage.getItem(VIS_PREF_KEY);
    return v === 'admins' ? 'admins' : 'public';
  } catch { return 'public'; }
}
function rememberVisibility(v) {
  try { localStorage.setItem(VIS_PREF_KEY, v); } catch { /* private mode etc. */ }
}

export function EditorView({ onPostCreated }) {
  const defaultVis = readDefaultVisibility();

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
      rememberVisibility(visibility);
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
    createElement('form', { className: 'typewriter-form', onSubmit: handleSubmit },
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
