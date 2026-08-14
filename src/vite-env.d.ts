/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module '*.svelte' {
  import type { Component } from 'svelte';
  // tsc (unlike svelte-check) can't see inside .svelte files, so this is
  // intentionally permissive; per-component prop/exports checking happens
  // in the editor via the Svelte language tools, not in `npm run build`.
  const component: Component<any, any, any>;
  export default component;
}
