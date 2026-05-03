#!/usr/bin/env node
/**
 * Config Loader
 * Reads config/flags.yml and generates config/flags.json for runtime use
 * Optionally injects environment variables
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load YAML config
const yamlPath = join(rootDir, 'config', 'flags.yml');
const jsonPath = join(rootDir, 'config', 'flags.json');

console.log('📦 Loading configuration...');

try {
  const yamlContent = readFileSync(yamlPath, 'utf8');
  const config = parseYaml(yamlContent);
  
  // Apply environment variable overrides
  if (process.env.DEV_MODE !== undefined) {
    config.dev.enabled = process.env.DEV_MODE === 'true';
  }
  
  if (process.env.DEBUG !== undefined) {
    config.debug.enabled = process.env.DEBUG === 'true';
  }
  
  if (process.env.API_URL) {
    config.api.base_url = process.env.API_URL;
  }
  
  if (process.env.DB_TABLE) {
    config.database.table_name = process.env.DB_TABLE;
  }
  
  if (process.env.DB_REGION) {
    config.database.region = process.env.DB_REGION;
  }
  
  // Write JSON output
  writeFileSync(jsonPath, JSON.stringify(config, null, 2), 'utf8');
  
  // Write TypeScript runtime config for frontend
  const tsPath = join(rootDir, 'types', 'flags-runtime.ts');
  const tsContent = `// Application flags - Frontend runtime config
// Auto-generated from config/flags.json - DO NOT EDIT MANUALLY

export const flagsConfig = ${JSON.stringify(config, null, 2)};
`;
  writeFileSync(tsPath, tsContent, 'utf8');
  
  console.log('✅ Configuration loaded from flags.yml');
  console.log(`   DEV mode: ${config.dev.enabled}`);
  console.log(`   DEBUG: ${config.debug.enabled}`);
  console.log(`   API URL: ${config.api.base_url}`);
  console.log(`   DB Table: ${config.database.table_name}`);
  
  // Display environment overrides if any were applied
  const overrides = [];
  if (process.env.DEV_MODE) overrides.push('DEV_MODE');
  if (process.env.DEBUG) overrides.push('DEBUG');
  if (process.env.API_URL) overrides.push('API_URL');
  if (process.env.DB_TABLE) overrides.push('DB_TABLE');
  if (process.env.DB_REGION) overrides.push('DB_REGION');
  
  if (overrides.length > 0) {
    console.log(`   Environment overrides: ${overrides.join(', ')}`);
  }
  
  console.log('');
  
} catch (error) {
  console.error('❌ Failed to load configuration:', error.message);
  process.exit(1);
}
