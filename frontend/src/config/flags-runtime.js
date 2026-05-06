export const CONFIG = {
  DEV:        false,
  API_URL:    'http://localhost:3000',
  MOCK_USER:  '',
  MOCK_TOKEN: '',
  DEV_DELAY:  0,
};

export function devLog(...args) {
  if (CONFIG.DEV) console.log('[DEV]', ...args);
}
