import type { LanguageSupport } from '@codemirror/language';
import { GFM } from '@lezer/markdown';

// ponytail: each loader is a separate dynamic import so Vite code-splits per
// language — CodeMirror's language packages (esp. python/javascript) were
// the bulk of the old single 1.2MB bundle. Loaded lazily and cached below.
const byExtension: Record<string, () => Promise<LanguageSupport>> = {
  md: async () =>
    (await import('@codemirror/lang-markdown')).markdown({ extensions: GFM }),
  markdown: async () =>
    (await import('@codemirror/lang-markdown')).markdown({ extensions: GFM }),
  json: async () => (await import('@codemirror/lang-json')).json(),
  jsonc: async () => (await import('@codemirror/lang-json')).json(),
  yaml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  yml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  js: async () => (await import('@codemirror/lang-javascript')).javascript(),
  mjs: async () => (await import('@codemirror/lang-javascript')).javascript(),
  cjs: async () => (await import('@codemirror/lang-javascript')).javascript(),
  jsx: async () =>
    (await import('@codemirror/lang-javascript')).javascript({ jsx: true }),
  ts: async () =>
    (await import('@codemirror/lang-javascript')).javascript({
      typescript: true,
    }),
  mts: async () =>
    (await import('@codemirror/lang-javascript')).javascript({
      typescript: true,
    }),
  cts: async () =>
    (await import('@codemirror/lang-javascript')).javascript({
      typescript: true,
    }),
  tsx: async () =>
    (await import('@codemirror/lang-javascript')).javascript({
      typescript: true,
      jsx: true,
    }),
  py: async () => (await import('@codemirror/lang-python')).python(),
  html: async () => (await import('@codemirror/lang-html')).html(),
  htm: async () => (await import('@codemirror/lang-html')).html(),
  css: async () => (await import('@codemirror/lang-css')).css(),
};

const cache = new Map<string, Promise<LanguageSupport>>();

/** Resolves the CodeMirror language for a file name, or undefined for plain text. */
export function languageForFile(
  fileName: string,
): Promise<LanguageSupport> | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  const loader = byExtension[ext];
  if (!loader) return undefined;
  let cached = cache.get(ext);
  if (!cached) {
    cached = loader();
    cache.set(ext, cached);
  }
  return cached;
}

export function isMarkdownFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext === 'md' || ext === 'markdown';
}
