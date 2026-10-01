const STORAGE_KEY = 'harbinger-appearance-v1';

export const THEMES = Object.freeze(['light', 'dark']);
export const PALETTES = Object.freeze(['ember', 'blue', 'moss']);
export const DEFAULT_APPEARANCE = Object.freeze({ theme: 'dark', palette: 'ember' });
export const PALETTE_LABELS = Object.freeze({
  ember: 'Ember',
  blue: 'Blue',
  moss: 'Moss',
});

export function normalizedAppearance(value) {
  return {
    theme: THEMES.includes(value?.theme) ? value.theme : DEFAULT_APPEARANCE.theme,
    palette: PALETTES.includes(value?.palette) ? value.palette : DEFAULT_APPEARANCE.palette,
  };
}

export function applyAppearance(value, persistLocal = true) {
  const appearance = normalizedAppearance(value);
  document.documentElement.dataset.theme = appearance.theme;
  document.documentElement.dataset.palette = appearance.palette;
  if (persistLocal) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      // Appearance still applies for this page when browser storage is blocked.
    }
  }
  return appearance;
}

export function readLocalAppearance() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizedAppearance(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}
