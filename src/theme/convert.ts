import { HighlightStyle } from '@codemirror/language';
import { tags as t, type Tag } from '@lezer/highlight';
import { parse as parseJsonc } from 'jsonc-parser';

export interface VSCodeTokenColor {
  name?: string;
  scope?: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

export interface VSCodeTheme {
  name?: string;
  type?: 'dark' | 'light';
  colors?: Record<string, string | undefined>;
  tokenColors?: VSCodeTokenColor[];
}

/** VS Code theme files are commonly JSONC (comments, trailing commas) — parse tolerantly. */
export function parseThemeJson(text: string): VSCodeTheme {
  return parseJsonc(text) as VSCodeTheme;
}

export interface ConvertedTheme {
  name: string;
  dark: boolean;
  highlightStyle: HighlightStyle;
  cssVars: Record<string, string>;
}

/** Every CSS var a converted theme might set — used to clear stale values when switching themes. */
export const THEME_CSS_VAR_KEYS = [
  '--editor-bg',
  '--editor-fg',
  '--editor-gutter-fg',
  '--editor-active-line',
  '--editor-selection',
  '--titlebar-bg',
  '--titlebar-fg',
  '--editor-link',
] as const;

/**
 * Representative TextMate scope -> Lezer highlight tag, most specific first.
 * Not exhaustive (there is no universal TextMate-scope-to-Lezer-tag mapping) —
 * covers the scopes that carry a theme's visual identity across most languages.
 */
const SCOPE_MAP: Array<[string, Tag | Tag[]]> = [
  ['comment.line', t.lineComment],
  ['comment.block', t.blockComment],
  ['comment', t.comment],
  ['string.regexp', t.regexp],
  ['string', t.string],
  ['constant.numeric', t.number],
  ['constant.language', t.bool],
  ['constant.character.escape', t.escape],
  ['constant.character', t.character],
  ['constant', t.constant(t.variableName)],
  ['keyword.control', t.controlKeyword],
  ['keyword.operator', t.operator],
  ['keyword', t.keyword],
  ['storage.type', t.typeName],
  ['storage.modifier', t.modifier],
  ['entity.name.function', t.function(t.variableName)],
  ['entity.name.class', t.className],
  ['entity.name.type', t.typeName],
  ['entity.name.tag', t.tagName],
  ['entity.other.attribute-name', t.attributeName],
  ['support.function', t.function(t.variableName)],
  ['support.class', t.className],
  ['support.type', t.typeName],
  ['variable.parameter', t.variableName],
  ['variable.language', t.self],
  ['variable', t.variableName],
  ['punctuation.definition.tag', t.angleBracket],
  ['punctuation', t.punctuation],
  ['meta.property-name', t.propertyName],
  ['markup.heading', t.heading],
  ['markup.bold', t.strong],
  ['markup.italic', t.emphasis],
  ['markup.underline.link', t.link],
  ['markup.quote', t.quote],
  ['markup.inserted', t.inserted],
  ['markup.deleted', t.deleted],
];

function findTagFor(scopes: string[]): Tag | Tag[] | undefined {
  for (const scope of scopes) {
    for (const [prefix, tag] of SCOPE_MAP) {
      if (scope === prefix || scope.startsWith(prefix + '.')) return tag;
    }
  }
  return undefined;
}

function fontStyleFlags(fontStyle?: string) {
  return {
    fontStyle: fontStyle?.includes('italic') ? 'italic' : undefined,
    fontWeight: fontStyle?.includes('bold') ? 'bold' : undefined,
    textDecoration: fontStyle?.includes('underline') ? 'underline' : undefined,
  };
}

export function convertTheme(theme: VSCodeTheme): ConvertedTheme {
  const specs: Array<{
    tag: Tag | Tag[];
    color?: string;
    fontStyle?: string;
    fontWeight?: string;
    textDecoration?: string;
  }> = [];

  for (const entry of theme.tokenColors ?? []) {
    const scopes = Array.isArray(entry.scope)
      ? entry.scope
      : entry.scope
        ? [entry.scope]
        : [];
    if (scopes.length === 0 || !entry.settings.foreground) continue;
    const tag = findTagFor(scopes);
    if (!tag) continue;
    specs.push({
      tag,
      color: entry.settings.foreground,
      ...fontStyleFlags(entry.settings.fontStyle),
    });
  }

  const highlightStyle = HighlightStyle.define(specs);

  const dark = theme.type !== 'light';
  const colors = theme.colors ?? {};
  const editorBg =
    colors['editor.background'] ?? (dark ? '#1e1e1e' : '#ffffff');
  const editorFg =
    colors['editor.foreground'] ?? (dark ? '#d4d4d4' : '#1a1a1a');

  const cssVars: Record<string, string> = {
    '--editor-bg': editorBg,
    '--editor-fg': editorFg,
    '--editor-gutter-fg': colors['editorLineNumber.foreground'] ?? editorFg,
    '--editor-active-line':
      colors['editor.lineHighlightBackground'] ?? 'rgba(128, 128, 128, 0.1)',
    '--editor-selection':
      colors['editor.selectionBackground'] ?? 'rgba(80, 150, 255, 0.3)',
    '--titlebar-bg':
      colors['titleBar.activeBackground'] ??
      colors['sideBar.background'] ??
      editorBg,
    '--titlebar-fg': colors['titleBar.activeForeground'] ?? editorFg,
    '--editor-link': colors['textLink.foreground'] ?? '#4ea1ff',
  };

  return { name: theme.name ?? 'Custom Theme', dark, highlightStyle, cssVars };
}
