import { createElement } from '../engine/main.js';
import { upsertMealEntry, deleteMealEntry, currentUserEmail, uploadMealImage, detachMealImage } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { mealLoader, ensureProfilesFor, profileFor } from '../lib/loaders.js';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// Earth-tone hues for distinguishing authors. The first preference is the
// admin's chosen displayColor (from their profile). Falls back to a stable
// deterministic assignment when nobody has picked a color yet.
const AUTHOR_HUES = ['author-green', 'author-indigo', 'author-terracotta', 'author-ochre', 'author-sand', 'author-plum'];

function pad(n) { return String(n).padStart(2, '0'); }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}
function parseMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
function shiftMonth(monthStr, delta) {
  const d = parseMonth(monthStr);
  d.setMonth(d.getMonth() + delta);
  return monthKey(d);
}

// Stable per-author color assignment for the lifetime of the page, used as a
// fallback when an admin hasn't picked a displayColor yet. The current user
// keeps index 0 (green) so their dot stays consistent across sessions.
const _authorColorMap = {};
function fallbackAuthorClass(email, currentEmail) {
  if (!email) return AUTHOR_HUES[0];
  if (email === currentEmail) return AUTHOR_HUES[0];
  if (_authorColorMap[email]) return _authorColorMap[email];
  const used = new Set(Object.values(_authorColorMap));
  const next = AUTHOR_HUES.slice(1).find(h => !used.has(h)) || AUTHOR_HUES[1];
  _authorColorMap[email] = next;
  return next;
}

// Resolve to a CSS class, preferring the explicit profile color when set.
function authorClass(email, currentEmail) {
  const p = profileFor(email);
  if (p.displayColor) return `author-${p.displayColor}`;
  return fallbackAuthorClass(email, currentEmail);
}

function buildGrid(monthStr) {
  const first = parseMonth(monthStr);
  const year = first.getFullYear();
  const month = first.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startWeekday = first.getDay();

  const cells = [];
  // Leading blanks
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  // Trailing blanks to complete the final week
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function entriesByDate(entries) {
  const map = {};
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return map;
}

function DayCell({ dateKey, entries, isToday, isSelected, currentEmail }) {
  if (!dateKey) {
    return createElement('div', { className: 'cal-cell cal-cell-blank' });
  }
  const day = Number(dateKey.slice(-2));
  const dots = (entries || []).map(e =>
    createElement('span', {
      className: `cal-author-dot ${authorClass(e.author, currentEmail)}`,
      title: e.author,
    })
  );

  let cls = 'cal-cell';
  if (isToday) cls += ' cal-cell-today';
  if (isSelected) cls += ' cal-cell-selected';
  if (entries && entries.length) cls += ' cal-cell-has-entry';

  return createElement('button', {
    className: cls,
    onClick: () => updateState({ selectedMealDate: dateKey }),
  },
    createElement('div', { className: 'cal-day-num' }, String(day)),
    createElement('div', { className: 'cal-dot-row' }, ...dots)
  );
}

// Meal log is stored as a single string per (date, author). We treat newline
// characters as item separators on the client — keeps the wire format and
// existing mock data working without any schema migration.
function textToItems(text) {
  return (text || '').split('\n').map(s => s.trim()).filter(Boolean);
}
function itemsToText(items) {
  return items.join('\n');
}

function MealItemRow({ value, onChange, onDelete }) {
  const commit = (e) => {
    const next = (e.target.value || '').trim();
    if (next === value) return;
    if (next === '') onDelete();   // emptying a row deletes it
    else onChange(next);
  };
  return createElement('div', { className: 'meal-item-row' },
    createElement('span', { className: 'meal-item-bullet' }, '·'),
    createElement('input', {
      // Key on the value so a server-side change re-syncs the input. When the
      // user is mid-edit the input is focused, so this only re-applies when
      // they aren't actively typing.
      key: `item-${value}`,
      type: 'text',
      className: 'meal-item-input',
      defaultValue: value,
      maxLength: 200,
      onBlur: commit,
      onKeyDown: (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); e.target.blur(); }
        if (e.key === 'Escape') { e.target.value = value; e.target.blur(); }
      },
    }),
    createElement('button', {
      type: 'button',
      className: 'meal-item-delete',
      onClick: onDelete,
      title: 'Remove',
      'aria-label': 'Remove item',
    }, '✕')
  );
}

function MealAddRow({ onAdd }) {
  // Hold the input element so the visible ADD button can read its current
  // value without forcing controlled-input plumbing.
  let inputEl = null;

  const submit = () => {
    if (!inputEl) return;
    const v = (inputEl.value || '').trim();
    if (!v) { inputEl.focus(); return; }
    onAdd(v);
    inputEl.value = '';
    inputEl.focus(); // stay put for rapid entry
  };

  return createElement('div', { className: 'meal-item-row meal-item-row-add' },
    createElement('span', { className: 'meal-item-bullet meal-item-bullet-add' }, '+'),
    createElement('input', {
      ref: (el) => { inputEl = el; },
      type: 'text',
      className: 'meal-item-input',
      placeholder: 'log a meal or snack',
      maxLength: 200,
      // type=text + autocapitalize=sentences feels natural for meal logging.
      autocapitalize: 'sentences',
      autocomplete: 'off',
      onKeyDown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      },
    }),
    createElement('button', {
      type: 'button',
      className: 'meal-add-btn',
      onClick: submit,
      title: 'Add item',
      'aria-label': 'Add item',
    }, 'ADD')
  );
}

// Read-only or editable photo grid. When editable, the ADD PHOTO button wraps
// a hidden file input — accept="image/*" and no `capture` so phones offer
// the native picker (Take Photo / Photo Library / Choose File). Each thumb
// is a link to the full-size image (opens in a new tab); owners get a tiny
// ✕ overlay to remove a photo.
function MealPhotos({ date, images, editable }) {
  let fileInput = null;
  const isUploading = AppState.mealImageUploading === date;

  const trigger = () => { if (!isUploading) fileInput?.click(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    updateState({ mealImageUploading: date });
    try {
      await uploadMealImage(date, file);
      mealLoader.reload();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      updateState({ mealImageUploading: null });
    }
  };

  const handleDelete = async (imageKey) => {
    if (!confirm('Remove this photo?')) return;
    try {
      await detachMealImage(date, imageKey);
      mealLoader.reload();
    } catch (err) {
      alert('Could not remove: ' + err.message);
    }
  };

  const hasImages = images && images.length > 0;
  if (!hasImages && !editable) return null;

  return createElement('div', { className: 'meal-photos' },
    hasImages
      ? createElement('div', { className: 'meal-photo-grid' },
          ...images.map(img =>
            createElement('div', { className: 'meal-photo' },
              createElement('button', {
                type: 'button',
                className: 'meal-photo-link',
                'aria-label': 'Open photo full size',
                // In-app lightbox keeps the URL out of browser history and
                // off the address bar — privacy-respectful viewing for
                // sensitive content.
                onClick: () => updateState({
                  lightboxImage: { url: img.imageUrl, alt: 'Meal photo' },
                }),
              },
                createElement('img', {
                  src: img.imageUrl,
                  alt: 'Meal photo',
                  loading: 'lazy',
                  className: 'meal-photo-img',
                  referrerpolicy: 'no-referrer',
                  draggable: 'false',
                })
              ),
              editable
                ? createElement('button', {
                    type: 'button',
                    className: 'meal-photo-delete',
                    onClick: (e) => { e.stopPropagation(); handleDelete(img.imageKey); },
                    title: 'Remove photo',
                    'aria-label': 'Remove photo',
                  }, '✕')
                : null
            )
          )
        )
      : null,

    editable
      ? createElement('div', { className: 'meal-photo-actions' },
          createElement('button', {
            type: 'button',
            className: isUploading ? 'meal-photo-add-btn busy' : 'meal-photo-add-btn',
            onClick: trigger,
            disabled: isUploading,
          }, isUploading ? 'UPLOADING…' : '+ ADD PHOTO'),
          createElement('input', {
            ref: (el) => { fileInput = el; },
            type: 'file',
            accept: 'image/*',
            className: 'meal-photo-file',
            onChange: handleFile,
          })
        )
      : null
  );
}

function DayEditor({ date, entries, currentEmail, onSaved, onClose }) {
  const ownEntry = entries.find(e => e.author === currentEmail);
  const others = entries.filter(e => e.author !== currentEmail);
  const items = textToItems(ownEntry?.text);

  const persist = async (nextItems) => {
    try {
      if (nextItems.length === 0) {
        await deleteMealEntry(date);
      } else {
        await upsertMealEntry(date, itemsToText(nextItems));
      }
      mealLoader.reload();
      if (onSaved) onSaved();
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
  };

  const addItem    = (t)        => persist([...items, t]);
  const updateItem = (i, t)     => persist(items.map((v, idx) => idx === i ? t : v));
  const deleteItem = (i)        => persist(items.filter((_, idx) => idx !== i));

  const dateLabel = (() => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    }).toUpperCase();
  })();

  return createElement('div', { className: 'meal-editor-pane' },
    createElement('div', { className: 'meal-editor-header' },
      createElement('div', { className: 'meal-editor-date' }, dateLabel),
      createElement('button', { className: 'meal-close-btn', onClick: onClose, title: 'Close' }, '✕')
    ),

    createElement('div', { className: 'meal-editor-list' },
      createElement('div', { className: 'meal-editor-label' }, 'WHAT YOU ATE'),
      ...items.map((item, idx) =>
        createElement(MealItemRow, {
          key: `item-${date}-${idx}-${item}`,
          value: item,
          onChange: (v) => updateItem(idx, v),
          onDelete: () => deleteItem(idx),
        })
      ),
      // Stable key per date so the input element survives an add-and-reload.
      // Without this, items.length changes on every add → MealAddRow remounts
      // → focus and (on iOS) the keyboard get yanked away mid-entry.
      createElement(MealAddRow, { key: `add-${date}`, onAdd: addItem })
    ),

    createElement(MealPhotos, {
      key: `photos-${date}`,
      date,
      images: ownEntry?.images || [],
      editable: true,
    }),

    others.length
      ? createElement('div', { className: 'meal-others' },
          createElement('div', { className: 'meal-others-label' }, 'ALSO ON THIS DAY'),
          ...others.map(e => {
            const profile = profileFor(e.author);
            const theirItems = textToItems(e.text);
            const theirImages = e.images || [];
            return createElement('div', { className: 'meal-other-entry' },
              createElement('div', { className: 'meal-other-author-row' },
                createElement('span', { className: `cal-author-dot ${authorClass(e.author, currentEmail)}` }),
                createElement('span', { className: 'meal-other-author' }, profile.displayName)
              ),
              theirItems.length === 0 && theirImages.length === 0
                ? createElement('div', { className: 'meal-other-empty' }, '—')
                : null,
              theirItems.length > 0
                ? createElement('ul', { className: 'meal-other-list' },
                    ...theirItems.map(t => createElement('li', { className: 'meal-other-item' }, t))
                  )
                : null,
              theirImages.length > 0
                ? createElement(MealPhotos, {
                    key: `others-photos-${e.author}-${date}`,
                    date,
                    images: theirImages,
                    editable: false,
                  })
                : null
            );
          })
        )
      : null
  );
}

export function CalendarView() {
  const monthStr = AppState.mealMonth || monthKey(new Date());
  const cells = buildGrid(monthStr);
  const entries = AppState.mealEntries || [];
  const grouped = entriesByDate(entries);
  const selected = AppState.selectedMealDate;
  const today = todayKey();
  const currentEmail = currentUserEmail();

  // Make sure every author whose dot we're about to draw has a profile loaded.
  ensureProfilesFor([currentEmail, ...entries.map(e => e.author)]);

  const monthDate = parseMonth(monthStr);
  const headerLabel = `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

  const goPrev = () => {
    updateState({ mealMonth: shiftMonth(monthStr, -1), mealLoaded: false, selectedMealDate: null });
    mealLoader.reload();
  };
  const goNext = () => {
    updateState({ mealMonth: shiftMonth(monthStr, 1), mealLoaded: false, selectedMealDate: null });
    mealLoader.reload();
  };
  const goToday = () => {
    const tk = monthKey(new Date());
    updateState({ mealMonth: tk, mealLoaded: false, selectedMealDate: today });
    mealLoader.reload();
  };

  // Marker class so mobile CSS knows when the day editor is filling the
  // screen modally (calendar grid is hidden in that mode).
  const shellClass = selected ? 'calendar-shell calendar-shell-detail' : 'calendar-shell';

  return createElement('div', { className: shellClass },
    createElement('div', { className: 'calendar-board' },
      createElement('div', { className: 'cal-header' },
        createElement('button', { className: 'cal-nav-btn', onClick: goPrev, title: 'Previous month' }, '‹'),
        createElement('div', { className: 'cal-header-center' },
          createElement('h2', { className: 'cal-month-title' }, headerLabel),
          createElement('button', { className: 'cal-today-btn', onClick: goToday }, 'TODAY')
        ),
        createElement('button', { className: 'cal-nav-btn', onClick: goNext, title: 'Next month' }, '›')
      ),

      createElement('div', { className: 'cal-weekday-row' },
        ...DAY_LABELS.map(d => createElement('div', { className: 'cal-weekday' }, d))
      ),

      createElement('div', { className: 'cal-grid' },
        ...cells.map(dateKey => createElement(DayCell, {
          dateKey,
          entries: dateKey ? grouped[dateKey] : null,
          isToday: dateKey === today,
          isSelected: dateKey === selected,
          currentEmail,
        }))
      ),

      createElement('div', { className: 'cal-legend' },
        createElement('span', { className: 'cal-legend-item' },
          createElement('span', { className: `cal-author-dot ${authorClass(currentEmail, currentEmail)}` }),
          ' ' + (profileFor(currentEmail).displayName || 'YOU')
        )
      )
    ),

    selected
      ? createElement(DayEditor, {
          key: `editor-${selected}`,
          date: selected,
          entries: grouped[selected] || [],
          currentEmail,
          onSaved: () => { /* loader reloads */ },
          onClose: () => updateState({ selectedMealDate: null }),
        })
      : createElement('div', { className: 'meal-editor-pane meal-editor-empty' },
          createElement('div', { className: 'meal-editor-empty-label' }, 'Choose a day to log'),
          createElement('div', { className: 'meal-editor-empty-blurb' },
            'cheer each other on ok'
          )
        )
  );
}
