import { load, type Store } from '@tauri-apps/plugin-store';
import type { VSCodeTheme } from '../theme/convert';

export interface CachedTheme {
  id: string;
  label: string;
  theme: VSCodeTheme;
}

export interface Settings {
  font: string | null;
  wrap: boolean;
  recentFiles: string[];
  themeId: string | null;
  customThemes: CachedTheme[];
}

const DEFAULTS: Settings = {
  font: null,
  wrap: true,
  recentFiles: [],
  themeId: null,
  customThemes: [],
};
const MAX_RECENT = 8;
const MAX_CUSTOM_THEMES = 10;

let backingStore: Store | undefined;

export const settings = $state<Settings>({ ...DEFAULTS });

export async function initSettings() {
  backingStore = await load('settings.json');
  const [font, wrap, recentFiles, themeId, customThemes] = await Promise.all([
    backingStore.get<string | null>('font'),
    backingStore.get<boolean>('wrap'),
    backingStore.get<string[]>('recentFiles'),
    backingStore.get<string | null>('themeId'),
    backingStore.get<CachedTheme[]>('customThemes'),
  ]);
  if (font !== undefined) settings.font = font;
  if (wrap !== undefined) settings.wrap = wrap;
  if (recentFiles !== undefined) settings.recentFiles = recentFiles;
  if (themeId !== undefined) settings.themeId = themeId;
  if (customThemes !== undefined) settings.customThemes = customThemes;
}

export function setFont(font: string | null) {
  settings.font = font;
  void backingStore?.set('font', font);
}

export function setWrapDefault(wrap: boolean) {
  settings.wrap = wrap;
  void backingStore?.set('wrap', wrap);
}

export function addRecentFile(path: string) {
  const next = [path, ...settings.recentFiles.filter((p) => p !== path)].slice(
    0,
    MAX_RECENT,
  );
  settings.recentFiles = next;
  void backingStore?.set('recentFiles', next);
}

export function removeRecentFile(path: string) {
  const next = settings.recentFiles.filter((p) => p !== path);
  settings.recentFiles = next;
  void backingStore?.set('recentFiles', next);
}

export function setThemeId(themeId: string | null) {
  settings.themeId = themeId;
  void backingStore?.set('themeId', themeId);
}

/** Caches an imported theme so re-selecting it later doesn't require refetching. */
export function cacheCustomTheme(cached: CachedTheme) {
  const next = [
    cached,
    ...settings.customThemes.filter((c) => c.id !== cached.id),
  ].slice(0, MAX_CUSTOM_THEMES);
  settings.customThemes = next;
  void backingStore?.set('customThemes', next);
}
