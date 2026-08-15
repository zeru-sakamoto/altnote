import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { EditorSelection, type EditorState } from '@codemirror/state';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import {
  copyLineDown,
  moveLineDown,
  moveLineUp,
  toggleComment,
} from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';

/** Insert a blank line below the current line without splitting text at the cursor (VS Code's Ctrl+Enter). */
function insertLineBelow(view: EditorView): boolean {
  const changes = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.head);
    return {
      changes: { from: line.to, insert: '\n' },
      range: EditorSelection.cursor(line.to + 1),
    };
  });
  view.dispatch(
    view.state.update(changes, { scrollIntoView: true, userEvent: 'input' }),
  );
  return true;
}

/** Insert a blank line above the current line (VS Code's Ctrl+Shift+Enter). */
function insertLineAbove(view: EditorView): boolean {
  const changes = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.head);
    return {
      changes: { from: line.from, insert: '\n' },
      range: EditorSelection.cursor(line.from),
    };
  });
  view.dispatch(
    view.state.update(changes, { scrollIntoView: true, userEvent: 'input' }),
  );
  return true;
}

/** Identifies which syntax-tree node/mark pair a formatting toggle should look
 * for when deciding whether a selection is already wrapped. Needed because
 * `*`/`**` share a character — Emphasis and StrongEmphasis can only be told
 * apart reliably by asking the parser, not by counting asterisks. */
interface WrapNodeInfo {
  node: string;
  mark: string;
}

interface MarkSpan {
  openFrom: number;
  openTo: number;
  closeFrom: number;
  closeTo: number;
}

/** Walks up from the selection looking for an ancestor node of `nodeName`
 * whose two `markName` children fully enclose `[from, to)` — i.e. the
 * selection sits inside that node's actual (parser-resolved) content, not
 * just near text that looks like its markers. */
function findEnclosingMarkedNode(
  state: EditorState,
  from: number,
  to: number,
  { node: nodeName, mark: markName }: WrapNodeInfo,
): MarkSpan | null {
  // Force a synchronous parse up to `to` rather than trusting whatever the
  // view's background parser has gotten to so far — this runs once per
  // keypress, not per frame, so the cost is fine, and it's what makes this
  // testable against a bare EditorState with no prior parsing.
  const tree = ensureSyntaxTree(state, to, 200) ?? syntaxTree(state);
  let node = tree.resolveInner(from, 1);
  while (node) {
    if (node.type.name === nodeName) {
      const marks = node.getChildren(markName);
      const open = marks[0];
      const close = marks[marks.length - 1];
      if (marks.length >= 2 && from >= open.to && to <= close.from) {
        return {
          openFrom: open.from,
          openTo: open.to,
          closeFrom: close.from,
          closeTo: close.to,
        };
      }
    }
    if (!node.parent) break;
    node = node.parent;
  }
  return null;
}

/** Pure change/selection computation for wrapping-or-unwrapping every
 * selection range in `open`/`close` markers (toggle behavior), for
 * formatting shortcuts like Mod-B/I/U. When `nodeInfo` is given, "already
 * wrapped" is decided by consulting the markdown syntax tree instead of
 * comparing raw characters — required for `*`/`**` (italic/bold), which
 * can't be disambiguated by string matching alone (see
 * `findEnclosingMarkedNode`). Exported separately from `toggleWrap` so it
 * can be unit tested against a plain `EditorState` without needing a real
 * (DOM-backed) `EditorView`. */
export function wrapSelectionSpec(
  state: EditorState,
  open: string,
  close: string,
  nodeInfo?: WrapNodeInfo,
) {
  return state.changeByRange((range) => {
    if (range.empty) {
      return {
        changes: { from: range.from, insert: open + close },
        range: EditorSelection.cursor(range.from + open.length),
      };
    }

    if (nodeInfo) {
      const enclosing = findEnclosingMarkedNode(
        state,
        range.from,
        range.to,
        nodeInfo,
      );
      if (enclosing) {
        const markLen = enclosing.openTo - enclosing.openFrom;
        return {
          changes: [
            { from: enclosing.openFrom, to: enclosing.openTo, insert: '' },
            { from: enclosing.closeFrom, to: enclosing.closeTo, insert: '' },
          ],
          range: EditorSelection.range(
            range.from - markLen,
            range.to - markLen,
          ),
        };
      }
      return {
        changes: [
          { from: range.from, insert: open },
          { from: range.to, insert: close },
        ],
        range: EditorSelection.range(
          range.from + open.length,
          range.to + open.length,
        ),
      };
    }

    // Text-based fallback for markers with no corresponding syntax-tree node
    // (currently just underline's `<u>`/`</u>` convention). Safe here since
    // those marker strings are unique and can't collide with a shorter or
    // longer run of themselves the way `*`/`**` can.
    const beforeFrom = Math.max(0, range.from - open.length);
    const afterTo = Math.min(state.doc.length, range.to + close.length);
    const before = state.sliceDoc(beforeFrom, range.from);
    const after = state.sliceDoc(range.to, afterTo);
    if (before === open && after === close) {
      return {
        changes: [
          { from: beforeFrom, to: range.from, insert: '' },
          { from: range.to, to: afterTo, insert: '' },
        ],
        range: EditorSelection.range(
          range.from - open.length,
          range.to - open.length,
        ),
      };
    }

    const selected = state.sliceDoc(range.from, range.to);
    if (
      selected.length >= open.length + close.length &&
      selected.startsWith(open) &&
      selected.endsWith(close)
    ) {
      return {
        changes: [
          { from: range.from, to: range.from + open.length, insert: '' },
          { from: range.to - close.length, to: range.to, insert: '' },
        ],
        range: EditorSelection.range(
          range.from,
          range.to - open.length - close.length,
        ),
      };
    }

    return {
      changes: [
        { from: range.from, insert: open },
        { from: range.to, insert: close },
      ],
      range: EditorSelection.range(
        range.from + open.length,
        range.to + open.length,
      ),
    };
  });
}

/** Wraps each selection range in `open`/`close` markers, or strips them back
 * off if the selection is already wrapped (toggle), for formatting shortcuts
 * like Mod-B/I/U. */
export function toggleWrap(
  open: string,
  close = open,
  nodeInfo?: WrapNodeInfo,
) {
  return (view: EditorView): boolean => {
    const tr = wrapSelectionSpec(view.state, open, close, nodeInfo);
    view.dispatch(
      view.state.update(tr, { scrollIntoView: true, userEvent: 'input' }),
    );
    return true;
  };
}

const vsCodeBindings: readonly KeyBinding[] = [
  { key: 'Mod-Enter', run: insertLineBelow },
  { key: 'Mod-Shift-Enter', run: insertLineAbove },
  { key: 'Mod-d', run: copyLineDown },
  { key: 'Alt-ArrowUp', run: moveLineUp },
  { key: 'Alt-ArrowDown', run: moveLineDown },
  { key: 'Mod-/', run: toggleComment },
  { key: 'Mod-h', run: openSearchPanel },
  {
    key: 'Mod-b',
    run: toggleWrap('**', '**', {
      node: 'StrongEmphasis',
      mark: 'EmphasisMark',
    }),
  },
  {
    key: 'Mod-i',
    run: toggleWrap('*', '*', { node: 'Emphasis', mark: 'EmphasisMark' }),
  },
  { key: 'Mod-u', run: toggleWrap('<u>', '</u>') },
  {
    key: 'Mod-Shift-x',
    run: toggleWrap('~~', '~~', {
      node: 'Strikethrough',
      mark: 'StrikethroughMark',
    }),
  },
];

/** VS Code-style editing shortcuts, given precedence over CodeMirror's defaults. */
export const vsCodeKeymap = keymap.of(vsCodeBindings as KeyBinding[]);
