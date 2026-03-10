/**
 * features/run.js
 *
 * Adds a ▶ run button to ```run code blocks.
 * Executes JS in the browser, captures console.log output,
 * and renders it inline below the block.
 *
 * Output is ephemeral — not saved to the document.
 *
 * To disable: remove runFeature from main.js feature array.
 */

import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'

const outputs = new Map()  // lineNumber → output string
let _view = null

class RunButton extends WidgetType {
  constructor(code, line) { super(); this.code = code; this.line = line }
  toDOM() {
    const btn = document.createElement('button')
    btn.textContent = '▶ run'
    btn.style.cssText = 'background:transparent; border:1px solid var(--accent-dim); color:var(--accent); font-family:var(--font-mono); font-size:11px; padding:1px 8px; border-radius:3px; cursor:pointer; margin-left:8px'
    btn.addEventListener('mousedown', e => {
      e.preventDefault()
      e.stopPropagation()
      const logs = []
      try {
        new Function('console', this.code)({ log: (...a) => logs.push(a.map(String).join(' ')) })
        outputs.set(this.line, logs.join('\n') || '(no output)')
      } catch (err) {
        outputs.set(this.line, `Error: ${err.message}`)
      }
      _view?.dispatch({ effects: [] })  // force re-render
    })
    return btn
  }
  ignoreEvent() { return false }
}

class RunOutput extends WidgetType {
  constructor(text) { super(); this.text = text }
  toDOM() {
    const el = document.createElement('div')
    el.style.cssText = 'color:var(--fg-dim); font-family:var(--font-mono); font-size:.9em; padding:4px 12px; border-left:2px solid var(--accent-dim); white-space:pre-wrap'
    el.textContent = this.text
    return el
  }
  ignoreEvent() { return true }
}

const runPlugin = ViewPlugin.fromClass(class {
  constructor(view) { _view = view; this.decorations = this._build(view) }
  update(u)        { this.decorations = this._build(u.view) }
  _build(view) {
    _view = view
    const decs = []
    const text  = view.state.doc.toString()
    const re    = /^```run\n([\s\S]*?)^```/gm
    let m
    while ((m = re.exec(text)) !== null) {
      const openLine  = view.state.doc.lineAt(m.index)
      const lineNo    = openLine.number
      const closePos  = m.index + m[0].length
      const closeLine = view.state.doc.lineAt(closePos - 1)

      decs.push(Decoration.widget({ widget: new RunButton(m[1], lineNo), side: 1 }).range(openLine.to))

      const out = outputs.get(lineNo)
      if (out !== undefined)
        decs.push(Decoration.widget({ widget: new RunOutput(out), side: 1, block: true }).range(closeLine.to))
    }
    return Decoration.set(decs, true)
  }
}, { decorations: v => v.decorations })

export const runFeature = {
  extensions() {
    return [runPlugin]
  },
}
