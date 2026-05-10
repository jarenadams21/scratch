import { createElement } from '../engine/main.js';
import { setTrait } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

// Generic feature catalog — declare type and the row renderer is picked
// automatically. Add new entries here and they appear in Settings.
export const DEFAULT_VISIBILITY_FALLBACK = 'admins';

const FEATURE_CATALOG = [
  {
    id: 'calendar',
    name: 'MEAL CALENDAR',
    description: 'monthly eating board',
    type: 'boolean',
  },
  {
    id: 'defaultVisibility',
    name: 'DEFAULT AUDIENCE',
    description: 'Where new posts go by default. You can still override per-entry in the editor.',
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

export function SettingsView({ onChanged }) {
  const traits = AppState.traits || {};

  // Single update path — handles both boolean and enum values. Reads fresh
  // traits at click time so rapid clicks don't toggle off a stale snapshot.
  const update = async (id, nextValue) => {
    const before = AppState.traits || {};
    updateState({ traits: { ...before, [id]: nextValue } });
    try {
      const result = await setTrait(id, nextValue);
      const finalTraits = result?.traits ?? { ...(AppState.traits || {}), [id]: nextValue };
      updateState({ traits: finalTraits });
      if (onChanged) onChanged(finalTraits);
    } catch (err) {
      updateState({ traits: before });
      alert('Could not save preference: ' + err.message);
    }
  };

  const renderRow = (feature) => {
    if (feature.type === 'enum') {
      const current = traits[feature.id] ?? feature.fallback;
      return createElement(EnumRow, {
        feature,
        value: current,
        onChange: (v) => update(feature.id, v),
        busy: AppState.traitsLoading,
      });
    }
    // boolean (default)
    return createElement(ToggleRow, {
      feature,
      enabled: !!traits[feature.id],
      onChange: (v) => update(feature.id, v),
      busy: AppState.traitsLoading,
    });
  };

  return createElement('div', { className: 'settings-sheet' },
    createElement('div', { className: 'sheet-header' },
      createElement('span', { className: 'date-stamp' }, 'OPERATOR'),
      createElement('span', { className: 'date-stamp' }, 'PREFERENCES')
    ),
    createElement('div', { className: 'settings-body' },
      createElement('p', { className: 'settings-blurb' },
        'Toggle the modules and defaults for your terminal. Each operator keeps their own preferences.'
      ),
      createElement('div', { className: 'feature-list' },
        ...FEATURE_CATALOG.map(renderRow)
      )
    )
  );
}
