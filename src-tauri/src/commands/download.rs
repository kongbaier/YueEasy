#[tauri::command]
pub async fn download_song(_song_id: i64, _url: String) -> Result<String, String> {
    Err("not implemented".into())
}
