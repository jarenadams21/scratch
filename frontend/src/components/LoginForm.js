import { createElement } from '../engine/main.js';
import { login, signup } from '../lib/api.js';
import { CONFIG } from '../config/flags-runtime.js';

/**
 * LoginForm Component
 * Handles user authentication (login only for admin, signup disabled)
 */
export function LoginForm({ onAuthSuccess, hideSignup = false }) {
  // Store refs for form inputs
  let emailInput;
  let passwordInput;
  
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    
    try {
      await login(emailInput.value, passwordInput.value);
      onAuthSuccess();
    } catch (err) {
      alert('Invalid credentials');
    }
  };
  
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    
    try {
      await signup(emailInput.value, passwordInput.value);
      onAuthSuccess();
    } catch (err) {
      alert('Account creation failed');
    }
  };
  
  const devBadge = CONFIG.DEV && CONFIG.SHOW_DEV_BADGES
    ? createElement('div', { className: 'dev-badge' }, '[DEV MODE - MOCK DATA]')
    : null;
  
  return createElement('div', { className: 'typewriter-login' },
    createElement('div', { className: 'paper-sheet' },
      createElement('h1', { className: 'masthead' }, 'HARBINGER'),
      createElement('div', { className: 'subhead' }, 'A Journal of Thought'),
      devBadge,
      createElement('div', { className: 'login-line' }, '─────────────────────'),
      createElement('form', { className: 'credentials' },
        createElement('input', {
          type: 'email',
          placeholder: 'OPERATOR',
          ref: (el) => { emailInput = el; },
          className: 'typewriter-input'
        }),
        createElement('input', {
          type: 'password',
          placeholder: 'PASSWORD',
          ref: (el) => { passwordInput = el; },
          className: 'typewriter-input'
        }),
        createElement('div', { className: 'button-row' },
          createElement('button', { 
            type: 'submit', 
            onClick: handleLogin,
            className: 'typewriter-btn'
          }, 'ENTER'),
          // Only show REGISTER button if hideSignup is false
          !hideSignup ? createElement('button', { 
            type: 'button', 
            onClick: handleSignup,
            className: 'typewriter-btn secondary'
          }, 'REGISTER') : null
        )
      )
    )
  );
}
