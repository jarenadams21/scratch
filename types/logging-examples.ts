/**
 * Logging System Usage Examples
 * =============================
 * 
 * This file demonstrates the improved type-safe logging system
 */

import { UTILITIES, LOG_LEVEL } from "./utilities";
import { Message, REGISTERED_NUM_MAP } from "./types";

// Create a logger instance for this file (RECOMMENDED APPROACH)
const logger = UTILITIES.createLogger("logging-examples.ts");

// ============================================================================
// METHOD 1: Using createLogger (RECOMMENDED)
// ============================================================================
// This automatically attaches the filename to all log calls
export function exampleUsingLogger() {
    const message: Message = {
        command: "exampleCommand",
        payload: {
            content: "Using logger instance",
            num: REGISTERED_NUM_MAP["init"]
        }
    };

    // Clean API - filename is automatically included
    logger.info(message);
    logger.warn(message);
    logger.error(message);
    logger.debug(message);
}

// ============================================================================
// METHOD 2: Direct LOG_WITH_LEVEL calls
// ============================================================================
// This is type-safe and validates filename format at compile time
export function exampleDirectCall() {
    const message: Message = {
        command: "directCallExample",
        payload: {
            content: "Direct logging call",
            num: REGISTERED_NUM_MAP["get_text"]
        }
    };

    // Type-safe: only accepts valid source file patterns (*.ts, *.tsx, *.js, *.jsx)
    UTILITIES.LOG_WITH_LEVEL("logging-examples.ts", LOG_LEVEL.INFO, message);
    
    // ❌ These would cause compile errors:
    // UTILITIES.LOG_WITH_LEVEL("string", LOG_LEVEL.INFO, message);  // Wrong literal
    // UTILITIES.LOG_WITH_LEVEL("file.txt", LOG_LEVEL.INFO, message); // Wrong extension
}

// ============================================================================
// METHOD 3: Multiple files with separate logger instances
// ============================================================================
export function createModularLoggers() {
    // Each module can have its own logger
    const dbLogger = UTILITIES.createLogger("database.ts");
    const apiLogger = UTILITIES.createLogger("api-client.ts");
    
    dbLogger.info({
        command: "queryDatabase",
        payload: {
            content: "Fetching user data",
            num: REGISTERED_NUM_MAP["get_text"]
        }
    });
    
    apiLogger.error({
        command: "apiRequest",
        payload: {
            content: "Request failed",
            num: REGISTERED_NUM_MAP["init"]
        }
    });
}

// ============================================================================
// BENEFITS OF THIS APPROACH
// ============================================================================
//*
