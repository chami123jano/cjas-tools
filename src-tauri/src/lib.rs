use tauri::plugin::Builder as PluginBuilder;
use tauri::Wry;
use tauri_plugin_opener::OpenerExt;

/* Is this address part of the app itself (its pages, files it makes)? */
fn inside_app(url: &tauri::Url) -> bool {
  match url.scheme() {
    "tauri" | "about" | "blob" | "data" => true,
    "http" | "https" => url.host_str() == Some("tauri.localhost"),
    _ => false,
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  /* A link to a website (the download page, Sri Lanka Post...) opens in the
     computer's own browser, and the app stays on the tool it was showing.
     The tests set CJA_TEST_NO_OPEN so no browser is opened while testing. */
  let outside_links = PluginBuilder::<Wry, ()>::new("outside-links")
    .on_navigation(|webview, url| {
      if inside_app(url) {
        return true;
      }
      if matches!(url.scheme(), "http" | "https" | "mailto") && std::env::var_os("CJA_TEST_NO_OPEN").is_none() {
        let _ = webview.opener().open_url(url.as_str(), None::<&str>);
      }
      false
    })
    .build();

  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(outside_links)
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
