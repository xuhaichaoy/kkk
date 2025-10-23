use std::{
    fs,
    fs::File,
    io::{self, Cursor, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::Local;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{async_runtime, AppHandle};
use tauri::{Emitter, Manager};
use thiserror::Error;
use uuid::Uuid;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=1";
const MODEL_FILENAME: &str = "ggml-small.bin";
const BUNDLED_MODEL_RELATIVE_PATH: &str = "models/ggml-small.bin";
const MODEL_PROGRESS_EVENT: &str = "speech://model-progress";
const MODEL_STATUS_EVENT: &str = "speech://model-status";

pub struct SpeechManager {
    base_dir: PathBuf,
    model_path: PathBuf,
    sessions_dir: PathBuf,
    sessions_file: PathBuf,
    state: Arc<async_runtime::Mutex<SpeechState>>,
    http: Client,
}

struct SpeechState {
    sessions: Vec<SpeechSession>,
    active_transcription: Option<ActiveTranscription>,
}

struct ActiveTranscription {
    cancel_flag: Arc<AtomicBool>,
}

impl ActiveTranscription {
    fn new(cancel_flag: Arc<AtomicBool>) -> Self {
        Self { cancel_flag }
    }

    fn cancel(&self) {
        self.cancel_flag.store(true, Ordering::Relaxed);
    }
}

struct ActiveTranscriptionHandle {
    state: Arc<async_runtime::Mutex<SpeechState>>,
    released: bool,
}

impl ActiveTranscriptionHandle {
    async fn acquire(
        state: Arc<async_runtime::Mutex<SpeechState>>,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<Self, SpeechError> {
        {
            let mut guard = state.lock().await;
            if guard.active_transcription.is_some() {
                return Err(SpeechError::TranscriptionInProgress);
            }
            guard.active_transcription = Some(ActiveTranscription::new(cancel_flag));
        }
        Ok(Self {
            state: state.clone(),
            released: false,
        })
    }

    async fn release(&mut self) {
        if self.released {
            return;
        }
        let mut guard = self.state.lock().await;
        guard.active_transcription = None;
        self.released = true;
    }
}

impl Drop for ActiveTranscriptionHandle {
    fn drop(&mut self) {
        if self.released {
            return;
        }
        let state = self.state.clone();
        async_runtime::spawn(async move {
            let mut guard = state.lock().await;
            guard.active_transcription = None;
        });
    }
}

#[derive(Debug, Error)]
pub enum SpeechError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("audio error: {0}")]
    Audio(String),
    #[error("whisper error: {0}")]
    Whisper(String),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("task join error: {0}")]
    Join(String),
    #[error("unsupported bit depth {0}")]
    UnsupportedBitDepth(u16),
    #[error("unsupported language {0}")]
    UnsupportedLanguage(String),
    #[error("模型路径包含非法字符")]
    InvalidModelPath,
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("未找到指定的转写记录：{0}")]
    SessionNotFound(String),
    #[error("已有转写任务正在进行")]
    TranscriptionInProgress,
    #[error("转写已取消")]
    TranscriptionCancelled,
}

impl From<hound::Error> for SpeechError {
    fn from(value: hound::Error) -> Self {
        Self::Audio(value.to_string())
    }
}

impl From<whisper_rs::WhisperError> for SpeechError {
    fn from(value: whisper_rs::WhisperError) -> Self {
        Self::Whisper(value.to_string())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SpeechLanguage {
    #[serde(rename = "en")]
    English,
    #[serde(rename = "zh")]
    Chinese,
}

impl SpeechLanguage {
    pub fn code(&self) -> &'static str {
        match self {
            SpeechLanguage::English => "en",
            SpeechLanguage::Chinese => "zh",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            SpeechLanguage::English => "英语",
            SpeechLanguage::Chinese => "中文",
        }
    }
}

impl TryFrom<&str> for SpeechLanguage {
    type Error = SpeechError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "en" | "english" => Ok(SpeechLanguage::English),
            "zh" | "zh-cn" | "chinese" | "zh-hans" => Ok(SpeechLanguage::Chinese),
            other => Err(SpeechError::UnsupportedLanguage(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechSession {
    pub id: String,
    pub title: String,
    pub language: SpeechLanguage,
    pub transcript: String,
    pub segments: Vec<TranscriptSegment>,
    pub audio_path: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechSessionBackup {
    pub id: String,
    pub title: String,
    pub language: SpeechLanguage,
    pub transcript: String,
    pub segments: Vec<TranscriptSegment>,
    pub created_at: String,
    pub audio_filename: String,
    pub audio_base64: String,
}

#[derive(Debug, Serialize)]
pub struct ModelStatusResponse {
    pub ready: bool,
    pub downloaded: bool,
    pub model_path: Option<String>,
}

impl ModelStatusResponse {
    fn ready(path: &Path, downloaded: bool) -> Self {
        Self {
            ready: true,
            downloaded,
            model_path: Some(path.to_string_lossy().into_owned()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ModelDownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelStatusKind {
    Exists,
    Downloading,
    Finished,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelStatusEvent {
    pub status: ModelStatusKind,
    pub model_path: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TranscribeAudioPayload {
    pub audio_base64: String,
    pub language: String,
    #[serde(default)]
    pub session_title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TranscribeAudioResponse {
    pub session: SpeechSession,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSpeechSessionPayload {
    pub session_id: String,
    #[serde(default)]
    pub transcript: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
}

struct TranscriptionResult {
    transcript: String,
    segments: Vec<TranscriptSegment>,
}

impl SpeechManager {
    pub fn new(app: &AppHandle) -> Result<Self, SpeechError> {
        let base_dir = app.path().app_local_data_dir()?;
        let base_dir = base_dir.join("speech");
        fs::create_dir_all(&base_dir)?;

        let model_path = base_dir.join(MODEL_FILENAME);
        let sessions_dir = base_dir.join("sessions");
        fs::create_dir_all(&sessions_dir)?;

        let sessions_file = base_dir.join("sessions.json");
        let sessions = if sessions_file.exists() {
            let content = fs::read(&sessions_file)?;
            serde_json::from_slice::<Vec<SpeechSession>>(&content)?
        } else {
            Vec::new()
        };

        if !sessions_file.exists() {
            fs::write(&sessions_file, b"[]")?;
        }

        Ok(Self {
            base_dir,
            model_path,
            sessions_dir,
            sessions_file,
            state: Arc::new(async_runtime::Mutex::new(SpeechState {
                sessions,
                active_transcription: None,
            })),
            http: Client::new(),
        })
    }

    pub async fn ensure_model(&self, app: &AppHandle) -> Result<ModelStatusResponse, SpeechError> {
        if self.model_path.exists() {
            let event = ModelStatusEvent {
                status: ModelStatusKind::Exists,
                model_path: Some(self.model_path.to_string_lossy().into_owned()),
                message: None,
            };
            let _ = app.emit(MODEL_STATUS_EVENT, event);
            return Ok(ModelStatusResponse::ready(&self.model_path, false));
        }

        if let Some(parent) = self.model_path.parent() {
            fs::create_dir_all(parent)?;
        }

        if self.try_copy_bundled_model(app)? {
            let finish_event = ModelStatusEvent {
                status: ModelStatusKind::Finished,
                model_path: Some(self.model_path.to_string_lossy().into_owned()),
                message: Some("使用内置模型".into()),
            };
            let _ = app.emit(MODEL_STATUS_EVENT, finish_event);
            return Ok(ModelStatusResponse::ready(&self.model_path, false));
        }

        let start_event = ModelStatusEvent {
            status: ModelStatusKind::Downloading,
            model_path: Some(self.model_path.to_string_lossy().into_owned()),
            message: None,
        };
        let _ = app.emit(MODEL_STATUS_EVENT, start_event);

        match self.download_model(app).await {
            Ok(()) => {
                let finish_event = ModelStatusEvent {
                    status: ModelStatusKind::Finished,
                    model_path: Some(self.model_path.to_string_lossy().into_owned()),
                    message: None,
                };
                let _ = app.emit(MODEL_STATUS_EVENT, finish_event);
                Ok(ModelStatusResponse::ready(&self.model_path, true))
            }
            Err(err) => {
                let _ = app.emit(
                    MODEL_STATUS_EVENT,
                    ModelStatusEvent {
                        status: ModelStatusKind::Failed,
                        model_path: Some(self.model_path.to_string_lossy().into_owned()),
                        message: Some(err.to_string()),
                    },
                );
                if self.model_path.exists() {
                    let _ = fs::remove_file(&self.model_path);
                }
                Err(err)
            }
        }
    }

    fn try_copy_bundled_model(&self, app: &AppHandle) -> Result<bool, SpeechError> {
        let mut candidate_files: Vec<PathBuf> = Vec::new();

        if let Ok(resource_dir) = app.path().resource_dir() {
            let search_dirs = [
                resource_dir.clone(),
                resource_dir.join("resources"),
                resource_dir.join("Resources"),
                resource_dir.join("../resources"),
                resource_dir.join("../Resources"),
            ];

            for dir in search_dirs {
                candidate_files.push(dir.join(BUNDLED_MODEL_RELATIVE_PATH));
            }
        }

        if let Some(manifest_dir) = option_env!("CARGO_MANIFEST_DIR") {
            candidate_files.push(
                Path::new(manifest_dir)
                    .join("resources")
                    .join(BUNDLED_MODEL_RELATIVE_PATH),
            );
        }

        candidate_files.push(Path::new("resources").join(BUNDLED_MODEL_RELATIVE_PATH));
        candidate_files.push(
            Path::new("src-tauri")
                .join("resources")
                .join(BUNDLED_MODEL_RELATIVE_PATH),
        );

        for candidate in candidate_files {
            if candidate.exists() {
                fs::copy(&candidate, &self.model_path)?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    async fn download_model(&self, app: &AppHandle) -> Result<(), SpeechError> {
        let response = self.http.get(MODEL_URL).send().await?;
        if !response.status().is_success() {
            return Err(SpeechError::Audio(format!(
                "模型下载失败，状态码 {}",
                response.status()
            )));
        }

        let total = response.content_length();
        let mut file = File::create(&self.model_path)?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk)?;
            downloaded += chunk.len() as u64;
            let progress = ModelDownloadProgress {
                downloaded_bytes: downloaded,
                total_bytes: total,
            };
            let _ = app.emit(MODEL_PROGRESS_EVENT, &progress);
        }

        file.flush()?;

        Ok(())
    }

    pub async fn list_sessions(&self) -> Vec<SpeechSession> {
        let guard = self.state.lock().await;
        guard.sessions.clone()
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<(), SpeechError> {
        let mut guard = self.state.lock().await;
        if let Some(index) = guard
            .sessions
            .iter()
            .position(|session| session.id == session_id)
        {
            let session = guard.sessions.remove(index);
            self.persist_sessions(&guard.sessions)?;
            let session_dir = self.sessions_dir.join(session.id);
            if session_dir.exists() {
                fs::remove_dir_all(session_dir)?;
            }
        }
        Ok(())
    }

    pub async fn update_session(
        &self,
        payload: UpdateSpeechSessionPayload,
    ) -> Result<SpeechSession, SpeechError> {
        let UpdateSpeechSessionPayload {
            session_id,
            transcript,
            title,
        } = payload;

        let mut guard = self.state.lock().await;
        let session = guard
            .sessions
            .iter_mut()
            .find(|session| session.id == session_id)
            .ok_or_else(|| SpeechError::SessionNotFound(session_id.clone()))?;

        if let Some(title) = title {
            let trimmed = title.trim();
            if !trimmed.is_empty() {
                session.title = trimmed.to_string();
            }
        }

        if let Some(transcript) = transcript {
            session.transcript = transcript.clone();
            let transcript_path = self.sessions_dir.join(&session.id).join("transcript.txt");
            fs::write(&transcript_path, transcript.as_bytes())?;
        }

        let result = session.clone();
        self.persist_sessions(&guard.sessions)?;
        Ok(result)
    }

    pub async fn cancel_transcription(&self) -> bool {
        let guard = self.state.lock().await;
        if let Some(active) = guard.active_transcription.as_ref() {
            active.cancel();
            true
        } else {
            false
        }
    }

    pub async fn transcribe_audio(
        &self,
        payload: TranscribeAudioPayload,
    ) -> Result<SpeechSession, SpeechError> {
        let language = SpeechLanguage::try_from(payload.language.as_str())?;
        let audio_bytes = decode_audio_base64(&payload.audio_base64)?;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let mut active_guard =
            ActiveTranscriptionHandle::acquire(self.state.clone(), cancel_flag.clone()).await?;
        let session_id = Uuid::new_v4().to_string();
        let session_dir = self.sessions_dir.join(&session_id);
        if let Err(err) = fs::create_dir_all(&session_dir) {
            active_guard.release().await;
            return Err(err.into());
        }

        let audio_relative_path = format!("sessions/{}/recording.wav", session_id);
        let audio_path = self.base_dir.join(&audio_relative_path);
        if let Some(parent) = audio_path.parent() {
            if let Err(err) = fs::create_dir_all(parent) {
                active_guard.release().await;
                let _ = fs::remove_dir_all(&session_dir);
                return Err(err.into());
            }
        }
        if let Err(err) = fs::write(&audio_path, &audio_bytes) {
            active_guard.release().await;
            let _ = fs::remove_dir_all(&session_dir);
            return Err(err.into());
        }

        let model_path = self.model_path.clone();
        let title_override = payload.session_title.clone();
        let audio_for_transcription = audio_bytes;

        let transcription_result = match async_runtime::spawn_blocking({
            let cancel_flag = cancel_flag.clone();
            move || {
                transcribe_blocking(&model_path, &audio_for_transcription, language, cancel_flag)
            }
        })
        .await
        {
            Ok(result) => result,
            Err(err) => {
                active_guard.release().await;
                let _ = fs::remove_dir_all(&session_dir);
                return Err(SpeechError::Join(err.to_string()));
            }
        };

        let transcription = match transcription_result {
            Ok(result) => {
                active_guard.release().await;
                result
            }
            Err(err) => {
                active_guard.release().await;
                let _ = fs::remove_dir_all(&session_dir);
                return Err(err);
            }
        };

        let timestamp = Local::now();
        let default_title = format!(
            "{}转写 {}",
            language.display_name(),
            timestamp.format("%H:%M:%S")
        );
        let title = title_override
            .filter(|t| !t.trim().is_empty())
            .unwrap_or(default_title);

        let transcript_path = session_dir.join("transcript.txt");
        fs::write(&transcript_path, transcription.transcript.as_bytes())?;

        let segments_path = session_dir.join("segments.json");
        fs::write(
            &segments_path,
            serde_json::to_vec_pretty(&transcription.segments)?,
        )?;

        let session = SpeechSession {
            id: session_id.clone(),
            title,
            language,
            transcript: transcription.transcript,
            segments: transcription.segments,
            audio_path: audio_relative_path,
            created_at: timestamp.to_rfc3339(),
        };

        {
            let mut guard = self.state.lock().await;
            guard.sessions.insert(0, session.clone());
            self.persist_sessions(&guard.sessions)?;
        }

        Ok(session)
    }

    fn persist_sessions(&self, sessions: &[SpeechSession]) -> Result<(), SpeechError> {
        let json = serde_json::to_vec_pretty(sessions)?;
        fs::write(&self.sessions_file, json)?;
        Ok(())
    }

    pub async fn export_sessions_data(&self) -> Result<Vec<SpeechSessionBackup>, SpeechError> {
        let guard = self.state.lock().await;
        let mut exported = Vec::with_capacity(guard.sessions.len());
        for session in &guard.sessions {
            let audio_path = self.base_dir.join(&session.audio_path);
            let audio_bytes = fs::read(&audio_path)?;
            let filename = Path::new(&session.audio_path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("recording.wav")
                .to_string();
            let mime = if filename.to_lowercase().ends_with(".wav") {
                "audio/wav"
            } else {
                "application/octet-stream"
            };
            let audio_base64 =
                format!("data:{mime};base64,{}", BASE64_STANDARD.encode(&audio_bytes));

            exported.push(SpeechSessionBackup {
                id: session.id.clone(),
                title: session.title.clone(),
                language: session.language,
                transcript: session.transcript.clone(),
                segments: session.segments.clone(),
                created_at: session.created_at.clone(),
                audio_filename: filename,
                audio_base64,
            });
        }
        Ok(exported)
    }

    pub async fn import_sessions_data(
        &self,
        sessions: Vec<SpeechSessionBackup>,
    ) -> Result<usize, SpeechError> {
        if sessions.is_empty() {
            return Ok(0);
        }

        let mut guard = self.state.lock().await;
        let mut imported = 0usize;

        for backup in sessions {
            let audio_bytes = decode_audio_base64(&backup.audio_base64)?;
            let sanitized_filename = sanitize_audio_filename(&backup.audio_filename);
            let session_dir = self.sessions_dir.join(&backup.id);

            if session_dir.exists() {
                fs::remove_dir_all(&session_dir)?;
            }
            fs::create_dir_all(&session_dir)?;

            let audio_path = session_dir.join(&sanitized_filename);
            fs::write(&audio_path, &audio_bytes)?;
            fs::write(session_dir.join("transcript.txt"), backup.transcript.as_bytes())?;
            fs::write(
                session_dir.join("segments.json"),
                serde_json::to_vec_pretty(&backup.segments)?,
            )?;

            let audio_rel_path = format!("sessions/{}/{}", backup.id, sanitized_filename);
            let session = SpeechSession {
                id: backup.id.clone(),
                title: backup.title.clone(),
                language: backup.language,
                transcript: backup.transcript.clone(),
                segments: backup.segments.clone(),
                audio_path: audio_rel_path,
                created_at: backup.created_at.clone(),
            };

            if let Some(pos) = guard.sessions.iter().position(|s| s.id == session.id) {
                guard.sessions.remove(pos);
            }
            guard.sessions.push(session);
            imported += 1;
        }

        guard
            .sessions
            .sort_by(|a, b| b.created_at.cmp(&a.created_at));
        self.persist_sessions(&guard.sessions)?;
        Ok(imported)
    }
}

fn decode_audio_base64(data: &str) -> Result<Vec<u8>, SpeechError> {
    let trimmed = if let Some((_, rest)) = data.split_once(",") {
        rest
    } else {
        data
    };
    BASE64_STANDARD
        .decode(trimmed)
        .map_err(|err| SpeechError::Audio(format!("Base64 decode failed: {err}")))
}

fn transcribe_blocking(
    model_path: &Path,
    audio_bytes: &[u8],
    language: SpeechLanguage,
    cancel_flag: Arc<AtomicBool>,
) -> Result<TranscriptionResult, SpeechError> {
    let (samples, sample_rate) = decode_wav_to_mono_f32(audio_bytes)?;
    let audio = if sample_rate != 16_000 {
        resample_audio(&samples, sample_rate, 16_000)
    } else {
        samples
    };

    let model_str = model_path.to_str().ok_or(SpeechError::InvalidModelPath)?;
    let ctx_params = WhisperContextParameters::default();
    let ctx = WhisperContext::new_with_params(model_str, ctx_params)?;
    let mut state = ctx.create_state()?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some(language.code()));
    params.set_translate(false);
    params.set_n_threads(num_cpus::get() as i32);
    params.set_no_context(true);

    if language == SpeechLanguage::Chinese {
        params.set_initial_prompt("以下是简体中文普通话的句子。");
    }

    let cancel_for_callback = cancel_flag.clone();
    let callback: Box<dyn FnMut() -> bool> = Box::new(move || -> bool {
        cancel_for_callback.load(Ordering::Relaxed)
    });
    params.set_abort_callback_safe::<Option<Box<dyn FnMut() -> bool>>, Box<dyn FnMut() -> bool>>(
        Some(callback),
    );
    match state.full(params, &audio) {
        Ok(_) => {}
        Err(err) => {
            if cancel_flag.load(Ordering::Relaxed) {
                return Err(SpeechError::TranscriptionCancelled);
            }
            return Err(err.into());
        }
    }

    let mut transcript = String::new();
    let mut segments = Vec::new();
    let num_segments = state.full_n_segments();
    for i in 0..num_segments {
        if let Some(segment) = state.get_segment(i) {
            let text_value = segment.to_str_lossy()?.trim().to_string();
            if !text_value.is_empty() {
                if !transcript.is_empty() {
                    transcript.push('\n');
                }
                transcript.push_str(&text_value);
            }

            let start = segment.start_timestamp() as f32 / 100.0;
            let end = segment.end_timestamp() as f32 / 100.0;
            segments.push(TranscriptSegment {
                start,
                end,
                text: text_value,
            });
        }
    }

    Ok(TranscriptionResult {
        transcript,
        segments,
    })
}

fn decode_wav_to_mono_f32(audio_bytes: &[u8]) -> Result<(Vec<f32>, u32), SpeechError> {
    let cursor = Cursor::new(audio_bytes);
    let mut reader = hound::WavReader::new(cursor)?;
    let spec = reader.spec();
    let channels = spec.channels as usize;
    if channels == 0 {
        return Err(SpeechError::Audio("音频通道数无效".into()));
    }

    let sample_rate = spec.sample_rate;

    let mono = match spec.sample_format {
        hound::SampleFormat::Float => {
            let samples: Vec<f32> = reader
                .samples::<f32>()
                .map(|s| s.map_err(|e| SpeechError::Audio(e.to_string())))
                .collect::<Result<_, _>>()?;
            if channels == 1 {
                samples
            } else {
                samples
                    .chunks(channels)
                    .map(|chunk| chunk.iter().copied().sum::<f32>() / channels as f32)
                    .collect()
            }
        }
        hound::SampleFormat::Int => match spec.bits_per_sample {
            8 => {
                let samples: Vec<i8> = reader
                    .samples::<i8>()
                    .map(|s| s.map_err(|e| SpeechError::Audio(e.to_string())))
                    .collect::<Result<_, _>>()?;
                let floats: Vec<f32> = samples.iter().map(|v| *v as f32 / i8::MAX as f32).collect();
                reduce_channels(&floats, channels)
            }
            16 => {
                let samples: Vec<i16> = reader
                    .samples::<i16>()
                    .map(|s| s.map_err(|e| SpeechError::Audio(e.to_string())))
                    .collect::<Result<_, _>>()?;
                let floats: Vec<f32> = samples
                    .iter()
                    .map(|v| *v as f32 / i16::MAX as f32)
                    .collect();
                reduce_channels(&floats, channels)
            }
            24 | 32 => {
                let samples: Vec<i32> = reader
                    .samples::<i32>()
                    .map(|s| s.map_err(|e| SpeechError::Audio(e.to_string())))
                    .collect::<Result<_, _>>()?;
                let scale = 2_i32.pow(spec.bits_per_sample as u32 - 1) as f32;
                let floats: Vec<f32> = samples.iter().map(|v| *v as f32 / scale).collect();
                reduce_channels(&floats, channels)
            }
            bits => return Err(SpeechError::UnsupportedBitDepth(bits)),
        },
    };

    Ok((mono, sample_rate))
}

fn reduce_channels(samples: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return samples.to_vec();
    }
    samples
        .chunks(channels)
        .map(|chunk| chunk.iter().copied().sum::<f32>() / channels as f32)
        .collect()
}

fn resample_audio(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if samples.is_empty() || from_rate == to_rate {
        return samples.to_vec();
    }

    let ratio = from_rate as f64 / to_rate as f64;
    let target_len = (samples.len() as f64 / ratio).round() as usize;
    let mut output = Vec::with_capacity(target_len);
    for i in 0..target_len {
        let src_pos = i as f64 * ratio;
        let src_idx = src_pos.floor() as usize;
        if src_idx >= samples.len() {
            break;
        }
        let next_idx = (src_idx + 1).min(samples.len() - 1);
        let frac = (src_pos - src_idx as f64) as f32;
        let s0 = samples[src_idx];
        let s1 = samples[next_idx];
        output.push(s0 + (s1 - s0) * frac);
    }
    output
}

fn sanitize_audio_filename(input: &str) -> String {
    let fallback = "recording.wav";
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return fallback.to_string();
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return fallback.to_string();
    }
    let candidate = Path::new(trimmed)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(fallback)
        .to_string();
    if candidate.is_empty() {
        fallback.to_string()
    } else {
        candidate
    }
}

#[tauri::command]
pub async fn ensure_speech_model(
    state: tauri::State<'_, SpeechManager>,
    app: AppHandle,
) -> Result<ModelStatusResponse, String> {
    state.ensure_model(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_speech_sessions(
    state: tauri::State<'_, SpeechManager>,
) -> Result<Vec<SpeechSession>, String> {
    Ok(state.list_sessions().await)
}

#[tauri::command]
pub async fn delete_speech_session(
    state: tauri::State<'_, SpeechManager>,
    session_id: String,
) -> Result<(), String> {
    state
        .delete_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_speech_session(
    state: tauri::State<'_, SpeechManager>,
    payload: UpdateSpeechSessionPayload,
) -> Result<SpeechSession, String> {
    state
        .update_session(payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn transcribe_audio(
    state: tauri::State<'_, SpeechManager>,
    payload: TranscribeAudioPayload,
) -> Result<TranscribeAudioResponse, String> {
    state
        .transcribe_audio(payload)
        .await
        .map(|session| TranscribeAudioResponse { session })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_transcription(state: tauri::State<'_, SpeechManager>) -> Result<bool, String> {
    Ok(state.cancel_transcription().await)
}

#[tauri::command]
pub async fn open_speech_session_folder(
    state: tauri::State<'_, SpeechManager>,
    session_id: String,
) -> Result<(), String> {
    let session_dir = state.sessions_dir.join(&session_id);

    if !session_dir.exists() {
        return Err(format!("会话文件夹不存在: {}", session_id));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(session_dir)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(session_dir)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(session_dir)
            .spawn()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn export_speech_sessions(
    state: tauri::State<'_, SpeechManager>,
) -> Result<Vec<SpeechSessionBackup>, String> {
    state
        .export_sessions_data()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_speech_sessions(
    state: tauri::State<'_, SpeechManager>,
    sessions: Vec<SpeechSessionBackup>,
) -> Result<usize, String> {
    state
        .import_sessions_data(sessions)
        .await
        .map_err(|e| e.to_string())
}
