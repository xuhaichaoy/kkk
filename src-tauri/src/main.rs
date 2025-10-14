#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod speech;

use speech::{
    delete_speech_session, ensure_speech_model, list_speech_sessions, transcribe_audio,
    SpeechManager,
};
use tauri::Manager;
use tauri_plugin_log::{fern::colors::ColoredLevelConfig, Target, TargetKind};

#[tauri::command]
fn open_todo_widget(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("todo-widget") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "todo-widget",
        tauri::WebviewUrl::App("/todo/widget".into()),
    )
    .title("Todo Widget")
    .inner_size(520.0, 370.0)
    .min_inner_size(520.0, 350.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            let manager = SpeechManager::new(&handle).map_err(|e| {
                let boxed: Box<dyn std::error::Error> = Box::new(e);
                boxed
            })?;
            app.manage(manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_todo_widget,
            ensure_speech_model,
            list_speech_sessions,
            delete_speech_session,
            transcribe_audio
        ])
        .plugin(tauri_plugin_fs::init())
        // 暂时禁用 window-state 插件来避免窗口状态冲突
        // .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([Target::new(TargetKind::Webview)])
                .with_colors(ColoredLevelConfig::default())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running Blink");
}
