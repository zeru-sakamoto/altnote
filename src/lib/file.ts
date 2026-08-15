import { open, save, message } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

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
