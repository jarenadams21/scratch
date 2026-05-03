import { Message, REGISTERED_NUM_MAP, sendMessage } from '../types/types.js';

// ─── Journal Message Creators ───────────────────────────────────────────────

export function createPostMessage(title: string, content: string, mood?: string): Message {
    return {
        command: "create_post",
        payload: {
            content: { title, content, mood },
            num: REGISTERED_NUM_MAP["create_post"]
        }
    };
}

export function getPostsMessage(): Message {
    return {
        command: "get_posts",
        payload: {
            content: {},
            num: REGISTERED_NUM_MAP["get_posts"]
        }
    };
}

export function getPostMessage(postId: string): Message {
    return {
        command: "get_post",
        payload: {
            content: { postId },
            num: REGISTERED_NUM_MAP["get_post"]
        }
    };
}

export function updatePostMessage(postId: string, updates: object): Message {
    return {
        command: "update_post",
        payload: {
            content: { postId, ...updates },
            num: REGISTERED_NUM_MAP["update_post"]
        }
    };
}

export function deletePostMessage(postId: string): Message {
    return {
        command: "delete_post",
        payload: {
            content: { postId },
            num: REGISTERED_NUM_MAP["delete_post"]
        }
    };
}

// ─── Auth Message Creators ──────────────────────────────────────────────────

export function signupMessage(email: string, password: string): Message {
    return {
        command: "auth_signup",
        payload: {
            content: { email, password },
            num: REGISTERED_NUM_MAP["auth_signup"]
        }
    };
}

export function loginMessage(email: string, password: string): Message {
    return {
        command: "auth_login",
        payload: {
            content: { email, password },
            num: REGISTERED_NUM_MAP["auth_login"]
        }
    };
}

export function logoutMessage(): Message {
    return {
        command: "auth_logout",
        payload: {
            content: {},
            num: REGISTERED_NUM_MAP["auth_logout"]
        }
    };
}
