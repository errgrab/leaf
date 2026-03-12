import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { tags } from "@lezer/highlight";

// Compartments let plugins attach extensions without recreating the editor.
// Each plugin that needs to inject editor behaviour gets its own slot.
export const syncSlot    = new Compartment(); // sync.js
export const pluginsSlot = new Compartment(); // all other plugins combined

const highlight = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--fg)", fontWeight: "bold", fontSize: "1.5em" },
  { tag: tags.heading2, color: "var(--fg)", fontWeight: "bold", fontSize: "1.25em" },
  { tag: tags.heading3, color: "var(--fg)", fontWeight: "bold", fontSize: "1.2em" },
  { tag: tags.strong,   color: "var(--fg)", fontWeight: "bold" },
  { tag: tags.emphasis, color: "var(--fg)", fontStyle: "italic" },
  { tag: tags.link,     color: "var(--accent)" },
  { tag: tags.monospace,color: "var(--accent-dim)" },
  { tag: tags.punctuation, color: "var(--fg-dim)" },
]);

const theme = EditorView.theme({
  "&":             { height: "100%", background: "transparent", color: "var(--fg)", fontSize: "var(--font-size)" },
  ".cm-content":   { fontFamily: "var(--font-mono)", lineHeight: "var(--line-height)", maxWidth: "var(--max-width)", margin: "0 auto", padding: "48px 24px 200px", caretColor: "var(--accent)" },
  ".cm-cursor":    { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-focused":   { outline: "none" },
  ".cm-activeLine":{ background: "transparent" },
  ".cm-gutters":   { display: "none" },
  ".cm-scroller":  { overflow: "auto", height: "100%" },
  ".cm-wikilink":  { color: "var(--accent)", textDecoration: "underline dotted", cursor: "pointer" },
});

export function createEditor(container) {
  return new EditorView({
    state: EditorState.create({
      doc: "",
      extensions: [
        theme,
        syntaxHighlighting(highlight),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        syncSlot.of([]),    // empty until sync attaches yCollab
        pluginsSlot.of([]), // empty until plugins attach their extensions
      ],
    }),
    parent: container,
  });
}

export function getContent(view) {
  return view.state.doc.toString();
}

export function setContent(view, content) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
  });
}