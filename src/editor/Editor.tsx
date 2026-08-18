import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { basicSetup } from 'codemirror';
import { vsCodeKeymap } from './keymap';
import { languageForFile, isMarkdownFile } from './languages';
import { livePreview, currentFilePath } from './livePreview';
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
  filePath: string | null;
  wrap: boolean;
  liveMarkdownPreview: boolean;
  lineNumbers: boolean;
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

function lineNumbersExtension(show: boolean) {
  // codemirror's base theme sets `.cm-gutter { display: flex !important }`,
  // which the line-number gutter also matches — beat it with !important too.
  return show
    ? []
    : EditorView.theme({ '.cm-lineNumbers': { display: 'none !important' } });
}

function themeExtension() {
  const theme = getActiveTheme();
  return theme ? syntaxHighlighting(theme.highlightStyle) : [];
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--editor-font-size, 14px)',
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-fg)',
  },
  '.cm-content': { caretColor: 'var(--editor-fg)' },
  // drawSelection() renders the visible caret as a `.cm-cursor` div with a
  // hardcoded border color, ignoring `caretColor` above — override it directly.
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-fg)' },
  '.cm-scroller': {
    fontFamily: 'var(--editor-font, ui-monospace, monospace)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-gutter-fg)',
    border: 'none',
  },
  // A wrapped line's gutter element spans every visual row it wraps to, so it
  // must stay top-aligned — the number belongs on the line's first row, not
  // centered across the whole wrapped block. Heading lines are the one
  // exception: they're taller than base line-height for a different reason
  // (their `.cm-md-h*` text is scaled up via `em`, not wrapped), so their
  // number is explicitly centered via `cm-md-h-gutter` (see livePreview.ts).
  '.cm-lineNumbers .cm-gutterElement': {
    display: 'flex',
    alignItems: 'flex-start',
  },
  '.cm-lineNumbers .cm-gutterElement.cm-md-h-gutter': {
    alignItems: 'center',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)',
  },
  // drawSelection()'s own focused-state rule is
  // `.<theme>.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`
  // (5 class selectors) — this app never sets EditorView.darkTheme, so CodeMirror's
  // built-in light-theme color wins that specificity fight while focused unless matched.
  '&.cm-focused .cm-scroller .cm-selectionLayer .cm-selectionBackground': {
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
  {
    fileName,
    filePath,
    wrap,
    liveMarkdownPreview,
    lineNumbers,
    initialContent = '',
    onChange,
  },
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
    filePath: new Compartment(),
    lineNumbers: new Compartment(),
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
        compartments.language.of([]),
        compartments.wrap.of(wrap ? EditorView.lineWrapping : []),
        compartments.livePreview.of(
          livePreviewExtension(fileName, liveMarkdownPreview),
        ),
        compartments.slashCommands.of(slashCommandsExtension(fileName)),
        compartments.theme.of(themeExtension()),
        compartments.filePath.of(currentFilePath.of(filePath)),
        compartments.lineNumbers.of(lineNumbersExtension(lineNumbers)),
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
    let cancelled = false;
    const pending = languageForFile(fileName);
    if (!pending) {
      viewRef.current?.dispatch({
        effects: compartments.language.reconfigure([]),
      });
      return;
    }
    pending.then((language) => {
      if (cancelled) return;
      viewRef.current?.dispatch({
        effects: compartments.language.reconfigure(language),
      });
    });
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.filePath.reconfigure(currentFilePath.of(filePath)),
    });
  }, [filePath]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.lineNumbers.reconfigure(
        lineNumbersExtension(lineNumbers),
      ),
    });
  }, [lineNumbers]);

  // Editor has no theme prop — theme changes originate in Settings/ThemePicker, so this
  // subscribes directly to the settings store rather than depending on props. The store
  // notifies on every settings change (not just theme ones), so skip the reconfigure —
  // which forces CodeMirror to redo syntax highlighting — unless the theme actually did.
  useEffect(() => {
    let lastTheme = getActiveTheme();
    const reconfigureTheme = () => {
      const theme = getActiveTheme();
      if (theme === lastTheme) return;
      lastTheme = theme;
      viewRef.current?.dispatch({
        effects: compartments.theme.reconfigure(
          theme ? syntaxHighlighting(theme.highlightStyle) : [],
        ),
      });
    };
    return subscribeSettings(reconfigureTheme);
  }, []);

  return <div className={styles.editor} ref={containerRef} />;
});

export default Editor;
