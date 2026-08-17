import { describe, it, expect } from 'vitest';
import { tags as t } from '@lezer/highlight';
import { convertTheme, parseThemeJson } from './convert';
import { presetThemes } from './presets';

describe('convertTheme', () => {
  const dracula = presetThemes.find((p) => p.id === 'dracula')!.theme;

  it('maps known editor colors into cssVars', () => {
    const converted = convertTheme(dracula);
    expect(converted.name).toBe('Dracula');
    expect(converted.dark).toBe(true);
    expect(converted.cssVars['--editor-bg']).toBe('#282A36');
    expect(converted.cssVars['--editor-fg']).toBe('#F8F8F2');
  });

  it('maps a tokenColors scope to the matching Lezer tag with its color', () => {
    const converted = convertTheme(dracula);
    const commentSpec = converted.highlightStyle.specs.find(
      (spec) => spec.tag === t.comment,
    );
    expect(commentSpec?.color).toBe('#6272A4');
  });

  it('falls back to sensible defaults when colors/tokenColors are missing', () => {
    const converted = convertTheme({ name: 'Bare', type: 'light' });
    expect(converted.dark).toBe(false);
    expect(converted.cssVars['--editor-bg']).toBe('#ffffff');
    expect(converted.cssVars['--editor-fg']).toBe('#1a1a1a');
    expect(converted.highlightStyle.specs).toHaveLength(0);
  });

  it('derives the selection color from the accent/link color, not the theme-provided one', () => {
    // Dracula's own editor.selectionBackground (#44475A) should be ignored in favor of a
    // translucent tint of its link color — it has none defined, so this falls back to the
    // app default accent (#4ea1ff), giving selection a hue distinct from the neutral
    // foreground-tinted active-line highlight.
    const converted = convertTheme(dracula);
    expect(converted.cssVars['--editor-selection']).toBe(
      'rgba(78, 161, 255, 0.28)',
    );
  });

  it('splits a comma-separated scope string into individual scopes', () => {
    // Regression: VS Code themes commonly list several scopes as one
    // comma-separated string (e.g. one-dark.json's `entity.name.type.module.js,
    // entity.name.type.module.ts`) rather than an array. Matching against the
    // unsplit string never hits a SCOPE_MAP prefix, so the rule's color was
    // silently dropped.
    const converted = convertTheme({
      name: 'Comma',
      tokenColors: [
        {
          scope: 'nonsense.scope, storage.type',
          settings: { foreground: '#ff00ff' },
        },
      ],
    });
    const typeSpec = converted.highlightStyle.specs.find(
      (spec) => spec.tag === t.typeName,
    );
    expect(typeSpec?.color).toBe('#ff00ff');
  });

  it("maps Tokyo Night's compound heading.N.markdown scope to the right heading tag", () => {
    // Regression: Tokyo Night styles headings via a two-part compound scope
    // like `"heading.1.markdown entity.name"` rather than `markup.heading`.
    // The unsplit-on-space compound never matched `markup.heading`'s dotted
    // prefix check, so headings stayed uncolored in that theme specifically.
    const tokyoNight = presetThemes.find((p) => p.id === 'tokyo-night')!.theme;
    const converted = convertTheme(tokyoNight);
    const heading1Spec = converted.highlightStyle.specs.find(
      (spec) => spec.tag === t.heading1,
    );
    expect(heading1Spec?.color).toBe('#89ddff');
  });

  it('derives the active-line color from the foreground at a low, consistent alpha', () => {
    // Dracula's own editor.lineHighlightBackground is unset; regardless, this app always
    // computes its own low-alpha neutral tint rather than trusting a theme's raw value
    // (which varies from fully-opaque to nearly-invisible across imported themes).
    const converted = convertTheme(dracula);
    expect(converted.cssVars['--editor-active-line']).toBe(
      'rgba(248, 248, 242, 0.06)',
    );
  });

  it('falls back to fixed defaults when the relevant color is not parseable hex', () => {
    const converted = convertTheme({
      name: 'Weird',
      colors: {
        'editor.foreground': 'not-a-color',
        'textLink.foreground': 'also-not-a-color',
      },
    });
    expect(converted.cssVars['--editor-selection']).toBe(
      'rgba(80, 150, 255, 0.3)',
    );
    expect(converted.cssVars['--editor-active-line']).toBe(
      'rgba(128, 128, 128, 0.06)',
    );
  });
});

describe('parseThemeJson', () => {
  it('parses strict JSON', () => {
    expect(parseThemeJson('{"name": "Test"}').name).toBe('Test');
  });

  it('tolerates line and block comments', () => {
    const theme = parseThemeJson(`{
      // a line comment
      "name": "Test", /* a block comment */
      "type": "dark"
    }`);
    expect(theme.name).toBe('Test');
    expect(theme.type).toBe('dark');
  });
});
