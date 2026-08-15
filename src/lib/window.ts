import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

/** Opens a new AltNote window, optionally pre-loaded with the file at `path`. */
export function createEditorWindow(path?: string): WebviewWindow {
  const label = `editor-${crypto.randomUUID()}`;
  const url = path
    ? `index.html?path=${encodeURIComponent(path)}`
    : 'index.html';
  return new WebviewWindow(label, {
    url,
    title: 'Untitled — AltNote',
    width: 800,
    height: 600,
    decorations: false,
  });
}
