use std::net::SocketAddr;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 3000;

pub fn default_port() -> u16 {
    DEFAULT_PORT
}

pub async fn start(port: Option<u16>) -> Result<tokio::task::JoinHandle<()>, String> {
    let port = port.unwrap_or(DEFAULT_PORT);
    let addr: SocketAddr = format!("{}:{}", DEFAULT_HOST, port)
        .parse()
        .map_err(|e| format!("invalid address: {}", e))?;

    let client = ncm_api_rs::create_client(None);
    let app = ncm_api_rs::server::build_app(client);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("NCM server failed to bind port {}: {}", port, e))?;

    let handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("NCM server stopped: {}", e);
        }
    });

    Ok(handle)
}

#[tauri::command]
pub async fn ncm_health_check() -> Result<bool, String> {
    let addr = format!("127.0.0.1:{}", DEFAULT_PORT);
    match tokio::net::TcpStream::connect(addr).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
