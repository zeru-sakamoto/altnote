import { EditorSelection } from '@codemirror/state';
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

const vsCodeBindings: readonly KeyBinding[] = [
  { key: 'Mod-Enter', run: insertLineBelow },
  { key: 'Mod-Shift-Enter', run: insertLineAbove },
  { key: 'Mod-d', run: copyLineDown },
  { key: 'Alt-ArrowUp', run: moveLineUp },
  { key: 'Alt-ArrowDown', run: moveLineDown },
  { key: 'Mod-/', run: toggleComment },
  { key: 'Mod-h', run: openSearchPanel },
];

/** VS Code-style editing shortcuts, given precedence over CodeMirror's defaults. */
export const vsCodeKeymap = keymap.of(vsCodeBindings as KeyBinding[]);
