<script lang="ts">
  import { onMount } from 'svelte';
  import { Compartment, Prec } from '@codemirror/state';
  import { EditorView } from '@codemirror/view';
  import { syntaxHighlighting } from '@codemirror/language';
  import { basicSetup } from 'codemirror';
  import { vsCodeKeymap } from './keymap';
  import { languageForFile, isMarkdownFile } from './languages';
  import { livePreview } from './livePreview';
  import { slashCommands } from './slashCommands';
  import { getActiveTheme } from '../theme/store.svelte';

  interface Props {
    fileName: string;
    wrap: boolean;
    liveMarkdownPreview: boolean;
    initialContent?: string;
    /** Called on every doc change. `isUserEdit` is false for programmatic loads (opening/new file). */
    onChange?: (content: string, isUserEdit: boolean) => void;
  }

  let {
    fileName,
    wrap,
    liveMarkdownPreview,
    initialContent = '',
    onChange,
  }: Props = $props();

  let container: HTMLDivElement;
  let view: EditorView | undefined;

  const languageCompartment = new Compartment();
  const wrapCompartment = new Compartment();
  const livePreviewCompartment = new Compartment();
  const slashCommandsCompartment = new Compartment();
  const themeCompartment = new Compartment();

  function livePreviewExtension() {
    return isMarkdownFile(fileName) && liveMarkdownPreview ? livePreview : [];
  }

  function slashCommandsExtension() {
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

  onMount(() => {
    view = new EditorView({
      doc: initialContent,
      parent: container,
      extensions: [
        basicSetup,
        editorTheme,
        Prec.highest(vsCodeKeymap),
        languageCompartment.of(languageForFile(fileName) ?? []),
        wrapCompartment.of(wrap ? EditorView.lineWrapping : []),
        livePreviewCompartment.of(livePreviewExtension()),
        slashCommandsCompartment.of(slashCommandsExtension()),
        themeCompartment.of(themeExtension()),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const isLoad = update.transactions.some((tr) =>
            tr.isUserEvent('altnote.load'),
          );
          onChange?.(update.state.doc.toString(), !isLoad);
        }),
      ],
    });
    return () => view?.destroy();
  });

  $effect(() => {
    view?.dispatch({
      effects: languageCompartment.reconfigure(languageForFile(fileName) ?? []),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: livePreviewCompartment.reconfigure(livePreviewExtension()),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: slashCommandsCompartment.reconfigure(slashCommandsExtension()),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: themeCompartment.reconfigure(themeExtension()),
    });
  });

  export function getContent(): string {
    return view?.state.doc.toString() ?? '';
  }

  /** Replace the whole document, e.g. when a different file is opened into this same editor. */
  export function loadContent(text: string) {
    view?.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      userEvent: 'altnote.load',
    });
  }

  export function focus() {
    view?.focus();
  }
</script>

<div class="editor" bind:this={container}></div>

<style>
  .editor {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
</style>
