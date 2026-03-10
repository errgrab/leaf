import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'

function navigate(path) {
  window.location.href = '/' + path.replace(/\.md$/, '')
}

// Decorate [[links]] with a class for styling + data-link for click handling
const wikilinkPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view) }
  update(u) {
    if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view)
  }
  build(view) {
    const decs = []
    const re   = /\[\[([^\]]+)\]\]/g
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to)
      let m
      while ((m = re.exec(text)) !== null) {
        decs.push(
          Decoration.mark({ class: 'cm-wikilink', attributes: { 'data-link': m[1] } })
            .range(from + m.index, from + m.index + m[0].length)
        )
      }
    }
    return Decoration.set(decs, true)
  }
}, { decorations: v => v.decorations })

// Navigate on click — only if the click target has data-link
const wikilinkClick = EditorView.domEventHandlers({
  click(e) {
    const el = e.target.closest('[data-link]')
    if (!el) return false
    navigate(el.getAttribute('data-link'))
    return true
  },
})

export function wikilinkExtension() {
  return [wikilinkPlugin, wikilinkClick]
}
