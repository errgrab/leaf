/**
 * core/app.js
 *
 * Application state and optional Yjs sync layer.
 * The app can work standalone - Yjs is pluggable for collaboration.
 */

import * as Y from "yjs";
import { syncCompartment } from "./editor.js";

/**
 * Create application state.
 * @param {string} filePath - The file path for this note
 * @returns {Object}
 */
export function createApp(filePath) {
  const commands = {
    _list: [],
    register(cmd) {
      this._list.push(cmd);
    },
    all() {
      return this._list;
    },
  };

  return {
    filePath,
    container: null, // DOM container
    editor: null, // CodeMirror EditorView
    sync: null, // Sync provider (optional)
    awareness: null, // Y.js Awareness (optional)
    commands,
    theme: null, // Theme controller
    identity: null, // User identity for collaboration
  };
}

/**
 * Attach Yjs sync to an existing editor.
 * This makes the editor collaborative without changing its core functionality.
 *
 * @param {Object} app - The app instance
 * @param {EditorView} view - CodeMirror editor view
 * @param {string} initialContent - Initial content if doc is empty
 * @returns {Promise<Object>} The sync provider
 */
export async function attachYjsSync(app, view, initialContent = "") {
  const doc = new Y.Doc();
  const ytext = doc.getText("content");

  // Import existing content if doc is empty
  if (ytext.length === 0 && initialContent) {
    ytext.insert(0, initialContent);
  }

  // Import the sync provider (WebSocket + persistence) first
  const { RelayProvider } = await import("../features/sync.js");
  const provider = new RelayProvider(app, doc, ytext);

  app.sync = provider;
  app.awareness = provider.awareness;
  app.doc = doc;
  app.ytext = ytext;

  // Now import y-codemirror and attach collab extension
  const { yCollab } = await import("y-codemirror.next");
  
  // Attach collab extension to editor via compartment
  view.dispatch({
    effects: syncCompartment.reconfigure(yCollab(ytext, provider.awareness)),
  });

  return provider;
}

/**
 * Create a standalone app without Yjs sync.
 * Useful for offline mode or simple editing.
 *
 * @param {Object} app - The app instance
 * @param {EditorView} view - CodeMirror editor view
 * @param {string} initialContent - Initial content
 */
export function attachStandaloneSync(app, view, initialContent = "") {
  // Create a mock awareness that does nothing
  app.awareness = {
    setLocalStateField() {},
    on() {},
    getStates() {
      return new Map();
    },
  };

  // Set content directly
  if (initialContent && view.state.doc.length === 0) {
    view.dispatch({
      changes: { from: 0, to: 0, insert: initialContent },
    });
  }

  // Mock sync
  app.sync = {
    on() {},
    connected: false,
    saveNow: async () => {},
  };
}
