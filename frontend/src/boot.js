/**
 * boot.js
 *
 * Application routing and initialization.
 * Handles URL-based routing and bootstraps the editor.
 */

import { createApp, attachYjsSync, attachStandaloneSync } from "./core/app.js";
import {
  createEditorView,
  syncCompartment,
  setContent,
} from "./core/editor.js";
import { loadThemes } from "./features/themes.js";
import { loadIdentity } from "./features/identity.js";
import { paletteExtension } from "./features/palette.js";
import { wikilinkExtension } from "./features/wiki.js";
import { registerCommands, registerDefaultCommands } from "./commands.js";
import { createSyncStatus } from "./ui/status.js";
import { getRecents, pushRecent } from "./features/persist.js";

/**
 * Initialize the application based on current URL.
 */
export function boot() {
  const raw = decodeURIComponent(location.pathname).slice(1);

  if (!raw) {
    bootScratch();
  } else {
    const filePath = raw.endsWith(".md") ? raw : raw + ".md";
    if (!raw.endsWith(".md")) {
      history.replaceState(null, "", "/" + filePath);
    }
    bootEditor(filePath);
  }
}

/**
 * Boot the editor for a specific file.
 * @param {string} filePath
 */
async function bootEditor(filePath) {
  document.title = filePath.replace(/\.md$/, "").split("/").pop();

  const app = createApp(filePath);
  const container = document.getElementById("app");
  container.style.cssText = "height:100%; overflow:auto";
  app.container = container;

  // Initialize features (before sync)
  loadThemes(app);
  registerDefaultCommands(app);

  // Create editor with sync compartment (will be configured after Yjs is attached)
  const view = createEditorView(container, {
    content: "",
    extensions: [
      syncCompartment.of([]),
      paletteExtension(app),
      wikilinkExtension(),
    ],
  });
  app.editor = view;

  // Attach Yjs sync (this sets app.awareness)
  await attachYjsSync(app, view);

  // Now load identity (needs awareness)
  loadIdentity(app);

  // Seed content if empty
  await seedIfEmpty(app);

  // Track recent files
  pushRecent(filePath.replace(/\.md$/, ""));

  // Create sync status indicator
  createSyncStatus(app);
}

/**
 * Boot the scratch buffer (home page).
 */
async function bootScratch() {
  document.title = "Leaf";

  const app = createApp("");
  const container = document.getElementById("app");
  container.style.cssText = "height:100%; overflow:auto";
  app.container = container;

  loadThemes(app);
  registerDefaultCommands(app);

  // Create editor first with initial content
  const files = await fetchFiles();
  const recents = getRecents();
  const allNotes = files.map((f) => f.path.replace(/\.md$/, ""));
  const bytes = files.reduce((s, f) => s + (f.size ?? 0), 0);

  const initialContent = [
    "# Leaf",
    "",
    "## Recent",
    ...(recents.length ? recents.map((r) => `- [[${r}]]`) : ["- _(none)_"]),
    "",
    "## Notes",
    ...(allNotes.length ? allNotes.map((n) => `- [[${n}]]`) : ["- _(none)_"]),
    "",
    `*${fmtBytes(bytes)} total*`,
  ].join("\n");

  const view = createEditorView(container, {
    content: initialContent,
    extensions: [
      syncCompartment.of([]),
      paletteExtension(app),
      wikilinkExtension(),
    ],
  });
  app.editor = view;

  // Attach sync for scratch buffer (empty path)
  await attachYjsSync(app, view, initialContent);

  // Load identity after sync is attached
  loadIdentity(app);
}

/**
 * Fetch the list of files from the API.
 * @returns {Promise<Array>}
 */
async function fetchFiles() {
  try {
    const r = await fetch("/api/files");
    if (r.ok) return await r.json();
  } catch {}
  return [];
}

/**
 * Seed the editor with content from the API if it's empty.
 * @param {Object} app
 */
async function seedIfEmpty(app) {
  const view = app.editor;
  if (view.state.doc.length > 0) return;

  // Wait a bit to ensure sync is established
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (view.state.doc.length > 0) return;

  const name = app.filePath.replace(/\.md$/, "").split("/").pop();
  try {
    const res = await fetch(`/api/files/${app.filePath}`);
    const text = res.ok ? await res.text() : `# ${name}\n`;
    setContent(view, text);
  } catch {
    setContent(view, `# ${name}\n`);
  }
}

/**
 * Format bytes to human-readable string.
 * @param {number} n
 * @returns {string}
 */
function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 ** 2) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 ** 2).toFixed(1) + " MB";
}
