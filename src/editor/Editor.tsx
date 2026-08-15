import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { basicSetup } from 'codemirror';
import { vsCodeKeymap } from './keymap';
import { languageForFile, isMarkdownFile } from './languages';
import { livePreview } from './livePreview';
import { slashCommands } from './slashCommands';
import { getActiveTheme } from '../theme/store';
import { subscribe as subscribeSettings } from '../settings/store';
import styles from './Editor.module.css';

export interface EditorHandle {
  getContent: () => string;
  loadContent: (text: string) => void;
  focus: () => void;
}

interface Props {
  fileName: string;
  wrap: boolean;
  liveMarkdownPreview: boolean;
  initialContent?: string;
  /** Called on every doc change. `isUserEdit` is false for programmatic loads (opening/new file). */
  onChange?: (content: string, isUserEdit: boolean) => void;
}

function livePreviewExtension(fileName: string, liveMarkdownPreview: boolean) {
  return isMarkdownFile(fileName) && liveMarkdownPreview ? livePreview : [];
}

function slashCommandsExtension(fileName: string) {
  return isMarkdownFile(fileName) ? [slashCommands] : [];
}

function themeExtension() {
  const theme = getActiveTheme();
  return theme ? syntaxHighlighting(theme.highlightStyle) : [];
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-fg)',
  },
  '.cm-content': { caretColor: 'var(--editor-fg)' },
  '.cm-scroller': {
    fontFamily: 'var(--editor-font, ui-monospace, monospace)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-gutter-fg)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-fg)',
    border: '1px solid var(--editor-active-line)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--editor-active-line)',
    color: 'var(--editor-fg)',
  },
  '.cm-completionDetail': {
    color: 'var(--editor-gutter-fg)',
    fontStyle: 'normal',
  },
});

const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { fileName, wrap, liveMarkdownPreview, initialContent = '', onChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const compartments = useRef({
    language: new Compartment(),
    wrap: new Compartment(),
    livePreview: new Compartment(),
    slashCommands: new Compartment(),
    theme: new Compartment(),
  }).current;

  useImperativeHandle(
    ref,
    () => ({
      getContent: () => viewRef.current?.state.doc.toString() ?? '',
      loadContent: (text) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          userEvent: 'altnote.load',
        });
      },
      focus: () => viewRef.current?.focus(),
    }),
    [],
  );

  // Mount once — construct the CodeMirror view. Intentionally reads `fileName`/`wrap`/etc.
  // only at construction time; live changes are handled by the reconfigure effects below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const view = new EditorView({
      doc: initialContent,
      parent: containerRef.current!,
      extensions: [
        basicSetup,
        editorTheme,
        Prec.highest(vsCodeKeymap),
        compartments.language.of(languageForFile(fileName) ?? []),
        compartments.wrap.of(wrap ? EditorView.lineWrapping : []),
        compartments.livePreview.of(
          livePreviewExtension(fileName, liveMarkdownPreview),
        ),
        compartments.slashCommands.of(slashCommandsExtension(fileName)),
        compartments.theme.of(themeExtension()),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const isLoad = update.transactions.some((tr) =>
            tr.isUserEvent('altnote.load'),
          );
          onChangeRef.current?.(update.state.doc.toString(), !isLoad);
        }),
      ],
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.language.reconfigure(
        languageForFile(fileName) ?? [],
      ),
    });
  }, [fileName]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.wrap.reconfigure(
        wrap ? EditorView.lineWrapping : [],
      ),
    });
  }, [wrap]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.livePreview.reconfigure(
        livePreviewExtension(fileName, liveMarkdownPreview),
      ),
    });
  }, [fileName, liveMarkdownPreview]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.slashCommands.reconfigure(
        slashCommandsExtension(fileName),
      ),
    });
  }, [fileName]);

  // Editor has no theme prop — theme changes originate in Settings/ThemePicker, so this
  // subscribes directly to the settings store rather than depending on props.
  useEffect(() => {
    const reconfigureTheme = () => {
      viewRef.current?.dispatch({
        effects: compartments.theme.reconfigure(themeExtension()),
      });
    };
    return subscribeSettings(reconfigureTheme);
  }, []);

  return <div className={styles.editor} ref={containerRef} />;
});

export default Editor;
