import { syntaxTree } from '@codemirror/language';
import { Facet, type EditorState, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { addToWordBank } from '../settings/store';
import {
  closePopover,
  makeMenuDivider,
  makeMenuItem,
  openPopover,
  type PopoverState,
} from './liveTable';

/** The subset of nspell's API this module depends on — kept narrow and
 * exported so tests can pass a fake instead of loading the real dictionary. */
export interface SpellChecker {
  correct(word: string): boolean;
  suggest(word: string): string[];
  add(word: string): unknown;
}

export const wordBankFacet = Facet.define<Set<string>, Set<string>>({
  combine: (values) => values[values.length - 1] ?? new Set(),
});

export interface WordToken {
  word: string;
  from: number;
  to: number;
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

/** Splits `text` into word tokens, offsetting positions by `offset` (the
 * document position `text` starts at). Hyphenated compounds tokenize as
 * separate words — simpler than teaching the dictionary about compounds, and
 * a false positive on a legitimate closed compound is caught by the word
 * bank like any other. */
export function tokenizeWords(text: string, offset = 0): WordToken[] {
  const out: WordToken[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const word = m[0];
    const from = offset + m.index;
    out.push({ word, from, to: from + word.length });
  }
  return out;
}

interface SkipRange {
  from: number;
  to: number;
}

/** Whole-node types that are never prose (code, autolinks). */
const SKIP_WHOLE = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'Autolink',
]);

/** Finds ranges within `[from, to)` that shouldn't be spell-checked: code
 * spans/blocks, autolinks, link/image destination URLs (their label/alt text
 * stays checkable), and wikilink targets (the alias after `|` stays
 * checkable). Modeled on the node-skipping in `livePreview.ts`'s
 * `buildDecorations`. */
export function collectSkipRanges(
  state: EditorState,
  from: number,
  to: number,
): SkipRange[] {
  const skip: SkipRange[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      const type = node.type.name;
      if (SKIP_WHOLE.has(type)) {
        skip.push({ from: node.from, to: node.to });
        return false;
      }
      if (type === 'Link' || type === 'Image') {
        const urlNode = node.node.getChild('URL');
        if (urlNode) skip.push({ from: urlNode.from, to: urlNode.to });
      } else if (type === 'URL') {
        const parentType = node.node.parent?.type.name;
        if (parentType !== 'Link' && parentType !== 'Image') {
          skip.push({ from: node.from, to: node.to });
        }
      } else if (type === 'WikiLink') {
        // Target (and the `|` delimiter) is skipped; the alias after `|`,
        // if any, is prose and stays checkable.
        const raw = state.doc.sliceString(node.from, node.to);
        const pipeIndex = raw.indexOf('|');
        const targetEnd =
          pipeIndex >= 0 ? node.from + pipeIndex + 1 : node.to - 2;
        skip.push({ from: node.from + 2, to: targetEnd });
      }
    },
  });
  return skip;
}

function isSkipped(tok: WordToken, skipRanges: SkipRange[]): boolean {
  return skipRanges.some((r) => tok.from < r.to && tok.to > r.from);
}

/** Prose word tokens within `[from, to)` that `spell` doesn't recognize and
 * that aren't in `wordBank` (checked first, before ever asking `spell`). */
export function findMisspelledWords(
  state: EditorState,
  from: number,
  to: number,
  spell: SpellChecker,
  wordBank: Set<string>,
): WordToken[] {
  const skipRanges = collectSkipRanges(state, from, to);
  const text = state.doc.sliceString(from, to);
  return tokenizeWords(text, from).filter((tok) => {
    if (isSkipped(tok, skipRanges)) return false;
    if (wordBank.has(tok.word.toLowerCase())) return false;
    return !spell.correct(tok.word);
  });
}

let spellPromise: Promise<SpellChecker> | null = null;

/** Loads nspell + the English dictionary, lazily and once per window —
 * never at module load, only the first time a prose file actually needs
 * checking, so code-only windows never pay for the ~550KB dictionary data. */
function loadSpell(): Promise<SpellChecker> {
  if (!spellPromise) {
    spellPromise = Promise.all([
      import('dictionary-en/index.aff?raw'),
      import('dictionary-en/index.dic?raw'),
      import('nspell'),
    ]).then(([aff, dic, nspellMod]) =>
      nspellMod.default({ aff: aff.default, dic: dic.default }),
    );
  }
  return spellPromise;
}

const MISSPELLED = Decoration.mark({ class: 'cm-spell-error' });
const SPELLCHECK_DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 5;

class SpellcheckPluginValue {
  decorations: DecorationSet = Decoration.none;
  private spell: SpellChecker | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private popover: PopoverState = { el: null, cleanup: null };

  constructor(private view: EditorView) {
    this.scheduleRebuild(0);
  }

  update(update: ViewUpdate) {
    const wordBankChanged =
      update.startState.facet(wordBankFacet) !==
      update.state.facet(wordBankFacet);
    if (
      update.docChanged ||
      update.viewportChanged ||
      wordBankChanged ||
      syntaxTree(update.startState) !== syntaxTree(update.state)
    ) {
      this.scheduleRebuild(SPELLCHECK_DEBOUNCE_MS);
    }
  }

  destroy() {
    clearTimeout(this.timer);
    closePopover(this.popover);
  }

  private scheduleRebuild(delay: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.rebuild(), delay);
  }

  private async rebuild() {
    const spell = await loadSpell();
    this.spell = spell;
    const wordBank = this.view.state.facet(wordBankFacet);
    for (const word of wordBank) spell.add(word);

    const ranges: Range<Decoration>[] = [];
    for (const { from, to } of this.view.visibleRanges) {
      for (const tok of findMisspelledWords(
        this.view.state,
        from,
        to,
        spell,
        wordBank,
      )) {
        ranges.push(MISSPELLED.range(tok.from, tok.to));
      }
    }
    this.decorations = Decoration.set(ranges, true);
    this.view.dispatch({});
  }

  /** Finds the flagged word (if any) at `pos`, by checking the currently
   * decorated ranges rather than recomputing — cheap, and consistent with
   * whatever's currently drawn on screen. */
  private flaggedWordAt(pos: number): WordToken | null {
    let found: WordToken | null = null;
    this.decorations.between(pos, pos, (from, to) => {
      if (pos >= from && pos <= to) {
        found = { word: this.view.state.doc.sliceString(from, to), from, to };
        return false;
      }
    });
    return found;
  }

  handleContextMenu(event: MouseEvent): boolean {
    const pos = this.view.posAtCoords({
      x: event.clientX,
      y: event.clientY,
    });
    if (pos == null) return false;
    const flagged = this.flaggedWordAt(pos);
    if (!flagged || !this.spell) return false;
    event.preventDefault();
    this.openSuggestions(flagged, event.clientX, event.clientY);
    return true;
  }

  private openSuggestions(word: WordToken, clientX: number, clientY: number) {
    const spell = this.spell;
    if (!spell) return;
    const editorRect = this.view.dom.getBoundingClientRect();
    const anchor = document.createElement('div');
    anchor.style.position = 'absolute';
    anchor.style.left = `${clientX - editorRect.left}px`;
    anchor.style.top = `${clientY - editorRect.top}px`;
    this.view.dom.appendChild(anchor);

    const state = this.popover;
    const close = () => closePopover(state);

    const suggestions = spell.suggest(word.word).slice(0, MAX_SUGGESTIONS);
    const items: HTMLElement[] = suggestions.map((suggestion) =>
      makeMenuItem(suggestion, () => {
        this.view.dispatch({
          changes: { from: word.from, to: word.to, insert: suggestion },
          selection: { anchor: word.from + suggestion.length },
        });
        close();
      }),
    );
    if (items.length > 0) items.push(makeMenuDivider());
    items.push(
      makeMenuItem('Add to word bank', () => {
        addToWordBank(word.word);
        close();
      }),
    );

    openPopover(state, anchor, 'cm-spell-popover', items);
    // openPopover's own dismiss handling (outside click / Escape) calls
    // closePopover(state) directly — wrap its cleanup so the anchor is
    // removed no matter how the popover closes.
    const dismissCleanup = state.cleanup;
    state.cleanup = () => {
      dismissCleanup?.();
      anchor.remove();
    };
  }
}

export const spellcheckPlugin = ViewPlugin.fromClass(SpellcheckPluginValue, {
  decorations: (v) => v.decorations,
  eventHandlers: {
    contextmenu(event) {
      return this.handleContextMenu(event);
    },
  },
});

export const spellcheckTheme = EditorView.baseTheme({
  '.cm-spell-error': {
    textDecoration: 'underline wavy',
    textDecorationColor: 'var(--destructive)',
    textUnderlineOffset: '2px',
  },
  '.cm-spell-popover': { minWidth: '140px' },
});
