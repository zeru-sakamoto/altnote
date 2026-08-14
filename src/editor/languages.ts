import type { LanguageSupport } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

const byExtension: Record<string, () => LanguageSupport> = {
  md: () => markdown(),
  markdown: () => markdown(),
  json: () => json(),
  jsonc: () => json(),
  yaml: () => yaml(),
  yml: () => yaml(),
  js: () => javascript(),
  mjs: () => javascript(),
  cjs: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  ts: () => javascript({ typescript: true }),
  mts: () => javascript({ typescript: true }),
  cts: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  py: () => python(),
  html: () => html(),
  htm: () => html(),
  css: () => css(),
};

/** Returns the CodeMirror language for a file name, or undefined for plain text. */
export function languageForFile(fileName: string): LanguageSupport | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return undefined;
  return byExtension[ext]?.();
}

export function isMarkdownFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext === 'md' || ext === 'markdown';
}
