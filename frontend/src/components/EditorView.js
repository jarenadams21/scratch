import { createElement } from '../main.js';
import { createPost } from '../api.js';

/**
 * EditorView Component
 * Compose new journal entries
 */
export function EditorView({ onPostCreated }) {
  // Store refs for form inputs - these will be set when DOM mounts
  let titleInput = null;
  let contentInput = null;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Guard: ensure refs are set
    if (!titleInput || !contentInput) {
      console.warn('Form inputs not yet mounted');
      return;
    }
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) {
      alert('Please provide both headline and content');
      return;
    }
    
    try {
      await createPost(title, content, null);
      
      // Clear form after successful post
      titleInput.value = '';
      contentInput.value = '';
      
      // Notify parent (triggers reload)
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (err) {
      alert('Transmission failed: ' + err.message);
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
    createElement('form', { 
      onSubmit: handleSubmit, 
      className: 'typewriter-form'
    },
      createElement('input', {
        type: 'text',
        placeholder: 'HEADLINE',
        ref: (el) => { titleInput = el; },
        className: 'headline-input'
      }),
      createElement('textarea', {
        placeholder: 'Begin typing...',
        rows: '20',
        ref: (el) => { contentInput = el; },
        className: 'body-text'
      }),
      createElement('button', { 
        type: 'submit',
        className: 'publish-btn'
      }, '▶ PUBLISH')
    )
  );
}
