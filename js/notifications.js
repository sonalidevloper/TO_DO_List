/**
 * notifications.js — Lightweight toast notification system.
 * Renders ephemeral alerts into #notification-tray.
 */

const TRAY = document.getElementById('notification-tray');

const ICONS = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };

/**
 * Show a toast notification.
 * @param {string} title   — Bold headline
 * @param {string} [msg]   — Optional supporting text
 * @param {'success'|'warning'|'error'|'info'} [type='info']
 * @param {number} [duration=3500] — Auto-dismiss delay in ms (0 = sticky)
 */
export function notify(title, msg = '', type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `notification notification--${type}`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');

  el.innerHTML = `
    <span class="notification__icon" aria-hidden="true">${ICONS[type] ?? 'ℹ️'}</span>
    <div class="notification__body">
      <p class="notification__title">${title}</p>
      ${msg ? `<p class="notification__msg">${msg}</p>` : ''}
    </div>
    <button class="btn-icon" aria-label="Dismiss notification" style="flex-shrink:0">✕</button>
  `;

  const dismiss = () => {
    el.classList.add('notification--exit');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  el.querySelector('button').addEventListener('click', dismiss);
  TRAY.appendChild(el);

  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss; // callers can dismiss programmatically
}