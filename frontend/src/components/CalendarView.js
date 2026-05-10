import { createElement } from '../engine/main.js';
import { upsertMealEntry, deleteMealEntry, currentUserEmail } from '../lib/api.js';
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

function DayEditor({ date, entries, currentEmail, onSaved, onClose }) {
  const ownEntry = entries.find(e => e.author === currentEmail);
  const others = entries.filter(e => e.author !== currentEmail);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = e.target.elements['meal'].value.trim();
    try {
      await upsertMealEntry(date, text);
      mealLoader.reload();
      if (onSaved) onSaved();
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Clear your entry for this day?')) return;
    try {
      await deleteMealEntry(date);
      mealLoader.reload();
      if (onSaved) onSaved();
    } catch (err) {
      alert('Could not delete: ' + err.message);
    }
  };

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

    createElement('form', { className: 'meal-editor-form', onSubmit: handleSubmit },
      createElement('label', { className: 'meal-editor-label' }, 'WHAT YOU ATE'),
      createElement('textarea', {
        key: `meal-text-${date}`,
        name: 'meal',
        className: 'meal-editor-text',
        placeholder: 'Update here :^1',
        defaultValue: ownEntry?.text || '',
        rows: 6,
      }),
      createElement('div', { className: 'meal-editor-actions' },
        ownEntry
          ? createElement('button', { type: 'button', className: 'meal-clear-btn', onClick: handleDelete }, 'CLEAR')
          : null,
        createElement('button', { type: 'submit', className: 'meal-save-btn' }, ownEntry ? 'UPDATE' : 'SAVE')
      )
    ),

    others.length
      ? createElement('div', { className: 'meal-others' },
          createElement('div', { className: 'meal-others-label' }, 'ALSO ON THIS DAY'),
          ...others.map(e => {
            const profile = profileFor(e.author);
            return createElement('div', { className: 'meal-other-entry' },
              createElement('span', { className: `cal-author-dot ${authorClass(e.author, currentEmail)}` }),
              createElement('span', { className: 'meal-other-author' }, profile.displayName),
              createElement('div', { className: 'meal-other-text' }, e.text || '—')
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
