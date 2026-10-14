import { createElement } from '../engine/main.js';
import { updateState } from '../lib/state.js';

let returnFocusNode = null;
let activeImageUrl = null;
let focusOnOpen = false;

// In-app full-screen image viewer. The image URL never goes into the browser
// address bar or history, and we set referrerpolicy=no-referrer on the <img>
// so the request doesn't leak Harbinger's URL out to S3 either. Tap the
// backdrop or the X to close; nothing else is interactive.
export function Lightbox({ image }) {
  if (!image) return null;
  if (activeImageUrl !== image.url) {
    activeImageUrl = image.url;
    returnFocusNode = typeof document !== 'undefined' ? document.activeElement : null;
    focusOnOpen = true;
  }
  const close = () => {
    activeImageUrl = null;
    const target = returnFocusNode;
    returnFocusNode = null;
    updateState({ lightboxImage: null });
    requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));
  };
  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
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
    className: 'lightbox-backdrop',
    onClick: (e) => { if (e.target === e.currentTarget) close(); },
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': image.caption ? `Image viewer: ${image.caption}` : 'Image viewer',
    onKeyDown: handleKeyDown,
    ref: node => {
      if (node && focusOnOpen) {
        focusOnOpen = false;
        requestAnimationFrame(() => node.querySelector('.lightbox-close')?.focus());
      }
    },
  },
    createElement('button', {
      type: 'button',
      className: 'lightbox-close',
      onClick: close,
      'aria-label': 'Close photo',
      title: 'Close',
    }, '✕'),
    createElement('img', {
      src: image.url,
      alt: image.alt || 'Photo',
      className: 'lightbox-img',
      referrerpolicy: 'no-referrer',
      // Don't include in browser drag/cache surfaces beyond what's needed.
      draggable: 'false',
    }),
    image.caption
      ? createElement('p', { className: 'lightbox-caption' }, image.caption)
      : null
  );
}
