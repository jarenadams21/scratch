// Application flags - Frontend runtime config
// Auto-generated from config/flags.json

export const flagsConfig = {
  "dev": {
    "enabled": true,
    "description": "Development mode with mock authentication and data",
    "mock_user": "admin@harbinger.dev",
    "mock_token": "mock-dev-token-12345",
    "simulated_delay_ms": 300
  },
  "debug": {
    "enabled": false,
    "description": "Enable detailed console logging"
  },
  "verbose": {
    "enabled": false,
    "description": "Enable verbose output for all operations"
  },
  "logging": {
    "log_level": "INFO",
    "log_to_console": true,
    "log_messages": true,
    "description": "Configure application-wide logging behavior"
  },
  "api": {
    "base_url": "http://localhost:3000",
    "timeout_ms": 30000,
    "retry_attempts": 3,
    "description": "Backend API connection settings"
  },
  "ui": {
    "show_dev_badges": true,
    "auto_save_interval_ms": 60000,
    "max_title_length": 100,
    "max_content_length": 10000,
    "description": "User interface behavior settings"
  },
  "database": {
    "table_name": "journal-app",
    "region": "us-east-1",
    "description": "DynamoDB connection settings"
  },
  "auth": {
    "jwt_expires_in": "7d",
    "require_email_verification": false,
    "description": "Authentication configuration"
  }
};

// Simple FLAGS for easy access
export const FLAGS = {
  DEV: flagsConfig.dev.enabled,
  DEBUG: flagsConfig.debug.enabled,
  VERBOSE: flagsConfig.verbose.enabled,
};

// Full CONFIG object for detailed settings
export const CONFIG = {
  DEV: flagsConfig.dev.enabled,
  DEBUG: flagsConfig.debug.enabled,
  VERBOSE: flagsConfig.verbose.enabled,
  LOG_LEVEL: flagsConfig.logging.log_level,
  LOG_TO_CONSOLE: flagsConfig.logging.log_to_console,
  LOG_MESSAGES: flagsConfig.logging.log_messages,
  API_URL: flagsConfig.api.base_url,
  API_TIMEOUT: flagsConfig.api.timeout_ms,
  API_RETRY: flagsConfig.api.retry_attempts,
  SHOW_DEV_BADGES: flagsConfig.ui.show_dev_badges,
  AUTO_SAVE_INTERVAL: flagsConfig.ui.auto_save_interval_ms,
  MAX_TITLE_LENGTH: flagsConfig.ui.max_title_length,
  MAX_CONTENT_LENGTH: flagsConfig.ui.max_content_length,
  DB_TABLE: flagsConfig.database.table_name,
  DB_REGION: flagsConfig.database.region,
  JWT_EXPIRES: flagsConfig.auth.jwt_expires_in,
  REQUIRE_EMAIL_VERIFICATION: flagsConfig.auth.require_email_verification,
  // DEV mode specifics
  MOCK_USER: flagsConfig.dev.mock_user,
  MOCK_TOKEN: flagsConfig.dev.mock_token,
  SIMULATED_DELAY: flagsConfig.dev.simulated_delay_ms,
};

// Helper functions
export function devLog(...args) {
  if (CONFIG.DEV) {
    console.log('[DEV]', ...args);
  }
}

export function debugLog(...args) {
  if (CONFIG.DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}
