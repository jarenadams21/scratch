import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';

export function App() {
  return createElement('div', { className: 'app' },
    createElement('h1', null, 'APP'),
    createElement('p', null, AppState.currentView),
    createElement('button', {
      onClick: () => updateState({ currentView: 'other' }),
    }, 'Switch view'),
  );
}
