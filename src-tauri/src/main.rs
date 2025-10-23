#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod speech;

use speech::{
    cancel_transcription, delete_speech_session, ensure_speech_model, export_speech_sessions,
    import_speech_sessions, list_speech_sessions, open_speech_session_folder, transcribe_audio,
    update_speech_session, SpeechManager,
};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_log::{fern::colors::ColoredLevelConfig, Target, TargetKind};

fn to_boxed_error<E>(err: E) -> Box<dyn std::error::Error>
where
    E: std::error::Error + 'static,
{
    Box::new(err)
}

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
            let manager = SpeechManager::new(&handle).map_err(to_boxed_error)?;
            app.manage(manager);

            let show_main_item =
                MenuItemBuilder::with_id("show-main", "显示主窗口").build(app).map_err(to_boxed_error)?;
            let quit_item =
                MenuItemBuilder::with_id("quit", "退出应用").build(app).map_err(to_boxed_error)?;

            let tray_menu = MenuBuilder::new(app)
                .item(&show_main_item)
                .item(&quit_item)
                .build()
                .map_err(to_boxed_error)?;

            let tray_icon_image = Image::from_bytes(include_bytes!("../icons/32x32.png"))
                .map_err(to_boxed_error)?;

            let tray_builder = TrayIconBuilder::with_id("kk-tray")
                .icon(tray_icon_image.clone())
                .menu(&tray_menu)
                .tooltip("Kk")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show-main" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, .. } = event {
                        if button == MouseButton::Left {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            let tray_builder = if cfg!(target_os = "macos") {
                tray_builder.icon_as_template(true)
            } else {
                tray_builder
            };

            let tray_icon = tray_builder.build(app).map_err(to_boxed_error)?;
            app.manage(tray_icon);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_todo_widget,
            ensure_speech_model,
            list_speech_sessions,
            delete_speech_session,
            update_speech_session,
            transcribe_audio,
            cancel_transcription,
            open_speech_session_folder,
            export_speech_sessions,
            import_speech_sessions
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
        .expect("error while running Kk");
}
