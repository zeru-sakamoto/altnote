import { tags } from '@lezer/highlight';
import type {
  DelimiterType,
  Element,
  InlineContext,
  MarkdownConfig,
} from '@lezer/markdown';

// ASCII-only punctuation check for emphasis-style flanking rules.
// @lezer/markdown's own Strikethrough extension uses an internal (unexported)
// Unicode-aware version of this; matching its heuristic exactly isn't worth
// vendoring for a highlight-only affordance.
const Punctuation = /[!-#%-*,-/:-@[-`{-~]/;

const HighlightDelim: DelimiterType = {
  resolve: 'Highlight',
  mark: 'HighlightMark',
};

/** `==text==` highlight/mark syntax, following the same delimiter-matching
 * pattern @lezer/markdown's built-in Strikethrough (`~~text~~`) uses. */
export const highlightExtension: MarkdownConfig = {
  defineNodes: [
    {
      name: 'Highlight',
      style: { 'Highlight/...': tags.special(tags.content) },
    },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx, next, pos) {
        if (
          next !== 61 /* '=' */ ||
          cx.char(pos + 1) !== 61 ||
          cx.char(pos + 2) === 61
        ) {
          return -1;
        }
        const before = cx.slice(pos - 1, pos);
        const after = cx.slice(pos + 2, pos + 3);
        const sBefore = /\s|^$/.test(before);
        const sAfter = /\s|^$/.test(after);
        const pBefore = Punctuation.test(before);
        const pAfter = Punctuation.test(after);
        return cx.addDelimiter(
          HighlightDelim,
          pos,
          pos + 2,
          !sAfter && (!pAfter || sBefore || pBefore),
          !sBefore && (!pBefore || sAfter || pAfter),
        );
      },
      after: 'Emphasis',
    },
  ],
};

/** `[[note]]` / `[[note|Alias]]` wikilinks (Obsidian convention). Visual-only:
 * no navigation/file-resolution, just rendering — matches the app's existing
 * `<u>` underline convention in being a hand-rolled, non-CommonMark addition. */
export const wikiLinkExtension: MarkdownConfig = {
  defineNodes: [
    { name: 'WikiLink', style: { 'WikiLink/...': tags.link } },
    { name: 'WikiLinkMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'WikiLink',
      parse(cx, next, pos) {
        if (next !== 91 /* '[' */ || cx.char(pos + 1) !== 91) return -1;
        let end = -1;
        for (let i = pos + 2; i < cx.end - 1; i++) {
          const ch = cx.char(i);
          if (ch === 10 /* '\n' */) break;
          if (ch === 93 /* ']' */ && cx.char(i + 1) === 93) {
            end = i;
            break;
          }
        }
        if (end < 0 || end === pos + 2) return -1;
        return cx.addElement(
          cx.elt('WikiLink', pos, end + 2, [
            cx.elt('WikiLinkMark', pos, pos + 2),
            cx.elt('WikiLinkMark', end, end + 2),
          ]),
        );
      },
      before: 'Link',
    },
  ],
};

/** Scans a `[^label]` starting at `pos`, returning the position of the
 * closing `]`, or -1 if the label is empty/contains whitespace/is unterminated. */
function scanFootnoteLabelEnd(cx: InlineContext, pos: number): number {
  const labelStart = pos + 2;
  for (let i = labelStart; i < cx.end; i++) {
    const ch = cx.char(i);
    if (ch === 93 /* ']' */) return i === labelStart ? -1 : i;
    if (ch === 32 || ch === 9 || ch === 10) return -1;
  }
  return -1;
}

const FOOTNOTE_DEF_RE = /^\[\^([^\]\s]+)\]:[ \t]?/;

/** `[^1]` inline footnote references and single-line `[^1]: text` definitions.
 * No multi-paragraph continuation support (Pandoc-style) — a
 * footnote definition is exactly one line; upgrade if notes need longer ones. */
export const footnoteExtension: MarkdownConfig = {
  defineNodes: [
    { name: 'FootnoteRef', style: tags.special(tags.content) },
    { name: 'FootnoteRefMark', style: tags.processingInstruction },
    { name: 'FootnoteDef', block: true, style: tags.content },
    { name: 'FootnoteDefMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'FootnoteRef',
      parse(cx, next, pos) {
        if (next !== 91 /* '[' */ || cx.char(pos + 1) !== 94 /* '^' */) {
          return -1;
        }
        const close = scanFootnoteLabelEnd(cx, pos);
        if (close < 0) return -1;
        return cx.addElement(
          cx.elt('FootnoteRef', pos, close + 1, [
            cx.elt('FootnoteRefMark', pos, pos + 2),
            cx.elt('FootnoteRefMark', close, close + 1),
          ]),
        );
      },
      before: 'Link',
    },
  ],
  parseBlock: [
    {
      name: 'FootnoteDef',
      parse(cx, line) {
        const text = line.text.slice(line.pos);
        const m = FOOTNOTE_DEF_RE.exec(text);
        if (!m) return false;
        const from = cx.lineStart + line.pos;
        const markEnd = from + m[0].length;
        const lineEnd = cx.lineStart + line.text.length;
        const children: Element[] = [cx.elt('FootnoteDefMark', from, markEnd)];
        if (markEnd < lineEnd) {
          children.push(
            ...cx.parser.parseInline(
              line.text.slice(markEnd - cx.lineStart),
              markEnd,
            ),
          );
        }
        cx.nextLine();
        cx.addElement(cx.elt('FootnoteDef', from, lineEnd, children));
        return true;
      },
      before: 'LinkReference',
    },
  ],
};
