/**
 * Harbinger - Main Entry Point
 * Custom vdom engine with component-based architecture
 */

console.log('[Harbinger] Loading app...');

import { render, createElement } from './engine/main.js';
import { App } from './components/App.js';
import { subscribeToState } from './lib/state.js';

console.log('[Harbinger] Imports successful');

// Main render function
function renderApp() {
  console.log('[Harbinger] renderApp called');
  const root = document.getElementById('root');
  if (!root) {
    console.error('[Harbinger] Root element not found');
    return;
  }
  
  console.log('[Harbinger] Rendering App component...');
  try {
    render(createElement(App, {}), root);
    console.log('[Harbinger] Render complete');
  } catch (error) {
    console.error('[Harbinger] Render error:', error);
  }
}

// Subscribe to state changes for re-renders
subscribeToState(() => {
  console.log('[Harbinger] State changed, re-rendering...');
  renderApp();
});

// Initial render
console.log('[Harbinger] Starting initial render');
renderApp();
