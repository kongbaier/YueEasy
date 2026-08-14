use std::io::BufReader;
use std::time::Duration;

use rodio::source::Source;
use rodio::stream::{DeviceSinkBuilder, MixerDeviceSink};
use rodio::Player;
use stream_download::http::reqwest::Url;
use stream_download::storage::temp::TempStorageProvider;
use stream_download::{Settings, StreamDownload};

#[allow(dead_code)] // Loading/Ended/Error 为后续阶段预留（对齐设计文档 §5 完整状态机）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioStatus {
    Idle,
    Loading,
    Playing,
    Paused,
    Ended,
    Error,
}

/// 解码完成的 source（type-erased），可直接 append 到 `Player`。
pub type PreparedSource = Box<dyn Source<Item = f32> + Send + 'static>;

/// 解码产物：source + 解码得到的真实时长（None 表示解码器无法给出，调用方回退元数据时长）。
pub struct DecodedSource {
    pub source: PreparedSource,
    pub real_duration: Option<Duration>,
}

/// 下载并解码一个 URL，产出可播放 source 及其真实时长。
///
/// 分两步：async 下载（`StreamDownload::new_http`）→ `spawn_blocking` 解码。
/// 真实时长取自解码器 `total_duration()`（symphonia 按 time_base × n_frames 换算），
/// 优先用于 ended 判定；为 None（流式/无时长头）时调用方回退 NCM 元数据。
pub async fn prepare_source(url: Url) -> Result<DecodedSource, String> {
    let reader = StreamDownload::new_http(url, TempStorageProvider::new(), Settings::default())
        .await
        .map_err(|e| e.to_string())?;
    // 记录媒体字节长度：往回 seek 需要 byte_len（symphonia 按字节偏移折算时间）+
    // is_seekable=true（否则 symphonia 判 ForwardOnly，往回 seek 返回 RandomAccessNotSupported）。
    let byte_len = reader.content_length();

    tokio::task::spawn_blocking(move || {
        let mut builder = rodio::decoder::Decoder::builder()
            .with_data(BufReader::new(reader))
            .with_seekable(true);
        if let Some(len) = byte_len {
            builder = builder.with_byte_len(len);
        }
        let source = builder.build().map_err(|e| e.to_string())?;
        // 在 type-erase 前读取真实时长（Box<dyn Source> 仍暴露 total_duration，此处显式取值更清晰）。
        let real_duration = source.total_duration();
        Ok(DecodedSource {
            source: Box::new(source) as PreparedSource,
            real_duration,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

pub struct AudioEngine {
    // 必须持有：drop 会停止设备输出（rodio 语义）。
    _device_sink: MixerDeviceSink,
    player: Player,
    status: AudioStatus,
    load_seq: u64,
    /// 当前曲目时长，用于 ended 判定：优先解码器给出的真实流时长，
    /// 缺失时回退 NCM 元数据（`load` 的第二参 `duration_secs`）。
    duration: Option<Duration>,
}

impl AudioEngine {
    pub fn new() -> Result<Self, String> {
        let device_sink = DeviceSinkBuilder::open_default_sink().map_err(|e| e.to_string())?;
        // 关闭 drop 时的日志噪音（Phase 2 内部管理生命周期）。
        let mut device_sink = device_sink;
        device_sink.log_on_drop(false);
        let mixer = device_sink.mixer().clone();
        let player = Player::connect_new(&mixer);
        Ok(Self {
            _device_sink: device_sink,
            player,
            status: AudioStatus::Idle,
            load_seq: 0,
            duration: None,
        })
    }

    /// 加载一个已解码的 source 并开始播放。返回递增的 load_seq（竞态防护）。
    ///
    /// `real_duration`：解码器给出的真实流时长（`DecodedSource.real_duration`），优先采用；
    /// 为 None 时回退 `duration_secs`（NCM 元数据），两者皆无则 duration=None（不判 ended）。
    pub fn load(
        &mut self,
        source: PreparedSource,
        real_duration: Option<Duration>,
        duration_secs: f64,
    ) -> u64 {
        self.load_seq += 1;
        self.player.clear();
        self.player.append(source);
        self.player.play();
        self.status = AudioStatus::Playing;
        self.duration = real_duration
            .or_else(|| (duration_secs > 0.0).then_some(Duration::from_secs_f64(duration_secs)));
        self.load_seq
    }

    pub fn play(&mut self) {
        self.player.play();
        if self.status != AudioStatus::Error {
            self.status = AudioStatus::Playing;
        }
    }

    pub fn pause(&mut self) {
        self.player.pause();
        if self.status != AudioStatus::Error {
            self.status = AudioStatus::Paused;
        }
    }

    pub fn seek(&mut self, secs: f64) {
        if !secs.is_finite() || secs < 0.0 {
            return;
        }
        if let Err(e) = self.player.try_seek(Duration::from_secs_f64(secs)) {
            // seek 失败（如 source 不支持随机访问）会由 get_position 校准把前端进度拉回；
            // 记录日志便于定位（Decode 侧已用 with_seekable(true)+byte_len 尽量保证可回溯）。
            log::warn!("[audio] seek to {secs}s failed: {e:?}");
        }
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.player.set_volume(volume.clamp(0.0, 1.0));
    }

    pub fn stop(&mut self) {
        self.player.stop();
        self.player.clear();
        self.status = AudioStatus::Idle;
    }

    pub fn get_pos(&self) -> Duration {
        self.player.get_pos()
    }

    /// 队列是否已空（当前曲目播放完毕）—— 上层据此判断 ended。
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.player.empty()
    }

    /// 当前曲目时长（来自 NCM 元数据，未知则为 None）。
    pub fn duration(&self) -> Option<Duration> {
        self.duration
    }

    pub fn status(&self) -> AudioStatus {
        self.status
    }

    #[allow(dead_code)]
    pub fn load_seq(&self) -> u64 {
        self.load_seq
    }

    /// 未来状态机阶段的预留入口（当前 ended/暂停改走 `pause()` 真正停 rodio）。
    #[allow(dead_code)]
    pub fn set_status(&mut self, status: AudioStatus) {
        self.status = status;
    }
}
