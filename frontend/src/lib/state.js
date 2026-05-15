export let AppState = {
  currentView: 'home',
};

let stateListeners = [];

export function updateState(updates) {
  Object.assign(AppState, updates);
  stateListeners.forEach(cb => cb(AppState));
}

export function subscribeToState(callback) {
  stateListeners.push(callback);
  return () => { stateListeners = stateListeners.filter(cb => cb !== callback); };
}

/**
 * Notes
 * - This is a very simple global state store >> Think Redux
 * - We could add more features like middleware, selectors, etc.
 * - For now, it's just a simple object and a way to subscribe to changes.
 * - The main use case is to track the current view and any global settings.
 * - Components can subscribe to changes and re-render when needed.
 * - We could also add a way to persist state to localStorage or sync with a backend.
 */

/**
 * Object Assign API:

const target = { a: 1, b: 2 };
const source = { b: 4, c: 5 };

const returnedTarget = Object.assign(target, source);

console.log(source)
console.log(target);
// Expected output: Object { a: 1, b: 4, c: 5 }
console.log(returnedTarget)

console.log(returnedTarget === target);
// Expected output: true

Object { b: 4, c: 5 }
Object { a: 1, b: 4, c: 5 }
Object { a: 1, b: 4, c: 5 }
true
 */