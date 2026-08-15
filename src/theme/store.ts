import { getSettingsSnapshot } from '../settings/store';
import { presetThemes } from './presets';
import { convertTheme, type ConvertedTheme, type VSCodeTheme } from './convert';

function resolveRawTheme(): VSCodeTheme | null {
  const settings = getSettingsSnapshot();
  if (!settings.themeId) return null;
  const preset = presetThemes.find((p) => p.id === settings.themeId);
  if (preset) return preset.theme;
  const custom = settings.customThemes.find((c) => c.id === settings.themeId);
  return custom?.theme ?? null;
}

/** Reads the currently selected theme (by id, via the settings store) and converts it. */
export function getActiveTheme(): ConvertedTheme | null {
  const raw = resolveRawTheme();
  if (!raw) return null;
  try {
    return convertTheme(raw);
  } catch {
    return null;
  }
}
