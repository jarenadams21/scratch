import { Message } from '../types/types';

export enum LOG_LEVEL {
    INFO,
    WARN,
    ERROR,
    DEBUG,
}

// Type-safe filename extractor
type ExtractFilename<T extends string> = T extends `${infer _Path}/${infer Filename}` 
    ? Filename 
    : T;

// Valid source file extensions
type ValidSourceFile = `${string}.ts` | `${string}.tsx` | `${string}.js` | `${string}.jsx`;

export const UTILITIES = {
    DEV_LOG: (message: Message) => {
        console.log(message)
    },
    
    LOG_WITH_LEVEL: <T extends ValidSourceFile>(fileFrom: T, level: LOG_LEVEL, message: Message) => {
        if (Object.values(LOG_LEVEL).includes(level)) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${LOG_LEVEL[level]}] [${fileFrom}]`, message)
        } else {
            // function check to not allow this to build
            throw new Error(`Log level ${level} is not valid and will prevent build.`);
        }
    },
    
    // Automatic filename capture helper
    createLogger: <T extends ValidSourceFile>(fileName: T) => {
        return {
            log: (level: LOG_LEVEL, message: Message) => {
                UTILITIES.LOG_WITH_LEVEL(fileName, level, message);
            },
            info: (message: Message) => {
                UTILITIES.LOG_WITH_LEVEL(fileName, LOG_LEVEL.INFO, message);
            },
            warn: (message: Message) => {
                UTILITIES.LOG_WITH_LEVEL(fileName, LOG_LEVEL.WARN, message);
            },
            error: (message: Message) => {
                UTILITIES.LOG_WITH_LEVEL(fileName, LOG_LEVEL.ERROR, message);
            },
            debug: (message: Message) => {
                UTILITIES.LOG_WITH_LEVEL(fileName, LOG_LEVEL.DEBUG, message);
            }
        };
    }
}