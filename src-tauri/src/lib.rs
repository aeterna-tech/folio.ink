use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use std::sync::Mutex;
use tauri::Manager;

struct SidecarState(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(SidecarState(Mutex::new(None)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // запуск Flask-бэкенда как sidecar-процесс
      let sidecar_command = app.shell().sidecar("run")
        .expect("failed to create sidecar command");

      let (mut rx, child) = sidecar_command
        .spawn()
        .expect("failed to spawn sidecar");

      let state = app.state::<SidecarState>();
      *state.0.lock().unwrap() = Some(child);

      // слушаем вывод процесса (для отладки - видно в консоли что Flask пишет)
      tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
          if let CommandEvent::Stdout(line) = event {
            println!("[Flask]: {}", String::from_utf8_lossy(&line));
          }
        }
      });

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        let state = window.state::<SidecarState>();
        let mut guard = state.0.lock().unwrap();
        let child_opt = guard.take();
        drop(guard);

        if let Some(child) = child_opt {
          let pid = child.pid();
          // child.kill() убивает только процесс-обёртку PyInstaller
          // (--onefile сначала распаковывает себя и запускает НАСТОЯЩИЙ
          // Python-процесс как отдельного потомка) — сам Python-процесс
          // остаётся сиротой и продолжает жить. taskkill /T убивает всё
          // дерево процессов целиком, гарантированно закрывая обоих.
          #[cfg(target_os = "windows")]
          {
            let _ = std::process::Command::new("taskkill")
              .args(["/PID", &pid.to_string(), "/T", "/F"])
              .output();
          }

          #[cfg(not(target_os = "windows"))]
          {
            let _ = child.kill();
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}