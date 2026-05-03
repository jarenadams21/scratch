import { createElement } from '../engine/main.js';
import { login } from '../lib/api.js';

export function LoginForm({ onAuthSuccess }) {
  const handleSubmit = async (e) => {
    e.preventDefault();
    const email    = e.target.elements['email'].value.trim();
    const password = e.target.elements['password'].value;
    if (!email || !password) return;
    try {
      await login(email, password);
      onAuthSuccess();
    } catch (err) {
      alert('Access denied');
    }
  };

  return createElement('div', { className: 'typewriter-login' },
    createElement('p', { className: 'login-heading' }, 'OPERATOR ACCESS'),
    createElement('p', { className: 'login-subhead' }, 'Restricted Terminal'),
    createElement('hr', { className: 'login-rule' }),
    createElement('form', { className: 'credentials', onSubmit: handleSubmit },
      createElement('input', {
        type: 'email',
        name: 'email',
        placeholder: 'EMAIL',
        className: 'typewriter-input',
        autocomplete: 'email'
      }),
      createElement('input', {
        type: 'password',
        name: 'password',
        placeholder: 'PASSWORD',
        className: 'typewriter-input',
        autocomplete: 'current-password'
      }),
      createElement('div', { className: 'button-row' },
        createElement('button', {
          type: 'submit',
          className: 'typewriter-btn'
        }, 'ENTER')
      )
    )
  );
}
