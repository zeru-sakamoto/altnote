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
  setLivePreviewFont,
  setLivePreviewFontSize,
  setPreviewPaneFont,
  setPreviewPaneFontSize,
  setAutoSave,
  setLineNumbers,
} from '../settings/store';
import ThemePicker from './ThemePicker';
import styles from './Settings.module.css';

interface Props {
  onClose: () => void;
}

interface FontFieldProps {
  idPrefix: string;
  label: string;
  fonts: string[];
  loading: boolean;
  font: string | null;
  fontSize: number | null;
  setFont: (font: string | null) => void;
  setFontSize: (fontSize: number | null) => void;
  /** CSS var the sample text falls back to when no font override is set. */
  defaultFontVar: string;
}

function FontField({
  idPrefix,
  label,
  fonts,
  loading,
  font,
  fontSize,
  setFont,
  setFontSize,
  defaultFontVar,
}: FontFieldProps) {
  const fontSelect = useSelectStore({
    value: font ?? '',
    setValue: (value) => setFont(value === '' ? null : value),
  });

  return (
    <div className={styles.field}>
      <label htmlFor={`${idPrefix}-select`}>{label}</label>
      <Select
        id={`${idPrefix}-select`}
        store={fontSelect}
        disabled={loading}
        className={styles.selectTrigger}
      >
        {font ?? 'Default (monospace)'}
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
        {fonts.map((f) => (
          <SelectItem
            key={f}
            value={f}
            className={styles.selectItem}
            style={{ fontFamily: `'${f}'` }}
          >
            {f}
          </SelectItem>
        ))}
      </SelectPopover>
      <p
        className={styles.sample}
        style={{
          fontFamily: font
            ? `'${font}', ui-monospace, monospace`
            : `var(${defaultFontVar})`,
        }}
      >
        The quick brown fox jumps over the lazy dog. 0123456789
      </p>
      <input
        id={`${idPrefix}-size`}
        type="number"
        min={8}
        max={40}
        value={fontSize ?? 14}
        onChange={(e) => {
          const value = Number(e.currentTarget.value);
          setFontSize(Number.isFinite(value) && value > 0 ? value : null);
        }}
        aria-label={`${label} size`}
        style={{ marginTop: 6 }}
      />
    </div>
  );
}

export default function Settings({ onClose }: Props) {
  const settings = useSettings();
  const [fonts, setFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useDialogStore({
    open: true,
    setOpen: (open) => !open && onClose(),
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

      <FontField
        idPrefix="font"
        label="Editor Font (live preview off)"
        fonts={fonts}
        loading={loading}
        font={settings.font}
        fontSize={settings.fontSize}
        setFont={setFont}
        setFontSize={setFontSize}
        defaultFontVar="--editor-font"
      />

      <FontField
        idPrefix="live-preview-font"
        label="Live Preview Font"
        fonts={fonts}
        loading={loading}
        font={settings.livePreviewFont}
        fontSize={settings.livePreviewFontSize}
        setFont={setLivePreviewFont}
        setFontSize={setLivePreviewFontSize}
        defaultFontVar="--editor-font"
      />

      <FontField
        idPrefix="preview-pane-font"
        label="Preview Pane Font"
        fonts={fonts}
        loading={loading}
        font={settings.previewPaneFont}
        fontSize={settings.previewPaneFontSize}
        setFont={setPreviewPaneFont}
        setFontSize={setPreviewPaneFontSize}
        defaultFontVar="--editor-font"
      />

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
