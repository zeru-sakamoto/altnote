<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';

  interface Props {
    title: string;
    wrap: boolean;
    isMd: boolean;
    liveMarkdownPreview: boolean;
    showPreviewPane: boolean;
    onNew: () => void;
    onOpen: () => void;
    onSave: () => void;
    onSaveAs: () => void;
    onToggleWrap: () => void;
    onToggleLiveMarkdownPreview: () => void;
    onTogglePreviewPane: () => void;
    onOpenSettings: () => void;
    recentFiles: string[];
    onOpenRecent: (path: string) => void;
  }

  let {
    title,
    wrap,
    isMd,
    liveMarkdownPreview,
    showPreviewPane,
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onToggleWrap,
    onToggleLiveMarkdownPreview,
    onTogglePreviewPane,
    onOpenSettings,
    recentFiles,
    onOpenRecent,
  }: Props = $props();

  const win = getCurrentWindow();
  const modLabel = navigator.platform.toLowerCase().includes('mac')
    ? '⌘'
    : 'Ctrl+';

  function baseName(path: string): string {
    return path.split(/[\\/]/).pop() ?? path;
  }

  let menuOpen = $state(false);

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  function run(action: () => void) {
    action();
    closeMenu();
  }
</script>

<svelte:window onclick={closeMenu} />

<div class="titlebar">
  <div class="menu">
    <button class="menu-button" title="Menu" onclick={toggleMenu}>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M3 5h10M3 8h10M3 11h10"
          stroke="currentColor"
          stroke-width="1.25"
          fill="none"
          stroke-linecap="round"
        />
      </svg>
    </button>
    {#if menuOpen}
      <div class="menu-dropdown">
        <button onclick={() => run(onNew)}
          >New <span class="hint">{modLabel}N</span></button
        >
        <button onclick={() => run(onOpen)}
          >Open… <span class="hint">{modLabel}O</span></button
        >
        {#if recentFiles.length > 0}
          <p class="section-label">Recent</p>
          {#each recentFiles.slice(0, 5) as path (path)}
            <button
              class="recent-item"
              title={path}
              onclick={() => run(() => onOpenRecent(path))}
            >
              {baseName(path)}
            </button>
          {/each}
          <div class="separator"></div>
        {/if}
        <button onclick={() => run(onSave)}
          >Save <span class="hint">{modLabel}S</span></button
        >
        <button onclick={() => run(onSaveAs)}
          >Save As… <span class="hint">{modLabel}Shift+S</span></button
        >
        <div class="separator"></div>
        <button onclick={() => run(onToggleWrap)}>
          <span class="check">{wrap ? '✓' : ''}</span>Wrap Text
          <span class="hint">Alt+Z</span>
        </button>
        {#if isMd}
          <div class="separator"></div>
          <button onclick={() => run(onToggleLiveMarkdownPreview)}>
            <span class="check">{liveMarkdownPreview ? '✓' : ''}</span>Live
            Preview
          </button>
          <button onclick={() => run(onTogglePreviewPane)}>
            <span class="check">{showPreviewPane ? '✓' : ''}</span>Preview Pane
          </button>
        {/if}
        <div class="separator"></div>
        <button onclick={() => run(onOpenSettings)}>Settings…</button>
      </div>
    {/if}
  </div>
  <div class="drag-region" data-tauri-drag-region>
    <span class="title" data-tauri-drag-region>{title}</span>
  </div>
  <div class="controls">
    <button title="Minimize" onclick={() => win.minimize()}>
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d="M2 6h8" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
    </button>
    <button title="Maximize" onclick={() => win.toggleMaximize()}>
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect
          x="2.5"
          y="2.5"
          width="7"
          height="7"
          stroke="currentColor"
          stroke-width="1"
          fill="none"
        />
      </svg>
    </button>
    <button class="close" title="Close" onclick={() => win.close()}>
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path
          d="M2 2l8 8M10 2l-8 8"
          stroke="currentColor"
          stroke-width="1"
          fill="none"
        />
      </svg>
    </button>
  </div>
</div>

<style>
  .titlebar {
    height: 38px;
    flex: 0 0 auto;
    display: flex;
    align-items: stretch;
    background-color: var(--titlebar-bg);
    color: var(--titlebar-fg);
    user-select: none;
  }

  .menu {
    position: relative;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 0 4px;
  }

  .menu-button {
    width: 32px;
    height: 28px;
    border-radius: 4px;
  }

  .menu-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 200px;
    background-color: var(--titlebar-bg);
    color: var(--titlebar-fg);
    border: 1px solid var(--titlebar-button-hover);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    padding: 4px;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .menu-dropdown button {
    width: auto;
    justify-content: flex-start;
    gap: 6px;
    padding: 6px 8px;
    font-size: 13px;
    border-radius: 3px;
  }

  .menu-dropdown .hint {
    margin-left: auto;
    opacity: 0.6;
    font-size: 11px;
  }

  .menu-dropdown .check {
    width: 12px;
    display: inline-block;
  }

  .separator {
    height: 1px;
    background-color: var(--titlebar-button-hover);
    margin: 4px 2px;
  }

  .section-label {
    font-size: 11px;
    opacity: 0.5;
    margin: 4px 8px 2px;
  }

  .menu-dropdown .recent-item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  .drag-region {
    flex: 1;
    display: flex;
    align-items: center;
    padding-left: 4px;
    min-width: 0;
  }

  .title {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .controls {
    display: flex;
  }

  button {
    appearance: none;
    border: none;
    background: transparent;
    color: inherit;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    outline: none;
  }

  button:hover {
    background-color: var(--titlebar-button-hover);
  }

  button:focus-visible {
    outline: 1px solid var(--titlebar-fg);
    outline-offset: -2px;
  }

  button.close:hover {
    background-color: var(--titlebar-close-hover);
    color: #ffffff;
  }
</style>
