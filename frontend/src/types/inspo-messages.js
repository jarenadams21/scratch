// Inspiration-board message creators.
// Same command/payload/num shape as feature-messages.js & audio-messages.js.
//
// An inspo board is a curated collection (Pinterest-style), but every image
// ALSO carries cross-cutting structured facets (occasion / weather / color)
// plus free-form tags. One image can belong to many boards at once and surface
// under any combination of facet filters — the "better than a single hierarchy"
// idea. Image bytes ride the existing request_image_upload_url (21) flow, so we
// only need new commands for boards + inspo metadata here.

const INSPO_COMMAND_MAP = {
  'get_inspo_boards':    30,
  'create_inspo_board':  31,
  'delete_inspo_board':  32,
  'get_inspos':          33,
  'create_inspo':        34,
  'update_inspo':        35,
  'delete_inspo':        36,
  'update_inspo_board':  37,
};

// Board (gallery) visibility — same model as journal posts: 'public' is the
// whole web, 'admins' is owner-only (i.e. "private"). New boards default to
// private; the owner opts a gallery into being public.
export const BOARD_PUBLIC  = 'public';
export const BOARD_PRIVATE = 'admins';
export const DEFAULT_BOARD_VISIBILITY = BOARD_PRIVATE;

// ─── Facet vocabularies ───────────────────────────────────────────────────────
// Suggested values offered as toggle-chips in the tag editor. They are NOT a
// closed set — the filter bar derives its options from the values actually
// present on items, so anything typed into free tags is still filterable.
export const SCENARIO_VOCAB = ['work', 'date night', 'wedding guest', 'travel', 'errands', 'night out', 'lounge', 'brunch'];
export const SEASON_VOCAB   = ['hot', 'warm', 'cool', 'cold', 'rainy', 'layering', 'summer', 'spring', 'fall', 'winter'];
export const COLOR_VOCAB    = ['neutrals', 'earth tones', 'bold', 'monochrome', 'pastel', 'denim', 'black', 'white'];

// The structured, filterable facet groups. `key` matches the field on an inspo
// item; `label` is the masthead-style heading shown in the UI; `vocab` seeds
// the editor chips. Free-form `tags` (where "vibe" lives) are handled
// separately as a text field, not a fixed group.
export const FACET_GROUPS = [
  { key: 'scenarios', label: 'OCCASION', vocab: SCENARIO_VOCAB },
  { key: 'seasons',   label: 'WEATHER',  vocab: SEASON_VOCAB },
  { key: 'colors',    label: 'COLOR',    vocab: COLOR_VOCAB },
];

export function getInspoBoardsMessage() {
  return {
    command: 'get_inspo_boards',
    payload: { content: {}, num: INSPO_COMMAND_MAP['get_inspo_boards'] },
  };
}

export function createInspoBoardMessage(name) {
  return {
    command: 'create_inspo_board',
    payload: { content: { name }, num: INSPO_COMMAND_MAP['create_inspo_board'] },
  };
}

export function deleteInspoBoardMessage(id) {
  return {
    command: 'delete_inspo_board',
    payload: { content: { id }, num: INSPO_COMMAND_MAP['delete_inspo_board'] },
  };
}

export function updateInspoBoardMessage(id, patch) {
  return {
    command: 'update_inspo_board',
    payload: { content: { id, patch }, num: INSPO_COMMAND_MAP['update_inspo_board'] },
  };
}

export function getInsposMessage() {
  return {
    command: 'get_inspos',
    payload: { content: {}, num: INSPO_COMMAND_MAP['get_inspos'] },
  };
}

export function createInspoMessage(image, meta) {
  return {
    command: 'create_inspo',
    payload: { content: { image, meta }, num: INSPO_COMMAND_MAP['create_inspo'] },
  };
}

export function updateInspoMessage(id, patch) {
  return {
    command: 'update_inspo',
    payload: { content: { id, patch }, num: INSPO_COMMAND_MAP['update_inspo'] },
  };
}

export function deleteInspoMessage(id) {
  return {
    command: 'delete_inspo',
    payload: { content: { id }, num: INSPO_COMMAND_MAP['delete_inspo'] },
  };
}
