import type { SyntaxNode } from '@lezer/common';
import type { Text } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';

export type Alignment = 'left' | 'right' | 'center' | null;

export interface TableModel {
  align: Alignment[];
  header: string[];
  rows: string[][];
}

function unescapeCell(text: string): string {
  return text.replace(/\\\|/g, '|');
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

export function parseAlign(delimiterCell: string): Alignment {
  const left = delimiterCell.startsWith(':');
  const right = delimiterCell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

function alignMarker(align: Alignment): string {
  if (align === 'center') return ':---:';
  if (align === 'right') return '---:';
  if (align === 'left') return ':---';
  return '---';
}

/** Cycles a column's alignment through the four GFM states on each click. */
export function nextAlign(align: Alignment): Alignment {
  if (align === null) return 'left';
  if (align === 'left') return 'center';
  if (align === 'center') return 'right';
  return null;
}

function alignLabel(align: Alignment): string {
  if (align === 'left') return 'Align left';
  if (align === 'center') return 'Align center';
  if (align === 'right') return 'Align right';
  return 'Clear alignment';
}

/** Builds a small inline SVG icon from Tabler Icons path data (`@tabler/icons-react`,
 * copied by name since its components are React elements and these widgets are plain DOM). */
function icon(paths: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'cm-md-table-menu-icon-svg';
  span.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return span;
}

// tabler: align-left / align-center / align-right / ban
function alignIcon(align: Alignment): HTMLSpanElement {
  if (align === 'left') {
    return icon(
      '<path d="M4 6l16 0"/><path d="M4 12l10 0"/><path d="M4 18l14 0"/>',
    );
  }
  if (align === 'center') {
    return icon(
      '<path d="M4 6l16 0"/><path d="M8 12l8 0"/><path d="M6 18l12 0"/>',
    );
  }
  if (align === 'right') {
    return icon(
      '<path d="M4 6l16 0"/><path d="M10 12l10 0"/><path d="M6 18l14 0"/>',
    );
  }
  return icon(
    '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M5.7 5.7l12.6 12.6"/>',
  );
}

// tabler: column-insert-left / column-insert-right
function colInsertIcon(side: 'before' | 'after'): HTMLSpanElement {
  if (side === 'before') {
    return icon(
      '<path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1"/>' +
        '<path d="M5 12l4 0"/><path d="M7 10l0 4"/>',
    );
  }
  return icon(
    '<path d="M6 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1"/>' +
      '<path d="M15 12l4 0"/><path d="M17 10l0 4"/>',
  );
}

// tabler: row-insert-top / row-insert-bottom
function rowInsertIcon(side: 'above' | 'below'): HTMLSpanElement {
  if (side === 'above') {
    return icon(
      '<path d="M4 18v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1"/>' +
        '<path d="M12 9v-4"/><path d="M10 7l4 0"/>',
    );
  }
  return icon(
    '<path d="M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1"/>' +
      '<path d="M12 15l0 4"/><path d="M14 17l-4 0"/>',
  );
}

// tabler: trash
function trashIcon(): HTMLSpanElement {
  return icon(
    '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/>' +
      '<path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>' +
      '<path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  );
}

/** Reads a `Table` syntax node's header/alignment/body rows into a plain, editable model. */
export function parseTableModel(doc: Text, tableNode: SyntaxNode): TableModel {
  const slice = (n: SyntaxNode) => doc.sliceString(n.from, n.to);
  const cellsOf = (row: SyntaxNode) =>
    row.getChildren('TableCell').map((c) => unescapeCell(slice(c).trim()));

  const headerNode = tableNode.getChild('TableHeader');
  const delimNode = tableNode.getChild('TableDelimiter');
  const header = headerNode ? cellsOf(headerNode) : [];
  const align = (delimNode ? slice(delimNode) : '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAlign);
  const rows = tableNode.getChildren('TableRow').map(cellsOf);

  return { align, header, rows };
}

/** Renders a table model back to GFM Markdown source, always fully re-formatted. */
export function serializeTable(model: TableModel): string {
  const cols = model.header.length;
  const row = (cells: string[]) =>
    '| ' +
    Array.from({ length: cols }, (_, i) => escapeCell(cells[i] ?? '')).join(
      ' | ',
    ) +
    ' |';
  const delimiter =
    '| ' +
    Array.from({ length: cols }, (_, i) =>
      alignMarker(model.align[i] ?? null),
    ).join(' | ') +
    ' |';
  return [row(model.header), delimiter, ...model.rows.map(row)].join('\n');
}

/** Inserts an empty column at `index` (clamped to the table's bounds). */
export function insertColumnAt(model: TableModel, index: number): TableModel {
  const at = Math.max(0, Math.min(index, model.header.length));
  return {
    align: [...model.align.slice(0, at), null, ...model.align.slice(at)],
    header: [...model.header.slice(0, at), '', ...model.header.slice(at)],
    rows: model.rows.map((r) => [...r.slice(0, at), '', ...r.slice(at)]),
  };
}

/** Inserts an empty row at `index` (clamped to the table's bounds). */
export function insertRowAt(model: TableModel, index: number): TableModel {
  const at = Math.max(0, Math.min(index, model.rows.length));
  const cols = model.header.length;
  return {
    ...model,
    rows: [
      ...model.rows.slice(0, at),
      Array(cols).fill(''),
      ...model.rows.slice(at),
    ],
  };
}

function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Moves the column at `from` to index `to` (both clamped to bounds), reordering
 * alignment/header/every row together. No-op if the indices are equal. */
export function moveColumn(
  model: TableModel,
  from: number,
  to: number,
): TableModel {
  const cols = model.header.length;
  const f = Math.max(0, Math.min(from, cols - 1));
  const t = Math.max(0, Math.min(to, cols - 1));
  if (cols === 0 || f === t) return model;
  return {
    align: arrayMove(model.align, f, t),
    header: arrayMove(model.header, f, t),
    rows: model.rows.map((r) => arrayMove(r, f, t)),
  };
}

/** Moves the row at `from` to index `to` (both clamped to bounds). No-op if
 * the indices are equal. */
export function moveRow(
  model: TableModel,
  from: number,
  to: number,
): TableModel {
  const rows = model.rows.length;
  const f = Math.max(0, Math.min(from, rows - 1));
  const t = Math.max(0, Math.min(to, rows - 1));
  if (rows === 0 || f === t) return model;
  return { ...model, rows: arrayMove(model.rows, f, t) };
}

/**
 * Writes a pasted grid of values into the model starting at (atRow, atCol),
 * growing header/align/rows as needed. atRow === -1 targets the header row.
 */
export function pasteIntoModel(
  model: TableModel,
  atRow: number,
  atCol: number,
  grid: string[][],
): TableModel {
  const maxGridRowLen = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const neededCols = Math.max(model.header.length, atCol + maxGridRowLen);
  const neededRows = Math.max(model.rows.length, atRow + grid.length);

  const align = [...model.align];
  while (align.length < neededCols) align.push(null);

  const header = [...model.header];
  while (header.length < neededCols) header.push('');

  const rows = model.rows.map((r) => {
    const next = [...r];
    while (next.length < neededCols) next.push('');
    return next;
  });
  while (rows.length < neededRows) rows.push(Array(neededCols).fill(''));

  grid.forEach((gridRow, ri) => {
    const targetRow = atRow + ri;
    gridRow.forEach((value, ci) => {
      const targetCol = atCol + ci;
      if (targetRow === -1) header[targetCol] = value;
      else rows[targetRow][targetCol] = value;
    });
  });

  return { align, header, rows };
}

/**
 * Toggles `open`/`close` markers around `text[from, to)` (or, for a collapsed
 * selection, right at the caret), stripping them if the span is already
 * exactly wrapped. Plain-string sibling of `wrapSelectionSpec`'s text-based
 * fallback in keymap.ts — table cells are just strings with a caret offset,
 * not an EditorState, so there's no syntax tree to consult here.
 */
export function toggleWrapText(
  text: string,
  from: number,
  to: number,
  open: string,
  close: string,
): { text: string; from: number; to: number } {
  const beforeFrom = Math.max(0, from - open.length);
  const afterTo = Math.min(text.length, to + close.length);
  const alreadyWrapped =
    text.slice(beforeFrom, from) === open && text.slice(to, afterTo) === close;

  if (from === to) {
    if (alreadyWrapped) {
      return {
        text: text.slice(0, beforeFrom) + text.slice(afterTo),
        from: beforeFrom,
        to: beforeFrom,
      };
    }
    return {
      text: text.slice(0, from) + open + close + text.slice(to),
      from: from + open.length,
      to: from + open.length,
    };
  }

  if (alreadyWrapped) {
    return {
      text:
        text.slice(0, beforeFrom) + text.slice(from, to) + text.slice(afterTo),
      from: beforeFrom,
      to: to - open.length,
    };
  }

  const selected = text.slice(from, to);
  if (
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close)
  ) {
    return {
      text:
        text.slice(0, from) +
        selected.slice(open.length, selected.length - close.length) +
        text.slice(to),
      from,
      to: to - open.length - close.length,
    };
  }

  return {
    text:
      text.slice(0, from) +
      open +
      text.slice(from, to) +
      close +
      text.slice(to),
    from: from + open.length,
    to: to + open.length,
  };
}

function getCellSelectionOffsets(
  cell: HTMLElement,
): { from: number; to: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (
    !cell.contains(range.startContainer) ||
    !cell.contains(range.endContainer)
  )
    return null;

  const pre = document.createRange();
  pre.selectNodeContents(cell);
  pre.setEnd(range.startContainer, range.startOffset);
  const from = pre.toString().length;

  const post = document.createRange();
  post.selectNodeContents(cell);
  post.setEnd(range.endContainer, range.endOffset);
  const to = post.toString().length;

  return { from, to };
}

function setCellSelectionOffsets(cell: HTMLElement, from: number, to: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const textNode =
    cell.firstChild ?? cell.appendChild(document.createTextNode(''));
  const len = textNode.textContent?.length ?? 0;
  const range = document.createRange();
  range.setStart(textNode, Math.min(Math.max(from, 0), len));
  range.setEnd(textNode, Math.min(Math.max(to, 0), len));
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Focuses the cell at (row, col) — row -1 is the header — placing the caret
 * at the given text edge. Returns whether a matching cell was found. */
function focusCell(
  table: HTMLTableElement,
  row: number,
  col: number,
  edge: 'start' | 'end',
): boolean {
  const cell = table.querySelector<HTMLElement>(
    `[data-row="${row}"][data-col="${col}"]`,
  );
  if (!cell) return false;
  cell.focus();
  setCellSelectionOffsets(
    cell,
    edge === 'start' ? 0 : (cell.textContent?.length ?? 0),
    edge === 'start' ? 0 : (cell.textContent?.length ?? 0),
  );
  return true;
}

const FORMAT_SHORTCUTS: Record<string, [string, string]> = {
  b: ['**', '**'],
  i: ['*', '*'],
  u: ['<u>', '</u>'],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const CELL_MARK_RE =
  /\*\*([^*]+)\*\*|(?<!\*)\*([^*]+)\*(?!\*)|~~([^~]+)~~|<u>([^<]*)<\/u>/g;

interface CellToken {
  /** Raw source text of this run, markers excluded. */
  raw: string;
  /** Offset of `raw` within the cell's full source string. */
  from: number;
  tag: 'strong' | 'em' | 'del' | 'u' | null;
}

/** Splits a cell's raw Markdown source into alternating plain/formatted runs
 * (bold/italic/underline/strikethrough — the marks FORMAT_SHORTCUTS and
 * Mod-Shift-X produce). Shared base for renderCellHtml (display) and
 * renderedOffsetToRawOffset (click-to-caret mapping) so the two can't drift
 * out of sync with each other. */
function tokenizeCell(text: string): CellToken[] {
  const tokens: CellToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CELL_MARK_RE.lastIndex = 0;
  while ((match = CELL_MARK_RE.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({
        raw: text.slice(lastIndex, match.index),
        from: lastIndex,
        tag: null,
      });
    }
    let tag: CellToken['tag'];
    let raw: string;
    let openLen: number;
    if (match[1] !== undefined) {
      tag = 'strong';
      raw = match[1];
      openLen = 2;
    } else if (match[2] !== undefined) {
      tag = 'em';
      raw = match[2];
      openLen = 1;
    } else if (match[3] !== undefined) {
      tag = 'del';
      raw = match[3];
      openLen = 2;
    } else {
      tag = 'u';
      raw = match[4] ?? '';
      openLen = 3; // '<u>'
    }
    tokens.push({ raw, from: match.index + openLen, tag });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ raw: text.slice(lastIndex), from: lastIndex, tag: null });
  }
  return tokens;
}

/** Renders a cell's raw Markdown source to display HTML. Shown only while
 * the cell is blurred; editing always works against the plain-text source
 * (see makeEditableCell's focus/blur handlers). */
export function renderCellHtml(text: string): string {
  return tokenizeCell(text)
    .map((t) => {
      const escaped = escapeHtml(t.raw);
      return t.tag ? `<${t.tag}>${escaped}</${t.tag}>` : escaped;
    })
    .join('');
}

/** Inverse of renderCellHtml's text flattening: given an offset into the
 * *rendered* plain text (e.g. from a click hit-tested against the formatted
 * DOM), returns the corresponding offset into the raw Markdown source —
 * needed because clicking a formatted cell swaps its DOM from rendered HTML
 * to raw text on focus, which would otherwise strand the caret. */
export function renderedOffsetToRawOffset(
  text: string,
  renderedOffset: number,
): number {
  let pos = 0;
  for (const t of tokenizeCell(text)) {
    if (renderedOffset <= pos + t.raw.length) {
      return t.from + (renderedOffset - pos);
    }
    pos += t.raw.length;
  }
  return text.length;
}

interface CellContext {
  /** -1 for the header row, 0-based index into model.rows otherwise. */
  row: number;
  col: number;
  /** Number of body rows (model.rows.length) — header row is not counted. */
  rowCount: number;
  colCount: number;
}

/** Builds the contentEditable surface for a cell's text. Callers wrap this in
 * the actual `<th>`/`<td>` (kept separate so header cells can host a hover
 * menu icon as a plain sibling, instead of a non-text child fighting with
 * `cell.textContent`-based commit/selection logic below). */
function makeEditableCell(
  text: string,
  align: Alignment,
  ctx: CellContext,
  onCommit: (next: string) => void,
): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'cm-md-table-cell-editable';
  cell.contentEditable = 'true';
  cell.innerHTML = renderCellHtml(text);
  cell.dataset.row = String(ctx.row);
  cell.dataset.col = String(ctx.col);
  if (align) cell.style.textAlign = align;

  // Editing always happens against the raw Markdown source (a single plain
  // text node, required by getCellSelectionOffsets/setCellSelectionOffsets);
  // the formatted HTML from renderCellHtml is swapped in only while blurred.
  cell.addEventListener('focus', () => {
    cell.textContent = text;
  });

  // A click that focuses the cell hit-tests against the *rendered* (marker-
  // stripped) DOM, but focus immediately swaps that DOM for raw text —
  // stranding the caret at whatever the browser's default placement lands
  // on. Take over: hit-test the click ourselves before the swap, translate
  // it to a raw-text offset, and place the caret there after focusing.
  // ponytail: only the initial focusing click is special-cased, so a
  // click-drag starting on that same click won't extend a selection (native
  // drag-select still works once the cell is already focused).
  cell.addEventListener('mousedown', (e) => {
    if (document.activeElement === cell) return;
    const caret = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (!caret || !cell.contains(caret.startContainer)) return;
    const pre = document.createRange();
    pre.selectNodeContents(cell);
    pre.setEnd(caret.startContainer, caret.startOffset);
    const renderedOffset = pre.toString().length;

    e.preventDefault();
    cell.focus();
    const rawOffset = renderedOffsetToRawOffset(text, renderedOffset);
    setCellSelectionOffsets(cell, rawOffset, rawOffset);
  });

  cell.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        setCellSelectionOffsets(cell, 0, cell.textContent?.length ?? 0);
        return;
      }
      const shortcut =
        key === 'x' && e.shiftKey
          ? (['~~', '~~'] as [string, string])
          : FORMAT_SHORTCUTS[key];
      if (shortcut) {
        e.preventDefault();
        e.stopPropagation();
        const sel = getCellSelectionOffsets(cell);
        if (sel) {
          const [open, close] = shortcut;
          const result = toggleWrapText(
            cell.textContent ?? '',
            sel.from,
            sel.to,
            open,
            close,
          );
          // Update the cell locally only — committing here would rebuild the
          // whole table widget (model changed => new DOM) and blur the cell
          // mid-edit. The blur handler below persists the change instead.
          cell.textContent = result.text;
          setCellSelectionOffsets(cell, result.from, result.to);
        }
        return;
      }
    }

    const table = cell.closest('table');

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!table) return;
      const dir = e.shiftKey ? -1 : 1;
      let row = ctx.row;
      let col = ctx.col + dir;
      if (col >= ctx.colCount) {
        col = 0;
        row += 1;
      } else if (col < 0) {
        col = ctx.colCount - 1;
        row -= 1;
      }
      if (row >= -1 && row <= ctx.rowCount - 1) {
        focusCell(table, row, col, dir > 0 ? 'start' : 'end');
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      cell.blur();
      if (table && ctx.row + 1 <= ctx.rowCount - 1) {
        focusCell(table, ctx.row + 1, ctx.col, 'start');
      }
      return;
    }

    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown'
    ) {
      if (!table) return;
      const sel = getCellSelectionOffsets(cell);
      if (!sel || sel.from !== sel.to) return;
      const len = cell.textContent?.length ?? 0;
      const atStart = sel.from === 0;
      const atEnd = sel.from === len;

      if (e.key === 'ArrowLeft' && atStart) {
        e.preventDefault();
        focusCell(table, ctx.row, ctx.col - 1, 'end');
      } else if (e.key === 'ArrowRight' && atEnd) {
        e.preventDefault();
        focusCell(table, ctx.row, ctx.col + 1, 'start');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusCell(table, ctx.row - 1, ctx.col, 'end');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusCell(table, ctx.row + 1, ctx.col, 'end');
      }
    }
  });

  cell.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text/plain') ?? '';
    if (!pasted.includes('\t') && !pasted.includes('\n')) {
      document.execCommand('insertText', false, pasted);
      return;
    }
    const grid = pasted
      .replace(/\r/g, '')
      .split('\n')
      .filter((line, i, lines) => !(i === lines.length - 1 && line === ''))
      .map((line) => line.split('\t'));
    cell.dispatchEvent(
      new CustomEvent('table-cell-paste', { bubbles: true, detail: { grid } }),
    );
  });

  cell.addEventListener('blur', () => {
    const next = (cell.textContent ?? '').trim();
    if (next !== text) onCommit(next);
    cell.innerHTML = renderCellHtml(next);
  });
  return cell;
}

function makeMenuItem(
  label: string,
  onClick: () => void,
  opts?: {
    active?: boolean;
    destructive?: boolean;
    disabled?: boolean;
    icon?: HTMLElement;
    iconOnly?: boolean;
  },
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cm-md-table-menu-item';
  if (opts?.active) btn.classList.add('cm-md-table-menu-item-active');
  if (opts?.destructive) btn.classList.add('cm-md-table-menu-item-destructive');
  if (opts?.icon) btn.appendChild(opts.icon);
  if (opts?.iconOnly) {
    btn.title = label;
    btn.setAttribute('aria-label', label);
  } else {
    btn.appendChild(document.createTextNode(label));
  }
  btn.disabled = !!opts?.disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeMenuDivider(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'cm-md-table-menu-divider';
  return div;
}

interface PopoverState {
  el: HTMLElement | null;
  cleanup: (() => void) | null;
}

function closePopover(state: PopoverState) {
  state.el?.remove();
  state.el = null;
  state.cleanup?.();
  state.cleanup = null;
}

/** Opens a dropdown as a plain absolutely-positioned child of `anchor` (which
 * must be `position: relative`) — no anchor-positioning API needed since it
 * never has to escape the anchor's own box. Dismisses itself on an outside
 * pointerdown or Escape; only one popover is ever open at a time per `state`. */
function openPopover(
  state: PopoverState,
  anchor: HTMLElement,
  className: string,
  items: HTMLElement[],
) {
  closePopover(state);
  const pop = document.createElement('div');
  pop.className = `cm-md-table-popover ${className}`;
  items.forEach((el) => pop.appendChild(el));
  anchor.appendChild(pop);
  state.el = pop;

  const onOutside = (e: PointerEvent) => {
    if (!pop.contains(e.target as Node)) closePopover(state);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closePopover(state);
  };
  // Deferred so the pointerdown that opened this popover doesn't also close it.
  const raf = requestAnimationFrame(() => {
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
  });
  state.cleanup = () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
  };
}

function elementCenters(elements: HTMLElement[], axis: 'x' | 'y'): number[] {
  return elements.map((el) => {
    const rect = el.getBoundingClientRect();
    return axis === 'x'
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2;
  });
}

function nearestIndexByCenter(centers: number[], pointerCoord: number): number {
  let best = 0;
  let bestDist = Infinity;
  centers.forEach((center, i) => {
    const dist = Math.abs(pointerCoord - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}

const DRAG_THRESHOLD_PX = 5;

interface UnionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function unionRect(elements: HTMLElement[]): UnionRect {
  const rects = elements.map((el) => el.getBoundingClientRect());
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

/** Positions `overlay` (already a child of `wrap`) to exactly cover a
 * pre-measured union bounding box — one continuous border around a whole
 * column's cells (th + every td), rather than each cell drawing its own
 * border and leaving seams at row boundaries. Takes a cached rect (measured
 * before any drag transform) rather than re-measuring live, since the
 * hovered group can be the dragged group itself (dropping back near its
 * start), whose live rect is offset by the pointer-follow transform. */
function fitOverlayToRect(
  overlay: HTMLElement,
  wrap: HTMLElement,
  rect: UnionRect,
) {
  const wrapRect = wrap.getBoundingClientRect();
  overlay.style.left = `${rect.left - wrapRect.left}px`;
  overlay.style.top = `${rect.top - wrapRect.top}px`;
  overlay.style.width = `${rect.right - rect.left}px`;
  overlay.style.height = `${rect.bottom - rect.top}px`;
}

/** For each group, how far (px, along `axis`) it must shift to sit in its
 * new slot if the group at `from` moved to `to` — 0 for groups outside that
 * range. Used to preview the reorder by sliding the *other* columns/rows out
 * of the way while the dragged one follows the pointer. */
function computeReorderOffsets(
  rects: UnionRect[],
  from: number,
  to: number,
  axis: 'x' | 'y',
): number[] {
  const starts = rects.map((r) => (axis === 'x' ? r.left : r.top));
  const sizes = rects.map((r) =>
    axis === 'x' ? r.right - r.left : r.bottom - r.top,
  );
  const order = arrayMove(
    rects.map((_, i) => i),
    from,
    to,
  );
  let cursor = starts[0];
  const slotStart: number[] = [];
  for (const origIndex of order) {
    slotStart[origIndex] = cursor;
    cursor += sizes[origIndex];
  }
  return starts.map((start, i) => slotStart[i] - start);
}

/** A hover-revealed "⋮" icon that's dual-purpose: a tap opens a popover menu,
 * a press-and-hold-then-move past a small threshold drags instead (reordering
 * the column/row via `drag.onDrop`) — the same trigger either opens a menu or
 * starts a drag, never both, decided by whether the pointer moved. */
function setupMenuIcon(params: {
  wrap: HTMLElement;
  anchor: HTMLElement;
  popoverClass: string;
  buildMenuItems: () => HTMLElement[];
  drag: {
    axis: 'x' | 'y';
    sourceIndex: number;
    getTargets: () => HTMLElement[];
    /** All elements a hovered target should highlight together, as one
     * bounding box — e.g. a column's th plus every td below it. Defaults to
     * just the hovered target itself (e.g. a row's single `<tr>`). */
    getHighlightGroup?: (target: HTMLElement, index: number) => HTMLElement[];
    onDrop: (toIndex: number) => void;
  };
}): HTMLButtonElement {
  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = 'cm-md-table-menu-icon';
  icon.textContent = '⋮';
  icon.setAttribute('aria-label', 'Column/row menu');

  const popoverState: PopoverState = { el: null, cleanup: null };

  icon.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let target: HTMLElement | null = null;
    let targetIdx = -1;
    let targets: HTMLElement[] = [];
    let centers: number[] = [];
    // All measured once, before any transform is applied — a group's live
    // rect would otherwise be thrown off by its own pointer-follow/shift
    // transform (e.g. dropping a column back near its start position).
    let groups: HTMLElement[][] = [];
    let groupRects: UnionRect[] = [];
    let overlay: HTMLElement | null = null;

    icon.setPointerCapture(e.pointerId);

    const clearHighlight = () => {
      overlay?.remove();
      overlay = null;
    };

    const resetGroups = () => {
      groups.forEach((group, i) => {
        group.forEach((el) => {
          el.style.transform = '';
          if (i === params.drag.sourceIndex) {
            el.classList.remove('cm-md-table-drag-source');
          }
        });
      });
      groups = [];
      groupRects = [];
    };

    const onMove = (me: PointerEvent) => {
      if (!dragging) {
        if (
          Math.hypot(me.clientX - startX, me.clientY - startY) <
          DRAG_THRESHOLD_PX
        )
          return;
        dragging = true;
        params.wrap.classList.add('cm-md-table-dragging');
        targets = params.drag.getTargets();
        centers = elementCenters(targets, params.drag.axis);
        groups = targets.map(
          (t, i) => params.drag.getHighlightGroup?.(t, i) ?? [t],
        );
        groupRects = groups.map(unionRect);
        groups[params.drag.sourceIndex]?.forEach((el) =>
          el.classList.add('cm-md-table-drag-source'),
        );
      }
      // The dragged row/column follows the pointer directly — makes the
      // interaction read as an actual drag instead of a static picker.
      const delta =
        params.drag.axis === 'x' ? me.clientX - startX : me.clientY - startY;
      const followTransform =
        params.drag.axis === 'x'
          ? `translateX(${delta}px)`
          : `translateY(${delta}px)`;
      groups[params.drag.sourceIndex]?.forEach(
        (el) => (el.style.transform = followTransform),
      );

      const coord = params.drag.axis === 'x' ? me.clientX : me.clientY;
      const idx = nearestIndexByCenter(centers, coord);
      const next = targets[idx] ?? null;
      if (target !== next) {
        target = next;
        targetIdx = idx;
        if (target) {
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'cm-md-table-drop-target';
            params.wrap.appendChild(overlay);
          }
          fitOverlayToRect(overlay, params.wrap, groupRects[idx]);

          // Shift every other column/row out of the way to preview the drop.
          const offsets = computeReorderOffsets(
            groupRects,
            params.drag.sourceIndex,
            idx,
            params.drag.axis,
          );
          groups.forEach((group, i) => {
            if (i === params.drag.sourceIndex) return;
            const shiftTransform =
              params.drag.axis === 'x'
                ? `translateX(${offsets[i]}px)`
                : `translateY(${offsets[i]}px)`;
            group.forEach((el) => (el.style.transform = shiftTransform));
          });
        } else {
          clearHighlight();
        }
      }
    };

    const onUp = () => {
      icon.releasePointerCapture(e.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (dragging) {
        params.wrap.classList.remove('cm-md-table-dragging');
        clearHighlight();
        resetGroups();
        const toIndex = targetIdx;
        if (toIndex >= 0 && toIndex !== params.drag.sourceIndex) {
          params.drag.onDrop(toIndex);
        }
      } else if (popoverState.el) {
        closePopover(popoverState);
      } else {
        openPopover(
          popoverState,
          params.anchor,
          params.popoverClass,
          params.buildMenuItems(),
        );
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  return icon;
}

/** Ponytail: every mutation re-serializes the whole table and replaces [from,to] in one
 * transaction, rather than surgically patching pipe positions. Simpler and handles
 * add/remove row/column uniformly; the tradeoff is the whole table's formatting gets
 * re-normalized on every edit (matches how e.g. Obsidian's table editor behaves too). */
export class TableWidget extends WidgetType {
  constructor(
    readonly model: TableModel,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: TableWidget) {
    return (
      this.from === other.from &&
      this.to === other.to &&
      JSON.stringify(this.model) === JSON.stringify(other.model)
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const { model, from, to } = this;
    const cols = model.header.length;
    const commit = (next: TableModel) =>
      view.dispatch({ changes: { from, to, insert: serializeTable(next) } });

    const wrap = document.createElement('div');
    wrap.className = 'cm-md-table-wrap';

    const table = document.createElement('table');
    table.className = 'cm-md-table';
    table.addEventListener('table-cell-paste', ((e: CustomEvent) => {
      const target = e.target as HTMLElement;
      const row = Number(target.dataset.row);
      const col = Number(target.dataset.col);
      commit(pasteIntoModel(model, row, col, e.detail.grid));
    }) as EventListener);

    const buildColumnMenuItems = (colIndex: number): HTMLElement[] => {
      const alignRow = document.createElement('div');
      alignRow.className = 'cm-md-table-menu-align-row';
      (['left', 'center', 'right'] as const).forEach((a) => {
        const active = (model.align[colIndex] ?? null) === a;
        alignRow.appendChild(
          makeMenuItem(
            alignLabel(a),
            () => {
              const align = [...model.align];
              align[colIndex] = active ? null : a;
              commit({ ...model, align });
            },
            { active, icon: alignIcon(a), iconOnly: true },
          ),
        );
      });
      alignRow.appendChild(
        makeMenuItem(
          alignLabel(null),
          () => {
            const align = [...model.align];
            align[colIndex] = null;
            commit({ ...model, align });
          },
          {
            active: (model.align[colIndex] ?? null) === null,
            icon: alignIcon(null),
            iconOnly: true,
          },
        ),
      );
      return [
        alignRow,
        makeMenuItem(
          'Insert column before',
          () => commit(insertColumnAt(model, colIndex)),
          { icon: colInsertIcon('before') },
        ),
        makeMenuItem(
          'Insert column after',
          () => commit(insertColumnAt(model, colIndex + 1)),
          { icon: colInsertIcon('after') },
        ),
        makeMenuDivider(),
        makeMenuItem(
          'Delete column',
          () =>
            commit({
              align: model.align.filter((_, ci) => ci !== colIndex),
              header: model.header.filter((_, ci) => ci !== colIndex),
              rows: model.rows.map((r) => r.filter((_, ci) => ci !== colIndex)),
            }),
          { destructive: true, disabled: cols <= 1, icon: trashIcon() },
        ),
      ];
    };

    const buildRowMenuItems = (rowIndex: number): HTMLElement[] => [
      makeMenuItem(
        'Insert row above',
        () => commit(insertRowAt(model, rowIndex)),
        { icon: rowInsertIcon('above') },
      ),
      makeMenuItem(
        'Insert row below',
        () => commit(insertRowAt(model, rowIndex + 1)),
        { icon: rowInsertIcon('below') },
      ),
      makeMenuDivider(),
      makeMenuItem(
        'Delete row',
        () =>
          commit({
            ...model,
            rows: model.rows.filter((_, ri) => ri !== rowIndex),
          }),
        { destructive: true, icon: trashIcon() },
      ),
    ];

    const columnTargets = () =>
      Array.from(
        table.querySelectorAll<HTMLElement>('thead .cm-md-table-header-cell'),
      );
    const rowTargets = () =>
      Array.from(table.querySelectorAll<HTMLElement>('tbody tr'));

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const headerHandle = document.createElement('th');
    headerHandle.className = 'cm-md-table-row-handle';
    headerRow.appendChild(headerHandle);

    model.header.forEach((text, i) => {
      const th = document.createElement('th');
      th.className = 'cm-md-table-cell cm-md-table-header-cell';
      th.appendChild(
        makeEditableCell(
          text,
          model.align[i] ?? null,
          { row: -1, col: i, rowCount: model.rows.length, colCount: cols },
          (next) => {
            const header = [...model.header];
            header[i] = next;
            commit({ ...model, header });
          },
        ),
      );
      th.appendChild(
        setupMenuIcon({
          wrap,
          anchor: th,
          popoverClass: 'cm-md-table-popover-col',
          buildMenuItems: () => buildColumnMenuItems(i),
          drag: {
            axis: 'x',
            sourceIndex: i,
            getTargets: columnTargets,
            getHighlightGroup: (th, idx) => [
              th,
              ...Array.from(
                table.querySelectorAll<HTMLElement>('tbody tr'),
              ).map((tr) => tr.children[idx + 1] as HTMLElement),
            ],
            onDrop: (toIndex) => commit(moveColumn(model, i, toIndex)),
          },
        }),
      );
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    model.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');

      const rowHandle = document.createElement('td');
      rowHandle.className = 'cm-md-table-row-handle';
      rowHandle.appendChild(
        setupMenuIcon({
          wrap,
          anchor: rowHandle,
          popoverClass: 'cm-md-table-popover-row',
          buildMenuItems: () => buildRowMenuItems(rowIndex),
          drag: {
            axis: 'y',
            sourceIndex: rowIndex,
            getTargets: rowTargets,
            onDrop: (toIndex) => commit(moveRow(model, rowIndex, toIndex)),
          },
        }),
      );
      tr.appendChild(rowHandle);

      for (let i = 0; i < cols; i++) {
        const td = document.createElement('td');
        td.className = 'cm-md-table-cell';
        td.appendChild(
          makeEditableCell(
            row[i] ?? '',
            model.align[i] ?? null,
            {
              row: rowIndex,
              col: i,
              rowCount: model.rows.length,
              colCount: cols,
            },
            (next) => {
              const rows = model.rows.map((r) => [...r]);
              rows[rowIndex][i] = next;
              commit({ ...model, rows });
            },
          ),
        );
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    return wrap;
  }
}
