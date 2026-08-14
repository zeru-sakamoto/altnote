mod commands;

use commands::fonts::list_system_fonts;
use commands::theme_import::fetch_marketplace_theme;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_system_fonts,
            fetch_marketplace_theme
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
