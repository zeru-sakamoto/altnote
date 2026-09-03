import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getSettingsSnapshot } from '../settings/store';

/** Opens a new AltNote window, optionally pre-loaded with the file at `path`. */
export function createEditorWindow(path?: string): WebviewWindow {
  const label = `editor-${crypto.randomUUID()}`;
  const url = path
    ? `index.html?path=${encodeURIComponent(path)}`
    : 'index.html';
  const { lastWindowWidth, lastWindowHeight } = getSettingsSnapshot();
  return new WebviewWindow(label, {
    url,
    title: 'Untitled — AltNote',
    width: lastWindowWidth ?? 800,
    height: lastWindowHeight ?? 600,
    decorations: false,
  });
}
