use serde::Serialize;
use serde_json::Value;
use std::io::{Cursor, Read};

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

#[derive(Serialize)]
pub struct ThemeFetchResult {
    theme: Value,
    theme_name: String,
}

/// Downloads a VS Code extension's package from the public Marketplace, extracts the
/// theme JSON matching `theme_slug` (falling back to the extension's first theme if the
/// slug can't be matched), and returns it.
#[tauri::command]
pub async fn fetch_marketplace_theme(
    publisher: String,
    extension: String,
    theme_slug: String,
) -> Result<ThemeFetchResult, String> {
    let url = format!(
        "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/{publisher}/vsextensions/{extension}/latest/vspackage"
    );

    let response = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Failed to reach the VS Code Marketplace: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Marketplace returned {} — check the publisher/extension name",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to download extension package: {e}"))?;

    let package_bytes = if bytes.starts_with(&[0x1f, 0x8b]) {
        let mut decoder = flate2::read::GzDecoder::new(&bytes[..]);
        let mut out = Vec::new();
        decoder
            .read_to_end(&mut out)
            .map_err(|e| format!("Failed to decompress extension package: {e}"))?;
        out
    } else {
        bytes.to_vec()
    };

    let mut archive = zip::ZipArchive::new(Cursor::new(package_bytes))
        .map_err(|e| format!("Downloaded file isn't a valid extension package: {e}"))?;

    let package_json = read_json_entry(&mut archive, "extension/package.json")?;

    let themes = package_json
        .pointer("/contributes/themes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if themes.is_empty() {
        return Err("This extension doesn't contribute any color themes".to_string());
    }

    let matching = themes
        .iter()
        .find(|theme| {
            theme
                .get("label")
                .and_then(Value::as_str)
                .map(|label| slugify(label) == theme_slug)
                .unwrap_or(false)
        })
        .or_else(|| themes.first())
        .expect("themes is non-empty");

    let theme_name = matching
        .get("label")
        .and_then(Value::as_str)
        .unwrap_or("Theme")
        .to_string();
    let theme_path = matching
        .get("path")
        .and_then(Value::as_str)
        .ok_or("Theme entry has no file path")?
        .trim_start_matches("./");

    let theme = read_json_entry(&mut archive, &format!("extension/{theme_path}"))?;

    Ok(ThemeFetchResult { theme, theme_name })
}

fn read_json_entry(
    archive: &mut zip::ZipArchive<Cursor<Vec<u8>>>,
    path: &str,
) -> Result<Value, String> {
    let mut file = archive
        .by_name(path)
        .map_err(|_| format!("{path} not found in extension package"))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read {path}: {e}"))?;
    // VS Code's own JSON files (including theme files) are commonly JSONC, with comments.
    jsonc_parser::parse_to_serde_value::<Value>(&contents, &Default::default())
        .map_err(|e| format!("Invalid JSON in {path}: {e}"))
}

fn slugify(label: &str) -> String {
    label
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
