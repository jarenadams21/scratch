// Application flags - Frontend runtime config
// Auto-generated from config/flags.json

export const flagsConfig = {
  "dev": {
    "enabled": false,
    "description": "Development mode with mock authentication and data",
    "mock_user": "admin@harbinger.dev",
    "mock_token": "mock-dev-token-12345",
    "simulated_delay_ms": 0
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
    "log_to_console": false,
    "log_messages": false,
    "description": "Configure application-wide logging behavior"
  },
  "api": {
    "base_url": "https://lncwuj7103.execute-api.us-east-2.amazonaws.com",
    "timeout_ms": 30000,
    "retry_attempts": 3,
    "description": "Backend API connection settings"
  },
  "ui": {
    "show_dev_badges": false,
    "auto_save_interval_ms": 60000,
    "max_title_length": 100,
    "max_content_length": 10000,
    "description": "User interface behavior settings"
  },
  "database": {
    "table_name": "harbinger-prod",
    "region": "us-east-1",
    "description": "DynamoDB connection settings"
  },
  "auth": {
    "jwt_expires_in": "7d",
    "require_email_verification": false,
    "description": "Authentication configuration"
  }
};

// Convenience exports
export const CONFIG = {
  DEV: flagsConfig.dev.enabled,
  DEBUG: flagsConfig.debug.enabled,
  API_URL: flagsConfig.api.base_url,
  TIMEOUT: flagsConfig.api.timeout_ms,
  RETRY_ATTEMPTS: flagsConfig.api.retry_attempts,
  LOG_LEVEL: flagsConfig.logging.log_level,
  DB_TABLE: flagsConfig.database.table_name,
  MOCK_USER: flagsConfig.dev.mock_user,
  MOCK_TOKEN: flagsConfig.dev.mock_token,
  SIMULATED_DELAY: flagsConfig.dev.simulated_delay_ms,
  SHOW_DEV_BADGES: flagsConfig.ui.show_dev_badges,
};

// Development helpers
export function devLog(...args) {
  if (CONFIG.DEV && CONFIG.DEBUG) {
    console.log('[DEV]', ...args);
  }
}
