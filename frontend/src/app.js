/**
 * Harbinger - Main Entry Point
 * Custom vdom engine with component-based architecture
 */
import { render, createElement } from './main.js';
import { App } from './components/App.js';
import { subscribeToState } from './components/state.js';

// Main render function
function renderApp() {
  const root = document.getElementById('root');
  if (!root) {
    console.error('Root element not found');
    return;
  }
  
  render(createElement(App, {}), root);
}

// Subscribe to state changes for re-renders
subscribeToState(() => {
  renderApp();
});

// Initial render
renderApp();
