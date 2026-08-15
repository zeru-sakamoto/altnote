import { describe, it, expect } from 'vitest';
import { Text } from '@codemirror/state';
import { parser, GFM } from '@lezer/markdown';
import { parseAlign, parseTableModel, serializeTable } from './liveTable';

const tableParser = parser.configure(GFM);

function parseFirstTable(source: string) {
  const tree = tableParser.parse(source);
  const tableNode = tree.topNode.getChild('Table');
  if (!tableNode) throw new Error('no table found in test fixture');
  return parseTableModel(Text.of(source.split('\n')), tableNode);
}

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
