#!/usr/bin/env ts-node
/**
 * Pipeline Validation Script for Logging
 * ======================================
 * 
 * This script validates that all LOG_WITH_LEVEL calls use the correct filename.
 * Use in CI/CD pipeline to ensure logging consistency.
 * 
 * Usage:
 *   ts-node scripts/validate-logging.ts
 *   
 * Exit codes:
 *   0 - All logging calls are valid
 *   1 - Invalid logging calls found
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationError {
    file: string;
    line: number;
    issue: string;
    code: string;
}

const errors: ValidationError[] = [];

/**
 * Extract filename from full path
 */
function getFilename(filePath: string): string {
    return path.basename(filePath);
}

/**
 * Check if a file uses LOG_WITH_LEVEL correctly
 */
function validateFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const filename = getFilename(filePath);
    
    // Pattern to match LOG_WITH_LEVEL calls
    const logPattern = /UTILITIES\.LOG_WITH_LEVEL\s*\(\s*["']([^"']+)["']/g;
    
    lines.forEach((line: string, index: number) => {
        let match;
        while ((match = logPattern.exec(line)) !== null) {
            const usedFilename = match[1];
            
            // Validate that the filename matches
            if (usedFilename !== filename) {
                errors.push({
                    file: filePath,
                    line: index + 1,
                    issue: `Incorrect filename in LOG_WITH_LEVEL. Expected "${filename}", got "${usedFilename}"`,
                    code: line.trim()
                });
            }
            
            // Validate file extension
            if (!usedFilename.match(/\.(ts|tsx|js|jsx)$/)) {
                errors.push({
                    file: filePath,
                    line: index + 1,
                    issue: `Invalid file extension in LOG_WITH_LEVEL: "${usedFilename}"`,
                    code: line.trim()
                });
            }
        }
    });
}

/**
 * Recursively find all TypeScript/JavaScript files
 */
function findSourceFiles(dir: string): string[] {
    const files: string[] = [];
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules and other common excluded directories
        if (entry.isDirectory() && !['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
            files.push(...findSourceFiles(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Main validation function
 */
function main() {
    const projectRoot = path.resolve(__dirname, '..');
    console.log(`🔍 Validating logging calls in: ${projectRoot}\n`);
    
    const sourceFiles = findSourceFiles(projectRoot);
    console.log(`📁 Found ${sourceFiles.length} source files\n`);
    
    sourceFiles.forEach(validateFile);
    
    if (errors.length === 0) {
        console.log('✅ All logging calls are valid!\n');
        process.exit(0);
    } else {
        console.error(`❌ Found ${errors.length} logging validation error(s):\n`);
        
        errors.forEach((error, index) => {
            console.error(`${index + 1}. ${error.file}:${error.line}`);
            console.error(`   ${error.issue}`);
            console.error(`   Code: ${error.code}\n`);
        });
        
        process.exit(1);
    }
}

// Run validation
main();
