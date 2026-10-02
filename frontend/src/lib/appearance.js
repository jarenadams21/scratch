const STORAGE_KEY = 'harbinger-appearance-v1';
const LEGACY_PALETTE_ALIASES = Object.freeze({
  blue: 'summer-sea',
});
let transitionTimer = null;

export const THEMES = Object.freeze(['light', 'dark']);
export const PALETTE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'ember', name: 'Rustic Orange', hex: '#E27452', check: '#18100D' }),
  Object.freeze({ id: 'moss', name: 'Sage Green', hex: '#88B795', check: '#101712' }),
  Object.freeze({ id: 'mainsail', name: 'Mainsail White', hex: '#E8DDC7', check: '#17130E' }),
  Object.freeze({ id: 'summer-sea', name: 'Summer Sea', hex: '#8190B2', check: '#11141C' }),
  Object.freeze({ id: 'sailor-red', name: 'Sailor Red', hex: '#973B36', check: '#FFF8F5' }),
  Object.freeze({ id: 'night-sky', name: 'Night Sky', hex: '#0A0B3A', check: '#F8F7EF' }),
  Object.freeze({ id: 'rrl-purple', name: 'RRL Purple', hex: '#5A405E', check: '#FFF8FC' }),
  Object.freeze({ id: 'maize', name: 'Maize Yellow', hex: '#D5AE4F', check: '#181307' }),
  Object.freeze({ id: 'hammond-khaki', name: 'Hammond Khaki', hex: '#A88F68', check: '#171108' }),
]);
export const PALETTES = Object.freeze(PALETTE_OPTIONS.map(option => option.id));
export const DEFAULT_APPEARANCE = Object.freeze({ theme: 'dark', palette: 'ember' });
export const PALETTE_LABELS = Object.freeze(Object.fromEntries(
  PALETTE_OPTIONS.map(option => [option.id, option.name])
));

export function normalizedAppearance(value) {
  const requestedPalette = LEGACY_PALETTE_ALIASES[value?.palette] || value?.palette;
  return {
    theme: THEMES.includes(value?.theme) ? value.theme : DEFAULT_APPEARANCE.theme,
    palette: PALETTES.includes(requestedPalette) ? requestedPalette : DEFAULT_APPEARANCE.palette,
  };
}

export function applyAppearance(value, persistLocal = true) {
  const appearance = normalizedAppearance(value);
  const root = document.documentElement;
  const changed = root.dataset.theme !== appearance.theme
    || root.dataset.palette !== appearance.palette;
  if (persistLocal && changed) {
    root.classList.add('appearance-settling');
    root.getBoundingClientRect();
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      root.classList.remove('appearance-settling');
    }, 190);
  }
  root.dataset.theme = appearance.theme;
  root.dataset.palette = appearance.palette;
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
