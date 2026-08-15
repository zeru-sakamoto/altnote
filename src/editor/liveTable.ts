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

function makeEditableCell(
  tag: 'th' | 'td',
  text: string,
  align: Alignment,
  onCommit: (next: string) => void,
): HTMLTableCellElement {
  const cell = document.createElement(tag);
  cell.className = 'cm-md-table-cell';
  cell.contentEditable = 'true';
  cell.textContent = text;
  if (align) cell.style.textAlign = align;
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      cell.blur();
    }
  });
  cell.addEventListener('blur', () => {
    const next = (cell.textContent ?? '').trim();
    if (next !== text) onCommit(next);
  });
  return cell;
}

function makeButton(
  label: string,
  title: string,
  onClick: () => void,
  disabled = false,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cm-md-table-btn';
  btn.textContent = label;
  btn.title = title;
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
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

    const thead = document.createElement('thead');

    const controlsRow = document.createElement('tr');
    controlsRow.className = 'cm-md-table-controls';
    for (let i = 0; i < cols; i++) {
      const th = document.createElement('th');
      th.appendChild(
        makeButton(
          '×',
          'Remove column',
          () =>
            commit({
              align: model.align.filter((_, ci) => ci !== i),
              header: model.header.filter((_, ci) => ci !== i),
              rows: model.rows.map((r) => r.filter((_, ci) => ci !== i)),
            }),
          cols <= 1,
        ),
      );
      controlsRow.appendChild(th);
    }
    controlsRow.appendChild(document.createElement('th'));
    thead.appendChild(controlsRow);

    const headerRow = document.createElement('tr');
    model.header.forEach((text, i) => {
      headerRow.appendChild(
        makeEditableCell('th', text, model.align[i] ?? null, (next) => {
          const header = [...model.header];
          header[i] = next;
          commit({ ...model, header });
        }),
      );
    });
    headerRow.appendChild(document.createElement('th'));
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    model.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      for (let i = 0; i < cols; i++) {
        tr.appendChild(
          makeEditableCell(
            'td',
            row[i] ?? '',
            model.align[i] ?? null,
            (next) => {
              const rows = model.rows.map((r) => [...r]);
              rows[rowIndex][i] = next;
              commit({ ...model, rows });
            },
          ),
        );
      }
      const actionCell = document.createElement('td');
      actionCell.className = 'cm-md-table-row-action';
      actionCell.appendChild(
        makeButton('×', 'Remove row', () =>
          commit({
            ...model,
            rows: model.rows.filter((_, ri) => ri !== rowIndex),
          }),
        ),
      );
      tr.appendChild(actionCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    const actions = document.createElement('div');
    actions.className = 'cm-md-table-actions';
    actions.appendChild(
      makeButton('+ Row', 'Add row', () =>
        commit({ ...model, rows: [...model.rows, Array(cols).fill('')] }),
      ),
    );
    actions.appendChild(
      makeButton('+ Column', 'Add column', () =>
        commit({
          align: [...model.align, null],
          header: [...model.header, ''],
          rows: model.rows.map((r) => [...r, '']),
        }),
      ),
    );
    wrap.appendChild(actions);

    return wrap;
  }
}
