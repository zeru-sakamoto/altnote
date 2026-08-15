import { describe, it, expect } from 'vitest';
import { parseVscodeThemesUrl } from './urlParser';

describe('parseVscodeThemesUrl', () => {
  it('parses a full vscodethemes.com theme URL', () => {
    expect(
      parseVscodeThemesUrl(
        'https://vscodethemes.com/e/dracula-theme.theme-dracula/dracula-theme',
      ),
    ).toEqual({
      publisher: 'dracula-theme',
      extension: 'theme-dracula',
      themeSlug: 'dracula-theme',
    });
  });

  it('parses a bare path without protocol/host', () => {
    expect(
      parseVscodeThemesUrl('/e/enkia.tokyo-night/tokyo-night-storm'),
    ).toEqual({
      publisher: 'enkia',
      extension: 'tokyo-night',
      themeSlug: 'tokyo-night-storm',
    });
  });

  it('tolerates surrounding whitespace and a trailing slash', () => {
    expect(parseVscodeThemesUrl('  /e/pub.ext/slug/  ')).toEqual({
      publisher: 'pub',
      extension: 'ext',
      themeSlug: 'slug',
    });
  });

  it('rejects URLs from a different host', () => {
    expect(
      parseVscodeThemesUrl('https://example.com/e/pub.ext/slug'),
    ).toBeNull();
  });

  it('rejects a vscodethemes.com URL that is not a theme page', () => {
    expect(parseVscodeThemesUrl('https://vscodethemes.com/')).toBeNull();
    expect(
      parseVscodeThemesUrl('https://vscodethemes.com/e/pub-no-extension'),
    ).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(parseVscodeThemesUrl('not a url at all')).toBeNull();
    expect(parseVscodeThemesUrl('')).toBeNull();
  });
});
