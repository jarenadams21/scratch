// Application flags - Frontend runtime config
// Auto-generated from config/flags.json - DO NOT EDIT MANUALLY

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
