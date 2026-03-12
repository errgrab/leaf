/**
 * plugins/persist.js
 *
 * Local persistence helpers.
 *   persist(app) → Promise  — loads IndexedDB state into the Yjs doc
 *   getRecents() → string[] — recent file names from localStorage
 *   pushRecent(name)        — add to recents list
 *
 * Note: IndexedDB persistence is handled inside sync.js (via y-indexeddb).
 * This module only exposes the recents list used by the scratch buffer.
 */

const RECENTS_KEY = "leaf-recents";

export async function persist(app) {
  // IndexedDB sync is handled in sync.js — nothing to do here yet.
  // This hook exists so future offline-first features can be added.
}

export function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function pushRecent(name) {
  const list = [name, ...getRecents().filter((r) => r !== name)].slice(0, 5);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
}