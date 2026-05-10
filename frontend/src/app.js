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

// Coalesce state-change re-renders. Critical: render() resets wipRoot and
// deletions globals, so calling it synchronously during another render
// (e.g. from a loader's updateState fired inside App's reconciliation)
// orphans the in-progress work. Deferring to a microtask guarantees we
// never call render() while the workLoop is mid-tree.
let renderScheduled = false;
subscribeToState(() => {
  if (renderScheduled) return;
  renderScheduled = true;
  queueMicrotask(() => {
    renderScheduled = false;
    console.log('[Harbinger] State changed, re-rendering...');
    renderApp();
  });
});

// Initial render
console.log('[Harbinger] Starting initial render');
renderApp();
