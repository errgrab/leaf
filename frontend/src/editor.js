/**
 * editor.js
 *
 * CodeMirror 6 editor with:
 *   - Markdown language + syntax highlighting
 *   - Y.js collaborative binding (y-codemirror.next)
 *   - Wiki-link click navigation  [[note]]
 *   - Leaf commands extension (/, [[)
 *   - Monkeytype-inspired styling via CSS variables
 *
 * Swapping editors: replace this file only.
 * sync.js / persist.js / commands.js are editor-agnostic.
 */

import { EditorView, keymap, ViewPlugin, Decoration } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import { yCollab } from "y-codemirror.next";
import { leafCommands, navigateTo, closePopup } from "./commands.js";

// ---------------------------------------------------------------------------
// Highlight style — monkeytype palette
// ---------------------------------------------------------------------------

const leafHighlight = HighlightStyle.define([
  {
    tag: tags.heading1,
    color: "var(--fg)",
    fontWeight: "bold",
    fontSize: "1.3em",
  },
  {
    tag: tags.heading2,
    color: "var(--fg)",
    fontWeight: "bold",
    fontSize: "1.15em",
  },
  { tag: tags.heading3, color: "var(--fg)", fontWeight: "bold" },
  { tag: tags.strong, color: "var(--fg)", fontWeight: "bold" },
  { tag: tags.emphasis, color: "var(--fg)", fontStyle: "italic" },
  { tag: tags.link, color: "var(--accent)" },
  { tag: tags.url, color: "var(--accent)", textDecoration: "underline" },
  { tag: tags.monospace, color: "var(--accent-dim)" },
  { tag: tags.comment, color: "var(--fg-dim)", fontStyle: "italic" },
  { tag: tags.processingInstruction, color: "var(--fg-dim)" },
  { tag: tags.punctuation, color: "var(--fg-dim)" },
  { tag: tags.keyword, color: "var(--accent)" },
  { tag: tags.string, color: "var(--accent-dim)" },
  { tag: tags.number, color: "var(--accent)" },
]);

// ---------------------------------------------------------------------------
// Editor theme — layout, cursor, selection
// ---------------------------------------------------------------------------

const leafTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "transparent",
    color: "var(--fg)",
    fontSize: "var(--font-size)",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    lineHeight: "var(--line-height)",
    maxWidth: "var(--max-width)",
    margin: "0 auto",
    padding: "48px 24px 200px",
    caretColor: "var(--accent)",
  },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-selectionBackground, ::selection": {
    background: "var(--accent-dim) !important",
    opacity: "0.3",
  },
  ".cm-focused": { outline: "none" },
  ".cm-activeLine": { background: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-scroller": { overflow: "auto", height: "100%" },
  // Wiki-link styling
  ".cm-wikilink": {
    color: "var(--accent)",
    cursor: "pointer",
    textDecoration: "underline dotted",
  },
});

// ---------------------------------------------------------------------------
// Wiki-link decorator — highlights [[links]] and makes them clickable
// ---------------------------------------------------------------------------

const wikilinkDecorator = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this._build(view);
    }
    update(u) {
      if (u.docChanged || u.viewportChanged)
        this.decorations = this._build(u.view);
    }

    _build(view) {
      const decs = [];
      const re = /\[\[([^\]]+)\]\]/g;
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let m;
        while ((m = re.exec(text)) !== null) {
          decs.push(
            Decoration.mark({
              class: "cm-wikilink",
              attributes: { "data-link": m[1] },
            }).range(from + m.index, from + m.index + m[0].length),
          );
        }
      }
      return Decoration.set(decs);
    }
  },
  { decorations: (v) => v.decorations },
);

// Click handler for wiki-links
const wikilinkClick = EditorView.domEventHandlers({
  click(e) {
    const el = e.target.closest(".cm-wikilink");
    if (!el) return false;
    const link = el.getAttribute("data-link");
    if (link) {
      navigateTo(link);
      return true;
    }
    return false;
  },
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Y.Doc}       doc
 * @param {object}      awareness   from RelayProvider
 * @returns {EditorView}
 */
export function createEditor(container, doc, awareness) {
  const ytext = doc.getText("content");

  const state = EditorState.create({
    extensions: [
      leafTheme,
      syntaxHighlighting(leafHighlight),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      yCollab(ytext, awareness),
      wikilinkDecorator,
      wikilinkClick,
      leafCommands(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        // Close popup on any click outside
        if (u.focusChanged && !u.view.hasFocus) closePopup();
      }),
    ],
  });

  return new EditorView({ state, parent: container });
}
