/**
 * persist.js
 *
 * Local IndexedDB persistence via y-indexeddb.
 * Restores the doc before the WebSocket connects — no flash of empty content,
 * and offline edits survive a page refresh.
 *
 * Swap for any other Y.js persistence adapter (OPFS, wa-sqlite, etc.)
 * without touching any other file.
 */

import { IndexeddbPersistence } from "y-indexeddb";

/**
 * @param   {string}  filePath  Used as the IndexedDB store key.
 * @param   {Y.Doc}   doc
 * @returns {Promise<IndexeddbPersistence>}  Resolves once local data is loaded.
 */
export function createPersist(filePath, doc) {
  const persist = new IndexeddbPersistence(filePath, doc);
  return new Promise((resolve) => persist.on("synced", () => resolve(persist)));
}
