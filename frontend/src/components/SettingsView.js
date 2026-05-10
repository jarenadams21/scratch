import { createElement } from '../engine/main.js';
import { setTrait } from '../lib/api.js';
import { AppState, updateState } from '../lib/state.js';

// Generic feature catalog — add new entries here and they automatically appear
// in the Settings panel as toggles. Keep descriptions short and humane.
const FEATURE_CATALOG = [
  {
    id: 'calendar',
    name: 'MEAL CALENDAR',
    description: 'A breathable monthly board for logging what was eaten each day. Shared with other admins.',
  },
];

function ToggleRow({ feature, enabled, onToggle, busy }) {
  return createElement('div', { className: 'feature-row' },
    createElement('div', { className: 'feature-text' },
      createElement('div', { className: 'feature-name' }, feature.name),
      createElement('div', { className: 'feature-desc' }, feature.description)
    ),
    createElement('button', {
      className: enabled ? 'feature-toggle on' : 'feature-toggle off',
      onClick: onToggle,
      disabled: busy,
      'aria-pressed': enabled ? 'true' : 'false',
    },
      createElement('span', { className: 'feature-toggle-knob' }),
      createElement('span', { className: 'feature-toggle-label' }, enabled ? 'ON' : 'OFF')
    )
  );
}

export function SettingsView({ onChanged }) {
  const traits = AppState.traits || {};

  const toggle = async (id) => {
    const next = !traits[id];
    // Optimistic update so the UI feels responsive
    updateState({ traits: { ...traits, [id]: next } });
    try {
      const result = await setTrait(id, next);
      const finalTraits = result?.traits ?? { ...traits, [id]: next };
      updateState({ traits: finalTraits });
      if (onChanged) onChanged(finalTraits);
    } catch (err) {
      // Roll back
      updateState({ traits: { ...traits, [id]: !next } });
      alert('Could not save preference: ' + err.message);
    }
  };

  return createElement('div', { className: 'settings-sheet' },
    createElement('div', { className: 'sheet-header' },
      createElement('span', { className: 'date-stamp' }, 'OPERATOR'),
      createElement('span', { className: 'date-stamp' }, 'PREFERENCES')
    ),
    createElement('div', { className: 'settings-body' },
      createElement('p', { className: 'settings-blurb' },
        'Toggle the modules that should appear in your terminal. Each operator keeps their own switches.'
      ),
      createElement('div', { className: 'feature-list' },
        ...FEATURE_CATALOG.map(feature =>
          createElement(ToggleRow, {
            feature,
            enabled: !!traits[feature.id],
            onToggle: () => toggle(feature.id),
            busy: AppState.traitsLoading,
          })
        )
      )
    )
  );
}
