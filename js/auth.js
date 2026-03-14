/**
 * auth.js — Authentication UI controller.
 *
 * Uses localStorage-backed "accounts" to simulate real auth.
 * In production, replace Storage.get/set with real API calls.
 */

import { Storage }  from './storage.js';
import { loginUser, logoutUser } from './state.js';
import { notify }   from './notifications.js';

/* ── DOM refs ────────────────────────────────────────────── */
const overlay    = document.getElementById('auth-overlay');
const app        = document.getElementById('app');
const tabs       = document.querySelectorAll('.auth-tab');
const panels     = { login: document.getElementById('auth-login'), register: document.getElementById('auth-register') };

const loginEmail  = document.getElementById('login-email');
const loginPw     = document.getElementById('login-password');
const loginErr    = document.getElementById('login-error');
const btnLogin    = document.getElementById('btn-login');
const togglePw    = document.getElementById('toggle-login-pw');

const regName     = document.getElementById('reg-name');
const regEmail    = document.getElementById('reg-email');
const regPw       = document.getElementById('reg-password');
const regErr      = document.getElementById('reg-error');
const btnRegister = document.getElementById('btn-register');
const pwStrength  = document.getElementById('pw-strength');

/* ── Helpers ─────────────────────────────────────────────── */
const getAccounts = () => Storage.get('accounts', {});
const saveAccounts = accs => Storage.set('accounts', accs);

/** Very light email validator. */
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Hash-like obfuscation (NOT real crypto — demo only). */
const obscure = str => btoa(str + ':taskflow');

/** Compute password strength 0–4. */
function strengthLevel(pw) {
  let score = 0;
  if (pw.length >= 6)              score++;
  if (pw.length >= 10)             score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9!@#$%^&*]/.test(pw))   score++;
  return score;
}

/** Update the visual strength bar. */
function renderStrength(pw) {
  const lvl = strengthLevel(pw);
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const pct    = [0, 25, 50, 75, 100];
  pwStrength.style.setProperty('--pw-width',  `${pct[lvl]}%`);
  pwStrength.style.setProperty('--pw-color',  colors[lvl] ?? '#ef4444');
}

/* ── Show / hide overlay ─────────────────────────────────── */
export function showAuth() {
  overlay.hidden = false;
  app.hidden     = true;
}

export function hideAuth() {
  overlay.hidden = true;
  app.hidden     = false;
}

/* ── Tab switching ───────────────────────────────────────── */
function switchTab(tab) {
  tabs.forEach(t => {
    const active = t.dataset.tab === tab;
    t.classList.toggle('auth-tab--active', active);
    t.setAttribute('aria-selected', String(active));
  });
  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle('auth-panel--active', key === tab);
  });
  // Clear errors on switch
  loginErr.textContent = '';
  regErr.textContent   = '';
}

/* ── Login ───────────────────────────────────────────────── */
function handleLogin() {
  const email = loginEmail.value.trim();
  const pw    = loginPw.value;

  if (!email || !pw) { loginErr.textContent = 'Please fill in all fields.'; return; }

  const accounts = getAccounts();
  const account  = accounts[email];

  if (!account || account.pw !== obscure(pw)) {
    loginErr.textContent = 'Incorrect email or password.';
    return;
  }

  loginErr.textContent = '';
  loginUser({ name: account.name, email });
  hideAuth();
  notify('Welcome back!', `Good to see you, ${account.name} 👋`, 'success');
}

/* ── Register ────────────────────────────────────────────── */
function handleRegister() {
  const name  = regName.value.trim();
  const email = regEmail.value.trim();
  const pw    = regPw.value;

  if (!name || !email || !pw) { regErr.textContent = 'Please fill in all fields.'; return; }
  if (!isEmail(email))        { regErr.textContent = 'Please enter a valid email.'; return; }
  if (pw.length < 6)          { regErr.textContent = 'Password must be at least 6 characters.'; return; }

  const accounts = getAccounts();
  if (accounts[email]) { regErr.textContent = 'An account with this email already exists.'; return; }

  accounts[email] = { name, pw: obscure(pw) };
  saveAccounts(accounts);

  regErr.textContent = '';
  loginUser({ name, email });
  hideAuth();
  notify('Account created!', `Welcome to TaskFlow, ${name} 🎉`, 'success');
}

/* ── Bind events ─────────────────────────────────────────── */
export function initAuth() {
  // Tab clicks (both the tab buttons AND inline "switch" link-btns)
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab && overlay.contains(tab)) switchTab(tab.dataset.tab);
  });

  btnLogin.addEventListener('click', handleLogin);
  btnRegister.addEventListener('click', handleRegister);

  // Enter key in inputs
  [loginEmail, loginPw].forEach(el => el.addEventListener('keydown', e => e.key === 'Enter' && handleLogin()));
  [regName, regEmail, regPw].forEach(el => el.addEventListener('keydown', e => e.key === 'Enter' && handleRegister()));

  // Password visibility toggle
  togglePw.addEventListener('click', () => {
    loginPw.type = loginPw.type === 'password' ? 'text' : 'password';
    togglePw.setAttribute('aria-label', loginPw.type === 'text' ? 'Hide password' : 'Show password');
  });

  // Password strength meter
  regPw.addEventListener('input', () => renderStrength(regPw.value));
}

/* ── Logout (called from settings) ──────────────────────── */
export function handleLogout() {
  logoutUser();
  // Clear form state
  loginEmail.value = ''; loginPw.value = '';
  regName.value = '';  regEmail.value = ''; regPw.value = '';
  loginErr.textContent = ''; regErr.textContent = '';
  showAuth();
}