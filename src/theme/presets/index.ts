import draculaRaw from './dracula.json?raw';
import oneDarkRaw from './one-dark.json?raw';
import githubLightRaw from './github-light.json?raw';
import tokyoNightRaw from './tokyo-night.json?raw';
import tokyoNightStormRaw from './tokyo-night-storm.json?raw';
import tokyoNightLightRaw from './tokyo-night-light.json?raw';
import { parseThemeJson } from '../convert';

export interface PresetTheme {
  id: string;
  label: string;
  dark: boolean;
  theme: ReturnType<typeof parseThemeJson>;
}

/** A handful of popular, open-source VS Code themes bundled at build time — no network needed. */
export const presetThemes: PresetTheme[] = [
  {
    id: 'dracula',
    label: 'Dracula',
    dark: true,
    theme: parseThemeJson(draculaRaw),
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    dark: true,
    theme: parseThemeJson(oneDarkRaw),
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    dark: false,
    theme: parseThemeJson(githubLightRaw),
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    dark: true,
    theme: parseThemeJson(tokyoNightRaw),
  },
  {
    id: 'tokyo-night-storm',
    label: 'Tokyo Night Storm',
    dark: true,
    theme: parseThemeJson(tokyoNightStormRaw),
  },
  {
    id: 'tokyo-night-light',
    label: 'Tokyo Night Light',
    dark: false,
    theme: parseThemeJson(tokyoNightLightRaw),
  },
];
