import "./style.css";

import * as Y from "yjs";
import { loadTheme } from "./theme.js";
import { createPersist } from "./persist.js";
import { RelayProvider } from "./sync.js";
import { createEditor } from "./editor.js";

loadTheme();

function getRecents() {
  try {
    return JSON.parse(localStorage.getItem("leaf-recents") ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(name) {
  const list = [name, ...getRecents().filter((r) => r !== name)].slice(0, 5);
  localStorage.setItem("leaf-recents", JSON.stringify(list));
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function bootScratch() {
  document.title = "Leaf";

  let files = [];
  try {
    const res = await fetch("/api/files");
    if (res.ok) files = await res.json();
  } catch {}

  const recents = getRecents();
  const allNotes = files.map((f) => f.path.replace(/\.md$/, ""));
  const totalBytes = files.reduce((s, f) => s + (f.size ?? 0), 0);

  // Build scratch content as plain text (rendered in the editor as markdown)
  const recentLines = recents.length
    ? recents.map((r) => `- [[${r}]]`).join("\n")
    : "- _(none yet)_";

  const allLines = allNotes.length
    ? allNotes.map((n) => `- [[${n}]]`).join("\n")
    : "- _(no notes yet)_";

  const scratch = [
    "# Leaf",
    "",
    "## Recents",
    recentLines,
    "",
    "## Notes",
    allLines,
    "",
    "---",
    `_${fmt(totalBytes)} total_`,
  ].join("\n");

  // In-memory doc only — no IndexedDB, no WebSocket
  const doc = new Y.Doc();
  mount(doc, null); // no sync provider for scratch
  doc.getText("content").insert(0, scratch);
}

// Routes

const raw = decodeURIComponent(location.pathname).replace(/^\//, "");

if (!raw) {
  bootScratch();
} else if (!raw.includes(".")) {
  // No extension → redirect to .md canonical URL
  history.replaceState(null, "", `/${raw}.md`);
  bootEditor(`${raw}.md`);
} else {
  bootEditor(raw);
}

async function bootEditor(filePath) {
  document.title = "Leaf - " + filePath.replace(/\.md$/, "").split("/").pop();
  pushRecent(filePath.replace(/\.md$/, ""));

  const doc = new Y.Doc();
  await createPersist(filePath, doc);
  const sync = new RelayProvider(
    `ws://${location.host}/ws/files`,
    filePath,
    doc,
  );
  mount(doc, sync);
  await seedIfEmpty(doc, filePath, sync);

  // Save on page unload (catches tab close / navigation)
  window.addEventListener("beforeunload", () => sync.saveNow());
}

// ---------------------------------------------------------------------------
// Cold-join seed
// ---------------------------------------------------------------------------

async function seedIfEmpty(doc, filePath, sync) {
  // Give the WS a moment to connect and receive peer updates
  await new Promise((resolve) => {
    if (sync.connected) return resolve();
    const t = setTimeout(resolve, 800);
    sync.on("status", ({ connected }) => {
      if (connected) {
        clearTimeout(t);
        resolve();
      }
    });
  });

  const ytext = doc.getText("content");
  if (ytext.length > 0) return; // already have content from IndexedDB or peers

  // No content anywhere — fetch from server (or use default for new files)
  const name = filePath.replace(/\.md$/, "").split("/").pop();
  try {
    const res = await fetch(`/api/files/${filePath}`);
    // await the text BEFORE entering the synchronous transact callback
    const text = res.ok ? await res.text() : `# ${name}\n`;
    doc.transact(() => ytext.insert(0, text), sync);
  } catch {
    doc.transact(() => ytext.insert(0, `# ${name}\n`), sync);
  }
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

function mount(doc, sync) {
  const app = document.getElementById("app");
  app.style.cssText = "height:100%; overflow:auto;";

  // Status dot (top-right) — shows sync connection state
  if (sync) {
    const dot = document.createElement("div");
    dot.style.cssText = `
      position: fixed; top: 12px; right: 16px;
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--fg-dim);
      transition: background 0.3s;
    `;
    dot.title = "disconnected";
    document.body.appendChild(dot);
    sync.on("status", ({ connected }) => {
      dot.style.background = connected ? "var(--accent)" : "var(--error)";
      dot.title = connected ? "synced" : "disconnected";
    });
  }

  createEditor(app, doc, sync?.awareness);
}

/* Old

import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";


const leafHighlight = HighlightStyle.define([
  {
    tag: t.heading1,
    fontSize: "1.58em",
    fontWeight: "500",
    color: "var(--fg)",
    lineHeight: "1.3",
  },
  {
    tag: t.heading2,
    fontSize: "1.22em",
    fontWeight: "500",
    color: "var(--fg)",
  },
  {
    tag: t.heading3,
    fontSize: "1.04em",
    fontWeight: "500",
    color: "var(--fg-muted)",
  },
  {
    tag: t.processingInstruction,
    color: "var(--fg-faint)",
    fontFamily: "var(--font-mono)",
  },
  { tag: t.strong, fontWeight: "600", color: "var(--fg)" },
  { tag: t.emphasis, fontStyle: "italic" },
  {
    tag: t.strikethrough,
    textDecoration: "line-through",
    color: "var(--fg-muted)",
  },
  {
    tag: t.monospace,
    fontFamily: "var(--font-mono)",
    fontSize: "0.83em",
    color: "var(--accent)",
  },
  { tag: t.link, color: "var(--accent)", textDecoration: "underline" },
  { tag: t.url, color: "var(--accent)" },
  { tag: t.quote, color: "var(--fg-muted)", fontStyle: "italic" },
  { tag: t.list, color: "var(--fg-faint)" },
  {
    tag: t.meta,
    color: "var(--fg-faint)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8em",
  },
  { tag: t.contentSeparator, color: "var(--fg-faint)" },
  { tag: t.content, color: "var(--fg)" },
]);

const view = new EditorView({
  state: EditorState.create({
    doc: "# Leaf",
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      drawSelection(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(leafHighlight),
      EditorView.theme({
        "&": { background: "transparent", color: "var(--fg)" },
        ".cm-content": { caretColor: "var(--accent)" },
        ".cm-cursor": { borderLeftColor: "var(--accent)" },
        ".cm-selectionBackground": {
          background: "var(--selection) !important",
        },
        "&.cm-focused .cm-selectionBackground": {
          background: "var(--selection) !important",
        },
      }),
    ],
  }),
  parent: document.getElementById("editor"),
});

view.focus();
*/
