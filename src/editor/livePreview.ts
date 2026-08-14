import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

const HIDE = Decoration.replace({});

const MARK_STYLE = Decoration.mark({ class: 'cm-md-mark' });
const STRONG = Decoration.mark({ class: 'cm-md-strong' });
const EMPHASIS = Decoration.mark({ class: 'cm-md-em' });
const CODE = Decoration.mark({ class: 'cm-md-code' });
const LINK = Decoration.mark({ class: 'cm-md-link' });
const HEADING: Record<string, Decoration> = {
  ATXHeading1: Decoration.mark({ class: 'cm-md-h cm-md-h1' }),
  ATXHeading2: Decoration.mark({ class: 'cm-md-h cm-md-h2' }),
  ATXHeading3: Decoration.mark({ class: 'cm-md-h cm-md-h3' }),
  ATXHeading4: Decoration.mark({ class: 'cm-md-h cm-md-h4' }),
  ATXHeading5: Decoration.mark({ class: 'cm-md-h cm-md-h5' }),
  ATXHeading6: Decoration.mark({ class: 'cm-md-h cm-md-h6' }),
};

/** Marker node types that get hidden unless the cursor is on their line. */
const HIDEABLE_MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'LinkMark',
]);

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const type = node.type.name;
        const heading = HEADING[type];

        if (heading) {
          builder.add(node.from, node.to, heading);
          return;
        }
        const onCursorLine =
          node.from <= cursorLine.to && node.to >= cursorLine.from;

        if (type === 'StrongEmphasis') {
          builder.add(node.from, node.to, STRONG);
        } else if (type === 'Emphasis') {
          builder.add(node.from, node.to, EMPHASIS);
        } else if (type === 'InlineCode') {
          builder.add(node.from, node.to, CODE);
        } else if (type === 'Link') {
          builder.add(node.from, node.to, LINK);
        } else if (type === 'URL' && !onCursorLine) {
          // The "(https://...)" destination part of a link, hidden unless being edited.
          builder.add(node.from, node.to, HIDE);
        }

        if (HIDEABLE_MARKS.has(type)) {
          builder.add(node.from, node.to, onCursorLine ? MARK_STYLE : HIDE);
        }
      },
    });
  }

  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const livePreviewTheme = EditorView.baseTheme({
  '.cm-md-mark': { opacity: '0.5' },
  '.cm-md-strong': { fontWeight: 'bold' },
  '.cm-md-em': { fontStyle: 'italic' },
  '.cm-md-code': {
    fontFamily: 'var(--editor-font, ui-monospace, monospace)',
    backgroundColor: 'var(--editor-active-line)',
    borderRadius: '3px',
    padding: '0 2px',
  },
  '.cm-md-link': {
    color: 'var(--editor-link, #4ea1ff)',
    textDecoration: 'underline',
  },
  '.cm-md-h': { fontWeight: 'bold' },
  '.cm-md-h1': { fontSize: '1.6em' },
  '.cm-md-h2': { fontSize: '1.4em' },
  '.cm-md-h3': { fontSize: '1.25em' },
  '.cm-md-h4': { fontSize: '1.15em' },
  '.cm-md-h5': { fontSize: '1.05em' },
  '.cm-md-h6': { fontSize: '1em' },
});

export const livePreview = [livePreviewPlugin, livePreviewTheme];
