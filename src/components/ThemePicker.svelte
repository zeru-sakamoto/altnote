<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import {
    settings,
    setThemeId,
    cacheCustomTheme,
  } from '../settings/store.svelte';
  import { presetThemes } from '../theme/presets';
  import { parseVscodeThemesUrl } from '../theme/urlParser';
  import { parseThemeJson, type VSCodeTheme } from '../theme/convert';

  interface MarketplaceThemeResult {
    theme: VSCodeTheme;
    theme_name: string;
  }

  let urlInput = $state('');
  let jsonInput = $state('');
  let importing = $state(false);
  let errorMessage = $state('');

  let allThemes = $derived([
    ...presetThemes.map((p) => ({ id: p.id, label: p.label })),
    ...settings.customThemes.map((c) => ({ id: c.id, label: c.label })),
  ]);

  function handleSelect(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    setThemeId(value === '' ? null : value);
  }

  async function importFromUrl() {
    errorMessage = '';
    const ref = parseVscodeThemesUrl(urlInput.trim());
    if (!ref) {
      errorMessage =
        "That doesn't look like a vscodethemes.com theme page URL.";
      return;
    }
    importing = true;
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
      urlInput = '';
    } catch (e) {
      errorMessage = typeof e === 'string' ? e : 'Failed to import that theme.';
    } finally {
      importing = false;
    }
  }

  function importFromJson() {
    errorMessage = '';
    try {
      const theme = parseThemeJson(jsonInput);
      if (!theme.tokenColors && !theme.colors) throw new Error('not a theme');
      const id = `custom:${theme.name ?? 'theme'}:${Date.now()}`;
      cacheCustomTheme({ id, label: theme.name ?? 'Custom Theme', theme });
      setThemeId(id);
      jsonInput = '';
    } catch {
      errorMessage = "That doesn't look like valid VS Code theme JSON.";
    }
  }
</script>

<div class="field">
  <label for="theme-select">Theme</label>
  <select
    id="theme-select"
    value={settings.themeId ?? ''}
    onchange={handleSelect}
  >
    <option value="">Default</option>
    {#each allThemes as theme (theme.id)}
      <option value={theme.id}>{theme.label}</option>
    {/each}
  </select>
</div>

<div class="field">
  <label for="theme-url">Import from vscodethemes.com</label>
  <div class="row">
    <input
      id="theme-url"
      type="text"
      placeholder="https://vscodethemes.com/e/..."
      bind:value={urlInput}
    />
    <button onclick={importFromUrl} disabled={importing || !urlInput.trim()}>
      {importing ? 'Importing…' : 'Import'}
    </button>
  </div>
</div>

<details class="field">
  <summary>Paste theme JSON instead</summary>
  <textarea
    rows="4"
    placeholder="Paste a VS Code theme's JSON here"
    bind:value={jsonInput}
  ></textarea>
  <button onclick={importFromJson} disabled={!jsonInput.trim()}
    >Import JSON</button
  >
</details>

{#if errorMessage}
  <p class="error">{errorMessage}</p>
{/if}

<style>
  .field {
    margin-top: 14px;
  }

  .field label {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 6px;
  }

  select,
  input,
  textarea {
    width: 100%;
    padding: 6px 8px;
    background-color: var(--editor-bg);
    color: var(--editor-fg);
    border: 1px solid var(--editor-active-line);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
  }

  textarea {
    resize: vertical;
    font-family: var(--editor-font, ui-monospace, monospace);
    margin: 8px 0;
  }

  .row {
    display: flex;
    gap: 6px;
  }

  .row input {
    flex: 1;
  }

  button {
    padding: 6px 10px;
    background-color: var(--editor-active-line);
    color: var(--editor-fg);
    border: 1px solid var(--editor-active-line);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  summary {
    font-size: 12px;
    opacity: 0.7;
    cursor: pointer;
  }

  .error {
    margin: 8px 0 0;
    font-size: 12px;
    color: #e05252;
  }
</style>
