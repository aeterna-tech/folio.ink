use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
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

      let (mut rx, mut _child) = sidecar_command
        .spawn()
        .expect("failed to spawn sidecar");

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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}