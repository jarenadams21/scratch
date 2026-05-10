import { createElement } from '../engine/main.js';
import { setTrait, currentUserEmail } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';
import { DISPLAY_COLORS } from '../types/feature-messages.js';

// Generic feature catalog — declare type and the row renderer is picked
// automatically. Add new entries here and they appear in Settings.
export const DEFAULT_VISIBILITY_FALLBACK = 'admins';

const FEATURE_CATALOG = [
  {
    id: 'displayName',
    name: 'DISPLAY NAME',
    description: 'How you appear in shared spaces. Posts show this instead of your email',
    type: 'string',
    placeholder: 'e.g. Boogaloo',
    maxLength: 32,
  },
  {
    id: 'displayColor',
    name: 'DOT COLOR',
    description: 'Your accent color for the calendar and any shared views',
    type: 'swatch',
    options: DISPLAY_COLORS,
  },
  {
    id: 'calendar',
    name: 'MEAL CALENDAR',
    description: 'Monthly eating board',
    type: 'boolean',
  },
  {
    id: 'defaultVisibility',
    name: 'DEFAULT AUDIENCE',
    description: 'Where new posts go by default; you can still override per-entry in the editor',
    type: 'enum',
    options: [
      { value: 'public', label: 'PUBLIC' },
      { value: 'admins', label: 'ADMINS' },
    ],
    fallback: DEFAULT_VISIBILITY_FALLBACK,
  },
];

function ToggleRow({ feature, enabled, onChange, busy }) {
  return createElement('div', { className: 'feature-row' },
    createElement('div', { className: 'feature-text' },
      createElement('div', { className: 'feature-name' }, feature.name),
      createElement('div', { className: 'feature-desc' }, feature.description)
    ),
    createElement('button', {
      className: enabled ? 'feature-toggle on' : 'feature-toggle off',
      onClick: () => onChange(!enabled),
      disabled: busy,
      'aria-pressed': enabled ? 'true' : 'false',
    },
      createElement('span', { className: 'feature-toggle-knob' }),
      createElement('span', { className: 'feature-toggle-label' }, enabled ? 'ON' : 'OFF')
    )
  );
}

function EnumRow({ feature, value, onChange, busy }) {
  return createElement('div', { className: 'feature-row' },
    createElement('div', { className: 'feature-text' },
      createElement('div', { className: 'feature-name' }, feature.name),
      createElement('div', { className: 'feature-desc' }, feature.description)
    ),
    createElement('div', { className: 'feature-enum', role: 'radiogroup' },
      ...feature.options.map(opt =>
        createElement('button', {
          type: 'button',
          className: value === opt.value ? 'feature-enum-btn active' : 'feature-enum-btn',
          onClick: () => onChange(opt.value),
          disabled: busy,
          'aria-pressed': value === opt.value ? 'true' : 'false',
        }, opt.label)
      )
    )
  );
}

function StringRow({ feature, value, onChange, busy }) {
  // Save on blur or Enter — never auto-save mid-keystroke. Trims whitespace.
  const commit = (e) => {
    const next = (e.target.value || '').trim();
    if (next === (value || '')) return;   // no-op if unchanged
    if (next.length === 0) return;        // ignore empty (use placeholder)
    onChange(next);
  };
  return createElement('div', { className: 'feature-row' },
    createElement('div', { className: 'feature-text' },
      createElement('div', { className: 'feature-name' }, feature.name),
      createElement('div', { className: 'feature-desc' }, feature.description)
    ),
    createElement('input', {
      key: `string-${feature.id}-${value || ''}`,
      type: 'text',
      className: 'feature-string-input',
      defaultValue: value || '',
      placeholder: feature.placeholder || '',
      maxLength: feature.maxLength,
      disabled: busy,
      onBlur: commit,
      onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
    })
  );
}

function SwatchRow({ feature, value, onChange, busy }) {
  return createElement('div', { className: 'feature-row' },
    createElement('div', { className: 'feature-text' },
      createElement('div', { className: 'feature-name' }, feature.name),
      createElement('div', { className: 'feature-desc' }, feature.description)
    ),
    createElement('div', { className: 'feature-swatches', role: 'radiogroup' },
      ...feature.options.map(c =>
        createElement('button', {
          type: 'button',
          className: value === c ? `feature-swatch active author-${c}` : `feature-swatch author-${c}`,
          onClick: () => onChange(c),
          disabled: busy,
          title: c,
          'aria-label': `Color ${c}`,
          'aria-pressed': value === c ? 'true' : 'false',
        })
      )
    )
  );
}

export function SettingsView({ onChanged }) {
  const traits = AppState.traits || {};

  // Single update path — handles boolean / enum / string / swatch values.
  // Reads fresh traits at click time so rapid edits don't see a stale snapshot.
  const update = async (id, nextValue) => {
    const before = AppState.traits || {};
    const beforeProfiles = AppState.profiles || {};
    updateState({ traits: { ...before, [id]: nextValue } });

    // Mirror profile-affecting traits into the profile cache instantly so
    // the calendar dot / post byline reflect the change before the network
    // round-trip resolves.
    const me = currentUserEmail();
    if (me && (id === 'displayName' || id === 'displayColor')) {
      const mine = beforeProfiles[me] || { displayName: 'Operator', displayColor: null };
      updateState({ profiles: { ...beforeProfiles, [me]: { ...mine, [id]: nextValue } } });
    }

    try {
      const result = await setTrait(id, nextValue);
      const finalTraits = result?.traits ?? { ...(AppState.traits || {}), [id]: nextValue };
      updateState({ traits: finalTraits });
      if (onChanged) onChanged(finalTraits);
    } catch (err) {
      updateState({ traits: before, profiles: beforeProfiles });
      alert('Could not save preference: ' + err.message);
    }
  };

  const renderRow = (feature) => {
    const busy = AppState.traitsLoading;
    if (feature.type === 'enum') {
      return createElement(EnumRow, {
        feature,
        value: traits[feature.id] ?? feature.fallback,
        onChange: (v) => update(feature.id, v),
        busy,
      });
    }
    if (feature.type === 'string') {
      return createElement(StringRow, {
        feature,
        value: traits[feature.id] || '',
        onChange: (v) => update(feature.id, v),
        busy,
      });
    }
    if (feature.type === 'swatch') {
      return createElement(SwatchRow, {
        feature,
        value: traits[feature.id] || null,
        onChange: (v) => update(feature.id, v),
        busy,
      });
    }
    // boolean (default)
    return createElement(ToggleRow, {
      feature,
      enabled: !!traits[feature.id],
      onChange: (v) => update(feature.id, v),
      busy,
    });
  };

  return createElement('div', { className: 'settings-sheet' },
    createElement('div', { className: 'sheet-header' },
      createElement('span', { className: 'date-stamp' }, 'OPERATOR'),
      createElement('span', { className: 'date-stamp' }, 'PREFERENCES')
    ),
    createElement('div', { className: 'settings-body' },
      createElement('p', { className: 'settings-blurb' },
        'Toggle the modules and defaults for your terminal; change at any point!'
      ),
      createElement('div', { className: 'feature-list' },
        ...FEATURE_CATALOG.map(renderRow)
      )
    )
  );
}
