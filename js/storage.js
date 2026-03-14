/**
 * storage.js — Persistent key-value store backed by localStorage.
 * All reads/writes go through this module so the rest of the app
 * never touches localStorage directly (single-responsibility principle).
 */

const PREFIX = 'taskflow_';

export const Storage = {
  /**
   * Retrieve a parsed value by key.
   * Returns `defaultValue` when the key is missing or JSON is corrupt.
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /** Serialize and persist a value. */
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.warn('[Storage] Could not save:', err);
    }
  },

  /** Remove a single key. */
  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  /** Wipe every key belonging to this app. */
  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};