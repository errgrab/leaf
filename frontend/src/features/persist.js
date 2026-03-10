/**
 * features/persist.js
 *
 * Local persistence helpers.
 */

import { IndexeddbPersistence } from "y-indexeddb";

/**
 * Load persisted state from IndexedDB.
 * @param {Object} app
 * @returns {Promise<void>}
 */
export function loadPersist(app) {
  return new Promise((resolve) => {
    if (app.filePath) {
      new IndexeddbPersistence(app.filePath, app.doc).on("synced", resolve);
    } else {
      resolve();
    }
  });
}

/**
 * Get recent files from localStorage.
 * @returns {Array<string>}
 */
export function getRecents() {
  try {
    return JSON.parse(localStorage.getItem("leaf-recents") ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Push a file to the recent files list.
 * @param {string} name - File name without extension
 */
export function pushRecent(name) {
  const list = [name, ...getRecents().filter((r) => r !== name)].slice(0, 5);
  localStorage.setItem("leaf-recents", JSON.stringify(list));
}
