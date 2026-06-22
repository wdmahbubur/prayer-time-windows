mod runtime_scheduler;

use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager, WindowEvent,
};
use tauri_plugin_updater::Builder as UpdaterBuilder;

use runtime_scheduler::{init_scheduler, sync_runtime_schedule, RuntimeSchedulePayload, RuntimeSchedulerState};

#[tauri::command]
fn show_main(app: AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("main").ok_or("main window not found")?;
  window.show().map_err(|e| e.to_string())?;
  window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_main(app: AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("main").ok_or("main window not found")?;
  window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_widget(app: AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("widget").ok_or("widget window not found")?;
  window.set_always_on_top(false).map_err(|e| e.to_string())?;
  window.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_widget(app: AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("widget").ok_or("widget window not found")?;
  window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_widget(app: AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("widget").ok_or("widget window not found")?;
  if window.is_visible().map_err(|e| e.to_string())? {
    window.hide().map_err(|e| e.to_string())
  } else {
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
  app.exit(0);
}

#[tauri::command]
fn start_focus_mode(app: AppHandle) -> Result<(), String> {
  start_focus_mode_impl(&app)
}

#[tauri::command]
fn end_focus_mode(app: AppHandle) -> Result<(), String> {
  end_focus_mode_impl(&app)
}

#[tauri::command]
fn sync_runtime_schedule_command(
  state: tauri::State<'_, RuntimeSchedulerState>,
  payload: RuntimeSchedulePayload,
) -> Result<(), String> {
  sync_runtime_schedule(state, payload)
}

fn start_focus_mode_impl(app: &AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("main").ok_or("main window not found")?;
  window.show().map_err(|e| e.to_string())?;
  window.set_always_on_top(true).map_err(|e| e.to_string())?;
  window.set_fullscreen(true).map_err(|e| e.to_string())?;
  window.set_focus().map_err(|e| e.to_string())
}

fn end_focus_mode_impl(app: &AppHandle) -> Result<(), String> {
  let window = app.get_webview_window("main").ok_or("main window not found")?;
  window.set_fullscreen(false).map_err(|e| e.to_string())?;
  window.set_always_on_top(false).map_err(|e| e.to_string())?;
  window.hide().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec![]),
    ))
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_shell::init())
    .plugin(UpdaterBuilder::new().build())
    .invoke_handler(tauri::generate_handler![
      show_main,
      hide_main,
      show_widget,
      hide_widget,
      toggle_widget,
      quit_app,
      start_focus_mode,
      end_focus_mode,
      sync_runtime_schedule_command
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.manage(init_scheduler(app.handle().clone()));
      build_tray(app.handle())?;
      if let Some(window) = app.get_webview_window("main") {
        let window_to_hide = window.clone();
        window.on_window_event(move |event| {
          if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_to_hide.set_fullscreen(false);
            let _ = window_to_hide.set_always_on_top(false);
            let _ = window_to_hide.hide();
          }
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
  let show = MenuItem::with_id(app, "show", "Show Prayer Times", true, None::<&str>)?;
  let hide = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
  let widget = MenuItem::with_id(app, "widget", "Show/Hide Widget", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &hide, &widget, &quit])?;

  TrayIconBuilder::with_id("main-tray")
    .tooltip("Prayer Times")
    .icon(app.default_window_icon().expect("missing app icon").clone())
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
      "hide" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.hide();
        }
      }
      "widget" => {
        if let Some(window) = app.get_webview_window("widget") {
          if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
          } else {
            let _ = window.set_always_on_top(false);
            let _ = window.show();
          }
        }
      }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
          } else {
            let _ = window.show();
            let _ = window.set_focus();
          }
        }
      }
    })
    .build(app)?;
  Ok(())
}
