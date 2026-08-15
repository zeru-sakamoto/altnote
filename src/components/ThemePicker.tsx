import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings, setThemeId, cacheCustomTheme } from '../settings/store';
import { presetThemes } from '../theme/presets';
import { parseVscodeThemesUrl } from '../theme/urlParser';
import { parseThemeJson, type VSCodeTheme } from '../theme/convert';
import styles from './ThemePicker.module.css';

interface MarketplaceThemeResult {
  theme: VSCodeTheme;
  theme_name: string;
}

export default function ThemePicker() {
  const settings = useSettings();
  const [urlInput, setUrlInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const allThemes = [
    ...presetThemes.map((p) => ({ id: p.id, label: p.label })),
    ...settings.customThemes.map((c) => ({ id: c.id, label: c.label })),
  ];

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    setThemeId(value === '' ? null : value);
  }

  async function importFromUrl() {
    setErrorMessage('');
    const ref = parseVscodeThemesUrl(urlInput.trim());
    if (!ref) {
      setErrorMessage(
        "That doesn't look like a vscodethemes.com theme page URL.",
      );
      return;
    }
    setImporting(true);
    try {
      const result = await invoke<MarketplaceThemeResult>(
        'fetch_marketplace_theme',
        {
          publisher: ref.publisher,
          extension: ref.extension,
          themeSlug: ref.themeSlug,
        },
      );
      const id = `${ref.publisher}.${ref.extension}:${ref.themeSlug}`;
      cacheCustomTheme({ id, label: result.theme_name, theme: result.theme });
      setThemeId(id);
      setUrlInput('');
    } catch (e) {
      setErrorMessage(
        typeof e === 'string' ? e : 'Failed to import that theme.',
      );
    } finally {
      setImporting(false);
    }
  }

  function importFromJson() {
    setErrorMessage('');
    try {
      const theme = parseThemeJson(jsonInput);
      if (!theme.tokenColors && !theme.colors) throw new Error('not a theme');
      const id = `custom:${theme.name ?? 'theme'}:${Date.now()}`;
      cacheCustomTheme({ id, label: theme.name ?? 'Custom Theme', theme });
      setThemeId(id);
      setJsonInput('');
    } catch {
      setErrorMessage("That doesn't look like valid VS Code theme JSON.");
    }
  }

  return (
    <>
      <div className={styles.field}>
        <label htmlFor="theme-select">Theme</label>
        <select
          id="theme-select"
          value={settings.themeId ?? ''}
          onChange={handleSelect}
        >
          <option value="">Default</option>
          {allThemes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="theme-url">Import from vscodethemes.com</label>
        <div className={styles.row}>
          <input
            id="theme-url"
            type="text"
            placeholder="https://vscodethemes.com/e/..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button
            onClick={importFromUrl}
            disabled={importing || !urlInput.trim()}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>

      <details className={styles.field}>
        <summary>Paste theme JSON instead</summary>
        <textarea
          rows={4}
          placeholder="Paste a VS Code theme's JSON here"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        ></textarea>
        <button onClick={importFromJson} disabled={!jsonInput.trim()}>
          Import JSON
        </button>
      </details>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}
    </>
  );
}
