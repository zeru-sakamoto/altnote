import { useSyncExternalStore } from 'react';
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
  liveMarkdownPreview: boolean;
  autoSave: boolean;
}

const DEFAULTS: Settings = {
  font: null,
  wrap: true,
  recentFiles: [],
  themeId: null,
  customThemes: [],
  liveMarkdownPreview: true,
  autoSave: false,
};
const MAX_RECENT = 8;
const MAX_CUSTOM_THEMES = 10;

let backingStore: Store | undefined;
let state: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettingsSnapshot(): Settings {
  return state;
}

/** React hook for declarative consumers — re-renders on any settings change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettingsSnapshot);
}

export async function initSettings() {
  backingStore = await load('settings.json');
  const [
    font,
    wrap,
    recentFiles,
    themeId,
    customThemes,
    liveMarkdownPreview,
    autoSave,
  ] = await Promise.all([
    backingStore.get<string | null>('font'),
    backingStore.get<boolean>('wrap'),
    backingStore.get<string[]>('recentFiles'),
    backingStore.get<string | null>('themeId'),
    backingStore.get<CachedTheme[]>('customThemes'),
    backingStore.get<boolean>('liveMarkdownPreview'),
    backingStore.get<boolean>('autoSave'),
  ]);
  const patch: Partial<Settings> = {};
  if (font !== undefined) patch.font = font;
  if (wrap !== undefined) patch.wrap = wrap;
  if (recentFiles !== undefined) patch.recentFiles = recentFiles;
  if (themeId !== undefined) patch.themeId = themeId;
  if (customThemes !== undefined) patch.customThemes = customThemes;
  if (liveMarkdownPreview !== undefined)
    patch.liveMarkdownPreview = liveMarkdownPreview;
  if (autoSave !== undefined) patch.autoSave = autoSave;
  setState(patch);
}

export function setFont(font: string | null) {
  setState({ font });
  void backingStore?.set('font', font);
}

export function setWrapDefault(wrap: boolean) {
  setState({ wrap });
  void backingStore?.set('wrap', wrap);
}

export function setLiveMarkdownPreview(liveMarkdownPreview: boolean) {
  setState({ liveMarkdownPreview });
  void backingStore?.set('liveMarkdownPreview', liveMarkdownPreview);
}

export function setAutoSave(autoSave: boolean) {
  setState({ autoSave });
  void backingStore?.set('autoSave', autoSave);
}

export function addRecentFile(path: string) {
  const next = [path, ...state.recentFiles.filter((p) => p !== path)].slice(
    0,
    MAX_RECENT,
  );
  setState({ recentFiles: next });
  void backingStore?.set('recentFiles', next);
}

export function removeRecentFile(path: string) {
  const next = state.recentFiles.filter((p) => p !== path);
  setState({ recentFiles: next });
  void backingStore?.set('recentFiles', next);
}

export function setThemeId(themeId: string | null) {
  setState({ themeId });
  void backingStore?.set('themeId', themeId);
}

/** Caches an imported theme so re-selecting it later doesn't require refetching. */
export function cacheCustomTheme(cached: CachedTheme) {
  const next = [
    cached,
    ...state.customThemes.filter((c) => c.id !== cached.id),
  ].slice(0, MAX_CUSTOM_THEMES);
  setState({ customThemes: next });
  void backingStore?.set('customThemes', next);
}
