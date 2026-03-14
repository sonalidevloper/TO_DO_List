/**
 * state.js — Centralized application state (no DOM access here).
 *
 * Architecture:
 *  - A single `state` object is the source of truth.
 *  - Mutation only happens through exported functions.
 *  - Every mutation calls `persist()` to sync to localStorage.
 *  - Consumers subscribe via `onChange()` and re-render on update.
 *
 * ES6+ features used: destructuring, spread, arrow functions,
 * template literals, functional array methods (map / filter / reduce).
 */

import { Storage } from './storage.js';

/* ── Types (JSDoc) ───────────────────────────────────────── */
/**
 * @typedef {Object} Task
 * @property {string}  id          — Unique identifier (crypto UUID or timestamp)
 * @property {string}  title       — Task description
 * @property {string}  notes       — Optional detail
 * @property {boolean} completed   — Completion flag
 * @property {'low'|'medium'|'high'} priority
 * @property {string}  category    — personal | work | health | learning | other
 * @property {string}  dueDate     — ISO date string or ''
 * @property {number}  createdAt   — Unix timestamp (ms)
 */

/**
 * @typedef {Object} AppState
 * @property {Task[]}   tasks
 * @property {string}   filter      — all | active | completed | priority | today
 * @property {string}   sort        — created | due | priority | alpha
 * @property {string}   theme       — light | dark
 * @property {boolean}  compact
 * @property {Object}   user        — { name, email, avatar }
 * @property {Object}   settings    — { dailyGoal, reminders, dailySummary }
 * @property {boolean}  isLoggedIn
 */

/* ── Initial / Default State ─────────────────────────────── */
const DEFAULTS = {
  tasks: [],
  filter: 'all',
  sort: 'created',
  theme: 'light',
  compact: false,
  user: { name: '', email: '', avatar: '' },
  settings: { dailyGoal: 5, reminders: true, dailySummary: false },
  isLoggedIn: false,
};

/* ── Private state object ────────────────────────────────── */
let state = { ...DEFAULTS };

/* ── Subscribers ─────────────────────────────────────────── */
const subscribers = [];

/** Notify all subscribers that state has changed. */
const notify = () => subscribers.forEach(fn => fn(state));

/** Persist relevant slices to localStorage. */
const persist = () => {
  Storage.set('tasks',      state.tasks);
  Storage.set('settings',   state.settings);
  Storage.set('theme',      state.theme);
  Storage.set('compact',    state.compact);
  Storage.set('user',       state.user);
  Storage.set('isLoggedIn', state.isLoggedIn);
};

/* ── Initialise from storage ─────────────────────────────── */
export function initState() {
  state = {
    ...DEFAULTS,
    tasks:      Storage.get('tasks',      []),
    settings:   Storage.get('settings',   DEFAULTS.settings),
    theme:      Storage.get('theme',      'light'),
    compact:    Storage.get('compact',    false),
    user:       Storage.get('user',       DEFAULTS.user),
    isLoggedIn: Storage.get('isLoggedIn', false),
  };
  notify();
}

/** Subscribe to state changes. Returns an unsubscribe function. */
export function onChange(fn) {
  subscribers.push(fn);
  return () => {
    const idx = subscribers.indexOf(fn);
    if (idx > -1) subscribers.splice(idx, 1);
  };
}

/** Read-only snapshot of current state. */
export function getState() {
  return { ...state };
}

/* ── Auth Actions ────────────────────────────────────────── */
export function loginUser({ name, email }) {
  state = { ...state, isLoggedIn: true, user: { name, email, avatar: name[0]?.toUpperCase() ?? '?' } };
  persist(); notify();
}

export function logoutUser() {
  state = { ...DEFAULTS };
  Storage.clear();
  notify();
}

export function updateProfile({ name }) {
  const avatar = name?.[0]?.toUpperCase() ?? '?';
  state = { ...state, user: { ...state.user, name, avatar } };
  persist(); notify();
}

/* ── Task CRUD ───────────────────────────────────────────── */

/** Generate a simple unique ID. */
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function addTask({ title, notes = '', priority = 'medium', category = 'personal', dueDate = '' }) {
  const task = { id: uid(), title: title.trim(), notes, priority, category, dueDate, completed: false, createdAt: Date.now() };
  state = { ...state, tasks: [task, ...state.tasks] };
  persist(); notify();
  return task;
}

export function updateTask(id, patch) {
  state = {
    ...state,
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
  };
  persist(); notify();
}

export function deleteTask(id) {
  state = { ...state, tasks: state.tasks.filter(t => t.id !== id) };
  persist(); notify();
}

export function toggleTask(id) {
  state = {
    ...state,
    tasks: state.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t),
  };
  persist(); notify();
}

export function clearCompleted() {
  state = { ...state, tasks: state.tasks.filter(t => !t.completed) };
  persist(); notify();
}

export function clearAllTasks() {
  state = { ...state, tasks: [] };
  persist(); notify();
}

/* ── UI State ────────────────────────────────────────────── */
export function setFilter(filter) {
  state = { ...state, filter };
  notify(); // filter is ephemeral — no persist needed
}

export function setSort(sort) {
  state = { ...state, sort };
  notify();
}

export function setTheme(theme) {
  state = { ...state, theme };
  persist(); notify();
}

export function setCompact(compact) {
  state = { ...state, compact };
  persist(); notify();
}

export function updateSettings(patch) {
  state = { ...state, settings: { ...state.settings, ...patch } };
  persist(); notify();
}

/* ── Derived selectors (pure functions, no side effects) ─── */

/** Priority weights for sorting. */
const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

/** Return today's date as YYYY-MM-DD. */
export const todayStr = () => new Date().toISOString().slice(0, 10);

/** Filter then sort tasks according to current state. */
export function selectVisibleTasks({ tasks, filter, sort }) {
  const today = todayStr();

  // 1. Filter
  const filtered = tasks.filter(t => {
    switch (filter) {
      case 'active':    return !t.completed;
      case 'completed': return t.completed;
      case 'priority':  return t.priority === 'high' && !t.completed;
      case 'today':     return t.dueDate === today && !t.completed;
      default:          return true; // 'all'
    }
  });

  // 2. Sort
  return [...filtered].sort((a, b) => {
    switch (sort) {
      case 'due':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      case 'priority':
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      case 'alpha':
        return a.title.localeCompare(b.title);
      default: // 'created'
        return b.createdAt - a.createdAt;
    }
  });
}

/** Counts used to badge the sidebar navigation. */
export function selectCounts(tasks) {
  const today = todayStr();
  return {
    all:       tasks.length,
    active:    tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    priority:  tasks.filter(t => t.priority === 'high' && !t.completed).length,
    today:     tasks.filter(t => t.dueDate === today && !t.completed).length,
  };
}

/** Progress stats for the ring widget. */
export function selectProgress(tasks) {
  const total = tasks.length;
  const done  = tasks.filter(t => t.completed).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}