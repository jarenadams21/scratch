// Journal Message Creators

const REGISTERED_NUM_MAP = {
  "init": 0,
  "get_text": 1,
  "create_post": 2,
  "get_posts": 3,
  "get_post": 4,
  "update_post": 5,
  "delete_post": 6,
  "auth_signup": 7,
  "auth_login": 8,
  "auth_logout": 9,
  // Audio commands (10–13 reserved — see audio-messages.js)
  // Feature commands (14–18 reserved — see feature-messages.js)
  "update_post_visibility": 19,
  "upsert_post": 20,
  "get_shelves": 21,
  "create_shelf": 22,
  "update_shelf": 23,
  "delete_shelf": 24,
  "get_appearance": 25,
  "set_appearance": 26,
};

export const VISIBILITY_PUBLIC = 'public';
export const VISIBILITY_ADMINS = 'admins';

// ─── Journal Message Creators ───────────────────────────────────────────────

export function createPostMessage(title, content, mood, visibility = VISIBILITY_PUBLIC) {
  return {
    command: "create_post",
    payload: {
      content: { title, content, mood, visibility },
      num: REGISTERED_NUM_MAP["create_post"]
    }
  };
}

export function upsertPostMessage(entry) {
  return {
    command: "upsert_post",
    payload: {
      content: entry,
      num: REGISTERED_NUM_MAP["upsert_post"]
    }
  };
}

export function getShelvesMessage() {
  return {
    command: "get_shelves",
    payload: { content: {}, num: REGISTERED_NUM_MAP["get_shelves"] }
  };
}

export function createShelfMessage(name, color, description = '') {
  return {
    command: "create_shelf",
    payload: { content: { name, color, description }, num: REGISTERED_NUM_MAP["create_shelf"] }
  };
}

export function updateShelfMessage(id, patch) {
  return {
    command: "update_shelf",
    payload: { content: { id, patch }, num: REGISTERED_NUM_MAP["update_shelf"] }
  };
}

export function deleteShelfMessage(id) {
  return {
    command: "delete_shelf",
    payload: { content: { id }, num: REGISTERED_NUM_MAP["delete_shelf"] }
  };
}

export function getAppearanceMessage() {
  return {
    command: "get_appearance",
    payload: { content: {}, num: REGISTERED_NUM_MAP["get_appearance"] }
  };
}

export function setAppearanceMessage(theme, palette) {
  return {
    command: "set_appearance",
    payload: { content: { theme, palette }, num: REGISTERED_NUM_MAP["set_appearance"] }
  };
}

export function updatePostVisibilityMessage(postId, timestamp, visibility, author) {
  return {
    command: "update_post_visibility",
    payload: {
      content: { postId, timestamp, visibility, author },
      num: REGISTERED_NUM_MAP["update_post_visibility"]
    }
  };
}

export function getPostsMessage(email = null) {
  return {
    command: "get_posts",
    payload: {
      content: email ? { email } : {},
      num: REGISTERED_NUM_MAP["get_posts"]
    }
  };
}

export function getPostMessage(postId) {
  return {
    command: "get_post",
    payload: {
      content: { postId },
      num: REGISTERED_NUM_MAP["get_post"]
    }
  };
}

export function updatePostMessage(postId, updates) {
  return {
    command: "update_post",
    payload: {
      content: { postId, ...updates },
      num: REGISTERED_NUM_MAP["update_post"]
    }
  };
}

export function deletePostMessage(postId) {
  return {
    command: "delete_post",
    payload: {
      content: { postId },
      num: REGISTERED_NUM_MAP["delete_post"]
    }
  };
}

// ─── Auth Message Creators ──────────────────────────────────────────────────

export function signupMessage(email, password) {
  return {
    command: "auth_signup",
    payload: {
      content: { email, password },
      num: REGISTERED_NUM_MAP["auth_signup"]
    }
  };
}

export function loginMessage(email, password) {
  return {
    command: "auth_login",
    payload: {
      content: { email, password },
      num: REGISTERED_NUM_MAP["auth_login"]
    }
  };
}

export function logoutMessage() {
  return {
    command: "auth_logout",
    payload: {
      content: {},
      num: REGISTERED_NUM_MAP["auth_logout"]
    }
  };
}
