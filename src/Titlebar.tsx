import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItemCheckbox,
  MenuSeparator,
  useMenuStore,
} from '@ariakit/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconMenu2, IconMinus, IconSquare, IconX } from '@tabler/icons-react';
import styles from './Titlebar.module.css';

interface Props {
  title: string;
  wrap: boolean;
  isMd: boolean;
  liveMarkdownPreview: boolean;
  showPreviewPane: boolean;
  onNew: () => void;
  onNewWindow: () => void;
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
  onNewWindow,
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
  const menu = useMenuStore();

  function run(action: () => void) {
    action();
    menu.hide();
  }

  return (
    <div className={styles.titlebar}>
      <div className={styles.menu}>
        <MenuButton store={menu} className={styles.menuButton} title="Menu">
          <IconMenu2 size={18} stroke={1.75} />
        </MenuButton>
        <Menu store={menu} gutter={4} className={styles.menuDropdown}>
          <MenuItem onClick={() => run(onNew)}>
            New <span className={styles.hint}>{modLabel}N</span>
          </MenuItem>
          <MenuItem onClick={() => run(onNewWindow)}>
            New Window <span className={styles.hint}>{modLabel}Shift+N</span>
          </MenuItem>
          <MenuItem onClick={() => run(onOpen)}>
            Open… <span className={styles.hint}>{modLabel}O</span>
          </MenuItem>
          {recentFiles.length > 0 && (
            <>
              <p className={styles.sectionLabel}>Recent</p>
              {recentFiles.slice(0, 5).map((path) => (
                <MenuItem
                  key={path}
                  className={styles.recentItem}
                  title={path}
                  onClick={() => run(() => onOpenRecent(path))}
                >
                  {baseName(path)}
                </MenuItem>
              ))}
              <MenuSeparator className={styles.separator} />
            </>
          )}
          <MenuItem onClick={() => run(onSave)}>
            Save <span className={styles.hint}>{modLabel}S</span>
          </MenuItem>
          <MenuItem onClick={() => run(onSaveAs)}>
            Save As… <span className={styles.hint}>{modLabel}Shift+S</span>
          </MenuItem>
          <MenuSeparator className={styles.separator} />
          <MenuItemCheckbox
            name="wrap"
            checked={wrap}
            onClick={() => run(onToggleWrap)}
          >
            Wrap Text <span className={styles.hint}>Alt+Z</span>
          </MenuItemCheckbox>
          {isMd && (
            <>
              <MenuSeparator className={styles.separator} />
              <MenuItemCheckbox
                name="liveMarkdownPreview"
                checked={liveMarkdownPreview}
                onClick={() => run(onToggleLiveMarkdownPreview)}
              >
                Live Preview
              </MenuItemCheckbox>
              <MenuItemCheckbox
                name="showPreviewPane"
                checked={showPreviewPane}
                onClick={() => run(onTogglePreviewPane)}
              >
                Preview Pane
              </MenuItemCheckbox>
            </>
          )}
          <MenuSeparator className={styles.separator} />
          <MenuItem onClick={() => run(onOpenSettings)}>Settings…</MenuItem>
        </Menu>
      </div>
      <div className={styles.dragRegion} data-tauri-drag-region>
        <span className={styles.title} data-tauri-drag-region>
          {title}
        </span>
      </div>
      <div className={styles.controls}>
        <button title="Minimize" onClick={() => getCurrentWindow().minimize()}>
          <IconMinus size={14} stroke={1.75} />
        </button>
        <button
          title="Maximize"
          onClick={() => getCurrentWindow().toggleMaximize()}
        >
          <IconSquare size={12} stroke={1.75} />
        </button>
        <button
          className={styles.close}
          title="Close"
          onClick={() => getCurrentWindow().close()}
        >
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
    </div>
  );
}
