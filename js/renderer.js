/**
 * renderer.js — Pure UI rendering layer.
 *
 * Receives state slices and mutates the DOM.
 * No state is owned here — this is a dumb "view" layer.
 * Uses template literals, destructuring, and functional methods.
 */

import { todayStr, selectVisibleTasks, selectCounts, selectProgress } from './state.js';

/* ── DOM element cache ───────────────────────────────────── */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const taskList     = $('task-list');
const emptyState   = $('empty-state');
const emptyHeading = $('empty-heading');
const emptyBody    = $('empty-body');
const actionCount  = $('action-count');
const topbarTitle  = $('topbar-title');
const topbarDate   = $('topbar-date');
const ringProgress = $('ring-progress');
const ringPercent  = $('ring-percent');
const statsDone    = $('stats-done-count');

/* ── Helpers ─────────────────────────────────────────────── */
/** Format an ISO date string to a human-readable label. */
function formatDue(isoDate) {
  if (!isoDate) return '';
  const today    = todayStr();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (isoDate === today)    return '📅 Today';
  if (isoDate === tomorrow) return '📅 Tomorrow';
  const d = new Date(isoDate + 'T00:00:00'); // force local TZ
  return `📅 ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Return true if a task's due date is in the past (and not completed). */
function isOverdue(task) {
  return !task.completed && task.dueDate && task.dueDate < todayStr();
}

/* ── Filter label map ────────────────────────────────────── */
const FILTER_LABEL = {
  all:       'All Tasks',
  active:    'Active Tasks',
  completed: 'Completed',
  priority:  'High Priority',
  today:     'Due Today',
};

const EMPTY_COPY = {
  all:       { h: "You're all caught up!",         b: "Add a task above to get started. Small steps lead to big wins." },
  active:    { h: "Nothing active right now!",     b: "All tasks are completed — great work! 🎉" },
  completed: { h: "No completed tasks yet",        b: "Finish your first task and it'll appear here." },
  priority:  { h: "No high-priority tasks",        b: "Your urgent list is clear. Mark tasks as High priority to see them here." },
  today:     { h: "Nothing due today",             b: "Schedule tasks with today's date and they'll appear here." },
};

/* ── Render: topbar ──────────────────────────────────────── */
export function renderTopbar(filter) {
  topbarTitle.textContent = FILTER_LABEL[filter] ?? 'Tasks';
  topbarDate.textContent  = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/* ── Render: sidebar badges & progress ring ──────────────── */
export function renderSidebar({ tasks, filter }) {
  const counts = selectCounts(tasks);
  // Update badges
  Object.entries(counts).forEach(([key, count]) => {
    const badge = $(`badge-${key}`);
    if (badge) badge.textContent = count;
  });

  // Active nav button
  $$('.nav-btn').forEach(btn => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('nav-btn--active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  // Progress ring
  const { total, done, pct } = selectProgress(tasks);
  const CIRCUMFERENCE = 113; // 2 * π * r (r=18)
  ringProgress.style.strokeDashoffset = `${CIRCUMFERENCE - (CIRCUMFERENCE * pct) / 100}`;
  ringPercent.textContent  = `${pct}%`;
  statsDone.textContent    = `${done} of ${total} done`;
}

/* ── Render: user profile chips ──────────────────────────── */
export function renderProfile({ user }) {
  const initial = user.avatar || user.name?.[0]?.toUpperCase() || '?';
  const sidebarAvatar = $('sidebar-avatar');
  const sidebarName   = $('sidebar-username');
  const settingsAvatar = $('settings-avatar');
  const settingsName   = $('settings-name');
  const settingsEmail  = $('settings-email');

  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (sidebarName)   sidebarName.textContent   = user.name || 'User';
  if (settingsAvatar) settingsAvatar.textContent = initial;
  if (settingsName)   settingsName.textContent   = user.name || '';
  if (settingsEmail)  settingsEmail.textContent  = user.email || '';

  const editName = $('edit-name');
  if (editName) editName.value = user.name || '';
}

/* ── Render: single task item HTML ───────────────────────── */
function buildTaskHTML(task) {
  const { id, title, notes, completed, priority, category, dueDate } = task;
  const overdue    = isOverdue(task);
  const dueLabel   = formatDue(dueDate);
  const checkedCls = completed ? 'task-item__checkbox--checked' : '';
  const doneCls    = completed ? 'task-item--completed' : '';

  // Priority tag
  const priorityTag = `<span class="task-item__tag task-item__tag--priority-${priority}">${priority}</span>`;

  // Due date tag
  const dueTag = dueLabel
    ? `<span class="task-item__due ${overdue ? 'task-item__due--overdue' : ''}">${overdue ? '⚠️ Overdue' : dueLabel}</span>`
    : '';

  // Overdue badge
  const overdueBadge = overdue ? `<span class="task-item__tag task-item__tag--overdue">Overdue</span>` : '';

  return `
    <li
      class="task-item ${doneCls}"
      data-id="${id}"
      data-priority="${priority}"
      role="listitem"
    >
      <button
        class="task-item__checkbox ${checkedCls}"
        aria-label="${completed ? 'Mark task incomplete' : 'Mark task complete'}: ${title}"
        aria-pressed="${completed}"
        data-action="toggle"
        tabindex="0"
      >${completed ? '<span class="check-icon" aria-hidden="true">✓</span>' : ''}</button>

      <div class="task-item__body">
        <p class="task-item__title">${escapeHTML(title)}</p>
        ${notes ? `<p class="task-item__notes">${escapeHTML(notes)}</p>` : ''}
        <div class="task-item__meta">
          <span class="task-item__tag task-item__tag--category">${category}</span>
          ${priorityTag}
          ${overdueBadge}
          ${dueTag}
        </div>
      </div>

      <div class="task-item__actions">
        <button class="btn-icon" aria-label="Edit task: ${title}" data-action="edit" title="Edit">✏️</button>
        <button class="btn-icon" aria-label="Delete task: ${title}" data-action="delete" title="Delete">🗑️</button>
      </div>
    </li>
  `;
}

/** Escape HTML special characters to prevent XSS. */
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ── Render: task list ───────────────────────────────────── */
export function renderTaskList(state) {
  const { filter, sort } = state;
  const visible = selectVisibleTasks(state);

  // Update action-bar count label
  const activeCnt = state.tasks.filter(t => !t.completed).length;
  actionCount.textContent = `${activeCnt} task${activeCnt !== 1 ? 's' : ''} remaining`;

  if (visible.length === 0) {
    taskList.innerHTML = '';
    emptyState.hidden  = false;
    const copy = EMPTY_COPY[filter] ?? EMPTY_COPY.all;
    emptyHeading.textContent = copy.h;
    emptyBody.textContent    = copy.b;
    return;
  }

  emptyState.hidden  = true;
  taskList.innerHTML = visible.map(buildTaskHTML).join('');
}

/* ── Render: settings toggles ────────────────────────────── */
export function renderSettings({ settings, theme, compact }) {
  const themeSwitch   = $('theme-switch');
  const compactSwitch = $('compact-switch');
  const remSwitch     = $('reminder-switch');
  const sumSwitch     = $('summary-switch');
  const goalInput     = $('daily-goal-input');

  if (themeSwitch)   { themeSwitch.setAttribute('aria-checked',   String(theme === 'dark')); }
  if (compactSwitch) { compactSwitch.setAttribute('aria-checked', String(compact)); }
  if (remSwitch)     { remSwitch.setAttribute('aria-checked',     String(settings.reminders)); }
  if (sumSwitch)     { sumSwitch.setAttribute('aria-checked',     String(settings.dailySummary)); }
  if (goalInput)       goalInput.value = settings.dailyGoal;
}

/* ── Render: full re-render pass ─────────────────────────── */
export function render(state) {
  renderTopbar(state.filter);
  renderSidebar(state);
  renderTaskList(state);
  renderProfile(state);
  renderSettings(state);

  // Apply theme & compact classes to root
  document.documentElement.dataset.theme   = state.theme;
  document.documentElement.dataset.compact = String(state.compact);
}