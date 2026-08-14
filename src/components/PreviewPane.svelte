<script lang="ts">
  import MarkdownIt from 'markdown-it';

  interface Props {
    content: string;
  }

  let { content }: Props = $props();

  const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
  let html = $derived(md.render(content));
</script>

<div class="preview">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</div>

<style>
  .preview {
    height: 100%;
    overflow-y: auto;
    padding: 12px 20px;
    box-sizing: border-box;
    background-color: var(--editor-bg);
    color: var(--editor-fg);
    border-left: 1px solid var(--titlebar-button-hover);
  }

  .preview :global(h1),
  .preview :global(h2),
  .preview :global(h3),
  .preview :global(h4),
  .preview :global(h5),
  .preview :global(h6) {
    line-height: 1.3;
  }

  .preview :global(pre) {
    background-color: var(--editor-active-line);
    padding: 8px 10px;
    border-radius: 4px;
    overflow-x: auto;
  }

  .preview :global(code) {
    font-family: var(--editor-font, ui-monospace, monospace);
  }

  .preview :global(blockquote) {
    margin: 0;
    padding-left: 12px;
    border-left: 3px solid var(--editor-gutter-fg);
    color: var(--editor-gutter-fg);
  }

  .preview :global(a) {
    color: var(--editor-link, #4ea1ff);
  }
</style>
