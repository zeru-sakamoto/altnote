import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Editor, { type EditorHandle } from './editor/Editor';
import Titlebar from './Titlebar';
import PreviewPane from './components/PreviewPane';
import SettingsPanel from './components/Settings';
import WelcomeScreen from './components/WelcomeScreen';
import { isMarkdownFile } from './editor/languages';
import {
  useSettings,
  initSettings,
  setWrapDefault,
  addRecentFile,
  removeRecentFile,
} from './settings/store';
import { getActiveTheme } from './theme/store';
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
import styles from './App.module.css';

export default function App() {
  const settings = useSettings();

  const [path, setPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState('Untitled');
  const [dirty, setDirty] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [docText, setDocText] = useState('');
  const [liveMarkdownPreview, setLiveMarkdownPreview] = useState(true);
  const [showPreviewPane, setShowPreviewPane] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const editorRef = useRef<EditorHandle>(null);

  // Kept in a ref so the keydown/close-request listeners (registered once on
  // mount) always see the latest values without needing to be re-registered.
  const latest = useRef({ path, fileName, dirty, wrap });
  latest.current = { path, fileName, dirty, wrap };

  const isMd = isMarkdownFile(fileName);
  const showWelcome =
    !path && !dirty && docText === '' && settings.recentFiles.length > 0;
  const windowTitle = `${dirty ? '● ' : ''}${fileName} — AltNote`;

  async function performSave(): Promise<boolean> {
    let targetPath = latest.current.path;
    if (!targetPath) {
      targetPath = await saveAsDialog(latest.current.fileName);
      if (!targetPath) return false;
    }
    await writeFile(targetPath, editorRef.current?.getContent() ?? '');
    setPath(targetPath);
    setFileName(fileNameFromPath(targetPath));
    setDirty(false);
    addRecentFile(targetPath);
    return true;
  }

  async function performSaveAs(): Promise<boolean> {
    const targetPath = await saveAsDialog(latest.current.fileName);
    if (!targetPath) return false;
    await writeFile(targetPath, editorRef.current?.getContent() ?? '');
    setPath(targetPath);
    setFileName(fileNameFromPath(targetPath));
    setDirty(false);
    addRecentFile(targetPath);
    return true;
  }

  /** Resolves true if it's now safe to discard the current document (saved, discarded, or already clean). */
  async function ensureSaved(): Promise<boolean> {
    if (!latest.current.dirty) return true;
    const choice = await askUnsavedChanges(latest.current.fileName);
    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;
    return performSave();
  }

  async function newFile() {
    if (!(await ensureSaved())) return;
    setPath(null);
    setFileName('Untitled');
    setDirty(false);
    editorRef.current?.loadContent('');
  }

  async function doOpen() {
    if (!(await ensureSaved())) return;
    const opened = await openFileDialog();
    if (!opened) return;
    setPath(opened.path);
    setFileName(opened.name);
    setDirty(false);
    editorRef.current?.loadContent(opened.content);
    addRecentFile(opened.path);
  }

  async function openRecent(recentPath: string) {
    if (!(await ensureSaved())) return;
    try {
      const opened = await openPath(recentPath);
      setPath(opened.path);
      setFileName(opened.name);
      setDirty(false);
      editorRef.current?.loadContent(opened.content);
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
    const next = !latest.current.wrap;
    setWrap(next);
    setWrapDefault(next);
  }

  function toggleSettings() {
    setShowSettings((v) => !v);
  }

  function toggleLiveMarkdownPreview() {
    setLiveMarkdownPreview((v) => !v);
  }

  function togglePreviewPane() {
    setShowPreviewPane((v) => !v);
  }

  useEffect(() => {
    void initSettings().then(() => {
      setWrap(settings.wrap);
    });

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

    window.addEventListener('keydown', handleKeydown);

    let unlistenClose: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!latest.current.dirty) return;
        event.preventDefault();
        const choice = await askUnsavedChanges(latest.current.fileName);
        if (choice === 'cancel') return;
        if (choice === 'save' && !(await performSave())) return;
        await getCurrentWindow().destroy();
      })
      .then((unlisten) => (unlistenClose = unlisten));

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      unlistenClose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void getCurrentWindow().setTitle(windowTitle);
  }, [windowTitle]);

  // Applied to the document root (not just `.app`) so it also reaches the
  // Settings panel, which renders as a sibling of <main> and wouldn't
  // otherwise inherit a CSS var scoped to it.
  useEffect(() => {
    const root = document.documentElement.style;
    if (settings.font) {
      root.setProperty(
        '--editor-font',
        `'${settings.font}', ui-monospace, monospace`,
      );
    } else {
      root.removeProperty('--editor-font');
    }
  }, [settings.font]);

  useEffect(() => {
    const theme = getActiveTheme();
    const root = document.documentElement.style;
    for (const key of THEME_CSS_VAR_KEYS) root.removeProperty(key);
    if (theme) {
      for (const [key, value] of Object.entries(theme.cssVars))
        root.setProperty(key, value);
    }
  }, [settings]);

  return (
    <>
      <main className={styles.app}>
        <Titlebar
          title={windowTitle}
          wrap={wrap}
          isMd={isMd}
          liveMarkdownPreview={liveMarkdownPreview}
          showPreviewPane={showPreviewPane}
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
        <div className={styles.editorArea}>
          <div className={styles.editorPane}>
            <Editor
              ref={editorRef}
              fileName={fileName}
              wrap={wrap}
              liveMarkdownPreview={liveMarkdownPreview}
              initialContent=""
              onChange={(text, isUserEdit) => {
                setDocText(text);
                if (isUserEdit) setDirty(true);
              }}
            />
            {showWelcome && (
              <WelcomeScreen
                recentFiles={settings.recentFiles}
                onOpenRecent={(p) => void openRecent(p)}
              />
            )}
          </div>
          {isMd && showPreviewPane && (
            <div className={styles.previewPane}>
              <PreviewPane content={docText} />
            </div>
          )}
        </div>
      </main>

      {showSettings && <SettingsPanel onClose={toggleSettings} />}
    </>
  );
}
