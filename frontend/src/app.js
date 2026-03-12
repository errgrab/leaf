/**
 * app.js
 *
 * Creates the app context and wires together the editor, sync, and plugins.
 * `app` is the shared object passed to every plugin — it is the plugin API.
 *
 * Plugins register commands via app.addCommand({ label, detail, run }).
 * Plugins can read app.editor, app.sync, app.filePath, app.identity.
 */

import { createEditor, setContent, pluginsSlot } from "./editor.js";
import { createSync } from "./sync.js";
import { themes } from "./plugins/themes.js";
import { identity } from "./plugins/identity.js";
import { commands } from "./plugins/commands.js";
import { paletteExtension } from "./plugins/palette.js";
import { wikilinkExtension } from "./plugins/wiki.js";
import { getRecents, pushRecent } from "./plugins/persist.js";
import { statusIndicator } from "./ui/status.js";

export async function createApp({ filePath = "", container }) {
  // Shared context — this is what plugins receive
  const app = {
    filePath,
    container,
    editor: null,   // set below
    sync: null,     // set below
    identity: null, // set by identity plugin
    _commands: [],

    addCommand(cmd) {
      this._commands.push(cmd);
    },
    getCommands() {
      return this._commands;
    },
  };

  // Set page title
  document.title = filePath
    ? "Leaf - " + filePath.replace(/\.md$/, "").split("/").pop()
    : "Leaf";

  // Mount editor
  container.style.cssText = "height:100%; overflow:auto";
  app.editor = createEditor(container);

  // Connect sync — loads IDB, syncs with server, merges with peers
  app.sync = createSync(app);

  // Wait for first server sync round-trip before deciding to seed
  await app.sync.synced;

  // If still empty after sync, seed content
  if (app.editor.state.doc.length === 0) {
    if (filePath) {
      await seedFromServer(app);
    } else {
      await seedScratch(app);
    }
  }

  // Track this file in recents
  if (filePath) {
    pushRecent(filePath.replace(/\.md$/, ""));
  }

  // Load plugins — order matters (themes first, identity needs sync.awareness)
  themes(app);
  identity(app);
  commands(app);

  // Attach editor extensions for plugins that need them
  app.editor.dispatch({
    effects: pluginsSlot.reconfigure([
      paletteExtension(app),
      wikilinkExtension(),
    ]),
  });

  statusIndicator(app);

  return app;
}

/**
 * Fetch file content from server and set it in the editor.
 * Only called when both IndexedDB and sync produced an empty doc.
 */
async function seedFromServer(app) {
  const name = app.filePath.replace(/\.md$/, "").split("/").pop();
  try {
    const res  = await fetch(`/api/files/${app.filePath}`);
    const text = res.ok ? await res.text() : `# ${name}\n`;
    setContent(app.editor, text);
  } catch {
    setContent(app.editor, `# ${name}\n`);
  }
}

/**
 * Build the scratch buffer home page from server file list + local recents.
 */
async function seedScratch(app) {
  let files = [];
  try {
    const res = await fetch("/api/files");
    if (res.ok) files = await res.json();
  } catch {}

  const recents  = getRecents();
  const allNotes = files.map((f) => f.path.replace(/\.md$/, ""));
  const bytes    = files.reduce((s, f) => s + (f.size ?? 0), 0);

  const content = [
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

  setContent(app.editor, content);
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 ** 2) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 ** 2).toFixed(1) + " MB";
}