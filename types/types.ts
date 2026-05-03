import { UTILITIES } from "./utilities";
import { LOG_LEVEL } from "./utilities";

// Create a logger instance for this file
const logger = UTILITIES.createLogger("types.ts");

export interface VISITOR {
    available_enums: Array<string>;
    INCOMING?: () => { 
        properties: Array<string | any>,
        onmessage: Message,
    }
}

export interface Message {
    command: string,
    payload: {
        content: string | object,
        num: RegisteredNum
    }
}

export type RegisteredNum = {
    val: number
}

export type RegisteredNumMap = {
    [key: string]: RegisteredNum
}

export const REGISTERED_NUM_MAP: RegisteredNumMap = {
    "init": { val: 0 },
    "get_text": { val: 1 },
    // Journal operations
    "create_post": { val: 10 },
    "get_posts": { val: 11 },
    "get_post": { val: 12 },
    "update_post": { val: 13 },
    "delete_post": { val: 14 },
    // Auth operations
    "auth_signup": { val: 20 },
    "auth_login": { val: 21 },
    "auth_logout": { val: 22 },
}

// GET_TEXT REGISTERED AS VAL 1
export function get_text(): RegisteredNum {
    return REGISTERED_NUM_MAP["get_text"];
}

// Send Message function
export function sendMessage(message: Message, proposed_num: number) {
    // Make sure proposed message is registered
    if (!Object.values(REGISTERED_NUM_MAP).some(num => num.val === proposed_num)) {
        throw new Error(`Proposed message number ${proposed_num} is not registered.`);
    }

    console.log("Sending message:", message);

}

export type RETURN_TO_SENDER = {
    from: string,
    to: string,
    message: Message
}

export const EXAMPLE_VISITOR: VISITOR = {
    available_enums: ["init", "get_text"],
    INCOMING: () => ({
        properties: [] as Array<RETURN_TO_SENDER>,
        onmessage: {
            command: "",
            payload: {
                content: "Send text in the site",
                num: REGISTERED_NUM_MAP["get_text"]
            }
        }
    })
}

// Example function of retrieving text from database and returning in component rendered in engine
export async function retrieveTextFromDatabase(): Promise<string> {
    // Simulate database call
    const simulatedDatabaseResponse = "This is the text retrieved from the database.";
    
    // Option 1: Use the logger instance (recommended)
    logger.info(
         { command: "retrieveTextFromDatabase",
             payload: { content: simulatedDatabaseResponse,
                 num: REGISTERED_NUM_MAP["get_text"] } });

    return new Promise((resolve) => {
        setTimeout(() => resolve(simulatedDatabaseResponse), 500);
    });

}