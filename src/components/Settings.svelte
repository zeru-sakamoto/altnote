<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { settings, setFont } from '../settings/store.svelte';
  import ThemePicker from './ThemePicker.svelte';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let fonts = $state<string[]>([]);
  let loading = $state(true);

  invoke<string[]>('list_system_fonts')
    .then((list) => (fonts = list))
    .catch(() => (fonts = []))
    .finally(() => (loading = false));

  function handleFontChange(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    setFont(value === '' ? null : value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  let panelEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    panelEl?.focus();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="backdrop"
  onclick={(e) => e.target === e.currentTarget && onClose()}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
  role="button"
  tabindex="-1"
  aria-label="Close settings"
>
  <div
    class="panel"
    bind:this={panelEl}
    role="dialog"
    aria-label="Settings"
    tabindex="-1"
  >
    <div class="header">
      <h2>Settings</h2>
      <button class="close-btn" onclick={onClose} title="Close">✕</button>
    </div>

    <div class="field">
      <label for="font-select">Editor Font</label>
      <select
        id="font-select"
        value={settings.font ?? ''}
        onchange={handleFontChange}
        disabled={loading}
      >
        <option value="">Default (monospace)</option>
        {#each fonts as font (font)}
          <option value={font} style="font-family: '{font}'">{font}</option>
        {/each}
      </select>
      <p
        class="sample"
        style="font-family: {settings.font
          ? `'${settings.font}', ui-monospace, monospace`
          : 'var(--editor-font)'}"
      >
        The quick brown fox jumps over the lazy dog. 0123456789
      </p>
    </div>

    <ThemePicker />
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .panel {
    width: 380px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    background-color: var(--editor-bg);
    color: var(--editor-fg);
    border: 1px solid var(--editor-active-line);
    border-radius: 6px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    padding: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .header h2 {
    font-size: 14px;
    margin: 0;
  }

  .close-btn {
    appearance: none;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background-color: var(--editor-active-line);
  }

  .field label {
    display: block;
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 6px;
  }

  select {
    width: 100%;
    padding: 6px 8px;
    background-color: var(--editor-bg);
    color: var(--editor-fg);
    border: 1px solid var(--editor-active-line);
    border-radius: 4px;
    font-size: 13px;
  }

  .sample {
    margin: 10px 0 0;
    font-size: 15px;
    opacity: 0.85;
  }
</style>
