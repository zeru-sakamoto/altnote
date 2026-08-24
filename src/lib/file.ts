import { open, save, message } from '@tauri-apps/plugin-dialog';
import {
  readTextFile,
  writeTextFile,
  watchImmediate,
} from '@tauri-apps/plugin-fs';

export interface OpenedFile {
  path: string;
  name: string;
  content: string;
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Shows the native open-file dialog and reads the chosen file. Returns null if cancelled. */
export async function openFileDialog(): Promise<OpenedFile | null> {
  const path = await open({ multiple: false });
  if (!path) return null;
  const content = await readTextFile(path);
  return { path, name: fileNameFromPath(path), content };
}

/** Shows the native open-file dialog and returns just the chosen path. Returns null if cancelled. */
export async function pickPath(): Promise<string | null> {
  return await open({ multiple: false });
}

/** Reads a file directly by path (e.g. re-opening a recent file), without showing a dialog. */
export async function openPath(path: string): Promise<OpenedFile> {
  const content = await readTextFile(path);
  return { path, name: fileNameFromPath(path), content };
}

export async function writeFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}

/** Shows the native save-file dialog. Returns the chosen path, or null if cancelled. */
export async function saveAsDialog(
  suggestedName?: string,
): Promise<string | null> {
  return await save({ defaultPath: suggestedName });
}

/** Watches `path` for external changes and calls `onChange` (debounced by the OS/watcher itself
 * on modify events only — creates/removes/etc. are ignored). Returns an unwatch function. */
export async function watchFile(
  path: string,
  onChange: () => void,
): Promise<() => void> {
  return await watchImmediate(path, (event) => {
    if (typeof event.type === 'object' && 'modify' in event.type) onChange();
  });
}

export type UnsavedChangesChoice = 'save' | 'discard' | 'cancel';

/** Asks the user what to do with unsaved changes before a destructive action (close/open/new). */
export async function askUnsavedChanges(
  fileName: string,
): Promise<UnsavedChangesChoice> {
  const result = await message(
    `Do you want to save the changes you made to ${fileName}?`,
    {
      title: 'Unsaved changes',
      kind: 'warning',
      buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
    },
  );
  if (result === 'Save') return 'save';
  if (result === "Don't Save") return 'discard';
  return 'cancel';
}

/** Asks whether to keep in-app edits or reload after `fileName` changed on disk while dirty. */
export async function askFileConflict(
  fileName: string,
): Promise<'keepMine' | 'reload'> {
  const result = await message(
    `${fileName} was changed by another program, but you have unsaved changes here.`,
    {
      title: 'File changed on disk',
      kind: 'warning',
      buttons: { ok: 'Reload from disk', cancel: 'Keep my changes' },
    },
  );
  return result === 'Reload from disk' ? 'reload' : 'keepMine';
}
