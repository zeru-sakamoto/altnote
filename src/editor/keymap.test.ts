import { describe, it, expect } from 'vitest';
import { markdown } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState } from '@codemirror/state';
import { GFM } from '@lezer/markdown';
import { wrapSelectionSpec } from './keymap';

function apply(
  doc: string,
  from: number,
  to: number,
  open: string,
  close = open,
) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(from, to),
  });
  const spec = wrapSelectionSpec(state, open, close);
  const next = state.update(spec).state;
  return { doc: next.doc.toString(), selection: next.selection.main };
}

const mdLang = markdown({ extensions: GFM });

function applyWithNode(
  doc: string,
  from: number,
  to: number,
  open: string,
  close: string,
  nodeInfo: { node: string; mark: string },
) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(from, to),
    extensions: [mdLang],
  });
  const spec = wrapSelectionSpec(state, open, close, nodeInfo);
  const next = state.update(spec).state;
  return { doc: next.doc.toString(), selection: next.selection.main };
}

const EMPHASIS = { node: 'Emphasis', mark: 'EmphasisMark' };
const STRONG = { node: 'StrongEmphasis', mark: 'EmphasisMark' };

describe('wrapSelectionSpec', () => {
  it('wraps a plain selection', () => {
    const { doc, selection } = apply('hello world', 0, 5, '**');
    expect(doc).toBe('**hello** world');
    expect(selection.from).toBe(2);
    expect(selection.to).toBe(7);
  });

  it('inserts markers with the cursor placed between them on an empty selection', () => {
    const { doc, selection } = apply('hello', 5, 5, '**');
    expect(doc).toBe('hello****');
    expect(selection.from).toBe(7);
    expect(selection.to).toBe(7);
  });

  it('unwraps when the selection sits inside existing markers', () => {
    const { doc, selection } = apply('**bold** text', 2, 6, '**');
    expect(doc).toBe('bold text');
    expect(selection.from).toBe(0);
    expect(selection.to).toBe(4);
  });

  it('unwraps when the selection includes the markers themselves', () => {
    const { doc, selection } = apply('**bold** text', 0, 8, '**');
    expect(doc).toBe('bold text');
    expect(selection.from).toBe(0);
    expect(selection.to).toBe(4);
  });

  it('supports distinct open/close markers, e.g. underline tags', () => {
    const { doc, selection } = apply('hello world', 0, 5, '<u>', '</u>');
    expect(doc).toBe('<u>hello</u> world');
    expect(selection.from).toBe(3);
    expect(selection.to).toBe(8);
  });

  it('unwraps distinct open/close markers already flanking the selection', () => {
    const { doc, selection } = apply('<u>hello</u> world', 3, 8, '<u>', '</u>');
    expect(doc).toBe('hello world');
    expect(selection.from).toBe(0);
    expect(selection.to).toBe(5);
  });

  it('does not unwrap a selection too short to contain both markers', () => {
    const { doc } = apply('**', 0, 2, '**');
    expect(doc).toBe('******');
  });
});

describe('wrapSelectionSpec with a syntax-tree node (bold/italic disambiguation)', () => {
  it('italicizes bold text instead of misreading ** as flanking * markers', () => {
    // Regression test: '**bold**' selecting 'bold' and toggling italic must
    // ADD italic (-> '***bold***'), not misidentify the inner '*' of the
    // '**' bold marker as an already-present italic marker and mangle it.
    const { doc, selection } = applyWithNode(
      '**bold**',
      2,
      6,
      '*',
      '*',
      EMPHASIS,
    );
    expect(doc).toBe('***bold***');
    expect(selection.from).toBe(3);
    expect(selection.to).toBe(7);
  });

  it('removes bold from combined bold+italic text, keeping the italic', () => {
    const { doc, selection } = applyWithNode(
      '***text***',
      3,
      7,
      '**',
      '**',
      STRONG,
    );
    expect(doc).toBe('*text*');
    expect(selection.from).toBe(1);
    expect(selection.to).toBe(5);
  });

  it('removes italic from combined bold+italic text, keeping the bold', () => {
    const { doc, selection } = applyWithNode(
      '***text***',
      3,
      7,
      '*',
      '*',
      EMPHASIS,
    );
    expect(doc).toBe('**text**');
    expect(selection.from).toBe(2);
    expect(selection.to).toBe(6);
  });

  it('still unwraps plain italic via the tree lookup', () => {
    const { doc, selection } = applyWithNode(
      '*text*',
      1,
      5,
      '*',
      '*',
      EMPHASIS,
    );
    expect(doc).toBe('text');
    expect(selection.from).toBe(0);
    expect(selection.to).toBe(4);
  });

  it('still unwraps plain bold via the tree lookup', () => {
    const { doc, selection } = applyWithNode(
      '**bold**',
      2,
      6,
      '**',
      '**',
      STRONG,
    );
    expect(doc).toBe('bold');
    expect(selection.from).toBe(0);
    expect(selection.to).toBe(4);
  });
});
