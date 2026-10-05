#[tauri::command]
fn print_roster(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![print_roster])
        .run(tauri::generate_context!())
        .expect("Could not start Pöttyös Beosztás");
}
