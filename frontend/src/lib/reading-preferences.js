const STORAGE_KEY = 'harbinger-reading-v1';

export const READING_SIZE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'small', label: 'Small' }),
  Object.freeze({ id: 'medium', label: 'Medium' }),
  Object.freeze({ id: 'large', label: 'Large' }),
]);

export const READING_SIZES = Object.freeze(READING_SIZE_OPTIONS.map(option => option.id));
export const DEFAULT_READING_SIZE = 'medium';

export function normalizedReadingSize(value) {
  return READING_SIZES.includes(value) ? value : DEFAULT_READING_SIZE;
}

export function applyReadingSize(value, persistLocal = true) {
  const size = normalizedReadingSize(value);
  document.documentElement.dataset.readingSize = size;
  if (persistLocal) {
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // The preference still applies for this page when storage is blocked.
    }
  }
  return size;
}

export function readLocalReadingSize() {
  try {
    return normalizedReadingSize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_READING_SIZE;
  }
}
