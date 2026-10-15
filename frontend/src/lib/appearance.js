const STORAGE_KEY = 'harbinger-appearance-v1';
const LEGACY_PALETTE_ALIASES = Object.freeze({
  blue: 'summer-sea',
  moss: 'rrl-olive',
  'rrl-purple': 'tony-plum',
});
let transitionTimer = null;

export const THEMES = Object.freeze(['light', 'dark']);
export const PALETTE_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'ember', name: 'Rustic Orange', hex: '#E27452', check: '#18100D',
    profile: 'kiln brick · oxidized steel',
  }),
  Object.freeze({
    id: 'rrl-olive', name: 'RRL Olive', hex: '#68684F', check: '#F2EFE8',
    profile: 'washed herringbone · field canvas',
  }),
  Object.freeze({
    id: 'mainsail', name: 'Mainsail White', hex: '#E8DDC7', check: '#17130E',
    profile: 'sailcloth · salt air · tarred rigging',
  }),
  Object.freeze({
    id: 'summer-sea', name: 'Summer Sea', hex: '#8190B2', check: '#11141C',
    profile: 'Massachusetts haze · weathered blue',
  }),
  Object.freeze({
    id: 'sailor-red', name: 'Sailor Red', hex: '#973B36', check: '#FFF8F5',
    profile: 'buoy paint · cranberry barn',
  }),
  Object.freeze({
    id: 'night-sky', name: 'Night Sky', hex: '#0A0B3A', check: '#F8F7EF',
    profile: 'Atlantic midnight · harbor lights',
  }),
  Object.freeze({
    id: 'tony-plum', name: 'Tony Plum', hex: '#27253D', check: '#F2EFE8',
    profile: 'blackened indigo · muted aubergine',
  }),
  Object.freeze({
    id: 'scarlette-pink', name: 'Scarlette Pink', hex: '#C38F98', check: '#2A1A1E',
    profile: 'faded Oxford · rose wool sweater · blush nylon',
  }),
  Object.freeze({
    id: 'industrial-charcoal', name: 'industrial charcoal', hex: '#30312E', check: '#F2EFE8',
    profile: 'carbon cloth · machined graphite',
  }),
  Object.freeze({
    id: 'maize', name: 'Maize Yellow', hex: '#D5AE4F', check: '#181307',
    profile: 'archival manila · dry field',
  }),
  Object.freeze({
    id: 'hammond-khaki', name: 'Hammond Khaki', hex: '#A88F68', check: '#171108',
    profile: 'workwear canvas · old paper',
  }),
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
  const themeColor = getComputedStyle(document.body || root).backgroundColor;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColor && themeColorMeta) themeColorMeta.setAttribute('content', themeColor);
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
