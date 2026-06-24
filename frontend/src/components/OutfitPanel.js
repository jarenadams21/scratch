import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';
import { outfitsLoader } from '../lib/loaders.js';
import { updateOutfit } from '../lib/api.js';
import { SLOT_DEFS, SLOT_KEYS, slotLabel } from '../types/outfit-messages.js';

// One outfit, edited in place inside the inspo tab. A body map of slots
// (head→shoe) plus an unbounded accessories column. Fill a slot by dragging an
// inspo image from the palette (desktop) or tapping the slot then an image
// (touch). Every change autosaves to the outfit — no draft, no save button —
// the same immediate-persist model boards use. Read-only for visitors.

const reloadOutfits = () => outfitsLoader.reload();
const refOfItem = (it) => ({ imageId: it.id, imageUrl: it.imageUrl, title: it.title || '' });
const itemById  = (id) => (AppState.inspoItems || []).find(x => x.id === id);

export function outfitPieceCount(slots) {
  return SLOT_KEYS.filter(k => slots[k]).length + (slots.accessories || []).length;
}

async function patchSlots(outfit, slots) {
  try {
    await updateOutfit(outfit.id, { slots });
    reloadOutfits();
  } catch (err) {
    alert('Could not save outfit: ' + err.message);
  }
}

function assignToSlot(outfit, slotKey, ref) {
  const slots = slotKey === 'accessories'
    ? { ...outfit.slots, accessories: [...(outfit.slots.accessories || []), ref] }
    : { ...outfit.slots, [slotKey]: ref };
  updateState({ outfitAssignSlot: null });
  patchSlots(outfit, slots);
}

function clearSlot(outfit, slotKey) {
  patchSlots(outfit, { ...outfit.slots, [slotKey]: null });
}

function removeAccessory(outfit, i) {
  patchSlots(outfit, { ...outfit.slots, accessories: (outfit.slots.accessories || []).filter((_, idx) => idx !== i) });
}

function toggleAssign(slotKey) {
  updateState({ outfitAssignSlot: AppState.outfitAssignSlot === slotKey ? null : slotKey });
}

function dropHandlers(outfit, slotKey) {
  return {
    onDragOver: (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; },
    onDrop: (e) => {
      e.preventDefault();
      const id = e.dataTransfer && e.dataTransfer.getData('text/plain');
      const it = id && itemById(id);
      if (it) assignToSlot(outfit, slotKey, refOfItem(it));
    },
  };
}

function openLightbox(ref, fallback) {
  updateState({ lightboxImage: { url: ref.imageUrl, alt: ref.title || fallback || 'Inspiration' } });
}

// ─── Slots + body map ────────────────────────────────────────────────────────────

function SlotBox(outfit, def, ref, interactive) {
  const filled = !!ref;
  const assigning = interactive && AppState.outfitAssignSlot === def.key;
  const props = {
    className: `outfit-slot outfit-slot-${def.key}` + (filled ? ' filled' : '') + (assigning ? ' assigning' : ''),
  };
  if (interactive) {
    Object.assign(props, dropHandlers(outfit, def.key));
    if (!filled) props.onClick = () => toggleAssign(def.key);
  }

  const body = filled
    ? createElement('div', { className: 'outfit-slot-content' },
        createElement('img', {
          src: ref.imageUrl, alt: ref.title || def.label, className: 'outfit-slot-img',
          referrerpolicy: 'no-referrer', draggable: 'false',
          onClick: (e) => { e.stopPropagation(); openLightbox(ref, def.label); },
        }),
        interactive
          ? createElement('button', {
              type: 'button', className: 'outfit-slot-clear', title: 'Clear slot',
              'aria-label': `Clear ${def.label}`,
              onClick: (e) => { e.stopPropagation(); clearSlot(outfit, def.key); },
            }, '✕')
          : null
      )
    : createElement('div', { className: 'outfit-slot-empty' },
        interactive ? (assigning ? 'PICK ONE →' : '+ drag / tap') : '—'
      );

  return createElement('div', props,
    createElement('div', { className: 'outfit-slot-label' }, def.label),
    body
  );
}

function AccessoryBox(outfit, list, interactive) {
  const assigning = interactive && AppState.outfitAssignSlot === 'accessories';

  const chips = list.map((ref, i) =>
    createElement('div', { className: 'outfit-acc-item', key: i },
      createElement('img', {
        src: ref.imageUrl, alt: ref.title || 'Accessory', className: 'outfit-acc-img',
        referrerpolicy: 'no-referrer', draggable: 'false',
        onClick: (e) => { e.stopPropagation(); openLightbox(ref, 'Accessory'); },
      }),
      interactive
        ? createElement('button', {
            type: 'button', className: 'outfit-acc-clear', title: 'Remove',
            'aria-label': 'Remove accessory',
            onClick: (e) => { e.stopPropagation(); removeAccessory(outfit, i); },
          }, '✕')
        : null
    )
  );

  const addProps = { className: 'outfit-acc-add' + (assigning ? ' assigning' : '') };
  if (interactive) {
    Object.assign(addProps, dropHandlers(outfit, 'accessories'));
    addProps.onClick = () => toggleAssign('accessories');
  }
  const addZone = interactive
    ? createElement('div', addProps, assigning ? 'PICK ONE →' : '+ ADD')
    : (list.length ? null : createElement('div', { className: 'outfit-acc-add' }, '—'));

  return createElement('div', { className: 'outfit-slot outfit-slot-acc' },
    createElement('div', { className: 'outfit-slot-label' }, 'ACCESSORIES'),
    createElement('div', { className: 'outfit-acc-list' }, ...chips, addZone)
  );
}

function BodyMap(outfit, interactive) {
  return createElement('div', { className: 'outfit-body' },
    ...SLOT_DEFS.map(def => SlotBox(outfit, def, outfit.slots[def.key], interactive)),
    AccessoryBox(outfit, outfit.slots.accessories || [], interactive)
  );
}

// ─── Palette (drag / tap source) ──────────────────────────────────────────────────

function paletteMatches(it, q) {
  if (!q) return true;
  const hay = [it.title, it.note, ...(it.tags || []), ...(it.scenarios || []), ...(it.seasons || []), ...(it.colors || [])]
    .join(' ').toLowerCase();
  return hay.includes(q);
}

function Palette(outfit) {
  const items = AppState.inspoItems || [];
  const q = (AppState.outfitPaletteQ || '').toLowerCase();
  const filtered = items.filter(it => paletteMatches(it, q));
  const assignSlot = AppState.outfitAssignSlot;

  const cells = filtered.map(it =>
    createElement('div', {
      className: 'outfit-palette-cell',
      key: it.id,
      draggable: 'true',
      title: it.title || '',
      onDragStart: (e) => {
        if (e.dataTransfer) { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'copy'; }
      },
      onClick: () => {
        const slot = AppState.outfitAssignSlot;
        if (slot) assignToSlot(outfit, slot, refOfItem(it));
        else updateState({ lightboxImage: { url: it.imageUrl, alt: it.title || 'Inspiration' } });
      },
    },
      createElement('img', {
        src: it.imageUrl, alt: it.title || 'Inspiration', className: 'outfit-palette-img',
        loading: 'lazy', referrerpolicy: 'no-referrer', draggable: 'false',
      })
    )
  );

  return createElement('aside', { className: 'outfit-palette' },
    createElement('div', { className: 'outfit-palette-head' },
      createElement('span', {}, assignSlot ? `PICK FOR ${slotLabel(assignSlot)}` : 'YOUR INSPO'),
      assignSlot
        ? createElement('button', { type: 'button', className: 'outfit-cancel-assign', onClick: () => updateState({ outfitAssignSlot: null }) }, '✕ cancel')
        : null
    ),
    createElement('input', {
      type: 'search', className: 'inspo-search', placeholder: 'search your inspo…',
      value: AppState.outfitPaletteQ || '',
      onInput: (e) => updateState({ outfitPaletteQ: e.target.value }),
    }),
    items.length
      ? createElement('div', { className: 'outfit-palette-grid' }, ...cells)
      : createElement('div', { className: 'inspo-empty' }, 'No inspo images yet — add some to a board first.')
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────────────

export function OutfitPanel({ outfit, readOnly }) {
  if (!outfit) return null;
  const n = outfitPieceCount(outfit.slots);

  const header = createElement('div', { className: 'outfit-toolbar' },
    readOnly
      ? createElement('div', { className: 'outfit-detail-name' }, outfit.name || 'Untitled outfit')
      : createElement('input', {
          type: 'text', className: 'outfit-name-input', placeholder: 'NAME THIS OUTFIT',
          value: outfit.name || '',
          onChange: (e) => { updateOutfit(outfit.id, { name: e.target.value }).then(reloadOutfits); },
        }),
    createElement('div', { className: 'outfit-piece-count' }, `${n} piece${n === 1 ? '' : 's'}`)
  );

  // Owner gets the editable body + palette; a visitor gets a read-only look
  // with a hint to tap pieces for the source inspiration.
  return readOnly
    ? createElement('div', { className: 'outfit-stage' },
        header,
        createElement('p', { className: 'outfit-detail-hint' }, 'Tap any piece to view its source inspiration full-size.'),
        BodyMap(outfit, false)
      )
    : createElement('div', { className: 'outfit-build' },
        createElement('div', { className: 'outfit-stage' }, header, BodyMap(outfit, true)),
        Palette(outfit)
      );
}
