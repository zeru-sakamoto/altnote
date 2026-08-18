import { describe, it, expect } from 'vitest';
import { Text } from '@codemirror/state';
import { parser, GFM } from '@lezer/markdown';
import {
  parseAlign,
  parseTableModel,
  serializeTable,
  nextAlign,
  insertColumnAt,
  insertRowAt,
  moveColumn,
  moveRow,
  pasteIntoModel,
  toggleWrapText,
  renderCellHtml,
  renderedOffsetToRawOffset,
  type TableModel,
} from './liveTable';

const tableParser = parser.configure(GFM);

function parseFirstTable(source: string) {
  const tree = tableParser.parse(source);
  const tableNode = tree.topNode.getChild('Table');
  if (!tableNode) throw new Error('no table found in test fixture');
  return parseTableModel(Text.of(source.split('\n')), tableNode);
}

describe('renderCellHtml', () => {
  it('renders bold, italic, underline, and strikethrough', () => {
    expect(renderCellHtml('**bold**')).toBe('<strong>bold</strong>');
    expect(renderCellHtml('*italic*')).toBe('<em>italic</em>');
    expect(renderCellHtml('<u>under</u>')).toBe('<u>under</u>');
    expect(renderCellHtml('~~strike~~')).toBe('<del>strike</del>');
  });

  it('escapes plain HTML-like text so it renders as literal characters', () => {
    expect(renderCellHtml('<script>x</script>')).toBe(
      '&lt;script&gt;x&lt;/script&gt;',
    );
  });

  it('leaves unformatted text untouched', () => {
    expect(renderCellHtml('plain text')).toBe('plain text');
  });
});

describe('renderedOffsetToRawOffset', () => {
  it('maps a click inside a bold run back to its raw offset', () => {
    // raw: "hi **bold** end" (indices: h0 i1 _2 *3 *4 b5 o6 l7 d8 *9 *10 _11 ...)
    // rendered: "hi bold end" -> offset 4 is the 'o' in "bold"
    const raw = 'hi **bold** end';
    expect(renderedOffsetToRawOffset(raw, 4)).toBe(6);
  });

  it('maps plain-text offsets 1:1 when there is no formatting', () => {
    expect(renderedOffsetToRawOffset('plain text', 4)).toBe(4);
  });

  it('clamps to raw length past the end of rendered text', () => {
    expect(renderedOffsetToRawOffset('**bold**', 100)).toBe(8);
  });
});

describe('parseAlign', () => {
  it('reads left/right/center/none from a delimiter cell', () => {
    expect(parseAlign('---')).toBeNull();
    expect(parseAlign(':---')).toBe('left');
    expect(parseAlign('---:')).toBe('right');
    expect(parseAlign(':---:')).toBe('center');
  });
});

describe('parseTableModel + serializeTable', () => {
  const source = '| A | B |\n| --- | ---: |\n| 1 | 2 |\n| 3 | 4 |';

  it('parses header, alignment, and rows', () => {
    const model = parseFirstTable(source);
    expect(model.header).toEqual(['A', 'B']);
    expect(model.align).toEqual([null, 'right']);
    expect(model.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('round-trips through serializeTable back into an equivalent model', () => {
    const model = parseFirstTable(source);
    const reparsed = parseFirstTable(serializeTable(model));
    expect(reparsed).toEqual(model);
  });

  it('escapes and unescapes pipe characters in cell text', () => {
    const withPipe = '| A |\n| --- |\n| a\\|b |';
    const model = parseFirstTable(withPipe);
    expect(model.rows).toEqual([['a|b']]);
    expect(serializeTable(model)).toContain('a\\|b');
  });
});

describe('nextAlign', () => {
  it('cycles null -> left -> center -> right -> null', () => {
    expect(nextAlign(null)).toBe('left');
    expect(nextAlign('left')).toBe('center');
    expect(nextAlign('center')).toBe('right');
    expect(nextAlign('right')).toBe(null);
  });
});

describe('insertColumnAt', () => {
  const model: TableModel = {
    align: [null, 'right'],
    header: ['A', 'B'],
    rows: [
      ['1', '2'],
      ['3', '4'],
    ],
  };

  it('inserts an empty column at the given index', () => {
    const next = insertColumnAt(model, 1);
    expect(next.header).toEqual(['A', '', 'B']);
    expect(next.align).toEqual([null, null, 'right']);
    expect(next.rows).toEqual([
      ['1', '', '2'],
      ['3', '', '4'],
    ]);
  });

  it('clamps the index to the table bounds', () => {
    expect(insertColumnAt(model, 99).header).toEqual(['A', 'B', '']);
    expect(insertColumnAt(model, -5).header).toEqual(['', 'A', 'B']);
  });
});

describe('insertRowAt', () => {
  const model: TableModel = {
    align: [null],
    header: ['A'],
    rows: [['1'], ['2']],
  };

  it('inserts an empty row at the given index', () => {
    const next = insertRowAt(model, 1);
    expect(next.rows).toEqual([['1'], [''], ['2']]);
  });

  it('clamps the index to the table bounds', () => {
    expect(insertRowAt(model, 99).rows).toEqual([['1'], ['2'], ['']]);
    expect(insertRowAt(model, -5).rows).toEqual([[''], ['1'], ['2']]);
  });
});

describe('moveColumn', () => {
  const model: TableModel = {
    align: [null, 'right', 'center'],
    header: ['A', 'B', 'C'],
    rows: [
      ['1', '2', '3'],
      ['4', '5', '6'],
    ],
  };

  it('moves a column from one index to another', () => {
    const next = moveColumn(model, 0, 2);
    expect(next.header).toEqual(['B', 'C', 'A']);
    expect(next.align).toEqual(['right', 'center', null]);
    expect(next.rows).toEqual([
      ['2', '3', '1'],
      ['5', '6', '4'],
    ]);
  });

  it('moves the last column to the first position', () => {
    const next = moveColumn(model, 2, 0);
    expect(next.header).toEqual(['C', 'A', 'B']);
  });

  it('is a no-op when from equals to', () => {
    expect(moveColumn(model, 1, 1)).toEqual(model);
  });

  it('clamps out-of-range indices to bounds', () => {
    expect(moveColumn(model, 99, 0).header).toEqual(['C', 'A', 'B']);
    expect(moveColumn(model, 0, -5).header).toEqual(['A', 'B', 'C']);
  });
});

describe('moveRow', () => {
  const model: TableModel = {
    align: [null],
    header: ['A'],
    rows: [['1'], ['2'], ['3']],
  };

  it('moves a row from one index to another', () => {
    expect(moveRow(model, 0, 2).rows).toEqual([['2'], ['3'], ['1']]);
  });

  it('moves the last row to the first position', () => {
    expect(moveRow(model, 2, 0).rows).toEqual([['3'], ['1'], ['2']]);
  });

  it('is a no-op when from equals to', () => {
    expect(moveRow(model, 1, 1)).toEqual(model);
  });

  it('clamps out-of-range indices to bounds', () => {
    expect(moveRow(model, 99, 0).rows).toEqual([['3'], ['1'], ['2']]);
    expect(moveRow(model, 0, -5).rows).toEqual([['1'], ['2'], ['3']]);
  });
});

describe('pasteIntoModel', () => {
  const model: TableModel = {
    align: [null, null],
    header: ['A', 'B'],
    rows: [['1', '2']],
  };

  it('overwrites cells starting at the target position', () => {
    const next = pasteIntoModel(model, 0, 0, [['x', 'y']]);
    expect(next.rows).toEqual([['x', 'y']]);
  });

  it('grows rows and columns when the pasted grid is bigger than the table', () => {
    const next = pasteIntoModel(model, 0, 1, [
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(next.header).toEqual(['A', 'B', '']);
    expect(next.align).toEqual([null, null, null]);
    expect(next.rows).toEqual([
      ['1', 'a', 'b'],
      ['', 'c', 'd'],
    ]);
  });

  it('targets the header row when atRow is -1', () => {
    const next = pasteIntoModel(model, -1, 0, [['X', 'Y']]);
    expect(next.header).toEqual(['X', 'Y']);
    expect(next.rows).toEqual([['1', '2']]);
  });
});

describe('toggleWrapText', () => {
  it('wraps a selected range with open/close markers', () => {
    const result = toggleWrapText('hello world', 0, 5, '**', '**');
    expect(result.text).toBe('**hello** world');
    expect(result).toMatchObject({ from: 2, to: 7 });
  });

  it('unwraps a selection that is already exactly wrapped', () => {
    const result = toggleWrapText('**hello** world', 2, 7, '**', '**');
    expect(result.text).toBe('hello world');
    expect(result).toMatchObject({ from: 0, to: 5 });
  });

  it('unwraps when the selection includes the markers themselves', () => {
    const result = toggleWrapText('**hello** world', 0, 9, '**', '**');
    expect(result.text).toBe('hello world');
  });

  it('inserts an empty pair at a collapsed caret and toggles it back off', () => {
    const inserted = toggleWrapText('hello', 5, 5, '**', '**');
    expect(inserted.text).toBe('hello****');
    expect(inserted).toMatchObject({ from: 7, to: 7 });

    const removed = toggleWrapText(
      inserted.text,
      inserted.from,
      inserted.to,
      '**',
      '**',
    );
    expect(removed.text).toBe('hello');
    expect(removed).toMatchObject({ from: 5, to: 5 });
  });

  it('supports multi-character underline markers', () => {
    const result = toggleWrapText('note this', 0, 4, '<u>', '</u>');
    expect(result.text).toBe('<u>note</u> this');
  });
});
