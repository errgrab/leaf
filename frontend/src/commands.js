/**
 * commands.js
 *
 * Two editor augmentations:
 *
 *  1. `/` command popup   — triggered by typing "/" at line start
 *     Commands are plain objects { label, detail, run(view) }
 *     Easy to extend: just push to COMMANDS.
 *
 *  2. `[[` wiki-link autocomplete — triggered by typing "[["
 *     Fetches file list from GET /api/files, shows matching notes,
 *     inserts [[filename]] and navigates on click.
 *
 * Both use a single shared vanilla popup element — no dependencies.
 */

import { ViewPlugin, keymap } from "@codemirror/view";
import { cycleTheme } from "./theme.js";

// ---------------------------------------------------------------------------
// Slash commands — add your own here
// ---------------------------------------------------------------------------

const COMMANDS = [
  {
    label: "/theme",
    detail: "cycle colour theme",
    run: (view) => {
      cycleTheme();
      closePopup();
    },
  },
  {
    label: "/new",
    detail: "open a new note",
    run: (view) => {
      promptNavigate();
    },
  },
  {
    label: "/home",
    detail: "go to scratch buffer",
    run: () => {
      window.location.href = "/";
    },
  },
];

// ---------------------------------------------------------------------------
// Shared popup
// ---------------------------------------------------------------------------

let popup = null;
let items = [];
let selected = 0;

function createPopup() {
  if (popup) return;
  popup = document.createElement("div");
  popup.style.cssText = `
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--fg-dim);
    border-radius: 4px;
    padding: 4px 0;
    min-width: 220px;
    max-height: 240px;
    overflow-y: auto;
    z-index: 1000;
    font-family: var(--font-mono);
    font-size: 13px;
    display: none;
  `;
  document.body.appendChild(popup);
}

function showPopup(x, y, entries, onSelect) {
  createPopup();
  items = entries;
  selected = 0;
  popup.innerHTML = "";

  entries.forEach((entry, i) => {
    const row = document.createElement("div");
    row.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      color: var(--fg);
    `;
    row.innerHTML = `<span>${entry.label}</span><span style="color:var(--fg-dim)">${entry.detail ?? ""}</span>`;
    row.addEventListener("mouseenter", () => setSelected(i));
    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onSelect(entry);
    });
    popup.appendChild(row);
  });

  setSelected(0);
  popup.style.display = "block";
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
}

function setSelected(i) {
  const rows = popup.querySelectorAll("div");
  rows.forEach((r, j) => {
    r.style.background = j === i ? "var(--accent-dim)" : "";
    r.style.color = j === i ? "var(--bg)" : "var(--fg)";
  });
  selected = i;
}

export function closePopup() {
  if (popup) popup.style.display = "none";
  items = [];
}

function isOpen() {
  return popup?.style.display === "block";
}

// ---------------------------------------------------------------------------
// File list cache
// ---------------------------------------------------------------------------

let _fileCache = null;

async function getFiles() {
  if (_fileCache) return _fileCache;
  const res = await fetch("/api/files");
  _fileCache = res.ok ? await res.json() : [];
  setTimeout(() => {
    _fileCache = null;
  }, 30_000); // refresh every 30s
  return _fileCache;
}

// ---------------------------------------------------------------------------
// Navigate helper
// ---------------------------------------------------------------------------

export function navigateTo(path) {
  // Strip .md for clean display URL then redirect
  const clean = path.replace(/\.md$/, "");
  window.location.href = `/${clean}`;
}

function promptNavigate() {
  const path = window.prompt("Open note (e.g. tokyo or notes/tokyo):");
  if (path?.trim()) navigateTo(path.trim());
}

// ---------------------------------------------------------------------------
// CodeMirror extension
// ---------------------------------------------------------------------------

export function leafCommands() {
  return [
    slashCommandPlugin(),
    wikiLinkPlugin(),
    keymap.of([
      {
        key: "Escape",
        run: (view) => {
          if (isOpen()) {
            closePopup();
            return true;
          }
          return false;
        },
      },
      {
        key: "ArrowDown",
        run: () => {
          if (isOpen()) {
            setSelected((selected + 1) % items.length);
            return true;
          }
          return false;
        },
      },
      {
        key: "ArrowUp",
        run: () => {
          if (isOpen()) {
            setSelected((selected - 1 + items.length) % items.length);
            return true;
          }
          return false;
        },
      },
      {
        key: "Enter",
        run: (view) => {
          if (isOpen() && items[selected]) {
            items[selected].run?.(view);
            closePopup();
            return true;
          }
          return false;
        },
      },
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Slash command plugin
// ---------------------------------------------------------------------------

function slashCommandPlugin() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
      }

      update(update) {
        if (!update.docChanged) return;
        const { state } = update.view;
        const { from } = state.selection.main;
        const line = state.doc.lineAt(from);
        const lineText = line.text.slice(0, from - line.from);

        // Trigger on "/" at start of line or after whitespace
        const match = lineText.match(/(?:^|\s)(\/\w*)$/);
        if (!match) {
          closePopup();
          return;
        }

        const query = match[1];
        const matches = COMMANDS.filter((c) => c.label.startsWith(query));
        if (!matches.length) {
          closePopup();
          return;
        }

        const coords = update.view.coordsAtPos(from);
        if (!coords) return;

        showPopup(coords.left, coords.bottom + 4, matches, (cmd) => {
          // Replace the /command text with nothing, then run
          const view = update.view;
          const start = from - query.length;
          view.dispatch({ changes: { from: start, to: from, insert: "" } });
          cmd.run(view);
          closePopup();
        });
      }

      destroy() {
        closePopup();
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Wiki-link plugin  [[
// ---------------------------------------------------------------------------

function wikiLinkPlugin() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
      }

      update(update) {
        if (!update.docChanged) return;
        const { state } = update.view;
        const { from } = state.selection.main;
        const line = state.doc.lineAt(from);
        const before = line.text.slice(0, from - line.from);

        const match = before.match(/\[\[([^\]]*)$/);
        if (!match) {
          closePopup();
          return;
        }

        const query = match[1];
        getFiles().then((files) => {
          const matches = files
            .filter((f) =>
              f.path
                .replace(/\.md$/, "")
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .slice(0, 10)
            .map((f) => ({
              label: f.path.replace(/\.md$/, ""),
              detail: "",
              run: (view) => {
                // Complete the [[link]]
                const start = from - match[1].length;
                const insert = `${f.path.replace(/\.md$/, "")}]]`;
                view.dispatch({ changes: { from: start, to: from, insert } });
                closePopup();
              },
            }));

          if (!matches.length) {
            closePopup();
            return;
          }
          const coords = update.view.coordsAtPos(from);
          if (coords)
            showPopup(coords.left, coords.bottom + 4, matches, (cmd) => {
              cmd.run(update.view);
              closePopup();
            });
        });
      }

      destroy() {
        closePopup();
      }
    },
  );
}
