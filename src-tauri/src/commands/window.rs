use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

/// Reads the width/height the last-closed window was saved at (via the
/// frontend settings store), falling back to the default 800x600.
fn last_window_size(app: &AppHandle) -> (f64, f64) {
    let store = match app.store("settings.json") {
        Ok(store) => store,
        Err(_) => return (800.0, 600.0),
    };
    let width = store
        .get("lastWindowWidth")
        .and_then(|v| v.as_f64())
        .unwrap_or(800.0);
    let height = store
        .get("lastWindowHeight")
        .and_then(|v| v.as_f64())
        .unwrap_or(600.0);
    (width, height)
}

/// Creates a new editor window, optionally pre-loaded with the file at `path`.
/// Used both for OS-triggered opens (first launch / single-instance relaunch,
/// via `std::env::args`) and, from the frontend, for in-app "Open"/"New Window".
pub fn open_editor_window(app: &AppHandle, path: Option<String>) -> tauri::Result<()> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let label = format!("editor-{nanos}");

    let url = match &path {
        Some(p) => format!("index.html?path={}", urlencoding::encode(p)),
        None => "index.html".to_string(),
    };

    let (width, height) = last_window_size(app);

    WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("Untitled — AltNote")
        .inner_size(width, height)
        .decorations(false)
        .build()?;

    Ok(())
}
