import { useEffect, useState } from 'react';
import {
  Checkbox,
  Dialog,
  DialogDismiss,
  Select,
  SelectItem,
  SelectPopover,
  useDialogStore,
  useSelectStore,
} from '@ariakit/react';
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
  const dialog = useDialogStore({
    open: true,
    setOpen: (open) => !open && onClose(),
  });
  const fontSelect = useSelectStore({
    value: settings.font ?? '',
    setValue: (value) => setFont(value === '' ? null : value),
  });

  useEffect(() => {
    invoke<string[]>('list_system_fonts')
      .then((list) => setFonts(list))
      .catch(() => setFonts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Dialog
      store={dialog}
      className={styles.panel}
      backdrop={<div className={styles.backdrop} />}
      aria-label="Settings"
    >
      <div className={styles.header}>
        <h2>Settings</h2>
        <DialogDismiss className={styles.closeBtn} title="Close">
          ✕
        </DialogDismiss>
      </div>

      <div className={styles.field}>
        <label htmlFor="font-select">Editor Font</label>
        <Select
          id="font-select"
          store={fontSelect}
          disabled={loading}
          className={styles.selectTrigger}
        >
          {settings.font ?? 'Default (monospace)'}
        </Select>
        <SelectPopover
          store={fontSelect}
          gutter={4}
          sameWidth
          className={styles.selectPopover}
        >
          <SelectItem value="" className={styles.selectItem}>
            Default (monospace)
          </SelectItem>
          {fonts.map((font) => (
            <SelectItem
              key={font}
              value={font}
              className={styles.selectItem}
              style={{ fontFamily: `'${font}'` }}
            >
              {font}
            </SelectItem>
          ))}
        </SelectPopover>
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
          <Checkbox
            id="autosave-toggle"
            className={styles.switchInput}
            checked={settings.autoSave}
            onChange={(e) => setAutoSave(e.currentTarget.checked)}
          />
          <span className={styles.switchTrack}>
            <span className={styles.switchThumb} />
          </span>
          <span>Auto Save (saves ~1s after you stop typing)</span>
        </label>
      </div>

      <div className={styles.field}>
        <label htmlFor="linenumbers-toggle" className={styles.switchLabel}>
          <Checkbox
            id="linenumbers-toggle"
            className={styles.switchInput}
            checked={settings.lineNumbers}
            onChange={(e) => setLineNumbers(e.currentTarget.checked)}
          />
          <span className={styles.switchTrack}>
            <span className={styles.switchThumb} />
          </span>
          <span>Line Numbers</span>
        </label>
      </div>

      <ThemePicker />
    </Dialog>
  );
}
