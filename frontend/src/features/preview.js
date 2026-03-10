/**
 * features/preview.js
 *
 * Preview mode: dims markdown syntax tokens on all lines except
 * the one the cursor is on, giving a cleaner reading experience.
 *
 * Toggle with /mode source or /mode preview.
 * Default mode is stored in localStorage under 'leaf-render-mode'.
 */

import { ViewPlugin, Decoration } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'

export const setMode = StateEffect.define()

const modeField = StateField.define({
  create: () => localStorage.getItem('leaf-render-mode') ?? 'preview',
  update: (v, tr) => {
    for (const e of tr.effects)
      if (e.is(setMode)) { localStorage.setItem('leaf-render-mode', e.value); return e.value }
    return v
  },
})

const previewPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this._build(view) }
  update(u) {
    if (u.docChanged || u.selectionSet || u.transactions.some(t => t.effects.some(e => e.is(setMode))))
      this.decorations = this._build(u.view)
  }
  _build(view) {
    if (view.state.field(modeField) !== 'preview') return Decoration.none
    const activeLine = view.state.doc.lineAt(view.state.selection.main.from).number
    const decs = []
    const re = /(\*\*|__|\*|_|~~|`+|#{1,6}\s|!\[|\[|\]\(|\))/g
    for (const { from, to } of view.visibleRanges) {
      let pos = from
      while (pos <= to) {
        const line = view.state.doc.lineAt(pos)
        if (line.number !== activeLine) {
          let m
          while ((m = re.exec(line.text)) !== null)
            decs.push(Decoration.mark({ class: 'cm-preview-dim' }).range(line.from + m.index, line.from + m.index + m[0].length))
          re.lastIndex = 0
        }
        pos = line.to + 1
      }
    }
    return Decoration.set(decs, true)
  }
}, { decorations: v => v.decorations })

/**
 * Preview feature extensions.
 * @returns {Array} Extensions for preview mode
 */
export function createPreviewFeature() {
  return [modeField, previewPlugin]
}

/**
 * Preview mode command for the command palette.
 * @param {EditorView} view
 * @param {string} arg - 'source' or 'preview'
 */
export function runModeCommand(view, arg) {
  const mode = arg?.trim()
  if (view && ['source', 'preview'].includes(mode))
    view.dispatch({ effects: setMode.of(mode) })
}
