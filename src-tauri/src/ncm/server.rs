use std::net::SocketAddr;

use super::NcmState;

pub async fn start() -> Result<(u16, tokio::task::JoinHandle<()>), String> {
    let addr: SocketAddr = "127.0.0.1:0"
        .parse()
        .map_err(|e| format!("invalid address: {}", e))?;

    let client = ncm_api_rs::create_client(None);
    let app = ncm_api_rs::server::build_app(client);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("NCM server failed to bind: {}", e))?;

    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);

    let handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("NCM server stopped: {}", e);
        }
    });

    Ok((port, handle))
}

#[tauri::command]
pub async fn ncm_health_check(state: tauri::State<'_, NcmState>) -> Result<bool, String> {
    let port = *state.port.lock().unwrap();
    match port {
        Some(p) => {
            let addr = format!("127.0.0.1:{}", p);
            Ok(tokio::net::TcpStream::connect(addr).await.is_ok())
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub fn get_ncm_port(state: tauri::State<'_, NcmState>) -> Result<u16, String> {
    state
        .port
        .lock()
        .unwrap()
        .ok_or_else(|| "NCM server not started".to_string())
}
