import { createElement } from '../engine/main.js';
import { upsertMealEntry, deleteMealEntry, currentUserEmail } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { mealLoader } from '../lib/loaders.js';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// Two earth-tone hues for distinguishing authors. Deterministic so each
// admin keeps the same color across sessions. With more authors we'd hash.
const AUTHOR_HUES = ['author-green', 'author-indigo', 'author-terracotta', 'author-ochre'];

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

// Stable per-author color assignment for the lifetime of the page. Different
// emails get different hues, the current user always gets index 0 (green).
const _authorColorMap = {};
function authorClass(email, currentEmail) {
  if (!email) return AUTHOR_HUES[0];
  if (email === currentEmail) return AUTHOR_HUES[0];
  if (_authorColorMap[email]) return _authorColorMap[email];
  // Fill from index 1 onward so the current user keeps green.
  const used = new Set(Object.values(_authorColorMap));
  const next = AUTHOR_HUES.slice(1).find(h => !used.has(h)) || AUTHOR_HUES[1];
  _authorColorMap[email] = next;
  return next;
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
        placeholder: 'A gentle log — no pressure, no judgement.',
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
          ...others.map(e =>
            createElement('div', { className: 'meal-other-entry' },
              createElement('span', { className: `cal-author-dot ${authorClass(e.author, currentEmail)}` }),
              createElement('span', { className: 'meal-other-author' }, e.author),
              createElement('div', { className: 'meal-other-text' }, e.text || '—')
            )
          )
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

  return createElement('div', { className: 'calendar-shell' },
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
          createElement('span', { className: 'cal-author-dot author-green' }), ' YOU'
        ),
        currentEmail
          ? createElement('span', { className: 'cal-legend-email' }, currentEmail)
          : null
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
            'Honor what you ate. The board is shared with other admins, so you can cheer each other on.'
          )
        )
  );
}
