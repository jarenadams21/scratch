// Feature trait + shared meal-board message creators.
// Same command/payload/num shape as journal-messages.js & audio-messages.js.

const FEATURE_COMMAND_MAP = {
  'get_traits':         14,
  'set_trait':          15,
  'get_meal_entries':   16,
  'upsert_meal_entry':  17,
  'delete_meal_entry':  18,
};

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
