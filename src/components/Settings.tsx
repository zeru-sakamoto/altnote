import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  useSettings,
  setFont,
  setFontSize,
  setAutoSave,
  setLineNumbers,
} from '../settings/store';
import ThemePicker from './ThemePicker';
import styles from './Settings.module.css';

interface Props {
  onClose: () => void;
}

export default function Settings({ onClose }: Props) {
  const settings = useSettings();
  const [fonts, setFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<string[]>('list_system_fonts')
      .then((list) => setFonts(list))
      .catch(() => setFonts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  function handleFontChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    setFont(value === '' ? null : value);
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}
      role="button"
      tabIndex={-1}
      aria-label="Close settings"
    >
      <div
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        aria-label="Settings"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor="font-select">Editor Font</label>
          <select
            id="font-select"
            value={settings.font ?? ''}
            onChange={handleFontChange}
            disabled={loading}
          >
            <option value="">Default (monospace)</option>
            {fonts.map((font) => (
              <option
                key={font}
                value={font}
                style={{ fontFamily: `'${font}'` }}
              >
                {font}
              </option>
            ))}
          </select>
          <p
            className={styles.sample}
            style={{
              fontFamily: settings.font
                ? `'${settings.font}', ui-monospace, monospace`
                : 'var(--editor-font)',
            }}
          >
            The quick brown fox jumps over the lazy dog. 0123456789
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="fontsize-input">Font Size</label>
          <input
            id="fontsize-input"
            type="number"
            min={8}
            max={40}
            value={settings.fontSize ?? 14}
            onChange={(e) => {
              const value = Number(e.currentTarget.value);
              setFontSize(Number.isFinite(value) && value > 0 ? value : null);
            }}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="autosave-toggle" className={styles.switchLabel}>
            <span>Auto Save (saves ~1s after you stop typing)</span>
            <input
              id="autosave-toggle"
              type="checkbox"
              className={styles.switchInput}
              checked={settings.autoSave}
              onChange={(e) => setAutoSave(e.currentTarget.checked)}
            />
            <span className={styles.switchTrack}>
              <span className={styles.switchThumb} />
            </span>
          </label>
        </div>

        <div className={styles.field}>
          <label htmlFor="linenumbers-toggle" className={styles.switchLabel}>
            <span>Line Numbers</span>
            <input
              id="linenumbers-toggle"
              type="checkbox"
              className={styles.switchInput}
              checked={settings.lineNumbers}
              onChange={(e) => setLineNumbers(e.currentTarget.checked)}
            />
            <span className={styles.switchTrack}>
              <span className={styles.switchThumb} />
            </span>
          </label>
        </div>

        <ThemePicker />
      </div>
    </div>
  );
}
