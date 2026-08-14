import { settings } from '../settings/store.svelte';
import { presetThemes } from './presets';
import { convertTheme, type ConvertedTheme, type VSCodeTheme } from './convert';

function resolveRawTheme(): VSCodeTheme | null {
  if (!settings.themeId) return null;
  const preset = presetThemes.find((p) => p.id === settings.themeId);
  if (preset) return preset.theme;
  const custom = settings.customThemes.find((c) => c.id === settings.themeId);
  return custom?.theme ?? null;
}

/** Reads the currently selected theme (by id, via `settings`) and converts it. Reactive when called from a `$derived`/`$effect`. */
export function getActiveTheme(): ConvertedTheme | null {
  const raw = resolveRawTheme();
  if (!raw) return null;
  try {
    return convertTheme(raw);
  } catch {
    return null;
  }
}
