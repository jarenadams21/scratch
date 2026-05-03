// Application flags loaded from config/flags.json
// See config/flags.yml for documentation and config/flags.json for runtime values
import { flagsConfig } from './flags-runtime.js';

// Simple flag accessors for backward compatibility
export const FLAGS = {
    DEBUG: flagsConfig.debug.enabled,
    VERBOSE: flagsConfig.verbose.enabled,
    DEV: flagsConfig.dev.enabled
};

// Full configuration object with all settings
export const CONFIG = {
    // Dev mode
    DEV: flagsConfig.dev.enabled,
    DEV_USER: flagsConfig.dev.mock_user,
    DEV_TOKEN: flagsConfig.dev.mock_token,
    DEV_DELAY: flagsConfig.dev.simulated_delay_ms,
    
    // Debug
    DEBUG: flagsConfig.debug.enabled,
    VERBOSE: flagsConfig.verbose.enabled,
    
    // Logging
    LOG_LEVEL: flagsConfig.logging.log_level,
    LOG_TO_CONSOLE: flagsConfig.logging.log_to_console,
    LOG_MESSAGES: flagsConfig.logging.log_messages,
    
    // API
    API_URL: flagsConfig.api.base_url,
    API_TIMEOUT: flagsConfig.api.timeout_ms,
    API_RETRY: flagsConfig.api.retry_attempts,
    
    // UI
    SHOW_DEV_BADGES: flagsConfig.ui.show_dev_badges,
    AUTO_SAVE_INTERVAL: flagsConfig.ui.auto_save_interval_ms,
    MAX_TITLE_LENGTH: flagsConfig.ui.max_title_length,
    MAX_CONTENT_LENGTH: flagsConfig.ui.max_content_length,
    
    // Database
    DB_TABLE: flagsConfig.database.table_name,
    DB_REGION: flagsConfig.database.region,
    
    // Auth
    AUTH_EXPIRES: flagsConfig.auth.jwt_expires_in,
    REQUIRE_EMAIL_VERIFY: flagsConfig.auth.require_email_verification,
};

// Helper to check if in development mode
export function isDev(): boolean {
    return CONFIG.DEV;
}

// Helper to check if debugging is enabled
export function isDebug(): boolean {
    return CONFIG.DEBUG || CONFIG.VERBOSE;
}

// Log with level checking
export function devLog(...args: any[]): void {
    if (CONFIG.DEV && CONFIG.LOG_TO_CONSOLE) {
        console.log('[DEV]', ...args);
    }
}

export function debugLog(...args: any[]): void {
    if (CONFIG.DEBUG && CONFIG.LOG_TO_CONSOLE) {
        console.log('[DEBUG]', ...args);
    }
}