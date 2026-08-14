<script lang="ts">
  interface Props {
    recentFiles: string[];
    onOpenRecent: (path: string) => void;
  }

  let { recentFiles, onOpenRecent }: Props = $props();

  function baseName(path: string): string {
    return path.split(/[\\/]/).pop() ?? path;
  }
</script>

{#if recentFiles.length > 0}
  <div class="welcome">
    <p class="hint">Recent files</p>
    <ul>
      {#each recentFiles as path (path)}
        <li>
          <button onclick={() => onOpenRecent(path)}>
            <span class="name">{baseName(path)}</span>
            <span class="path">{path}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .welcome {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .hint {
    opacity: 0.5;
    font-size: 12px;
    margin: 0 0 8px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 340px;
    max-width: 80%;
    pointer-events: auto;
  }

  li + li {
    margin-top: 4px;
  }

  button {
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid var(--editor-active-line);
    border-radius: 4px;
    padding: 8px 10px;
    color: var(--editor-fg);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: inherit;
  }

  button:hover {
    background-color: var(--editor-active-line);
  }

  .name {
    font-size: 13px;
  }

  .path {
    font-size: 11px;
    opacity: 0.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
