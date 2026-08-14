export interface VscodeThemesRef {
  publisher: string;
  extension: string;
  themeSlug: string;
}

const PATH_PATTERN = /^\/e\/([^/.]+)\.([^/]+)\/([^/]+)\/?$/;

/** Parses a vscodethemes.com theme page URL (or bare path): /e/{publisher}.{extension}/{theme-slug} */
export function parseVscodeThemesUrl(input: string): VscodeThemesRef | null {
  const trimmed = input.trim();
  let pathname = trimmed;

  try {
    const url = new URL(trimmed);
    if (!/(^|\.)vscodethemes\.com$/i.test(url.hostname)) return null;
    pathname = url.pathname;
  } catch {
    // Not a full URL — fall through and try it as a bare path.
  }

  const match = PATH_PATTERN.exec(pathname);
  if (!match) return null;
  const [, publisher, extension, themeSlug] = match;
  return { publisher, extension, themeSlug };
}
