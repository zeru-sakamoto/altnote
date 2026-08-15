mod commands;

use commands::fonts::list_system_fonts;
use commands::theme_import::fetch_marketplace_theme;
use commands::window::open_editor_window;

/// First non-flag argument in an argv list, i.e. the file path (if any)
/// the OS launched/relaunched us with.
fn file_arg(argv: impl IntoIterator<Item = String>) -> Option<String> {
    argv.into_iter().skip(1).find(|a| !a.starts_with('-'))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let _ = open_editor_window(app, file_arg(argv));
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_system_fonts,
            fetch_marketplace_theme
        ])
        .setup(|app| {
            open_editor_window(app.handle(), file_arg(std::env::args()))?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
