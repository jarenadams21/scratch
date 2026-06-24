import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';
import { inspoBoardsLoader, inspoItemsLoader, outfitsLoader } from '../lib/loaders.js';
import {
  createInspoBoard, deleteInspoBoard, updateInspoBoard, updateInspo, deleteInspo, uploadInspo,
  createOutfit, deleteOutfit, updateOutfit,
} from '../lib/api.js';
import { FACET_GROUPS } from '../types/inspo-messages.js';
import { emptyOutfitSlots } from '../types/outfit-messages.js';
import { OutfitPanel, outfitPieceCount } from './OutfitPanel.js';

// One inspiration space. The rail holds two kinds of collection — image BOARDS
// (a freeform grid of anything: outfits, furniture, pets, colours) and OUTFITS
// (a body-map that arranges images into slots). Both are peers: same rail, same
// public/private visibility, same delete. Selecting a board shows its filtered
// grid (the flagship multi-facet filter); selecting an outfit hands the main
// pane to its body-map editor. Images stay the general atomic unit.

const reloadItems   = () => inspoItemsLoader.reload();
const reloadBoards  = () => inspoBoardsLoader.reload();
const reloadOutfits = () => outfitsLoader.reload();

// ─── Pure filter helpers ──────────────────────────────────────────────────────

function itemsInBoard(items, boardId) {
  if (boardId === 'all') return items;
  return items.filter(it => (it.boards || []).includes(boardId));
}

// AND across facet groups, OR within a group; plus a free-text contains match.
function matchesFilters(item, filters) {
  for (const g of FACET_GROUPS) {
    const sel = filters[g.key] || [];
    if (sel.length) {
      const vals = item[g.key] || [];
      if (!sel.some(v => vals.includes(v))) return false;
    }
  }
  const q = (filters.q || '').trim().toLowerCase();
  if (q) {
    const hay = [
      item.title, item.note,
      ...(item.tags || []), ...(item.scenarios || []),
      ...(item.seasons || []), ...(item.colors || []),
    ].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// Builds the chip options for each facet group from the values actually present
// on the current board's items, with counts — so the filter bar only ever
// offers values that exist and shows how many images each would narrow to.
function facetOptions(items) {
  return FACET_GROUPS.map(g => {
    const counts = {};
    for (const it of items) {
      for (const v of (it[g.key] || [])) counts[v] = (counts[v] || 0) + 1;
    }
    const values = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
      .map(value => ({ value, count: counts[value] }));
    return { key: g.key, label: g.label, values };
  });
}

function activeFilterCount(filters) {
  return FACET_GROUPS.reduce((n, g) => n + (filters[g.key] || []).length, 0)
    + ((filters.q || '').trim() ? 1 : 0);
}

// ─── Selection ─────────────────────────────────────────────────────────────────
// Picking a board (or ALL) drops out of any open outfit; picking an outfit
// hands the main pane to the body-map editor.

function selectBoard(id) {
  updateState({ inspoActiveBoard: id, inspoActiveOutfitId: null, outfitAssignSlot: null });
}

function selectOutfit(id) {
  updateState({ inspoActiveOutfitId: id, outfitAssignSlot: null });
}

function toggleFilter(key, value) {
  const cur = AppState.inspoFilters;
  const set = new Set(cur[key] || []);
  set.has(value) ? set.delete(value) : set.add(value);
  updateState({ inspoFilters: { ...cur, [key]: [...set] } });
}

function setQuery(q) {
  updateState({ inspoFilters: { ...AppState.inspoFilters, q } });
}

function clearFilters() {
  updateState({ inspoFilters: { scenarios: [], seasons: [], colors: [], q: '' } });
}

async function handleAddBoard() {
  const name = prompt('Name this board (e.g. "Fall layering")');
  if (!name || !name.trim()) return;
  try {
    await createInspoBoard(name.trim());
    reloadBoards();
  } catch (err) {
    alert('Could not create board: ' + err.message);
  }
}

async function handleDeleteBoard(board) {
  if (!confirm(`Delete board "${board.name}"? Images stay in your collection — they just leave this board.`)) return;
  try {
    await deleteInspoBoard(board.id);
    if (AppState.inspoActiveBoard === board.id) selectBoard('all');
    reloadBoards();
    reloadItems();
  } catch (err) {
    alert('Could not delete board: ' + err.message);
  }
}

async function handleAddOutfit() {
  const name = prompt('Name this outfit (e.g. "June wedding")');
  if (name === null) return;
  try {
    const created = await createOutfit((name || '').trim() || 'Untitled outfit', emptyOutfitSlots());
    reloadOutfits();
    selectOutfit(created.id);
  } catch (err) {
    alert('Could not create outfit: ' + err.message);
  }
}

async function handleDeleteOutfit(outfit) {
  if (!confirm(`Delete the outfit "${outfit.name}"? The inspiration images stay in your boards.`)) return;
  try {
    await deleteOutfit(outfit.id);
    if (AppState.inspoActiveOutfitId === outfit.id) selectBoard('all');
    reloadOutfits();
  } catch (err) {
    alert('Could not delete outfit: ' + err.message);
  }
}

// Flip a collection between public (whole web) and private ('admins',
// owner-only). Gate only the riskier public direction behind a confirm, like
// posts do. Shared by boards and outfits — same visibility feature set.
async function toggleVisibility(kind, entity) {
  const next = entity.visibility === 'public' ? 'admins' : 'public';
  if (next === 'public') {
    const ok = confirm(
      `Make the ${kind} "${entity.name}" PUBLIC?\n\n` +
      'Anyone visiting the site will be able to see it.'
    );
    if (!ok) return;
  }
  try {
    if (kind === 'outfit') { await updateOutfit(entity.id, { visibility: next }); reloadOutfits(); }
    else { await updateInspoBoard(entity.id, { visibility: next }); reloadBoards(); }
  } catch (err) {
    alert('Could not change visibility: ' + err.message);
  }
}

// ─── Board rail ────────────────────────────────────────────────────────────────

// Public/private pill — clickable for the owner to flip a gallery's audience.
function VisibilityTag({ visibility, onToggle }) {
  const isPublic = visibility === 'public';
  const cls = isPublic ? 'vis-tag vis-tag-public' : 'vis-tag vis-tag-admins';
  const label = isPublic ? 'PUBLIC' : 'PRIVATE';
  if (!onToggle) {
    return createElement('span', { className: cls, title: isPublic ? 'Visible to everyone' : 'Owner only' }, label);
  }
  return createElement('button', {
    type: 'button',
    className: cls + ' vis-tag-btn',
    title: isPublic ? 'Public gallery — click to make private' : 'Private gallery — click to make public',
    onClick: (e) => { e.stopPropagation(); onToggle(); },
  }, label);
}

function CollectionRow({ name, count, kind, active, visibility, onSelect, onToggleVis, onDelete }) {
  return createElement('div', { className: active ? 'inspo-board-row active' : 'inspo-board-row' },
    createElement('button', {
      type: 'button',
      className: 'inspo-board-btn',
      onClick: onSelect,
    },
      kind === 'outfit'
        ? createElement('span', { className: 'inspo-row-badge', title: 'Outfit' }, 'FIT')
        : null,
      createElement('span', { className: 'inspo-board-name' }, name),
      createElement('span', { className: 'inspo-board-count' }, String(count))
    ),
    // Controls row: visibility pill (+ delete for the owner). Omitted for the
    // ALL pseudo-board and for read-only visitors.
    (visibility || onDelete)
      ? createElement('div', { className: 'inspo-board-ctl' },
          visibility ? createElement(VisibilityTag, { visibility, onToggle: onToggleVis }) : null,
          onDelete
            ? createElement('button', {
                type: 'button',
                className: 'inspo-board-del',
                title: `Delete ${kind}`,
                'aria-label': `Delete ${kind} ${name}`,
                onClick: (e) => { e.stopPropagation(); onDelete(); },
              }, '✕')
            : null
        )
      : null
  );
}

function CollectionRail({ boards, outfits, items, activeBoard, activeOutfitId, readOnly }) {
  const inGrid = !activeOutfitId;

  const boardRows = boards.map(b =>
    createElement(CollectionRow, {
      key: b.id, name: b.name.toUpperCase(), kind: 'board',
      count: items.filter(it => (it.boards || []).includes(b.id)).length,
      active: inGrid && activeBoard === b.id,
      onSelect: () => selectBoard(b.id),
      visibility: readOnly ? null : b.visibility,
      onToggleVis: readOnly ? null : () => toggleVisibility('board', b),
      onDelete: readOnly ? null : () => handleDeleteBoard(b),
    })
  );

  const outfitRows = outfits.map(o =>
    createElement(CollectionRow, {
      key: o.id, name: (o.name || 'Untitled').toUpperCase(), kind: 'outfit',
      count: outfitPieceCount(o.slots),
      active: activeOutfitId === o.id,
      onSelect: () => selectOutfit(o.id),
      visibility: readOnly ? null : o.visibility,
      onToggleVis: readOnly ? null : () => toggleVisibility('outfit', o),
      onDelete: readOnly ? null : () => handleDeleteOutfit(o),
    })
  );

  // Group the rail so a reader can tell boards from outfits at a glance:
  //   ALL · BOARDS <rows> · OUTFITS <rows>. A subheading only appears when its
  // group is non-empty.
  const group = (label) => createElement('div', { className: 'inspo-rail-group', key: `grp-${label}` }, label);
  const listChildren = [
    createElement(CollectionRow, {
      key: 'all', name: 'ALL', kind: null, count: items.length,
      active: inGrid && activeBoard === 'all', onSelect: () => selectBoard('all'),
      visibility: null, onToggleVis: null, onDelete: null,
    }),
  ];
  if (boardRows.length)  { listChildren.push(group(readOnly ? 'GALLERIES' : 'BOARDS'), ...boardRows); }
  if (outfitRows.length) { listChildren.push(group('OUTFITS'), ...outfitRows); }

  return createElement('aside', { className: 'inspo-rail' },
    createElement('div', { className: 'inspo-rail-head' }, 'COLLECTIONS'),
    createElement('div', { className: 'inspo-board-list' }, ...listChildren),
    readOnly
      ? null
      : createElement('div', { className: 'inspo-rail-actions' },
          createElement('button', { type: 'button', className: 'inspo-new-board', onClick: handleAddBoard }, '+ BOARD'),
          createElement('button', { type: 'button', className: 'inspo-new-board', onClick: handleAddOutfit }, '+ OUTFIT')
        )
  );
}

// ─── Filter bar (flagship) ─────────────────────────────────────────────────────

function FilterChip({ label, count, active, onClick }) {
  return createElement('button', {
    type: 'button',
    className: active ? 'inspo-chip active' : 'inspo-chip',
    onClick,
  }, count != null ? `${label} ${count}` : label);
}

function FilterBar({ options, filters }) {
  const groups = options.map(group =>
    group.values.length === 0
      ? null
      : createElement('div', { className: 'inspo-facet-group', key: group.key },
          createElement('span', { className: 'inspo-facet-label' }, group.label),
          createElement('div', { className: 'inspo-facet-chips' },
            ...group.values.map(v =>
              createElement(FilterChip, {
                key: `${group.key}:${v.value}`,
                label: v.value,
                count: v.count,
                active: (filters[group.key] || []).includes(v.value),
                onClick: () => toggleFilter(group.key, v.value),
              })
            )
          )
        )
  ).filter(Boolean);

  return createElement('div', { className: 'inspo-filterbar' },
    createElement('input', {
      type: 'search',
      className: 'inspo-search',
      placeholder: 'search tags, vibe, notes…',
      value: filters.q || '',
      onInput: (e) => setQuery(e.target.value),
    }),
    ...groups
  );
}

// ─── Grid + card ───────────────────────────────────────────────────────────────

function openLightbox(item) {
  updateState({ lightboxImage: { url: item.imageUrl, alt: item.title || 'Inspiration' } });
}

function tagSummary(item) {
  const all = [...(item.scenarios || []), ...(item.seasons || []), ...(item.colors || [])];
  return all.slice(0, 4);
}

function InspoCard({ item, readOnly }) {
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Remove this image from your collection?')) return;
    try {
      await deleteInspo(item.id);
      if (AppState.inspoEditingId === item.id) updateState({ inspoEditingId: null });
      reloadItems();
    } catch (err) {
      alert('Could not remove: ' + err.message);
    }
  };

  return createElement('div', { className: 'inspo-card' },
    createElement('button', {
      type: 'button',
      className: 'inspo-card-img-btn',
      'aria-label': 'View full size',
      onClick: () => openLightbox(item),
    },
      createElement('img', {
        src: item.imageUrl,
        alt: item.title || 'Inspiration',
        loading: 'lazy',
        className: 'inspo-card-img',
        referrerpolicy: 'no-referrer',
        draggable: 'false',
      })
    ),
    readOnly
      ? null
      : createElement('div', { className: 'inspo-card-bar' },
          createElement('button', {
            type: 'button', className: 'inspo-card-edit',
            onClick: () => updateState({ inspoEditingId: item.id }),
          }, 'TAG'),
          createElement('button', {
            type: 'button', className: 'inspo-card-del',
            title: 'Remove', 'aria-label': 'Remove image', onClick: handleDelete,
          }, '✕')
        ),
    item.title ? createElement('div', { className: 'inspo-card-title' }, item.title) : null,
    createElement('div', { className: 'inspo-card-tags' },
      ...tagSummary(item).map((t, i) =>
        createElement('span', { className: 'inspo-card-tag', key: i }, t)
      )
    )
  );
}

// ─── Tag editor (overlay) ──────────────────────────────────────────────────────

function EditorChip({ label, active, onClick }) {
  return createElement('button', {
    type: 'button',
    className: active ? 'inspo-chip active' : 'inspo-chip',
    onClick,
  }, label);
}

async function patchItem(item, patch) {
  try {
    await updateInspo(item.id, patch);
    reloadItems();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
}

function toggleItemValue(item, key, value) {
  const set = new Set(item[key] || []);
  set.has(value) ? set.delete(value) : set.add(value);
  patchItem(item, { [key]: [...set] });
}

function InspoEditor({ item, boards }) {
  const close = () => updateState({ inspoEditingId: null });

  const facetSections = FACET_GROUPS.map(g => {
    // Offer the suggested vocabulary plus any custom values already on the item.
    const opts = [...new Set([...(g.vocab || []), ...(item[g.key] || [])])];
    return createElement('div', { className: 'inspo-edit-section', key: g.key },
      createElement('div', { className: 'inspo-edit-label' }, g.label),
      createElement('div', { className: 'inspo-facet-chips' },
        ...opts.map(v =>
          createElement(EditorChip, {
            key: v,
            label: v,
            active: (item[g.key] || []).includes(v),
            onClick: () => toggleItemValue(item, g.key, v),
          })
        )
      )
    );
  });

  return createElement('div', {
    className: 'inspo-editor-overlay',
    onClick: (e) => { if (e.target === e.currentTarget) close(); },
    role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tag image',
  },
    createElement('div', { className: 'inspo-editor' },
      createElement('div', { className: 'inspo-editor-head' },
        createElement('span', {}, 'TAG IMAGE'),
        createElement('button', { type: 'button', className: 'inspo-close', onClick: close, title: 'Close' }, '✕')
      ),

      createElement('div', { className: 'inspo-editor-body' },
        createElement('img', {
          src: item.imageUrl, alt: item.title || 'Inspiration',
          className: 'inspo-editor-img', referrerpolicy: 'no-referrer', draggable: 'false',
        }),

        createElement('div', { className: 'inspo-editor-fields' },
          createElement('input', {
            type: 'text', className: 'inspo-edit-input', placeholder: 'TITLE',
            value: item.title || '',
            onChange: (e) => patchItem(item, { title: e.target.value.trim() }),
          }),
          createElement('input', {
            type: 'text', className: 'inspo-edit-input', placeholder: 'NOTE',
            value: item.note || '',
            onChange: (e) => patchItem(item, { note: e.target.value.trim() }),
          }),

          createElement('div', { className: 'inspo-edit-section' },
            createElement('div', { className: 'inspo-edit-label' }, 'BOARDS'),
            createElement('div', { className: 'inspo-facet-chips' },
              ...(boards.length
                ? boards.map(b =>
                    createElement(EditorChip, {
                      key: b.id,
                      label: b.name,
                      active: (item.boards || []).includes(b.id),
                      onClick: () => toggleItemValue(item, 'boards', b.id),
                    })
                  )
                : [createElement('span', { className: 'inspo-empty-hint', key: 'none' }, 'No boards yet — create one in the rail.')])
            )
          ),

          ...facetSections,

          createElement('div', { className: 'inspo-edit-section' },
            createElement('div', { className: 'inspo-edit-label' }, 'TAGS / VIBE'),
            createElement('input', {
              type: 'text', className: 'inspo-edit-input',
              placeholder: 'comma,separated,e.g. old money, minimal',
              value: (item.tags || []).join(', '),
              onChange: (e) => patchItem(item, {
                tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
              }),
            })
          )
        )
      )
    )
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export function InspoView({ readOnly }) {
  const allBoards   = AppState.inspoBoards || [];
  const allItems    = AppState.inspoItems || [];
  const allOutfits  = AppState.savedOutfits || [];
  const filters     = AppState.inspoFilters || { scenarios: [], seasons: [], colors: [], q: '' };

  // A visitor (readOnly) only ever sees public boards/outfits and the images
  // that live in at least one public board. The owner sees everything. (The
  // backend will enforce the same cut server-side; this keeps dev faithful.)
  const boards  = readOnly ? allBoards.filter(b => b.visibility === 'public')  : allBoards;
  const outfits = readOnly ? allOutfits.filter(o => o.visibility === 'public') : allOutfits;
  const publicIds = new Set(boards.map(b => b.id));
  const sourceItems = readOnly
    ? allItems.filter(it => (it.boards || []).some(id => publicIds.has(id)))
    : allItems;

  // Fall back to ALL if the remembered board isn't one the viewer may see.
  const remembered = AppState.inspoActiveBoard || 'all';
  const activeBoard = (remembered === 'all' || publicIds.has(remembered) || (!readOnly && allBoards.some(b => b.id === remembered)))
    ? remembered : 'all';

  // A selected outfit (that the viewer may see) takes over the main pane.
  const activeOutfit = AppState.inspoActiveOutfitId
    ? outfits.find(o => o.id === AppState.inspoActiveOutfitId)
    : null;

  const rail = createElement(CollectionRail, {
    boards, outfits, items: sourceItems,
    activeBoard, activeOutfitId: activeOutfit ? activeOutfit.id : null, readOnly,
  });

  // ── Outfit mode: body-map editor replaces the grid ──
  if (activeOutfit) {
    return createElement('div', { className: 'inspo-layout' },
      rail,
      createElement('section', { className: 'inspo-main' },
        createElement(OutfitPanel, { outfit: activeOutfit, readOnly })
      )
    );
  }

  // ── Grid mode: board images + flagship multi-facet filtering ──
  const boardItems = itemsInBoard(sourceItems, activeBoard);
  const options    = facetOptions(boardItems);
  const filtered   = boardItems.filter(it => matchesFilters(it, filters));
  const nActive    = activeFilterCount(filters);
  const editingItem = (!readOnly && AppState.inspoEditingId)
    ? sourceItems.find(it => it.id === AppState.inspoEditingId)
    : null;

  let fileInput = null;
  const triggerUpload = () => { if (!AppState.inspoUploading) fileInput?.click(); };

  // Accepts one or many images at once — picking several screenshots from a
  // phone's photo library or a computer's file dialog uploads them all. Each
  // goes through uploadInspo (validate → presign → S3 PUT, or data-URL in dev).
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same files later
    if (!files.length) return;
    updateState({ inspoUploading: true });
    // Drop new images straight into the board you're looking at.
    const meta = activeBoard === 'all' ? {} : { boards: [activeBoard] };
    let firstId = null, ok = 0;
    const errors = [];
    for (const file of files) {
      try {
        const created = await uploadInspo(file, meta);
        if (!firstId) firstId = created.id;
        ok++;
      } catch (err) {
        errors.push(`${file.name || 'image'}: ${err.message}`);
      }
    }
    reloadItems();
    updateState({
      inspoUploading: false,
      // Jump straight into tagging only when exactly one image was added.
      inspoEditingId: (ok === 1 && files.length === 1) ? firstId : AppState.inspoEditingId,
    });
    if (errors.length) alert(`Some uploads failed:\n${errors.join('\n')}`);
  };

  const activeBoardName = activeBoard === 'all'
    ? 'ALL IMAGES'
    : ((boards.find(b => b.id === activeBoard) || {}).name || 'ALL IMAGES');
  const countLabel = nActive > 0
    ? `${filtered.length} of ${boardItems.length}`
    : `${boardItems.length} image${boardItems.length === 1 ? '' : 's'}`;

  const grid = filtered.length
    ? createElement('div', { className: 'inspo-grid' },
        ...filtered.map(item => createElement(InspoCard, { key: item.id, item, readOnly }))
      )
    : createElement('div', { className: 'inspo-empty' },
        boardItems.length === 0
          ? (readOnly ? 'Nothing in this gallery yet.' : 'No images here yet. Upload a screenshot to start curating.')
          : 'No images match these filters.'
      );

  return createElement('div', { className: 'inspo-layout' },
    rail,

    createElement('section', { className: 'inspo-main' },
      createElement('div', { className: 'inspo-toolbar' },
        createElement('div', { className: 'inspo-collection-title' }, activeBoardName.toUpperCase()),
        createElement('div', { className: 'inspo-count' }, countLabel),
        nActive > 0
          ? createElement('button', { type: 'button', className: 'inspo-clear', onClick: clearFilters }, `CLEAR FILTERS (${nActive})`)
          : null,
        // Upload is owner-only; visitors get a read-only gallery.
        readOnly
          ? null
          : createElement('button', {
              type: 'button',
              className: AppState.inspoUploading ? 'inspo-add busy' : 'inspo-add',
              onClick: triggerUpload,
              disabled: AppState.inspoUploading,
            }, AppState.inspoUploading ? 'UPLOADING…' : '+ ADD INSPO'),
        readOnly
          ? null
          : createElement('input', {
              ref: (el) => { fileInput = el; },
              type: 'file',
              accept: 'image/*',          // phone: camera + photo library; computer: file dialog
              multiple: true,             // pick several screenshots at once
              className: 'inspo-file',
              onChange: handleFiles,
            })
      ),

      createElement(FilterBar, { options, filters }),
      grid
    ),

    editingItem ? createElement(InspoEditor, { key: 'editor', item: editingItem, boards }) : null
  );
}
