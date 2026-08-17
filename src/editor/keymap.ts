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
      // Empty wrap under the cursor (e.g. `**|**`) toggled with the same
      // shortcut removes it, rather than nesting another empty pair — checked
      // by raw text since an empty span like `****` never resolves to a
      // syntax-tree node worth asking about.
      const beforeFrom = Math.max(0, range.from - open.length);
      const afterTo = Math.min(state.doc.length, range.to + close.length);
      // Also require the char just outside each marker to differ from the
      // marker's own edge char, so `*` (italic) doesn't misread itself as
      // matching inside a longer `**`/`***` run (e.g. bold's empty `**|**`) —
      // that would strip one asterisk of the *wrong* marker instead of
      // nesting italic around it.
      const openOuter = state.sliceDoc(Math.max(0, beforeFrom - 1), beforeFrom);
      const closeOuter = state.sliceDoc(
        afterTo,
        Math.min(state.doc.length, afterTo + 1),
      );
      if (
        state.sliceDoc(beforeFrom, range.from) === open &&
        state.sliceDoc(range.to, afterTo) === close &&
        openOuter !== open[0] &&
        closeOuter !== close[close.length - 1]
      ) {
        return {
          changes: [
            { from: beforeFrom, to: range.from, insert: '' },
            { from: range.to, to: afterTo, insert: '' },
          ],
          range: EditorSelection.cursor(beforeFrom),
        };
      }
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

const TAB_OUT_NODES: WrapNodeInfo[] = [
  { node: 'StrongEmphasis', mark: 'EmphasisMark' },
  { node: 'Emphasis', mark: 'EmphasisMark' },
  { node: 'Strikethrough', mark: 'StrikethroughMark' },
];

/** If `pos` sits inside a bold/italic/strikethrough/underline span, returns the
 * position just past its closing marker (so Tab can jump the caret out to the
 * right instead of indenting). Underline has no syntax-tree node (raw `<u>`
 * HTML), so it's found by scanning the current line's text instead. */
export function tabOutOfWrapTarget(
  state: EditorState,
  pos: number,
): number | null {
  for (const info of TAB_OUT_NODES) {
    const enclosing = findEnclosingMarkedNode(state, pos, pos, info);
    if (enclosing) return enclosing.closeTo;
  }

  const line = state.doc.lineAt(pos);
  const relPos = pos - line.from;
  const lineText = line.text;
  const openIdx = lineText.lastIndexOf('<u>', relPos);
  const closeIdx = lineText.indexOf('</u>', relPos);
  if (
    openIdx !== -1 &&
    closeIdx !== -1 &&
    openIdx + 3 <= relPos &&
    !lineText.slice(openIdx + 3, relPos).includes('</u>')
  ) {
    return line.from + closeIdx + 4;
  }

  return null;
}

/** Tab, when the caret is inside a formatting span, jumps it past the closing
 * marker instead of indenting. Falls through to normal Tab handling
 * otherwise. */
function tabOutOfWrap(view: EditorView): boolean {
  const { main } = view.state.selection;
  if (!main.empty) return false;
  const target = tabOutOfWrapTarget(view.state, main.head);
  if (target === null) return false;
  view.dispatch({
    selection: EditorSelection.cursor(target),
    scrollIntoView: true,
  });
  return true;
}

const vsCodeBindings: readonly KeyBinding[] = [
  { key: 'Tab', run: tabOutOfWrap },
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
