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
  '--editor-heading-fg',
  '--editor-bold-fg',
  '--editor-italic-fg',
  '--editor-quote-fg',
  '--brand-accent',
  '--brand-accent-fg',
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
  // Some themes (e.g. Tokyo Night) style markdown headings via this
  // convention instead of `markup.heading`, as a two-part compound scope
  // like `"heading.1.markdown entity.name"` — matched below via the
  // space-separated prefix check, not `markup.heading`'s dotted one.
  ['heading.1.markdown', t.heading1],
  ['heading.2.markdown', t.heading2],
  ['heading.3.markdown', t.heading3],
  ['heading.4.markdown', t.heading4],
  ['heading.5.markdown', t.heading5],
  ['heading.6.markdown', t.heading6],
];

function findTagFor(scopes: string[]): Tag | Tag[] | undefined {
  for (const scope of scopes) {
    for (const [prefix, tag] of SCOPE_MAP) {
      if (
        scope === prefix ||
        scope.startsWith(prefix + '.') ||
        scope.startsWith(prefix + ' ')
      )
        return tag;
    }
  }
  return undefined;
}

/** Parses `#rgb`, `#rrggbb`, or `#rrggbbaa` (alpha ignored) into 0-255 channels. */
function hexToRgb(hex: string): [number, number, number] | undefined {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (h.length === 6 || h.length === 8) {
    h = h.slice(0, 6);
  } else {
    return undefined;
  }
  const num = Number.parseInt(h, 16);
  if (Number.isNaN(num)) return undefined;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function tintFrom(hex: string, alpha: number, fallback: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Selection and active-line are computed from the theme's own colors rather than trusting
 * `editor.selectionBackground`/`editor.lineHighlightBackground` directly — imported VS Code
 * themes represent these wildly inconsistently (opaque hex, 8-digit hex with alpha, or
 * missing entirely) and some read as nearly invisible, or too close to each other, in this
 * app's rendering. Deriving both guarantees legible, theme-appropriate contrast: selection
 * tints the theme's own accent/link color (a hue distinct from body text, so it never blends
 * into the neutral active-line indicator), while active-line stays a low-alpha neutral tint
 * of the foreground, consistently subtle across every theme.
 */
function selectionColorFrom(accent: string): string {
  return tintFrom(accent, 0.28, 'rgba(80, 150, 255, 0.3)');
}

function activeLineColorFrom(foreground: string): string {
  return tintFrom(foreground, 0.06, 'rgba(128, 128, 128, 0.06)');
}

/**
 * Picks a representative UI-brand accent from a theme's `colors` block, for the general
 * app chrome (buttons, focus rings) rather than editor syntax — distinct from `editorLink`.
 * Priority favors colors VS Code itself treats as UI-brand signals over incidental syntax
 * colors; `editorLink` (which already has its own `#4ea1ff` fallback) is the last resort,
 * so this always terminates in something usable even for a theme with an empty `colors` block.
 */
function accentFrom(
  colors: Record<string, string | undefined>,
  editorLink: string,
): string {
  return (
    colors['button.background'] ??
    colors['activityBarBadge.background'] ??
    colors['focusBorder'] ??
    editorLink
  );
}

/** Relative-luminance check to pick readable text on top of an arbitrary accent color. */
function contrastForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map((c) => c / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#111318' : '#ffffff';
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
    // A single `scope` string may itself be a comma-separated list (VS Code's
    // TextMate scope selector syntax, e.g. `"entity.name.type.module.js,
    // entity.name.type.module.ts"`) — split it, or matching against the
    // combined string never hits a SCOPE_MAP prefix and the rule's color is
    // silently dropped, which is why some themes barely changed the editor's
    // syntax colors at all.
    const scopes = Array.isArray(entry.scope)
      ? entry.scope
      : entry.scope
        ? entry.scope.split(',').map((s) => s.trim())
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
  // Same scope->color data CodeMirror's HighlightStyle uses, re-exposed as CSS vars so
  // the plain-HTML PreviewPane (which has no Lezer tags to match against) can mirror the
  // editor's markdown syntax colors instead of rendering headings/bold/italic in flat body text.
  const colorForTag = (tag: Tag) => specs.find((s) => s.tag === tag)?.color;

  const dark = theme.type !== 'light';
  const colors = theme.colors ?? {};
  const editorBg =
    colors['editor.background'] ?? (dark ? '#1e1e1e' : '#ffffff');
  const editorFg =
    colors['editor.foreground'] ?? (dark ? '#d4d4d4' : '#1a1a1a');
  const editorLink = colors['textLink.foreground'] ?? '#4ea1ff';
  const gutterFg = colors['editorLineNumber.foreground'] ?? editorFg;
  const accent = accentFrom(colors, editorLink);

  const cssVars: Record<string, string> = {
    '--editor-bg': editorBg,
    '--editor-fg': editorFg,
    '--editor-gutter-fg': gutterFg,
    '--editor-active-line': activeLineColorFrom(editorFg),
    '--editor-selection': selectionColorFrom(editorLink),
    '--titlebar-bg':
      colors['titleBar.activeBackground'] ??
      colors['sideBar.background'] ??
      editorBg,
    '--titlebar-fg': colors['titleBar.activeForeground'] ?? editorFg,
    '--editor-link': editorLink,
    '--editor-heading-fg':
      colorForTag(t.heading1) ?? colorForTag(t.heading) ?? editorFg,
    '--editor-bold-fg': colorForTag(t.strong) ?? editorFg,
    '--editor-italic-fg': colorForTag(t.emphasis) ?? editorFg,
    '--editor-quote-fg': colorForTag(t.quote) ?? gutterFg,
    '--brand-accent': accent,
    '--brand-accent-fg': contrastForeground(accent),
  };

  return { name: theme.name ?? 'Custom Theme', dark, highlightStyle, cssVars };
}
