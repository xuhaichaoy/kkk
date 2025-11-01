import React from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';

import RecorderControls from '../components/speech/RecorderControls';
import TranscriptView from '../components/speech/TranscriptView';
import SessionHistory from '../components/speech/SessionHistory';
import { PageHeader, CardContainer } from '../components/common';
import { useStatusBar } from '../components/common/StatusBar';
import { blobTo16kWavBase64 } from '../utils/audioUtils';
import { SPEECH_SUPPORTED } from '../utils/platform';
import type {
  ModelDownloadProgress,
  ModelStatusEvent,
  ModelStatusResponse,
  SpeechLanguage,
  SpeechSession,
  TranscribeAudioResponse,
  TranscriptSegment,
} from '../types/speech';

const SpeechToTextPage: React.FC = () => {
  if (!SPEECH_SUPPORTED) {
    return (
      <Box
        sx={{
          maxWidth: '600px',
          margin: '0 auto',
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Alert
          severity="info"
          sx={{
            borderRadius: 2,
            borderLeft: '4px solid',
            borderLeftColor: 'info.main',
            boxShadow: 1,
          }}
        >
          当前 Windows 版本已移除语音识别功能。
        </Alert>
      </Box>
    );
  }
  const [language, setLanguage] = React.useState<SpeechLanguage>('zh');
  const [isRecording, setIsRecording] = React.useState(false);
  const [modelReady, setModelReady] = React.useState(false);
  const [modelProgress, setModelProgress] = React.useState<ModelDownloadProgress | null>(null);
  const [transcribing, setTranscribing] = React.useState(false);
  const [ensuringModel, setEnsuringModel] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manualModelMessage, setManualModelMessage] = React.useState<string | null>(null);
  const [manualModelPath, setManualModelPath] = React.useState<string | null>(null);
  const [transcriptDraft, setTranscriptDraft] = React.useState('');
  const [segments, setSegments] = React.useState<TranscriptSegment[]>([]);
  const [sessions, setSessions] = React.useState<SpeechSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [currentSession, setCurrentSession] = React.useState<SpeechSession | null>(null);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [transcriptionDuration, setTranscriptionDuration] = React.useState(0);
  const [lastTranscriptionDuration, setLastTranscriptionDuration] = React.useState<number | null>(null);
  const [isSavingTranscript, setIsSavingTranscript] = React.useState(false);
  const [audioSrc, setAudioSrc] = React.useState<string | null>(null);
  const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recordingLanguageRef = React.useRef<SpeechLanguage>('zh');
  const chunkRef = React.useRef<Blob[]>([]);
  const selectedSessionIdRef = React.useRef<string | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const dataArrayRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const recordingStartRef = React.useRef<number | null>(null);
  const audioLoadIdRef = React.useRef(0);
  const audioUrlRef = React.useRef<string | null>(null);
  const transcriptionStartRef = React.useRef<number | null>(null);
  const transcriptionRafRef = React.useRef<number | null>(null);
  const transcriptionCancelledRef = React.useRef(false);
  const { setStatus, resetStatus } = useStatusBar();

  const stopMonitoring = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (recordingStartRef.current !== null) {
      setRecordingDuration((performance.now() - recordingStartRef.current) / 1000);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        /* ignore */
      });
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    recordingStartRef.current = null;
    setAudioLevel(0);
  }, []);

  const startMonitoring = React.useCallback(
    (stream: MediaStream) => {
      stopMonitoring();

      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        const dataArray = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        dataArrayRef.current = dataArray;
        source.connect(analyser);
        recordingStartRef.current = performance.now();
        setRecordingDuration(0);

        const update = () => {
          const analyserNode = analyserRef.current;
          const buffer = dataArrayRef.current;
          if (!analyserNode || !buffer) {
            return;
          }
          analyserNode.getByteTimeDomainData(buffer);
          let sumSquares = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const normalized = (buffer[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / buffer.length);
          const scaledLevel = Math.min(1, rms * 1.5);
          setAudioLevel(scaledLevel);
          if (recordingStartRef.current !== null) {
            setRecordingDuration((performance.now() - recordingStartRef.current) / 1000);
          }
          rafRef.current = requestAnimationFrame(update);
        };

        update();
      } catch (err) {
        console.error(err);
        stopMonitoring();
      }
    },
    [stopMonitoring],
  );

  const resetTranscriptionTimer = React.useCallback(() => {
    if (transcriptionRafRef.current !== null) {
      cancelAnimationFrame(transcriptionRafRef.current);
      transcriptionRafRef.current = null;
    }
    transcriptionStartRef.current = null;
    setTranscriptionDuration(0);
  }, []);

  const startTranscriptionTimer = React.useCallback(() => {
    resetTranscriptionTimer();
    transcriptionStartRef.current = performance.now();

    const update = () => {
      if (transcriptionStartRef.current === null) {
        return;
      }
      setTranscriptionDuration((performance.now() - transcriptionStartRef.current) / 1000);
      transcriptionRafRef.current = requestAnimationFrame(update);
    };

    update();
  }, [resetTranscriptionTimer]);

  const stopTranscriptionTimer = React.useCallback(() => {
    if (transcriptionRafRef.current !== null) {
      cancelAnimationFrame(transcriptionRafRef.current);
      transcriptionRafRef.current = null;
    }
    if (transcriptionStartRef.current !== null) {
      const elapsed = (performance.now() - transcriptionStartRef.current) / 1000;
      transcriptionStartRef.current = null;
      setTranscriptionDuration(elapsed);
      setLastTranscriptionDuration(elapsed);
    }
  }, []);

  const beginTranscription = React.useCallback(() => {
    transcriptionCancelledRef.current = false;
    setError(null);
    setTranscribing(true);
    startTranscriptionTimer();
  }, [startTranscriptionTimer]);

  const finalizeTranscription = React.useCallback(
    (options?: { preserveDuration?: boolean }) => {
      const preserve = options?.preserveDuration ?? true;
      if (preserve) {
        stopTranscriptionTimer();
      } else {
        resetTranscriptionTimer();
        setLastTranscriptionDuration(null);
      }
      setTranscribing(false);
    },
    [resetTranscriptionTimer, stopTranscriptionTimer],
  );

  const getErrorMessage = React.useCallback((value: unknown) => {
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && 'message' in value) {
      const message = (value as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
    return '';
  }, []);

  const prepareAudioSource = React.useCallback(async (session: SpeechSession | null) => {
    audioLoadIdRef.current += 1;
    const loadId = audioLoadIdRef.current;

    setAudioSrc(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    if (!session?.audio_path) {
      return;
    }

    try {
      const bytes = await readFile(`speech/${session.audio_path}`, {
        baseDir: BaseDirectory.AppLocalData,
      });
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const objectUrl = URL.createObjectURL(blob);
      if (audioLoadIdRef.current === loadId) {
        audioUrlRef.current = objectUrl;
        setAudioSrc(objectUrl);
      } else {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.error(err);
      if (audioLoadIdRef.current === loadId) {
        setAudioSrc(null);
      }
    }
  }, []);

  const applySession = React.useCallback((session: SpeechSession | null) => {
    selectedSessionIdRef.current = session?.id ?? null;
    setSelectedSessionId(session?.id ?? null);
    setCurrentSession(session);
    setTranscriptDraft(session?.transcript ?? '');
    setSegments(session?.segments ?? []);
    void prepareAudioSource(session);
  }, [prepareAudioSource]);

  const loadSessions = React.useCallback(async (preferredId?: string | null) => {
    try {
      const list = await invoke<SpeechSession[]>('list_speech_sessions');
      setSessions(list);
      if (list.length === 0) {
        applySession(null);
        return;
      }

      const targetId = preferredId ?? selectedSessionIdRef.current;
      if (targetId) {
        const existing = list.find(item => item.id === targetId);
        if (existing) {
          applySession(existing);
          return;
        }
      }

      applySession(list[0]);
    } catch (invokeError) {
      console.error(invokeError);
      setError('加载转写历史失败，请稍后重试。');
    }
  }, [applySession]);

  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    let timeout: number | undefined;

    if (error) {
      setStatus(() => ({
        message: error,
        severity: 'error',
      }));
    } else if (modelProgress) {
      const total = modelProgress.total_bytes ?? 0;
      const percent =
        total > 0 ? Math.min(100, Math.round((modelProgress.downloaded_bytes / total) * 100)) : null;
      const downloadedMb = modelProgress.downloaded_bytes / (1024 * 1024);
      setStatus(() => ({
        message: '正在下载语音模型',
        detail:
          percent !== null
            ? `下载进度 ${percent}%`
            : `已下载 ${downloadedMb.toFixed(1)} MB`,
        severity: 'info',
        progress: percent ?? null,
      }));
    } else if (ensuringModel && !modelReady) {
      setStatus(() => ({
        message: '正在检查语音模型',
        severity: 'info',
      }));
    } else if (transcribing) {
      setStatus(() => ({
        message: '正在转写录音',
        severity: 'info',
      }));
    } else if (isRecording) {
      setStatus(() => ({
        message: '正在录音',
        severity: 'info',
      }));
    } else if (modelReady) {
      setStatus(() => ({
        message: '语音模型已就绪',
        severity: 'success',
      }));
      timeout = window.setTimeout(() => {
        resetStatus();
      }, 3200);
    } else if (manualModelMessage) {
      setStatus(() => ({
        message: manualModelMessage,
        detail: manualModelPath ? `模型目标路径：${manualModelPath}` : undefined,
        severity: 'info',
      }));
    } else {
      resetStatus();
    }

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [
    ensuringModel,
    error,
    isRecording,
    manualModelMessage,
    manualModelPath,
    modelProgress,
    modelReady,
    resetStatus,
    setStatus,
    transcribing,
  ]);

  const ensureModel = React.useCallback(async () => {
    setEnsuringModel(true);
    setError(null);
    try {
      const status = await invoke<ModelStatusResponse>('ensure_speech_model');
      if (!isMountedRef.current) {
        return;
      }
      if (status.ready) {
        setModelReady(true);
        setManualModelMessage(null);
        setManualModelPath(null);
      } else if (status.model_path) {
        setManualModelPath(status.model_path);
      }
    } catch (invokeError) {
      console.error(invokeError);
      if (isMountedRef.current) {
        setError('加载识别模型失败，请检查网络。');
      }
    } finally {
      if (isMountedRef.current) {
        setEnsuringModel(false);
        void loadSessions();
      }
    }
  }, [loadSessions]);

  React.useEffect(() => {
    const unlisten: UnlistenFn[] = [];
    isMountedRef.current = true;

    const registerListeners = async () => {
      const progressListener = await listen<ModelDownloadProgress>('speech://model-progress', event => {
        if (!isMountedRef.current) {
          return;
        }
        setModelProgress(event.payload);
      });
      unlisten.push(progressListener);

      const statusListener = await listen<ModelStatusEvent>('speech://model-status', event => {
        if (!isMountedRef.current) {
          return;
        }
        const payload = event.payload;
        if (payload.status === 'finished' || payload.status === 'exists') {
          setModelReady(true);
          setModelProgress(null);
          setManualModelMessage(null);
          setManualModelPath(null);
        } else if (payload.status === 'downloading') {
          setModelReady(false);
          setManualModelMessage(null);
          setManualModelPath(null);
        } else if (payload.status === 'manual_copy_required') {
          setModelReady(false);
          setModelProgress(null);
          setManualModelMessage(
            payload.message ?? '当前版本未内置语音模型，请手动复制模型文件后重试。',
          );
          if (payload.model_path) {
            setManualModelPath(payload.model_path);
          }
        } else if (payload.status === 'failed') {
          setModelReady(false);
          setManualModelMessage(null);
          setManualModelPath(null);
          setError(payload.message ?? '模型下载失败，请检查网络后重试。');
        }
      });
      unlisten.push(statusListener);
    };

    void registerListeners().then(() => {
      void ensureModel();
    });

    return () => {
      isMountedRef.current = false;
      unlisten.forEach(disposer => {
        disposer();
      });
      if (transcriptionRafRef.current !== null) {
        cancelAnimationFrame(transcriptionRafRef.current);
        transcriptionRafRef.current = null;
      }
      transcriptionStartRef.current = null;
      stopMonitoring();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [ensureModel, stopMonitoring]);

  const resetRecordingState = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunkRef.current = [];
    setIsRecording(false);
    stopMonitoring();
    setRecordingDuration(0);
  }, [stopMonitoring]);

  const processRecording = React.useCallback(
    async (blob: Blob, selectedLanguage: SpeechLanguage) => {
      beginTranscription();
      let newSessionId: string | null = null;
      let hadError = false;
      let wasCancelled = false;
      try {
        const base64 = await blobTo16kWavBase64(blob);
        const response = await invoke<TranscribeAudioResponse>('transcribe_audio', {
          payload: {
            audio_base64: base64,
            language: selectedLanguage,
          },
        });

        newSessionId = response.session.id;
        applySession(response.session);
        setSessions(prev => [response.session, ...prev.filter(item => item.id !== response.session.id)]);
      } catch (invokeError) {
        console.error(invokeError);
        const message = getErrorMessage(invokeError);
        if (message.includes('转写已取消')) {
          wasCancelled = true;
        } else if (message.includes('已有转写任务正在进行')) {
          hadError = true;
          setError('已有转写任务正在进行，请稍后重试。');
        } else {
          hadError = true;
          setError('转写失败，请稍后重试。');
        }
        if (hadError && !wasCancelled) {
          setLastTranscriptionDuration(null);
        }
      } finally {
        const cancelled = wasCancelled || transcriptionCancelledRef.current;
        finalizeTranscription({ preserveDuration: cancelled || !hadError });
        transcriptionCancelledRef.current = false;
        void loadSessions(newSessionId ?? undefined);
        setRecordingDuration(0);
      }
    },
    [
      applySession,
      beginTranscription,
      finalizeTranscription,
      getErrorMessage,
      loadSessions,
    ],
  );

  const handleUploadAudio = React.useCallback(
    async (file: File) => {
      beginTranscription();
      let newSessionId: string | null = null;
      let hadError = false;
      let wasCancelled = false;
      try {
        const base64 = await blobTo16kWavBase64(file);
        const response = await invoke<TranscribeAudioResponse>('transcribe_audio', {
          payload: {
            audio_base64: base64,
            language,
          },
        });

        newSessionId = response.session.id;
        applySession(response.session);
        setSessions(prev => [response.session, ...prev.filter(item => item.id !== response.session.id)]);
      } catch (invokeError) {
        console.error(invokeError);
        const message = getErrorMessage(invokeError);
        if (message.includes('转写已取消')) {
          wasCancelled = true;
        } else if (message.includes('已有转写任务正在进行')) {
          hadError = true;
          setError('已有转写任务正在进行，请稍后重试。');
        } else {
          hadError = true;
          setError('上传音频转写失败，请检查文件格式。');
        }
        if (hadError && !wasCancelled) {
          setLastTranscriptionDuration(null);
        }
      } finally {
        const cancelled = wasCancelled || transcriptionCancelledRef.current;
        finalizeTranscription({ preserveDuration: cancelled || !hadError });
        transcriptionCancelledRef.current = false;
        void loadSessions(newSessionId ?? undefined);
      }
    },
    [
      language,
      applySession,
      beginTranscription,
      finalizeTranscription,
      getErrorMessage,
      loadSessions,
    ],
  );

  const handleStartRecording = React.useCallback(async () => {
    setError(null);
    if (!hasMediaDevices) {
      setError('当前环境不支持麦克风采集。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunkRef.current = [];
      recordingLanguageRef.current = language;
      startMonitoring(stream);

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          chunkRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopMonitoring();
        const combined = new Blob(chunkRef.current, { type: 'audio/webm' });
        chunkRef.current = [];
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (combined.size > 0) {
          void processRecording(combined, recordingLanguageRef.current);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError('无法访问麦克风，请检查权限设置。');
      stopMonitoring();
      setRecordingDuration(0);
      resetRecordingState();
    }
  }, [hasMediaDevices, language, processRecording, resetRecordingState, startMonitoring, stopMonitoring]);

  const handleStopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopMonitoring();
    setIsRecording(false);
    setRecordingDuration(0);
  }, [stopMonitoring]);

  const handleCancelTranscription = React.useCallback(async () => {
    if (!transcribing) {
      return;
    }
    transcriptionCancelledRef.current = true;
    stopTranscriptionTimer();
    setTranscribing(false);
    try {
      await invoke<boolean>('cancel_transcription');
    } catch (invokeError) {
      console.error(invokeError);
    }
  }, [stopTranscriptionTimer, transcribing]);

  const handleSelectSession = React.useCallback(
    (session: SpeechSession) => {
      applySession(session);
    },
    [applySession],
  );

  const handleDeleteSession = React.useCallback(
    async (session: SpeechSession) => {
      try {
        await invoke('delete_speech_session', { sessionId: session.id });
        if (selectedSessionId === session.id) {
          applySession(null);
        }
        void loadSessions();
      } catch (invokeError) {
        console.error(invokeError);
        setError('删除记录失败，请稍后重试。');
      }
    },
    [applySession, loadSessions, selectedSessionId],
  );

  const handleTranscriptChange = React.useCallback((value: string) => {
    setTranscriptDraft(value);
  }, []);

  const handleSaveTranscript = React.useCallback(async () => {
    if (!currentSession || transcriptDraft === currentSession.transcript) {
      return;
    }
    setIsSavingTranscript(true);
    setError(null);
    try {
      const updated = await invoke<SpeechSession>('update_speech_session', {
        payload: {
          session_id: currentSession.id,
          transcript: transcriptDraft,
        },
      });
      setCurrentSession(updated);
      setTranscriptDraft(updated.transcript);
      setSegments(updated.segments);
      setSessions(prev => {
        const index = prev.findIndex(item => item.id === updated.id);
        if (index === -1) {
          return [updated, ...prev];
        }
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    } catch (invokeError) {
      console.error(invokeError);
      setError('保存文案失败，请稍后重试。');
    } finally {
      setIsSavingTranscript(false);
    }
  }, [currentSession, transcriptDraft]);

  const hasTranscriptChanges = React.useMemo(() => {
    if (!currentSession) {
      return false;
    }
    return transcriptDraft !== currentSession.transcript;
  }, [currentSession, transcriptDraft]);

  const transcriptLanguage = currentSession?.language ?? language;

  React.useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  return (
    <Box sx={{ 
      maxWidth: '100%',
      margin: '0 auto',
      p: { xs: 2, sm: 3, md: 4 },
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      <PageHeader
        title="🎙️ 语音转写助手"
        subtitle="使用本地模型，支持中文与英文的离线识别，耗性能"
        gradient={true}
      />

      {error && (
        <Box sx={{ mb: 3 }}>
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: 2,
              borderLeft: '4px solid',
              borderLeftColor: 'error.main',
              boxShadow: 1,
            }}
          >
            {error}
          </Alert>
        </Box>
      )}

      <Stack spacing={3}>
        <CardContainer>
          {manualModelMessage && (
            <Alert
              severity="info"
              sx={{
                mb: 2,
                borderRadius: 2,
                alignItems: 'flex-start',
              }}
            >
              {manualModelMessage}
              {manualModelPath ? (
                <Typography
                  component="code"
                  sx={{
                    display: 'block',
                    mt: 1,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {manualModelPath}
                </Typography>
              ) : null}
            </Alert>
          )}
          <RecorderControls
            language={language}
            onLanguageChange={setLanguage}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onEnsureModel={ensureModel}
            onUploadAudio={handleUploadAudio}
            modelReady={modelReady}
            disabled={!hasMediaDevices}
            progress={modelProgress}
            transcribing={transcribing}
            ensuringModel={ensuringModel}
            audioLevel={audioLevel}
            recordingDuration={recordingDuration}
            onStopTranscription={handleCancelTranscription}
            transcriptionDuration={transcriptionDuration}
            lastTranscriptionDuration={lastTranscriptionDuration}
            manualModelMessage={manualModelMessage}
            manualModelPath={manualModelPath}
          />
        </CardContainer>

        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3,
          width: '100%',
          alignItems: 'stretch',
        }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CardContainer minHeight="600px">
              <TranscriptView
                language={transcriptLanguage}
                transcript={transcriptDraft}
                segments={segments}
                isLoading={transcribing}
                canEdit={Boolean(currentSession)}
                onTranscriptChange={handleTranscriptChange}
                onSaveTranscript={currentSession ? handleSaveTranscript : undefined}
                isSavingTranscript={isSavingTranscript}
                hasChanges={hasTranscriptChanges}
                audioSrc={audioSrc}
              />
            </CardContainer>
          </Box>

          <Box sx={{ width: { xs: '100%', lg: '420px' }, flexShrink: 0 }}>
            <CardContainer minHeight="600px">
              <SessionHistory
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                onSelect={handleSelectSession}
                onDelete={handleDeleteSession}
              />
            </CardContainer>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
};

export default SpeechToTextPage;
