import { createElement } from '../engine/main.js';
import { createPost } from '../lib/api.js';

export function EditorView({ onPostCreated }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const title   = e.target.elements['title'].value.trim();
    const content = e.target.elements['content'].value.trim();
    if (!title || !content) {
      alert('Headline and body required');
      return;
    }
    try {
      await createPost(title, content, null);
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
      createElement('div', { className: 'editor-footer' },
        createElement('button', {
          type: 'submit',
          className: 'publish-btn'
        }, '▶  TRANSMIT')
      )
    )
  );
}
