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
    const commentSpec = converted.highlightStyle.specs.find((spec) => spec.tag === t.comment);
    expect(commentSpec?.color).toBe('#6272A4');
  });

  it('falls back to sensible defaults when colors/tokenColors are missing', () => {
    const converted = convertTheme({ name: 'Bare', type: 'light' });
    expect(converted.dark).toBe(false);
    expect(converted.cssVars['--editor-bg']).toBe('#ffffff');
    expect(converted.cssVars['--editor-fg']).toBe('#1a1a1a');
    expect(converted.highlightStyle.specs).toHaveLength(0);
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
