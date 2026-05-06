import { render, createElement } from './engine/main.js';
import { App } from './components/App.js';
import { subscribeToState } from './lib/state.js';

function renderApp() {
  render(createElement(App, {}), document.getElementById('root'));
}

subscribeToState(renderApp);
renderApp();
