# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AltNote — a Windows Notepad alternative built as a Tauri 2 desktop app: React/TypeScript frontend (CodeMirror 6 editor) + a small Rust backend. A single-file text/Markdown editor with per-window multi-document support (each open file gets its own OS window, not tabs).

## Commands

- `npm run dev` — Vite dev server only (port 1420, fixed/strict). For the full desktop app, use `npm run tauri dev` instead so the Rust shell launches too.
- `npm run build` — full release pipeline: `prettier --write .` → `tsc` (typecheck, no emit) → `vitest run` → `vite build`. This is also what `tauri build` invokes via `beforeBuildCommand`, so a broken test or type error fails the app build.
- `npm run test` / `npx vitest run` — run the frontend test suite once (vitest, `environment: 'node'` — no DOM, see below).
- `npx vitest run path/to/file.test.ts` — run a single test file. `npx vitest run -t "name"` filters by test name.
- `npm run format` — prettier write.
- `npx tsc --noEmit` — typecheck only.
- Rust: `cargo check` / `cargo build` from `src-tauri/` (or `cargo build --release` for the LTO/opt-level="s" release profile).

## Architecture

### Frontend/backend split
The Rust side (`src-tauri/src/`) is intentionally thin — it exists only for what the webview can't do itself:
- `commands/fonts.rs` — `list_system_fonts` (via `font-kit`), invoked once when the Settings panel mounts.
- `commands/theme_import.rs` — `fetch_marketplace_theme`, downloads/unzips a VS Code extension `.vsix` from the public Marketplace and extracts a theme JSON (network + zip work not doable from the webview).
- `commands/window.rs` / `lib.rs` — window creation (`open_editor_window`) and the single-instance/OS-launch-argument handling.
Everything else (file I/O, dialogs, settings persistence, window chrome) goes through the `@tauri-apps/plugin-*` JS APIs directly rather than custom commands.

### Multi-window model
There are no tabs — every open document is its own OS window (`index.html?path=<encoded path>`), each an independent React root/App instance. Two places create windows and must stay in sync on the URL convention:
- `src/lib/window.ts` (`createEditorWindow`) — used from in-app "Open"/"New Window", labels windows `editor-${crypto.randomUUID()}`.
- `src-tauri/src/commands/window.rs` (`open_editor_window`) — used for first launch and OS "open with"/relaunch (via `tauri-plugin-single-instance`), labels windows `editor-${nanos}`.
`App.tsx` reads its own `path` query param once at module load (`initialPath`) to know what to load on mount.

### Editor: CodeMirror 6 + a hand-rolled live-preview layer
`src/editor/Editor.tsx` builds one `EditorView` on mount and reconfigures it afterward entirely through `Compartment`s (language, wrap, live-preview, slash-commands, theme, current file path) — never remounts the view. Settings/theme changes reach the editor two ways: props (from `App.tsx`) for document-level state, and a direct subscription to the settings store (`subscribeSettings`) for theme, since the editor has no `theme` prop.

Markdown language support is `@lezer/markdown` + `@codemirror/lang-markdown`, extended with hand-written `MarkdownConfig`s in `src/editor/mdExtensions.ts` (highlight `==text==`, Obsidian-style `[[wikilinks]]`, single-line footnotes) plus GFM/Superscript/Subscript from `@lezer/markdown`. Non-Markdown languages are lazy-loaded per file extension in `src/editor/languages.ts` and cached — this dynamic-import split is deliberate to keep the base bundle small (see comment there).

"Live preview" (Obsidian/Typora-style — Markdown renders inline in the same editor rather than a separate pane) is `src/editor/livePreview.ts`: a `ViewPlugin` that walks the syntax tree over `view.visibleRanges` on every doc/selection/viewport change and builds a `DecorationSet` — hiding marker characters unless the cursor is on that line, replacing nodes with widgets (checkboxes, images, tables, `<hr>`), etc. `liveImage.ts` and `liveTable.ts` hold the widget classes for images (resolved via Tauri's asset protocol against the current file's directory) and editable tables, respectively. This is separate from `PreviewPane.tsx`, which is a plain side-by-side rendered pane using `markdown-it` (debounced re-render on content change) — the two Markdown renderers are independent and don't share logic.

### State: two independent stores, both `useSyncExternalStore`-based, no Redux/Zustand
- `src/settings/store.ts` — app settings (font, wrap, recent files, theme id, cached custom themes, live-preview/autosave toggles), persisted via `@tauri-apps/plugin-store` (`settings.json`). Plain module-level state + a `Set` of listeners; `useSettings()` is the React hook.
- `src/theme/store.ts` — resolves the active theme (by id, from `presetThemes` or the settings store's cached custom themes) and converts it via `src/theme/convert.ts`. `getActiveTheme()` is memoized by raw-theme object identity — callers (Editor's settings subscription, App's CSS-var effect) re-invoke it on *every* settings change, not just theme ones, so this cache is load-bearing for avoiding redundant `HighlightStyle` rebuilds.

Themes are VS Code theme JSON (JSONC, via `jsonc-parser`), converted in `theme/convert.ts` into a CodeMirror `HighlightStyle` (via a hand-maintained TextMate-scope → Lezer-tag `SCOPE_MAP`, not exhaustive) plus a handful of CSS custom properties (`--editor-bg`, `--editor-fg`, etc., listed in `THEME_CSS_VAR_KEYS`) applied to `document.documentElement`. Themes come from three sources: bundled presets (`src/theme/presets/*.json`, imported with Vite's `?raw`), a pasted `vscodethemes.com` URL (parsed in `theme/urlParser.ts`, fetched via the Rust `fetch_marketplace_theme` command), or previously-imported custom themes cached in settings.

### Testing
Vitest runs under `environment: 'node'` (see `vite.config.ts`) — there is no DOM. Tests that need a document (anything touching a real `EditorView`) can't run here; that's why editor logic that needs testing (e.g. `wrapSelectionSpec` in `keymap.ts`, `toggleTaskMarkerText` in `livePreview.ts`) is factored out as pure functions operating on a plain `EditorState`, exported specifically for unit testing, and tested separately from the DOM-dependent `ViewPlugin`/widget code around them.
