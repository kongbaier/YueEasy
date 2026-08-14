//! Phase 1 Spike：验证 stream-download + rodio 播放网络音频流 + seek + 内存清理。
//!
//! 用法：`cargo run --example spike_audio -- <audio-url>`
//!
//! 验证点：
//! 1. StreamDownload 从 URL 分块下载到临时文件（内存恒定），并暴露 Read+Seek。
//! 2. rodio Decoder（symphonia）解码该流，total_duration 正确。
//! 3. Player 播放 + try_seek 精确跳转。
//! 4. drop 后临时文件清理（TempStorage 语义）。

use std::io::{BufReader, Read, Seek};
use std::time::Duration;

use rodio::decoder::Decoder;
use rodio::source::Source;
use rodio::stream::DeviceSinkBuilder;
use rodio::Player;
use stream_download::http::reqwest::Url;
use stream_download::source::DecodeError;
use stream_download::storage::temp::TempStorageProvider;
use stream_download::{Settings, StreamDownload};

#[tokio::main]
async fn main() -> Result<(), String> {
    let raw_url = std::env::args()
        .nth(1)
        .ok_or("usage: cargo run --example spike_audio -- <audio-url>")?;
    let url = Url::parse(&raw_url).map_err(|e| e.to_string())?;

    println!("[spike] downloading + decoding: {url}");

    let reader = match StreamDownload::new_http(url, TempStorageProvider::new(), Settings::default())
        .await
    {
        Ok(r) => r,
        Err(e) => return Err(e.decode_error().await),
    };

    // 解码 + 播放为阻塞 IO，放 spawn_blocking（rodio 内部线程消费 source）。
    tokio::task::spawn_blocking(move || run_playback(reader))
        .await
        .map_err(|e| e.to_string())?
}

fn run_playback<R>(reader: R) -> Result<(), String>
where
    R: Read + Seek + Send + Sync + 'static,
{
    let device_sink = DeviceSinkBuilder::open_default_sink().map_err(|e| e.to_string())?;
    let mixer = device_sink.mixer().clone();
    let player = Player::connect_new(&mixer);

    let source = Decoder::try_from(BufReader::new(reader)).map_err(|e| e.to_string())?;
    let total = source.total_duration();
    println!("[spike] total_duration = {total:?}");

    player.append(source);
    player.play();
    println!("[spike] playing, pos = {:?}", player.get_pos());

    std::thread::sleep(Duration::from_secs(3));
    println!("[spike] after 3s, pos = {:?}", player.get_pos());

    match player.try_seek(Duration::from_secs(30)) {
        Ok(()) => println!("[spike] seek to 30s ok, pos = {:?}", player.get_pos()),
        Err(e) => println!("[spike] seek failed: {e}"),
    }

    std::thread::sleep(Duration::from_secs(2));
    println!("[spike] after seek +2s, pos = {:?}", player.get_pos());

    player.stop();
    player.clear();
    println!("[spike] stopped + cleared");

    Ok(())
}
