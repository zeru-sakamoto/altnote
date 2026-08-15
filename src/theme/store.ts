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

let cached: { raw: VSCodeTheme; converted: ConvertedTheme } | null = null;

/** Reads the currently selected theme (by id, via the settings store) and converts it.
 * Cached by raw-theme identity so settings changes unrelated to the theme (font, wrap,
 * recent files, ...) don't re-run the conversion — callers re-invoke this on every
 * settings-store notification. */
export function getActiveTheme(): ConvertedTheme | null {
  const raw = resolveRawTheme();
  if (!raw) {
    cached = null;
    return null;
  }
  if (cached && cached.raw === raw) return cached.converted;
  try {
    const converted = convertTheme(raw);
    cached = { raw, converted };
    return converted;
  } catch {
    cached = null;
    return null;
  }
}
