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
};

// ─── Journal Message Creators ───────────────────────────────────────────────

export function createPostMessage(title, content, mood) {
  return {
    command: "create_post",
    payload: {
      content: { title, content, mood },
      num: REGISTERED_NUM_MAP["create_post"]
    }
  };
}

export function getPostsMessage() {
  return {
    command: "get_posts",
    payload: {
      content: {},
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
