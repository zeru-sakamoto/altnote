use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

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

    WebviewWindowBuilder::new(app, label, WebviewUrl::App(url.into()))
        .title("Untitled — AltNote")
        .inner_size(800.0, 600.0)
        .decorations(false)
        .build()?;

    Ok(())
}
