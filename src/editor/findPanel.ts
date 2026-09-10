import type { EditorState } from '@codemirror/state';
import { EditorView, type Panel, type ViewUpdate } from '@codemirror/view';
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search';

const MATCH_SCAN_CAP = 9999;

/** Locates the current match (if any) and counts all matches for `query` in
 * `state`, capped at MATCH_SCAN_CAP to avoid pathological regexes hanging on
 * huge documents. Pure function of state — no DOM — so it's unit-testable
 * without a real EditorView. */
export function countMatches(
  query: SearchQuery,
  state: EditorState,
): { index: number; total: number } {
  if (!query.valid) return { index: -1, total: 0 };
  const cursor = query.getCursor(state);
  const main = state.selection.main;
  let total = 0;
  let index = -1;
  let firstAtOrAfter = -1;
  for (
    let result = cursor.next();
    !result.done && total < MATCH_SCAN_CAP;
    result = cursor.next()
  ) {
    const { from, to } = result.value;
    if (from === main.from && to === main.to) index = total;
    else if (firstAtOrAfter === -1 && from >= main.from) firstAtOrAfter = total;
    total++;
  }
  if (index === -1) index = firstAtOrAfter;
  return { index, total };
}

function formatCount(index: number, total: number): string {
  if (total === 0) return 'No results';
  if (index === -1) return `${total} results`;
  return `${index + 1} of ${total}`;
}

function input(attrs: Record<string, string>): HTMLInputElement {
  const el = document.createElement('input');
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function labeledCheckbox(label: string, title: string) {
  const box = input({ type: 'checkbox' });
  box.className = 'cm-find-checkbox';
  const wrap = document.createElement('label');
  wrap.className = 'cm-find-toggle';
  wrap.title = title;
  wrap.append(box, document.createTextNode(label));
  return { box, wrap };
}

function button(label: string, title: string, onClick: () => void) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cm-find-button';
  btn.title = title;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

/** In-house replacement for @codemirror/search's default find/replace panel
 * (wired via `search({ createPanel: createFindPanel })`), styled to match
 * this app's other floating editor UI instead of CodeMirror's stock look —
 * while reusing all of its match-highlighting/cursor/replace logic. */
class FindPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;
  private query: SearchQuery;
  private readonly view: EditorView;
  private readonly searchField: HTMLInputElement;
  private readonly replaceField: HTMLInputElement;
  private readonly caseField: HTMLInputElement;
  private readonly reField: HTMLInputElement;
  private readonly wordField: HTMLInputElement;
  private readonly countEl: HTMLSpanElement;

  constructor(view: EditorView) {
    this.view = view;
    this.query = getSearchQuery(view.state);

    this.searchField = input({
      class: 'cm-find-input',
      placeholder: 'Find',
      'aria-label': 'Find',
      'main-field': 'true',
    });
    this.searchField.value = this.query.search;

    this.replaceField = input({
      class: 'cm-find-input',
      placeholder: 'Replace',
      'aria-label': 'Replace',
    });
    this.replaceField.value = this.query.replace;

    const caseToggle = labeledCheckbox('Aa', 'Match case');
    const reToggle = labeledCheckbox('.*', 'Regular expression');
    const wordToggle = labeledCheckbox('ab', 'Whole word');
    this.caseField = caseToggle.box;
    this.caseField.checked = this.query.caseSensitive;
    this.reField = reToggle.box;
    this.reField.checked = this.query.regexp;
    this.wordField = wordToggle.box;
    this.wordField.checked = this.query.wholeWord;

    this.countEl = document.createElement('span');
    this.countEl.className = 'cm-find-count';

    const commit = () => this.commit();
    [this.searchField, this.replaceField].forEach((field) => {
      field.addEventListener('input', commit);
    });
    [this.caseField, this.reField, this.wordField].forEach((field) => {
      field.addEventListener('change', commit);
    });

    const findRow = document.createElement('div');
    findRow.className = 'cm-find-row';
    findRow.append(
      this.searchField,
      this.countEl,
      button('↑', 'Previous match', () => findPrevious(this.view)),
      button('↓', 'Next match', () => findNext(this.view)),
      caseToggle.wrap,
      reToggle.wrap,
      wordToggle.wrap,
      button('×', 'Close', () => closeSearchPanel(this.view)),
    );

    const replaceRow = document.createElement('div');
    replaceRow.className = 'cm-find-row';
    replaceRow.append(
      this.replaceField,
      button('Replace', 'Replace current match', () => replaceNext(this.view)),
      button('Replace All', 'Replace all matches', () => replaceAll(this.view)),
    );

    this.dom = document.createElement('div');
    this.dom.className = 'cm-find-panel';
    this.dom.addEventListener('keydown', (e) => this.keydown(e));
    this.dom.append(findRow, replaceRow);

    this.updateCount(view.state);
  }

  private commit() {
    const query = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.caseField.checked,
      regexp: this.reField.checked,
      wholeWord: this.wordField.checked,
      replace: this.replaceField.value,
    });
    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
    }
    this.updateCount(this.view.state);
  }

  private keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(this.view);
    } else if (e.key === 'Enter' && e.target === this.searchField) {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(this.view);
    } else if (e.key === 'Enter' && e.target === this.replaceField) {
      e.preventDefault();
      replaceNext(this.view);
    }
  }

  private setQuery(query: SearchQuery) {
    this.query = query;
    this.searchField.value = query.search;
    this.replaceField.value = query.replace;
    this.caseField.checked = query.caseSensitive;
    this.reField.checked = query.regexp;
    this.wordField.checked = query.wholeWord;
  }

  private updateCount(state: EditorState) {
    const { index, total } = countMatches(getSearchQuery(state), state);
    this.countEl.textContent = formatCount(index, total);
  }

  mount() {
    this.searchField.select();
  }

  update(update: ViewUpdate) {
    let queryChanged = false;
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value);
          queryChanged = true;
        }
      }
    }
    if (queryChanged || update.docChanged || update.selectionSet) {
      this.updateCount(update.state);
    }
  }
}

export function createFindPanel(view: EditorView): Panel {
  return new FindPanel(view);
}

export const findPanelTheme = EditorView.baseTheme({
  '.cm-find-panel': {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '6px 8px',
    borderBottom: '1px solid var(--editor-active-line)',
    background: 'var(--editor-bg, #1e1e1e)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    fontSize: '13px',
  },
  '.cm-find-row': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  '.cm-find-input': {
    flex: '0 1 240px',
    padding: '4px 6px',
    borderRadius: '4px',
    border: '1px solid var(--editor-active-line)',
    background: 'var(--editor-bg, #1e1e1e)',
    color: 'var(--editor-fg, inherit)',
    font: 'inherit',
    outline: 'none',
  },
  '.cm-find-input:focus': {
    borderColor: 'var(--editor-fg, #888)',
  },
  '.cm-find-count': {
    minWidth: '70px',
    color: 'var(--editor-fg, inherit)',
    opacity: '0.65',
    whiteSpace: 'nowrap',
  },
  '.cm-find-button': {
    appearance: 'none',
    border: '1px solid var(--editor-active-line)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
    padding: '3px 8px',
  },
  '.cm-find-button:hover': {
    backgroundColor: 'var(--editor-active-line)',
  },
  '.cm-find-toggle': {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '12px',
    whiteSpace: 'pre',
    cursor: 'pointer',
    opacity: '0.85',
  },
  '.cm-find-checkbox': {
    margin: '0',
  },
});
