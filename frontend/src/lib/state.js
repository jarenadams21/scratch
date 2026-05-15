export let AppState = {
  currentView: 'home',
};

// Listeners that will be called whenever the AppState is updated.
let stateListeners = [];

// Updates the global state and notifies listeners.
// - `updates` is an object with the properties to update in AppState.
// - We use Object.assign to merge the updates into the existing AppState.
// - After updating, we call each listener callback with the new AppState.
// Example usage:
// updateState({ currentView: 'settings' });
// Example of listener being notified:
// subscribeToState((newState) => {
//  console.log('State updated:', newState);
// });
export function updateState(updates) {
  Object.assign(AppState, updates);
  stateListeners.forEach(cb => cb(AppState));
}

// Allows components to subscribe to changes in the AppState.
// - `callback` is a function that will be called with the new AppState whenever it changes.
// - Returns a function that can be called to unsubscribe the listener.
// Example usage:
// const unsubscribe = subscribeToState((newState) => {
//   console.log('State updated:', newState);
// });
// To unsubscribe later:
// unsubscribe();
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