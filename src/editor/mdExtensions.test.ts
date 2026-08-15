import { describe, it, expect } from 'vitest';
import { parser } from '@lezer/markdown';
import type { SyntaxNode, Tree } from '@lezer/common';
import {
  footnoteExtension,
  highlightExtension,
  wikiLinkExtension,
} from './mdExtensions';

function findNode(tree: Tree, name: string): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  tree.iterate({
    enter(node) {
      if (found) return false;
      if (node.type.name === name) {
        found = node.node;
        return false;
      }
    },
  });
  return found;
}

describe('highlightExtension', () => {
  const p = parser.configure(highlightExtension);

  it('parses ==text== as a Highlight node', () => {
    const tree = p.parse('a ==highlighted== b');
    const node = findNode(tree, 'Highlight');
    expect(node).not.toBeNull();
    expect(node && 'a ==highlighted== b'.slice(node.from, node.to)).toBe(
      '==highlighted==',
    );
    expect(findNode(tree, 'HighlightMark')).not.toBeNull();
  });

  it('does not treat a lone = as a highlight', () => {
    const tree = p.parse('a = b');
    expect(findNode(tree, 'Highlight')).toBeNull();
  });
});

describe('wikiLinkExtension', () => {
  const p = parser.configure(wikiLinkExtension);

  it('parses [[note]] as a WikiLink node', () => {
    const source = 'see [[My Note]] please';
    const tree = p.parse(source);
    const node = findNode(tree, 'WikiLink');
    expect(node).not.toBeNull();
    expect(node && source.slice(node.from, node.to)).toBe('[[My Note]]');
  });

  it('parses [[note|Alias]] as a single WikiLink node', () => {
    const source = 'see [[My Note|Alias]] please';
    const tree = p.parse(source);
    const node = findNode(tree, 'WikiLink');
    expect(node).not.toBeNull();
    expect(node && source.slice(node.from, node.to)).toBe('[[My Note|Alias]]');
  });

  it('does not match an unterminated [[', () => {
    const tree = p.parse('a [[unterminated note');
    expect(findNode(tree, 'WikiLink')).toBeNull();
  });
});

describe('footnoteExtension', () => {
  const p = parser.configure(footnoteExtension);

  it('parses [^1] as an inline FootnoteRef', () => {
    const source = 'text[^1] more';
    const tree = p.parse(source);
    const node = findNode(tree, 'FootnoteRef');
    expect(node).not.toBeNull();
    expect(node && source.slice(node.from, node.to)).toBe('[^1]');
  });

  it('parses a single-line [^1]: definition as a FootnoteDef block', () => {
    const source = 'para\n\n[^1]: the explanation';
    const tree = p.parse(source);
    const node = findNode(tree, 'FootnoteDef');
    expect(node).not.toBeNull();
    expect(node && source.slice(node.from, node.to)).toBe(
      '[^1]: the explanation',
    );
    expect(findNode(tree, 'FootnoteDefMark')).not.toBeNull();
  });

  it('does not treat [^1] with an internal space as a footnote ref', () => {
    const tree = p.parse('text[^has space] more');
    expect(findNode(tree, 'FootnoteRef')).toBeNull();
  });
});
