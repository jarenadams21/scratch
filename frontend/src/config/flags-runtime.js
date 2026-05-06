const raw = {
  dev: {
    enabled: true,
    mock_user:  'dev@example.com',
    mock_token: 'dev-token-local',
    delay_ms:   200,
  },
  api: {
    base_url: 'http://localhost:3000',
  },
};

export const CONFIG = {
  DEV:        raw.dev.enabled,
  API_URL:    raw.api.base_url,
  MOCK_USER:  raw.dev.mock_user,
  MOCK_TOKEN: raw.dev.mock_token,
  DEV_DELAY:  raw.dev.delay_ms,
};

export function devLog(...args) {
  if (CONFIG.DEV) console.log('[DEV]', ...args);
}
