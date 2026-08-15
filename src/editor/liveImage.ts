import { convertFileSrc } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import { Facet } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';

/** The absolute path of the file currently open in the editor, or null (untitled/unsaved). */
export const currentFilePath = Facet.define<string | null, string | null>({
  combine: (values) => (values.length ? values[values.length - 1] : null),
});

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Resolves a Markdown image's `src` to something the webview can load: passes URLs
 * (http/https/data/asset/...) through as-is, and resolves relative local paths against
 * the current file's directory via Tauri's asset protocol. Null if there's no base
 * directory to resolve against (an untitled, unsaved document). */
export async function resolveImageSrc(
  raw: string,
  filePath: string | null,
): Promise<string | null> {
  if (URL_SCHEME.test(raw)) return raw;
  if (!filePath) return null;
  const dir = await dirname(filePath);
  const resolved = await join(dir, raw);
  return convertFileSrc(resolved);
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }
  toDOM(view: EditorView): HTMLElement {
    const img = document.createElement('img');
    img.className = 'cm-md-image';
    img.alt = this.alt;
    img.loading = 'lazy';
    img.addEventListener(
      'error',
      () => img.classList.add('cm-md-image-error'),
      { once: true },
    );
    const filePath = view.state.facet(currentFilePath);
    resolveImageSrc(this.src, filePath).then((src) => {
      if (src) img.src = src;
      else img.classList.add('cm-md-image-error');
    });
    return img;
  }
}
