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
  fontSize: number | null;
  wrap: boolean;
  recentFiles: string[];
  themeId: string | null;
  customThemes: CachedTheme[];
  liveMarkdownPreview: boolean;
  autoSave: boolean;
  lineNumbers: boolean;
}

const DEFAULTS: Settings = {
  font: null,
  fontSize: null,
  wrap: true,
  recentFiles: [],
  themeId: null,
  customThemes: [],
  liveMarkdownPreview: true,
  autoSave: false,
  lineNumbers: true,
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
    fontSize,
    wrap,
    recentFiles,
    themeId,
    customThemes,
    liveMarkdownPreview,
    autoSave,
    lineNumbers,
  ] = await Promise.all([
    backingStore.get<string | null>('font'),
    backingStore.get<number | null>('fontSize'),
    backingStore.get<boolean>('wrap'),
    backingStore.get<string[]>('recentFiles'),
    backingStore.get<string | null>('themeId'),
    backingStore.get<CachedTheme[]>('customThemes'),
    backingStore.get<boolean>('liveMarkdownPreview'),
    backingStore.get<boolean>('autoSave'),
    backingStore.get<boolean>('lineNumbers'),
  ]);
  const patch: Partial<Settings> = {};
  if (font !== undefined) patch.font = font;
  if (fontSize !== undefined) patch.fontSize = fontSize;
  if (wrap !== undefined) patch.wrap = wrap;
  if (recentFiles !== undefined) patch.recentFiles = recentFiles;
  if (themeId !== undefined) patch.themeId = themeId;
  if (customThemes !== undefined) patch.customThemes = customThemes;
  if (liveMarkdownPreview !== undefined)
    patch.liveMarkdownPreview = liveMarkdownPreview;
  if (autoSave !== undefined) patch.autoSave = autoSave;
  if (lineNumbers !== undefined) patch.lineNumbers = lineNumbers;
  setState(patch);
}

export function setFont(font: string | null) {
  setState({ font });
  void backingStore?.set('font', font);
}

export function setFontSize(fontSize: number | null) {
  setState({ fontSize });
  void backingStore?.set('fontSize', fontSize);
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

export function setLineNumbers(lineNumbers: boolean) {
  setState({ lineNumbers });
  void backingStore?.set('lineNumbers', lineNumbers);
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
