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
