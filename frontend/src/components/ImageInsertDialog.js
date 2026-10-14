import { createElement } from '../engine/main.js';
import { uploadWritingImage } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

let pendingInsert = null;
let focusDialogOnOpen = false;

export function openImageInsert(onInsert, options = {}) {
  pendingInsert = {
    onInsert,
    options,
    returnFocus: typeof document !== 'undefined' ? document.activeElement : null,
  };
  focusDialogOnOpen = true;
  updateState({ imageInsertOpen: true });
}

function closeImageInsert(restoreFocus = true) {
  const returnFocus = pendingInsert?.returnFocus;
  pendingInsert = null;
  updateState({ imageInsertOpen: false });
  if (restoreFocus) requestAnimationFrame(() => returnFocus?.focus?.({ preventScroll: true }));
}

export function imageDirective(image) {
  const fields = {
    url: String(image.imageUrl || ''),
    key: String(image.imageKey || ''),
    alt: image.decorative ? '' : String(image.alt || ''),
    caption: String(image.caption || '').replace(/\r?\n/g, ' '),
    decorative: image.decorative ? '1' : '0',
  };
  const attributes = Object.entries(fields)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join(' ');
  return `:::image ${attributes} :::`;
}

export function insertImageDirective(textarea, insertAt, image) {
  const directive = imageDirective(image);
  const before = textarea.value.slice(0, insertAt);
  const after = textarea.value.slice(insertAt);
  const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n\n' : '\n';
  const inserted = `${prefix}${directive}${suffix}`;
  textarea.value = `${before}${inserted}${after}`;
  const caret = insertAt + inserted.length;
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(caret, caret);
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

export function replaceImageDirective(content, range, image) {
  const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n');
  lines.splice(range.startLine, range.endLine - range.startLine + 1, imageDirective(image));
  return lines.join('\n');
}

export function ImageInsertDialog() {
  if (!AppState.imageInsertOpen || !pendingInsert) return null;
  const submit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const file = data.get('image');
    const decorative = data.get('decorative') === 'on';
    const alt = String(data.get('alt') || '').trim();
    if (!decorative && !alt) {
      alert('Describe the image for readers using assistive technology, or mark it decorative.');
      return;
    }
    try {
      submitButton.disabled = true;
      submitButton.textContent = 'UPLOADING…';
      const uploaded = await uploadWritingImage(file);
      const image = {
        ...uploaded,
        alt,
        decorative,
        caption: String(data.get('caption') || '').trim(),
      };
      const callback = pendingInsert?.onInsert;
      closeImageInsert(false);
      callback?.(image);
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = 'UPLOAD & INSERT';
      alert(`Could not upload image: ${error.message}`);
    }
  };
  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeImageInsert();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'
    )];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createElement('div', {
    className: 'image-insert-overlay',
    role: 'presentation',
    onClick: event => { if (event.target === event.currentTarget) closeImageInsert(); },
  },
    createElement('form', {
      className: 'image-insert-dialog',
      onSubmit: submit,
      onKeyDown: handleKeyDown,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'image-insert-title',
      ref: node => {
        if (node && focusDialogOnOpen) {
          focusDialogOnOpen = false;
          requestAnimationFrame(() => node.querySelector('input[type="file"]')?.focus());
        }
      },
    },
      createElement('header', null,
        createElement('div', null,
          createElement('span', null, 'MEDIA INSERT / MANAGED UPLOAD'),
          createElement('h2', { id: 'image-insert-title' }, 'Insert image')
        ),
        createElement('button', { type: 'button', onClick: closeImageInsert }, 'CLOSE')
      ),
      createElement('div', { className: 'image-insert-fields' },
        createElement('label', null,
          createElement('span', null, 'IMAGE FILE'),
          createElement('input', {
            type: 'file',
            name: 'image',
            accept: 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif',
            required: true,
          })
        ),
        createElement('label', null,
          createElement('span', null, 'ALT TEXT'),
          createElement('textarea', {
            name: 'alt',
            rows: 3,
            maxLength: 500,
            placeholder: 'Describe what matters in the image.',
          })
        ),
        createElement('label', { className: 'image-decorative-toggle' },
          createElement('input', { type: 'checkbox', name: 'decorative' }),
          createElement('span', null, 'DECORATIVE IMAGE — HIDE FROM SCREEN READERS')
        ),
        createElement('label', null,
          createElement('span', null, 'CAPTION (OPTIONAL)'),
          createElement('input', { name: 'caption', maxLength: 500 })
        ),
      ),
      createElement('footer', null,
        createElement('p', null, 'Insert first, then drag and resize the image directly in Preview or the Edition canvas.'),
        createElement('div', null,
          createElement('button', { type: 'button', onClick: closeImageInsert }, 'CANCEL'),
          createElement('button', { type: 'submit' }, 'UPLOAD & INSERT')
        )
      )
    )
  );
}
