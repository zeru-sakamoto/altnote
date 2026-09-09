import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { wikiLinkExtension } from './mdExtensions';
import {
  tokenizeWords,
  collectSkipRanges,
  findMisspelledWords,
  type SpellChecker,
} from './spellcheck';

const mdLang = markdown({ extensions: [GFM, wikiLinkExtension] });

describe('tokenizeWords', () => {
  it('extracts plain words with their positions', () => {
    expect(tokenizeWords('hello world')).toEqual([
      { word: 'hello', from: 0, to: 5 },
      { word: 'world', from: 6, to: 11 },
    ]);
  });

  it('keeps contractions and possessives as single words', () => {
    expect(tokenizeWords("don't stop")).toEqual([
      { word: "don't", from: 0, to: 5 },
      { word: 'stop', from: 6, to: 10 },
    ]);
    expect(tokenizeWords("Sam's book")).toEqual([
      { word: "Sam's", from: 0, to: 5 },
      { word: 'book', from: 6, to: 10 },
    ]);
  });

  it('splits hyphenated compounds into separate words', () => {
    expect(tokenizeWords('well-known fact')).toEqual([
      { word: 'well', from: 0, to: 4 },
      { word: 'known', from: 5, to: 10 },
      { word: 'fact', from: 11, to: 15 },
    ]);
  });

  it('ignores punctuation and numbers-only tokens', () => {
    expect(tokenizeWords('hi, 123 there!')).toEqual([
      { word: 'hi', from: 0, to: 2 },
      { word: 'there', from: 8, to: 13 },
    ]);
  });

  it('applies the given offset to every token', () => {
    expect(tokenizeWords('hi there', 100)).toEqual([
      { word: 'hi', from: 100, to: 102 },
      { word: 'there', from: 103, to: 108 },
    ]);
  });
});

describe('collectSkipRanges', () => {
  it('skips an inline code span', () => {
    const doc = 'see `teh code` here';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const skip = collectSkipRanges(state, 0, doc.length);
    const codeFrom = doc.indexOf('`');
    const codeTo = doc.lastIndexOf('`') + 1;
    expect(skip.some((r) => r.from === codeFrom && r.to === codeTo)).toBe(true);
  });

  it('skips a fenced code block', () => {
    const doc = '```\nteh\n```';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const skip = collectSkipRanges(state, 0, doc.length);
    expect(skip.some((r) => r.from === 0 && r.to === doc.length)).toBe(true);
  });

  it('skips the URL of a link but keeps the label checkable', () => {
    const doc = '[teh label](https://example.com/teh)';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const skip = collectSkipRanges(state, 0, doc.length);
    const urlFrom = doc.indexOf('https://');
    const urlTo = doc.lastIndexOf(')');
    expect(skip.some((r) => r.from === urlFrom && r.to === urlTo)).toBe(true);
    const labelFrom = doc.indexOf('teh');
    expect(skip.some((r) => r.from <= labelFrom && r.to > labelFrom)).toBe(
      false,
    );
  });

  it('skips the URL of an image but keeps alt text checkable', () => {
    const doc = '![teh alt](https://example.com/x.png)';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const skip = collectSkipRanges(state, 0, doc.length);
    const urlFrom = doc.indexOf('https://');
    expect(skip.some((r) => r.from === urlFrom)).toBe(true);
    const altFrom = doc.indexOf('teh');
    expect(skip.some((r) => r.from <= altFrom && r.to > altFrom)).toBe(false);
  });

  it('skips a bare autolink', () => {
    const doc = 'see <https://example.com/teh> now';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const skip = collectSkipRanges(state, 0, doc.length);
    const linkFrom = doc.indexOf('<');
    const linkTo = doc.indexOf('>') + 1;
    expect(skip.some((r) => r.from === linkFrom && r.to === linkTo)).toBe(true);
  });

  it('skips a wikilink target but keeps the alias checkable', () => {
    const doc = '[[Sme Page|teh alias]]';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const skip = collectSkipRanges(state, 0, doc.length);
    const targetFrom = doc.indexOf('Sme');
    expect(skip.some((r) => r.from <= targetFrom && r.to > targetFrom)).toBe(
      true,
    );
    const aliasFrom = doc.indexOf('teh alias');
    expect(skip.some((r) => r.from <= aliasFrom && r.to > aliasFrom)).toBe(
      false,
    );
  });
});

const KNOWN_WORDS = new Set([
  'hello',
  'world',
  'the',
  'cat',
  'sat',
  'here',
  'see',
  'now',
]);
const fakeSpell: SpellChecker = {
  correct: (word) => KNOWN_WORDS.has(word.toLowerCase()),
  suggest: () => [],
  add: () => undefined,
};

describe('findMisspelledWords', () => {
  it('flags a word the checker does not recognize', () => {
    const doc = 'the cat siat';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const result = findMisspelledWords(
      state,
      0,
      doc.length,
      fakeSpell,
      new Set(),
    );
    expect(result.map((t) => t.word)).toEqual(['siat']);
  });

  it('never flags a word already in the word bank, even if unknown to the checker', () => {
    const doc = 'siat here';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const result = findMisspelledWords(
      state,
      0,
      doc.length,
      fakeSpell,
      new Set(['siat']),
    );
    expect(result).toEqual([]);
  });

  it('is case-insensitive against the word bank', () => {
    const doc = 'Siat here';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const result = findMisspelledWords(
      state,
      0,
      doc.length,
      fakeSpell,
      new Set(['siat']),
    );
    expect(result).toEqual([]);
  });

  it('never flags words inside a code span, even if unknown to the checker', () => {
    const doc = 'see `siat` here';
    const state = EditorState.create({ doc, extensions: [mdLang] });
    const result = findMisspelledWords(
      state,
      0,
      doc.length,
      fakeSpell,
      new Set(),
    );
    expect(result).toEqual([]);
  });
});
