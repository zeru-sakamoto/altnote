import { describe, it, expect } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { SearchQuery } from '@codemirror/search';
import { countMatches } from './findPanel';

function stateWith(doc: string, cursor = 0) {
  return EditorState.create({ doc, selection: EditorSelection.cursor(cursor) });
}

describe('countMatches', () => {
  it('reports no results for an unmatched query', () => {
    const state = stateWith('hello world');
    const query = new SearchQuery({ search: 'xyz' });
    expect(countMatches(query, state)).toEqual({ index: -1, total: 0 });
  });

  it('reports a single match', () => {
    const state = stateWith('hello world');
    const query = new SearchQuery({ search: 'world' });
    expect(countMatches(query, state)).toEqual({ index: 0, total: 1 });
  });

  it('counts multiple matches and finds the nearest one at/after the cursor', () => {
    const state = stateWith('cat dog cat bird cat', 10);
    const query = new SearchQuery({ search: 'cat' });
    // matches at 0, 8, 17 — cursor at 10 is closest to (but before) the match at 17
    expect(countMatches(query, state)).toEqual({ index: 2, total: 3 });
  });

  it('identifies the exact match as current when the selection covers it', () => {
    const state = EditorState.create({
      doc: 'cat dog cat bird cat',
      selection: EditorSelection.range(8, 11),
    });
    const query = new SearchQuery({ search: 'cat' });
    expect(countMatches(query, state)).toEqual({ index: 1, total: 3 });
  });

  it('respects case sensitivity', () => {
    const state = stateWith('Cat cat CAT');
    const caseSensitive = new SearchQuery({
      search: 'cat',
      caseSensitive: true,
    });
    expect(countMatches(caseSensitive, state)).toEqual({ index: 0, total: 1 });
    const caseInsensitive = new SearchQuery({
      search: 'cat',
      caseSensitive: false,
    });
    expect(countMatches(caseInsensitive, state)).toEqual({
      index: 0,
      total: 3,
    });
  });

  it('supports regexp queries', () => {
    const state = stateWith('a1 b22 c333');
    const query = new SearchQuery({ search: '\\d+', regexp: true });
    expect(countMatches(query, state)).toEqual({ index: 0, total: 3 });
  });

  it('returns no results for an empty query', () => {
    const state = stateWith('hello world');
    const query = new SearchQuery({ search: '' });
    expect(countMatches(query, state)).toEqual({ index: -1, total: 0 });
  });
});
