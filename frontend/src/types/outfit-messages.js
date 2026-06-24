// Outfit-builder message creators + slot model.
// An outfit references inspo images by slot: dragging an inspo image into the
// `top` slot means "I like the top in this image" — the slot supplies the
// semantic, the image is the inspiration. Image bytes already live in the inspo
// collection, so an outfit only stores lightweight refs ({imageId, imageUrl,
// title}) per slot — no new uploads.

const OUTFIT_COMMAND_MAP = {
  'get_outfits':    40,
  'create_outfit':  41,
  'update_outfit':  42,
  'delete_outfit':  43,
};

// Fixed single-piece slots, ordered head→shoe to mirror the body. The class
// name `outfit-slot-<key>` drives each slot's grid placement in CSS.
export const SLOT_DEFS = [
  { key: 'head',      label: 'HEAD / HAT' },
  { key: 'eyewear',   label: 'EYEWEAR' },
  { key: 'outerwear', label: 'OUTERWEAR' },
  { key: 'top',       label: 'TOP' },
  { key: 'belt',      label: 'BELT' },
  { key: 'bottom',    label: 'BOTTOM' },
  { key: 'sock',      label: 'SOCKS' },
  { key: 'shoe',      label: 'SHOES' },
];
export const SLOT_KEYS = SLOT_DEFS.map(s => s.key);

// Outfits are collections too — they carry public/private visibility exactly
// like image boards and journal posts. New outfits start private.
export const DEFAULT_OUTFIT_VISIBILITY = 'admins';

// `accessories` is a separate, unbounded list (jewelry, scarf, bag…).
export function emptyOutfitSlots() {
  const slots = { accessories: [] };
  for (const k of SLOT_KEYS) slots[k] = null;
  return slots;
}

export function slotLabel(key) {
  if (key === 'accessories') return 'ACCESSORY';
  const def = SLOT_DEFS.find(s => s.key === key);
  return def ? def.label : key.toUpperCase();
}

export function getOutfitsMessage() {
  return { command: 'get_outfits', payload: { content: {}, num: OUTFIT_COMMAND_MAP['get_outfits'] } };
}

export function createOutfitMessage(name, slots) {
  return { command: 'create_outfit', payload: { content: { name, slots }, num: OUTFIT_COMMAND_MAP['create_outfit'] } };
}

export function updateOutfitMessage(id, patch) {
  return { command: 'update_outfit', payload: { content: { id, patch }, num: OUTFIT_COMMAND_MAP['update_outfit'] } };
}

export function deleteOutfitMessage(id) {
  return { command: 'delete_outfit', payload: { content: { id }, num: OUTFIT_COMMAND_MAP['delete_outfit'] } };
}
