// Environment configuration
// Loads from config/flags.json for consistency with frontend
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const flagsConfig = JSON.parse(
  readFileSync(join(__dirname, '../../config/flags.json'), 'utf8')
);

export const config = {
  // AWS Configuration
  AWS_REGION: process.env.AWS_REGION || flagsConfig.database.region,
  DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || flagsConfig.database.table_name,
  
  // Auth Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-key-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || flagsConfig.auth.jwt_expires_in,
  
  // API Configuration
  PORT: process.env.PORT || 3000,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
  API_TIMEOUT: flagsConfig.api.timeout_ms,
  
  // Flags
  DEV_MODE: process.env.DEV_MODE === 'true' || flagsConfig.dev.enabled,
  DEBUG: process.env.DEBUG === 'true' || flagsConfig.debug.enabled,
};
