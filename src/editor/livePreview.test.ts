import { describe, it, expect } from 'vitest';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { toggleTaskMarkerText, tableField } from './livePreview';

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
