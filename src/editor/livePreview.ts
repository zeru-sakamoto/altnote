import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { ImageWidget } from './liveImage';
import { TableWidget, parseTableModel } from './liveTable';

export { currentFilePath } from './liveImage';

const HIDE = Decoration.replace({});

const MARK_STYLE = Decoration.mark({ class: 'cm-md-mark' });
const STRONG = Decoration.mark({ class: 'cm-md-strong' });
const EMPHASIS = Decoration.mark({ class: 'cm-md-em' });
const STRIKE = Decoration.mark({ class: 'cm-md-strike' });
const UNDERLINE = Decoration.mark({ class: 'cm-md-underline' });
const CODE = Decoration.mark({ class: 'cm-md-code' });
const LINK = Decoration.mark({ class: 'cm-md-link' });
const LIST_MARK = Decoration.mark({ class: 'cm-md-listmark' });
const HIGHLIGHT = Decoration.mark({ class: 'cm-md-highlight' });
const SUPER = Decoration.mark({ class: 'cm-md-super' });
const SUB = Decoration.mark({ class: 'cm-md-sub' });
const FOOTNOTE_REF = Decoration.mark({ class: 'cm-md-footnote-ref' });
const QUOTE_LINE = Decoration.line({ class: 'cm-md-quote-line' });
const CODEBLOCK_LINE = Decoration.line({ class: 'cm-md-codeblock-line' });
const LINKREF_LINE = Decoration.line({ class: 'cm-md-linkref-line' });
const FOOTNOTE_DEF_LINE = Decoration.line({ class: 'cm-md-footnote-def-line' });
const HEADING: Record<string, Decoration> = {
  ATXHeading1: Decoration.mark({ class: 'cm-md-h cm-md-h1' }),
  ATXHeading2: Decoration.mark({ class: 'cm-md-h cm-md-h2' }),
  ATXHeading3: Decoration.mark({ class: 'cm-md-h cm-md-h3' }),
  ATXHeading4: Decoration.mark({ class: 'cm-md-h cm-md-h4' }),
  ATXHeading5: Decoration.mark({ class: 'cm-md-h cm-md-h5' }),
  ATXHeading6: Decoration.mark({ class: 'cm-md-h cm-md-h6' }),
  SetextHeading1: Decoration.mark({ class: 'cm-md-h cm-md-h1' }),
  SetextHeading2: Decoration.mark({ class: 'cm-md-h cm-md-h2' }),
};

/** Marker node types that get hidden unless the cursor is on their line. */
const HIDEABLE_MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'LinkMark',
  'QuoteMark',
  'StrikethroughMark',
  'HighlightMark',
  'SuperscriptMark',
  'SubscriptMark',
  'FootnoteDefMark',
]);

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'cm-md-hr';
    return hr;
  }
}
const HR = Decoration.replace({ widget: new HrWidget() });

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-md-bullet';
    span.textContent = '•';
    return span;
  }
}
const BULLET = Decoration.replace({ widget: new BulletWidget() });

/** `[ ]`/`[x]`/`[X]` -> the opposite marker text. Exported for a unit test, since a real
 * CodeMirror EditorView needs a DOM (this project's vitest config runs under `node`). */
export function toggleTaskMarkerText(markerText: string): string {
  return /[xX]/.test(markerText) ? '[ ]' : '[x]';
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return (
      other.checked === this.checked &&
      other.from === this.from &&
      other.to === this.to
    );
  }
  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'cm-md-checkbox';
    input.checked = this.checked;
    input.addEventListener('click', () => {
      const current = view.state.doc.sliceString(this.from, this.to);
      view.dispatch({
        changes: {
          from: this.from,
          to: this.to,
          insert: toggleTaskMarkerText(current),
        },
      });
    });
    return input;
  }
}

/** Adds every line number a node spans (inclusive) to `into`. */
function markSpannedLines(
  view: EditorView,
  node: { from: number; to: number },
  into: Set<number>,
) {
  const startLine = view.state.doc.lineAt(node.from).number;
  const endLine = view.state.doc.lineAt(node.to).number;
  for (let n = startLine; n <= endLine; n++) into.add(n);
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head);
  const quoteLines = new Set<number>();
  const codeLines = new Set<number>();
  const linkRefLines = new Set<number>();
  const footnoteDefLines = new Set<number>();
  let pendingUnderlineOpen: {
    from: number;
    to: number;
    onCursorLine: boolean;
  } | null = null;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const type = node.type.name;
        const heading = HEADING[type];
        const onCursorLine =
          node.from <= cursorLine.to && node.to >= cursorLine.from;

        if (heading) {
          ranges.push(heading.range(node.from, node.to));
          return;
        }

        // Tables always render as the interactive widget — there's no raw-text edit
        // fallback, since editing happens through the widget's own cells instead.
        if (type === 'Table') {
          const model = parseTableModel(view.state.doc, node.node);
          ranges.push(
            Decoration.replace({
              widget: new TableWidget(model, node.from, node.to),
              block: true,
            }).range(node.from, node.to),
          );
          return false;
        }

        // Images render inline unless the cursor is on that line, in which case they
        // fall through to the same Link-style raw-markup handling below.
        if (type === 'Image' && !onCursorLine) {
          const urlNode = node.node.getChild('URL');
          const url = urlNode
            ? view.state.doc.sliceString(urlNode.from, urlNode.to)
            : null;
          if (url) {
            const raw = view.state.doc.sliceString(node.from, node.to);
            const alt = raw.match(/^!\[([^\]]*)\]/)?.[1] ?? '';
            ranges.push(
              Decoration.replace({ widget: new ImageWidget(url, alt) }).range(
                node.from,
                node.to,
              ),
            );
            return false;
          }
        }

        if (type === 'StrongEmphasis') {
          ranges.push(STRONG.range(node.from, node.to));
        } else if (type === 'Emphasis') {
          ranges.push(EMPHASIS.range(node.from, node.to));
        } else if (type === 'Strikethrough') {
          ranges.push(STRIKE.range(node.from, node.to));
        } else if (type === 'InlineCode') {
          ranges.push(CODE.range(node.from, node.to));
        } else if (type === 'Link' || type === 'Image') {
          ranges.push(LINK.range(node.from, node.to));
        } else if (type === 'ListMark') {
          const markText = view.state.doc.sliceString(node.from, node.to);
          ranges.push(
            (/^[-*+]$/.test(markText) ? BULLET : LIST_MARK).range(
              node.from,
              node.to,
            ),
          );
        } else if (type === 'URL' && !onCursorLine) {
          // The "(https://...)" destination part of a link, hidden unless being edited.
          ranges.push(HIDE.range(node.from, node.to));
        } else if (type === 'TaskMarker') {
          const text = view.state.doc.sliceString(node.from, node.to);
          ranges.push(
            Decoration.replace({
              widget: new CheckboxWidget(/[xX]/.test(text), node.from, node.to),
            }).range(node.from, node.to),
          );
        } else if (type === 'HorizontalRule' && !onCursorLine) {
          ranges.push(HR.range(node.from, node.to));
        } else if (type === 'Blockquote') {
          markSpannedLines(view, node, quoteLines);
        } else if (type === 'FencedCode') {
          markSpannedLines(view, node, codeLines);
        } else if (type === 'Autolink') {
          // The whole `<https://...>` span is the visible content (unlike an
          // inline link's separate text/URL parts), so style it and stop —
          // descending would let the generic URL-hiding branch below erase it.
          ranges.push(LINK.range(node.from, node.to));
          return false;
        } else if (type === 'LinkReference') {
          markSpannedLines(view, node, linkRefLines);
        } else if (type === 'Superscript') {
          ranges.push(SUPER.range(node.from, node.to));
        } else if (type === 'Subscript') {
          ranges.push(SUB.range(node.from, node.to));
        } else if (type === 'Highlight') {
          ranges.push(HIGHLIGHT.range(node.from, node.to));
        } else if (type === 'FootnoteRef') {
          ranges.push(FOOTNOTE_REF.range(node.from, node.to));
        } else if (type === 'FootnoteDef') {
          markSpannedLines(view, node, footnoteDefLines);
        } else if (type === 'WikiLink') {
          // Brackets + `target|` prefix are hidden via raw-text
          // slicing rather than dedicated child nodes for the label/alias —
          // matches the Image alt-text extraction below, no grammar needed.
          const raw = view.state.doc.sliceString(node.from, node.to);
          const pipeIndex = raw.indexOf('|');
          if (onCursorLine) {
            ranges.push(MARK_STYLE.range(node.from, node.from + 2));
            ranges.push(MARK_STYLE.range(node.to - 2, node.to));
          } else {
            ranges.push(HIDE.range(node.from, node.from + 2));
            ranges.push(HIDE.range(node.to - 2, node.to));
            if (pipeIndex >= 0) {
              ranges.push(
                HIDE.range(node.from + 2, node.from + 2 + pipeIndex + 1),
              );
            }
          }
          ranges.push(LINK.range(node.from, node.to));
          return false;
        } else if (type === 'HTMLTag') {
          // No native Markdown underline syntax; Obsidian's own convention (and ours)
          // is raw `<u>...</u>` HTML, which the base CommonMark parser already tokenizes.
          const text = view.state.doc.sliceString(node.from, node.to);
          if (/^<u>$/i.test(text)) {
            pendingUnderlineOpen = {
              from: node.from,
              to: node.to,
              onCursorLine,
            };
          } else if (/^<\/u>$/i.test(text) && pendingUnderlineOpen) {
            ranges.push(
              (pendingUnderlineOpen.onCursorLine ? MARK_STYLE : HIDE).range(
                pendingUnderlineOpen.from,
                pendingUnderlineOpen.to,
              ),
            );
            ranges.push(UNDERLINE.range(pendingUnderlineOpen.to, node.from));
            ranges.push(
              (onCursorLine ? MARK_STYLE : HIDE).range(node.from, node.to),
            );
            pendingUnderlineOpen = null;
          }
        }

        if (HIDEABLE_MARKS.has(type)) {
          ranges.push(
            (onCursorLine ? MARK_STYLE : HIDE).range(node.from, node.to),
          );
        }
      },
    });
  }

  for (const lineNo of quoteLines) {
    ranges.push(QUOTE_LINE.range(view.state.doc.line(lineNo).from));
  }
  for (const lineNo of codeLines) {
    ranges.push(CODEBLOCK_LINE.range(view.state.doc.line(lineNo).from));
  }
  for (const lineNo of linkRefLines) {
    ranges.push(LINKREF_LINE.range(view.state.doc.line(lineNo).from));
  }
  for (const lineNo of footnoteDefLines) {
    ranges.push(FOOTNOTE_DEF_LINE.range(view.state.doc.line(lineNo).from));
  }

  return Decoration.set(ranges, true);
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
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
  '.cm-md-strike': { textDecoration: 'line-through' },
  '.cm-md-underline': { textDecoration: 'underline' },
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
  '.cm-md-listmark': {
    color: 'var(--editor-link, #4ea1ff)',
    fontWeight: 'bold',
  },
  '.cm-md-bullet': {
    display: 'inline-block',
    width: '1em',
    color: 'var(--editor-link, #4ea1ff)',
    fontWeight: 'bold',
  },
  '.cm-md-quote-line': {
    borderLeft: '3px solid var(--editor-gutter-fg)',
    paddingLeft: '10px',
    opacity: '0.85',
  },
  '.cm-md-codeblock-line': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '.cm-md-highlight': {
    backgroundColor: 'var(--editor-highlight-bg, #ffe066)',
    color: 'var(--editor-highlight-fg, inherit)',
    borderRadius: '2px',
  },
  '.cm-md-super': {
    verticalAlign: 'super',
    fontSize: 'smaller',
  },
  '.cm-md-sub': {
    verticalAlign: 'sub',
    fontSize: 'smaller',
  },
  '.cm-md-footnote-ref': {
    verticalAlign: 'super',
    fontSize: '0.75em',
    color: 'var(--editor-link, #4ea1ff)',
  },
  '.cm-md-linkref-line': {
    opacity: '0.6',
  },
  '.cm-md-footnote-def-line': {
    opacity: '0.7',
    fontSize: '0.92em',
  },
  '.cm-md-checkbox': {
    verticalAlign: 'middle',
    margin: '0 4px 2px 0',
    cursor: 'pointer',
  },
  '.cm-md-hr': {
    margin: '0.5em 0',
    border: 'none',
    borderTop: '1px solid var(--editor-gutter-fg)',
    opacity: '0.4',
  },
  '.cm-md-image': {
    maxWidth: '100%',
    maxHeight: '400px',
    verticalAlign: 'middle',
    borderRadius: '4px',
  },
  '.cm-md-image-error': {
    display: 'inline-block',
    minWidth: '80px',
    minHeight: '24px',
    border: '1px dashed var(--editor-gutter-fg)',
    borderRadius: '4px',
    padding: '4px 8px',
  },
  '.cm-md-table-wrap': {
    margin: '4px 0',
  },
  '.cm-md-table': {
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  '.cm-md-table-controls th': {
    border: 'none',
    padding: '0 4px',
    textAlign: 'center',
  },
  '.cm-md-table-cell': {
    border: '1px solid var(--editor-active-line)',
    padding: '4px 8px',
    minWidth: '3em',
    outline: 'none',
  },
  '.cm-md-table-cell:focus': {
    outline: '1px solid var(--editor-link, #4ea1ff)',
  },
  '.cm-md-table-row-action': {
    border: 'none',
    padding: '0 4px',
    textAlign: 'center',
  },
  '.cm-md-table-btn': {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    opacity: '0.55',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: '1',
    padding: '2px 4px',
    borderRadius: '3px',
  },
  '.cm-md-table-btn:hover:not(:disabled)': {
    opacity: '1',
    backgroundColor: 'var(--editor-active-line)',
  },
  '.cm-md-table-btn:disabled': {
    opacity: '0.2',
    cursor: 'default',
  },
  '.cm-md-table-actions': {
    marginTop: '2px',
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
