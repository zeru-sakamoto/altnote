import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from './Titlebar.module.css';

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

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

const modLabel = navigator.platform.toLowerCase().includes('mac')
  ? '⌘'
  : 'Ctrl+';

export default function Titlebar({
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
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  function toggleMenu(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen((open) => !open);
  }

  function run(action: () => void) {
    action();
    setMenuOpen(false);
  }

  return (
    <div className={styles.titlebar}>
      <div className={styles.menu}>
        <button className={styles.menuButton} title="Menu" onClick={toggleMenu}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M3 5h10M3 8h10M3 11h10"
              stroke="currentColor"
              strokeWidth="1.25"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {menuOpen && (
          <div className={styles.menuDropdown}>
            <button onClick={() => run(onNew)}>
              New <span className={styles.hint}>{modLabel}N</span>
            </button>
            <button onClick={() => run(onOpen)}>
              Open… <span className={styles.hint}>{modLabel}O</span>
            </button>
            {recentFiles.length > 0 && (
              <>
                <p className={styles.sectionLabel}>Recent</p>
                {recentFiles.slice(0, 5).map((path) => (
                  <button
                    key={path}
                    className={styles.recentItem}
                    title={path}
                    onClick={() => run(() => onOpenRecent(path))}
                  >
                    {baseName(path)}
                  </button>
                ))}
                <div className={styles.separator}></div>
              </>
            )}
            <button onClick={() => run(onSave)}>
              Save <span className={styles.hint}>{modLabel}S</span>
            </button>
            <button onClick={() => run(onSaveAs)}>
              Save As… <span className={styles.hint}>{modLabel}Shift+S</span>
            </button>
            <div className={styles.separator}></div>
            <button onClick={() => run(onToggleWrap)}>
              <span className={styles.check}>{wrap ? '✓' : ''}</span>Wrap Text
              <span className={styles.hint}>Alt+Z</span>
            </button>
            {isMd && (
              <>
                <div className={styles.separator}></div>
                <button onClick={() => run(onToggleLiveMarkdownPreview)}>
                  <span className={styles.check}>
                    {liveMarkdownPreview ? '✓' : ''}
                  </span>
                  Live Preview
                </button>
                <button onClick={() => run(onTogglePreviewPane)}>
                  <span className={styles.check}>
                    {showPreviewPane ? '✓' : ''}
                  </span>
                  Preview Pane
                </button>
              </>
            )}
            <div className={styles.separator}></div>
            <button onClick={() => run(onOpenSettings)}>Settings…</button>
          </div>
        )}
      </div>
      <div className={styles.dragRegion} data-tauri-drag-region>
        <span className={styles.title} data-tauri-drag-region>
          {title}
        </span>
      </div>
      <div className={styles.controls}>
        <button title="Minimize" onClick={() => getCurrentWindow().minimize()}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M2 6h8"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </button>
        <button
          title="Maximize"
          onClick={() => getCurrentWindow().toggleMaximize()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect
              x="2.5"
              y="2.5"
              width="7"
              height="7"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </button>
        <button
          className={styles.close}
          title="Close"
          onClick={() => getCurrentWindow().close()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
