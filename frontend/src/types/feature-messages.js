// Feature trait + shared meal-board message creators.
// Same command/payload/num shape as journal-messages.js & audio-messages.js.

const FEATURE_COMMAND_MAP = {
  'get_traits':                14,
  'set_trait':                 15,
  'get_meal_entries':          16,
  'upsert_meal_entry':         17,
  'delete_meal_entry':         18,
  'get_profiles':              20,
  'request_image_upload_url':  21,
  'attach_meal_image':         22,
  'detach_meal_image':         23,
};

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024;  // 8 MB

export const DISPLAY_COLORS = ['green', 'indigo', 'terracotta', 'ochre', 'sand', 'plum'];
export const DEFAULT_DISPLAY_NAME = 'Operator';

export function getTraitsMessage() {
  return {
    command: 'get_traits',
    payload: { content: {}, num: FEATURE_COMMAND_MAP['get_traits'] },
  };
}

export function setTraitMessage(trait, value) {
  return {
    command: 'set_trait',
    payload: { content: { trait, value }, num: FEATURE_COMMAND_MAP['set_trait'] },
  };
}

export function getMealEntriesMessage(startDate, endDate) {
  return {
    command: 'get_meal_entries',
    payload: { content: { startDate, endDate }, num: FEATURE_COMMAND_MAP['get_meal_entries'] },
  };
}

export function upsertMealEntryMessage(date, text) {
  return {
    command: 'upsert_meal_entry',
    payload: { content: { date, text }, num: FEATURE_COMMAND_MAP['upsert_meal_entry'] },
  };
}

export function deleteMealEntryMessage(date) {
  return {
    command: 'delete_meal_entry',
    payload: { content: { date }, num: FEATURE_COMMAND_MAP['delete_meal_entry'] },
  };
}

export function getProfilesMessage(emails) {
  return {
    command: 'get_profiles',
    payload: { content: { emails }, num: FEATURE_COMMAND_MAP['get_profiles'] },
  };
}

export function requestImageUploadUrlMessage(filename, contentType) {
  return {
    command: 'request_image_upload_url',
    payload: { content: { filename, contentType }, num: FEATURE_COMMAND_MAP['request_image_upload_url'] },
  };
}

export function attachMealImageMessage(date, image) {
  return {
    command: 'attach_meal_image',
    payload: { content: { date, image }, num: FEATURE_COMMAND_MAP['attach_meal_image'] },
  };
}

export function detachMealImageMessage(date, imageKey) {
  return {
    command: 'detach_meal_image',
    payload: { content: { date, imageKey }, num: FEATURE_COMMAND_MAP['detach_meal_image'] },
  };
}
