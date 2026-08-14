<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import Editor from './editor/Editor.svelte';
  import Titlebar from './Titlebar.svelte';
  import PreviewPane from './components/PreviewPane.svelte';
  import SettingsPanel from './components/Settings.svelte';
  import WelcomeScreen from './components/WelcomeScreen.svelte';
  import { isMarkdownFile } from './editor/languages';
  import {
    settings,
    initSettings,
    setWrapDefault,
    addRecentFile,
    removeRecentFile,
  } from './settings/store.svelte';
  import { getActiveTheme } from './theme/store.svelte';
  import { THEME_CSS_VAR_KEYS } from './theme/convert';
  import {
    askUnsavedChanges,
    fileNameFromPath,
    openFileDialog,
    openPath,
    saveAsDialog,
    writeFile,
  } from './lib/file';
  import { message } from '@tauri-apps/plugin-dialog';

  interface EditorHandle {
    getContent: () => string;
    loadContent: (text: string) => void;
    focus: () => void;
  }

  let path = $state<string | null>(null);
  let fileName = $state('Untitled');
  let dirty = $state(false);
  let wrap = $state(true);
  let docText = $state('');
  let liveMarkdownPreview = $state(true);
  let showPreviewPane = $state(false);
  let showSettings = $state(false);
  let editor: EditorHandle | undefined = $state();

  let isMd = $derived(isMarkdownFile(fileName));
  let showWelcome = $derived(
    !path && !dirty && docText === '' && settings.recentFiles.length > 0,
  );

  async function performSave(): Promise<boolean> {
    let targetPath = path;
    if (!targetPath) {
      targetPath = await saveAsDialog(fileName);
      if (!targetPath) return false;
    }
    await writeFile(targetPath, editor?.getContent() ?? '');
    path = targetPath;
    fileName = fileNameFromPath(targetPath);
    dirty = false;
    addRecentFile(targetPath);
    return true;
  }

  async function performSaveAs(): Promise<boolean> {
    const targetPath = await saveAsDialog(fileName);
    if (!targetPath) return false;
    await writeFile(targetPath, editor?.getContent() ?? '');
    path = targetPath;
    fileName = fileNameFromPath(targetPath);
    dirty = false;
    addRecentFile(targetPath);
    return true;
  }

  /** Resolves true if it's now safe to discard the current document (saved, discarded, or already clean). */
  async function ensureSaved(): Promise<boolean> {
    if (!dirty) return true;
    const choice = await askUnsavedChanges(fileName);
    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;
    return performSave();
  }

  async function newFile() {
    if (!(await ensureSaved())) return;
    path = null;
    fileName = 'Untitled';
    dirty = false;
    editor?.loadContent('');
  }

  async function doOpen() {
    if (!(await ensureSaved())) return;
    const opened = await openFileDialog();
    if (!opened) return;
    path = opened.path;
    fileName = opened.name;
    dirty = false;
    editor?.loadContent(opened.content);
    addRecentFile(opened.path);
  }

  async function openRecent(recentPath: string) {
    if (!(await ensureSaved())) return;
    try {
      const opened = await openPath(recentPath);
      path = opened.path;
      fileName = opened.name;
      dirty = false;
      editor?.loadContent(opened.content);
      addRecentFile(opened.path);
    } catch {
      removeRecentFile(recentPath);
      await message(
        `Couldn't open ${fileNameFromPath(recentPath)} — it may have been moved or deleted.`,
        {
          title: 'File not found',
          kind: 'error',
        },
      );
    }
  }

  function toggleWrap() {
    wrap = !wrap;
    setWrapDefault(wrap);
  }

  function toggleSettings() {
    showSettings = !showSettings;
  }

  function toggleLiveMarkdownPreview() {
    liveMarkdownPreview = !liveMarkdownPreview;
  }

  function togglePreviewPane() {
    showPreviewPane = !showPreviewPane;
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod && e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      toggleWrap();
      return;
    }
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'n') {
      e.preventDefault();
      void newFile();
    } else if (key === 'o') {
      e.preventDefault();
      void doOpen();
    } else if (key === 's' && e.shiftKey) {
      e.preventDefault();
      void performSaveAs();
    } else if (key === 's') {
      e.preventDefault();
      void performSave();
    }
  }

  onMount(() => {
    void initSettings().then(() => {
      wrap = settings.wrap;
    });

    window.addEventListener('keydown', handleKeydown);
    let unlistenClose: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!dirty) return;
        event.preventDefault();
        const choice = await askUnsavedChanges(fileName);
        if (choice === 'cancel') return;
        if (choice === 'save' && !(await performSave())) return;
        await getCurrentWindow().destroy();
      })
      .then((unlisten) => (unlistenClose = unlisten));

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      unlistenClose?.();
    };
  });

  let windowTitle = $derived(`${dirty ? '● ' : ''}${fileName} — AltNote`);

  $effect(() => {
    void getCurrentWindow().setTitle(windowTitle);
  });

  // Applied to the document root (not just `.app`) so it also reaches the
  // Settings panel, which renders as a sibling of <main> and wouldn't
  // otherwise inherit a CSS var scoped to it.
  $effect(() => {
    const root = document.documentElement.style;
    if (settings.font) {
      root.setProperty(
        '--editor-font',
        `'${settings.font}', ui-monospace, monospace`,
      );
    } else {
      root.removeProperty('--editor-font');
    }
  });

  $effect(() => {
    const theme = getActiveTheme();
    const root = document.documentElement.style;
    for (const key of THEME_CSS_VAR_KEYS) root.removeProperty(key);
    if (theme) {
      for (const [key, value] of Object.entries(theme.cssVars))
        root.setProperty(key, value);
    }
  });
</script>

<main class="app">
  <Titlebar
    title={windowTitle}
    {wrap}
    {isMd}
    {liveMarkdownPreview}
    {showPreviewPane}
    onNew={() => void newFile()}
    onOpen={() => void doOpen()}
    onSave={() => void performSave()}
    onSaveAs={() => void performSaveAs()}
    onToggleWrap={toggleWrap}
    onToggleLiveMarkdownPreview={toggleLiveMarkdownPreview}
    onTogglePreviewPane={togglePreviewPane}
    onOpenSettings={toggleSettings}
    recentFiles={settings.recentFiles}
    onOpenRecent={(p) => void openRecent(p)}
  />
  <div class="editor-area">
    <div class="editor-pane">
      <Editor
        bind:this={editor}
        {fileName}
        {wrap}
        {liveMarkdownPreview}
        initialContent=""
        onChange={(text, isUserEdit) => {
          docText = text;
          if (isUserEdit) dirty = true;
        }}
      />
      {#if showWelcome}
        <WelcomeScreen
          recentFiles={settings.recentFiles}
          onOpenRecent={(p) => void openRecent(p)}
        />
      {/if}
    </div>
    {#if isMd && showPreviewPane}
      <div class="preview-pane">
        <PreviewPane content={docText} />
      </div>
    {/if}
  </div>
</main>

{#if showSettings}
  <SettingsPanel onClose={toggleSettings} />
{/if}

<style>
  .app {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
  }

  .editor-area {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .editor-pane {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .preview-pane {
    flex: 1;
    min-width: 0;
  }
</style>
