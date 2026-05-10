import { createElement } from '../engine/main.js';
import { updateState } from '../lib/state.js';

// In-app full-screen image viewer. The image URL never goes into the browser
// address bar or history, and we set referrerpolicy=no-referrer on the <img>
// so the request doesn't leak Harbinger's URL out to S3 either. Tap the
// backdrop or the X to close; nothing else is interactive.
export function Lightbox({ image }) {
  if (!image) return null;
  const close = () => updateState({ lightboxImage: null });

  return createElement('div', {
    className: 'lightbox-backdrop',
    onClick: (e) => { if (e.target === e.currentTarget) close(); },
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Photo viewer',
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
    })
  );
}
