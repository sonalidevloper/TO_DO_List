import {
  initState, onChange, getState,
  addTask, updateTask, deleteTask, toggleTask, clearCompleted, clearAllTasks,
  setFilter, setSort, setTheme, setCompact, updateSettings, updateProfile, logoutUser,
  selectCounts,
} from './state.js';

import { render, renderSettings } from './renderer.js';
import { initAuth, showAuth, hideAuth, handleLogout } from './auth.js';
import { notify } from './notifications.js';

/* ── Shorthand helpers ───────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── 1. INITIALISE ───────────────────────────────────────── */
initState();
initAuth();

// Subscribe to state changes → re-render
onChange(state => render(state));

// Decide: show auth or jump straight to app
const initial = getState();
if (initial.isLoggedIn) {
  hideAuth();
  render(initial);
  greetUser(initial.user);
} else {
  showAuth();
}

/* ── 2. TASK INPUT & ADD ─────────────────────────────────── */
const taskInput     = $('task-input');
const btnAddTask    = $('btn-add-task');
const btnToggleForm = $('btn-toggle-form');
const addExtras     = $('add-task-extras');
const taskDue       = $('task-due');
const taskPriority  = $('task-priority');
const taskCategory  = $('task-category');
const taskNotes     = $('task-notes');

/** Read input fields and dispatch addTask. */
function submitNewTask() {
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    notify('Task title required', 'Please type something before adding.', 'warning');
    return;
  }

  addTask({
    title,
    notes:    taskNotes.value.trim(),
    priority: taskPriority.value,
    category: taskCategory.value,
    dueDate:  taskDue.value,
  });

  // Reset form
  taskInput.value   = '';
  taskNotes.value   = '';
  taskDue.value     = '';
  taskPriority.value = 'medium';
  taskCategory.value = 'personal';
  taskInput.focus();

  notify('Task added!', title, 'success', 2500);
  checkGoal();
}

btnAddTask.addEventListener('click', submitNewTask);
taskInput.addEventListener('keydown', e => e.key === 'Enter' && submitNewTask());

// Expand/collapse extra fields
btnToggleForm.addEventListener('click', () => {
  const open = addExtras.hidden;
  addExtras.hidden = !open;
  btnToggleForm.setAttribute('aria-expanded', String(open));
  btnToggleForm.style.transform = open ? 'rotate(45deg)' : '';
  if (open) taskInput.focus();
});

// Empty-state shortcut
$('btn-empty-add')?.addEventListener('click', () => {
  taskInput.focus();
  if (addExtras.hidden) btnToggleForm.click();
});

/* ── 3. TASK LIST DELEGATION ─────────────────────────────── */
/** Single delegated listener on the task list handles: toggle, edit, delete. */
$('task-list').addEventListener('click', e => {
  const btn  = e.target.closest('[data-action]');
  if (!btn) return;

  const item = btn.closest('[data-id]');
  if (!item) return;
  const id = item.dataset.id;

  switch (btn.dataset.action) {
    case 'toggle': handleToggle(id, item); break;
    case 'edit':   openEditModal(id); break;
    case 'delete': handleDelete(id, item); break;
  }
});

/** Keyboard accessibility: Space/Enter on task items. */
$('task-list').addEventListener('keydown', e => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  const btn = e.target.closest('[data-action]');
  if (btn) { e.preventDefault(); btn.click(); }
});

function handleToggle(id, itemEl) {
  toggleTask(id);
  // Brief visual pop on checkbox
  const checkbox = itemEl.querySelector('.task-item__checkbox');
  checkbox?.classList.add('task-item__checkbox--checked');
  checkGoal();
}

function handleDelete(id, itemEl) {
  itemEl.classList.add('task-item--deleting');
  itemEl.addEventListener('animationend', () => {
    deleteTask(id);
    notify('Task deleted', '', 'info', 2000);
  }, { once: true });
}

/* ── 4. FILTER & SORT ────────────────────────────────────── */
document.addEventListener('click', e => {
  const navBtn = e.target.closest('.nav-btn[data-filter]');
  if (!navBtn) return;
  setFilter(navBtn.dataset.filter);
});

$('sort-select').addEventListener('change', e => setSort(e.target.value));

/* ── 5. CLEAR COMPLETED ──────────────────────────────────── */
$('btn-clear-completed').addEventListener('click', () => {
  const { tasks } = getState();
  const doneCount = tasks.filter(t => t.completed).length;
  if (!doneCount) { notify('Nothing to clear', 'No completed tasks found.', 'info', 2000); return; }
  clearCompleted();
  notify(`${doneCount} task${doneCount > 1 ? 's' : ''} cleared`, '', 'success', 2500);
});

/* ── 6. EDIT MODAL ───────────────────────────────────────── */
const editModal      = $('edit-modal');
const editId         = $('edit-task-id');
const editTitle      = $('edit-task-title');
const editDue        = $('edit-task-due');
const editPriority   = $('edit-task-priority');
const editCategory   = $('edit-task-category');
const editNotes      = $('edit-task-notes');

function openEditModal(id) {
  const { tasks } = getState();
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editId.value       = id;
  editTitle.value    = task.title;
  editDue.value      = task.dueDate || '';
  editPriority.value = task.priority;
  editCategory.value = task.category;
  editNotes.value    = task.notes || '';

  editModal.hidden = false;
  editTitle.focus();
}

function closeEditModal() {
  editModal.hidden = true;
}

$('close-modal').addEventListener('click', closeEditModal);
$('cancel-edit').addEventListener('click', closeEditModal);

$('save-edit').addEventListener('click', () => {
  const title = editTitle.value.trim();
  if (!title) { notify('Title required', '', 'warning'); return; }

  updateTask(editId.value, {
    title,
    dueDate:  editDue.value,
    priority: editPriority.value,
    category: editCategory.value,
    notes:    editNotes.value.trim(),
  });
  closeEditModal();
  notify('Task updated ✓', title, 'success', 2000);
});

// Close modal on backdrop click
editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !editModal.hidden) closeEditModal();
  if (e.key === 'Escape' && !$('settings-drawer').hidden) closeSettings();
});

/* ── 7. THEME TOGGLE ─────────────────────────────────────── */
function applyTheme(dark) {
  setTheme(dark ? 'dark' : 'light');
  $('btn-toggle-theme').textContent = dark ? '☀️' : '🌙';
  $('btn-toggle-theme').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  const sw = $('theme-switch');
  if (sw) sw.setAttribute('aria-checked', String(dark));
}

$('btn-toggle-theme').addEventListener('click', () => {
  const { theme } = getState();
  applyTheme(theme !== 'dark');
});

/* ── 8. SETTINGS DRAWER ──────────────────────────────────── */
const settingsDrawer  = $('settings-drawer');
const settingsOverlay = $('settings-overlay');

function openSettings() {
  settingsDrawer.hidden  = false;
  settingsOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  $('close-settings').focus();
  renderSettings(getState());
}

function closeSettings() {
  settingsDrawer.hidden  = true;
  settingsOverlay.hidden = true;
  document.body.style.overflow = '';
}

$('btn-open-settings').addEventListener('click', openSettings);
$('user-pill').addEventListener('click', openSettings);
$('user-pill').addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && openSettings());
$('close-settings').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

// Theme switch inside settings
$('theme-switch').addEventListener('click', e => {
  const dark = e.currentTarget.getAttribute('aria-checked') !== 'true';
  applyTheme(dark);
});

// Compact switch
$('compact-switch').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
  setCompact(on);
  e.currentTarget.setAttribute('aria-checked', String(on));
});

// Reminder & Summary switches
$('reminder-switch').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
  updateSettings({ reminders: on });
  e.currentTarget.setAttribute('aria-checked', String(on));
  notify(on ? 'Reminders enabled' : 'Reminders disabled', '', 'info', 2000);
});

$('summary-switch').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-checked') !== 'true';
  updateSettings({ dailySummary: on });
  e.currentTarget.setAttribute('aria-checked', String(on));
});

// Save profile
$('btn-save-profile').addEventListener('click', () => {
  const name = $('edit-name').value.trim();
  if (!name) { notify('Name required', '', 'warning'); return; }
  updateProfile({ name });
  notify('Profile updated ✓', '', 'success', 2000);
});

// Save settings
$('btn-save-settings').addEventListener('click', () => {
  const goal = parseInt($('daily-goal-input').value, 10);
  if (goal < 1 || goal > 50) { notify('Goal must be 1–50', '', 'warning'); return; }
  updateSettings({ dailyGoal: goal });
  notify('Settings saved ✓', '', 'success', 2000);
  closeSettings();
});

// Clear all data
$('btn-clear-all').addEventListener('click', () => {
  if (!confirm('Are you sure? This will delete ALL your tasks permanently.')) return;
  clearAllTasks();
  closeSettings();
  notify('All data cleared', '', 'info', 3000);
});

// Logout
$('btn-logout').addEventListener('click', () => {
  closeSettings();
  handleLogout();
});

/* ── 9. FEEDBACK / GOAL TRACKING ─────────────────────────── */
const feedbackBanner = $('feedback-banner');
let goalShownToday = false;

function checkGoal() {
  if (goalShownToday) return;
  const { tasks, settings } = getState();
  const done = tasks.filter(t => t.completed).length;
  if (done >= settings.dailyGoal) {
    goalShownToday = true;
    feedbackBanner.hidden = false;
    $('feedback-title').textContent = `🎯 Daily goal reached!`;
    $('feedback-body').textContent  = `You've completed ${done} tasks today. Keep up the momentum!`;
    notify('Daily goal reached! 🎯', `${done} tasks completed`, 'success', 5000);
  }
}

$('close-feedback').addEventListener('click', () => { feedbackBanner.hidden = true; });

/* ── 10. GREET USER ──────────────────────────────────────── */
function greetUser(user) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  notify(`${greeting}, ${user.name?.split(' ')[0] || 'there'}! 👋`, 'Ready to get things done?', 'info', 4000);
}

/* ── 11. SYSTEM THEME DETECTION ─────────────────────────── */
(function detectSystemTheme() {
  const { theme } = getState();
  // Only auto-apply system theme if user hasn't manually set one
  if (!theme || theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  } else {
    applyTheme(theme === 'dark');
  }
})();

// Listen for live system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  const { theme } = getState();
  if (theme === 'auto') applyTheme(e.matches);
});

/* ── 12. SIMULATED REMINDERS ─────────────────────────────── */
(function scheduleReminders() {
  // Check for overdue tasks 10 seconds after load
  setTimeout(() => {
    const { tasks, settings } = getState();
    if (!settings.reminders || !getState().isLoggedIn) return;

    const today   = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < today);
    const dueToday = tasks.filter(t => !t.completed && t.dueDate === today);

    if (overdue.length)  notify(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, 'Don\'t let them pile up!', 'warning', 6000);
    if (dueToday.length) notify(`${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`, 'Stay on top of it!', 'info', 5000);
  }, 10_000);
})();