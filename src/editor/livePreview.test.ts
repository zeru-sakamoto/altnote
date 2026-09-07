import { describe, it, expect } from 'vitest';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import {
  toggleTaskMarkerText,
  tableField,
  bulletAutoSpaceInsert,
  getLinkUrlAt,
} from './livePreview';

const mdLang = markdown({ extensions: GFM });

describe('toggleTaskMarkerText', () => {
  it('checks an unchecked marker', () => {
    expect(toggleTaskMarkerText('[ ]')).toBe('[x]');
  });

  it('unchecks a lowercase-checked marker', () => {
    expect(toggleTaskMarkerText('[x]')).toBe('[ ]');
  });

  it('unchecks an uppercase-checked marker', () => {
    expect(toggleTaskMarkerText('[X]')).toBe('[ ]');
  });
});

describe('bulletAutoSpaceInsert', () => {
  it('computes an insert+cursor for each bullet marker on an empty line', () => {
    for (const marker of ['-', '*', '+']) {
      const state = EditorState.create({ doc: '', extensions: [mdLang] });
      expect(bulletAutoSpaceInsert(state, 0, 0, marker)).toEqual({
        insert: `${marker} `,
        cursor: 2,
      });
    }
  });

  it('does nothing for a non-marker character', () => {
    const state = EditorState.create({ doc: '', extensions: [mdLang] });
    expect(bulletAutoSpaceInsert(state, 0, 0, 'a')).toBeNull();
  });

  it('does nothing when the line already has other content', () => {
    const state = EditorState.create({ doc: 'hello', extensions: [mdLang] });
    expect(bulletAutoSpaceInsert(state, 5, 5, '-')).toBeNull();
  });

  it('does nothing when replacing a selection', () => {
    const state = EditorState.create({ doc: 'x', extensions: [mdLang] });
    expect(bulletAutoSpaceInsert(state, 0, 1, '-')).toBeNull();
  });

  it('does nothing inside a fenced code block', () => {
    const state = EditorState.create({
      doc: '```\n\n```',
      extensions: [mdLang],
    });
    expect(bulletAutoSpaceInsert(state, 4, 4, '-')).toBeNull();
  });
});

describe('getLinkUrlAt', () => {
  it('finds the destination of an inline [text](url) link', () => {
    const doc = '[example](https://example.com)';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    expect(getLinkUrlAt(state, 3)).toBe('https://example.com');
  });

  it('finds a bare GFM autolink with no [text](url) wrapper', () => {
    const doc = 'see https://example.com/path for more';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    expect(getLinkUrlAt(state, 8)).toBe('https://example.com/path');
  });

  it('finds a bracketed <url> autolink', () => {
    const doc = '<https://example.com>';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    expect(getLinkUrlAt(state, 5)).toBe('https://example.com');
  });

  it('returns null for plain text', () => {
    const doc = 'just some text';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    expect(getLinkUrlAt(state, 5)).toBeNull();
  });
});

describe('tableField', () => {
  const doc = '| a | b |\n| - | - |\n| 1 | 2 |\n';

  it('builds the table decoration once the language attaches asynchronously, without a doc change', () => {
    const language = new Compartment();
    let state = EditorState.create({
      doc,
      extensions: [language.of([]), tableField],
    });
    expect(state.field(tableField).size).toBe(0);

    const tr = state.update({
      effects: language.reconfigure(markdown({ extensions: GFM })),
    });
    state = tr.state;

    expect(state.field(tableField).size).toBe(1);
  });
});
