import React from 'react';
import {
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import DownloadIcon from '@mui/icons-material/Download';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import type { ModelDownloadProgress, SpeechLanguage } from '../../types/speech';

const formatSeconds = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export interface RecorderControlsProps {
  language: SpeechLanguage;
  onLanguageChange: (language: SpeechLanguage) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopTranscription: () => void;
  onEnsureModel: () => void;
  onUploadAudio: (file: File) => void;
  disabled?: boolean;
  modelReady: boolean;
  progress: ModelDownloadProgress | null;
  transcribing: boolean;
  ensuringModel: boolean;
  audioLevel: number;
  recordingDuration: number;
  transcriptionDuration: number;
  lastTranscriptionDuration: number | null;
  manualModelMessage?: string | null;
  manualModelPath?: string | null;
}

const RecorderControls: React.FC<RecorderControlsProps> = ({
  language,
  onLanguageChange,
  isRecording,
  onStartRecording,
  onStopRecording,
  onStopTranscription,
  onEnsureModel,
  onUploadAudio,
  disabled = false,
  modelReady,
  progress,
  transcribing,
  ensuringModel,
  audioLevel,
  recordingDuration,
  transcriptionDuration,
  lastTranscriptionDuration,
  manualModelMessage,
  manualModelPath,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUploadAudio(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  }, [onUploadAudio]);
  const percent = React.useMemo(() => {
    if (!progress || !progress.total_bytes) {
      return null;
    }
    if (progress.total_bytes === 0) {
      return null;
    }
    return Math.min(100, Math.round((progress.downloaded_bytes / progress.total_bytes) * 100));
  }, [progress]);

  const primaryActionDisabled =
    disabled || (!isRecording && (!modelReady || ensuringModel)) || transcribing;

  const buttonLabel = React.useMemo(() => {
    if (isRecording) {
      return '停止录音';
    }
    if (ensuringModel) {
      return '模型准备中…';
    }
    if (transcribing) {
      return '转写中…';
    }
    if (!modelReady) {
      return '模型准备中…';
    }
    return '开始录音';
  }, [isRecording, modelReady, transcribing, ensuringModel]);

  const levelPercent = React.useMemo(() => {
    const clamped = Math.max(0, Math.min(audioLevel, 1));
    return Math.round(clamped * 100);
  }, [audioLevel]);

  const formattedDuration = React.useMemo(
    () => formatSeconds(recordingDuration),
    [recordingDuration],
  );

  const formattedTranscriptionDuration = React.useMemo(
    () => formatSeconds(transcriptionDuration),
    [transcriptionDuration],
  );

  const formattedLastTranscriptionDuration = React.useMemo(
    () =>
      lastTranscriptionDuration === null
        ? null
        : formatSeconds(lastTranscriptionDuration),
    [lastTranscriptionDuration],
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          录音控制
        </Typography>
        <Typography variant="body2" color="text.secondary">
          选择语言并开始录音，系统会自动完成离线识别
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={isRecording ? 3 : 2.5} sx={{ transition: 'all 0.3s ease-in-out' }}>
        <FormControl fullWidth>
          <InputLabel id="speech-language-label">识别语言</InputLabel>
          <Select
            labelId="speech-language-label"
            value={language}
            label="识别语言"
            onChange={event => onLanguageChange(event.target.value as SpeechLanguage)}
            disabled={isRecording || transcribing}
            sx={{
              borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '1.5px',
              },
            }}
          >
            <MenuItem value="zh">🇨🇳 中文</MenuItem>
            <MenuItem value="en">🇺🇸 英语</MenuItem>
          </Select>
        </FormControl>

        {!modelReady && (
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: 'primary.lighter',
              border: '1px solid',
              borderColor: 'primary.light',
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <DownloadIcon color="primary" />
                <Typography variant="body2" fontWeight={600} color="primary.dark">
                  首次使用需要下载 Whisper Small 模型（约 244MB）
                </Typography>
              </Stack>
              <LinearProgress
                variant={percent === null || ensuringModel ? 'indeterminate' : 'determinate'}
                value={percent ?? undefined}
                sx={{ 
                  borderRadius: 2, 
                  height: 10,
                  bgcolor: 'primary.light',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 2,
                  }
                }}
              />
              {percent !== null && (
                <Typography variant="body2" fontWeight={600} color="primary.main">
                  已完成 {percent}%
                </Typography>
              )}
              <Button
                variant="contained"
                size="medium"
                onClick={onEnsureModel}
                disabled={ensuringModel}
                startIcon={<DownloadIcon />}
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                  }
                }}
              >
                {ensuringModel ? '正在下载…' : '立即下载模型'}
              </Button>
            </Stack>
          </Box>
        )}

        {/* 录音状态显示区 - 使用平滑过渡避免跳动 */}
        <Box
          sx={{
            maxHeight: isRecording ? '500px' : 0,
            opacity: isRecording ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.4s ease-in-out, opacity 0.3s ease-in-out, margin 0.4s ease-in-out',
            mb: isRecording ? 3 : 0,
          }}
        >
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: 'rgba(237, 108, 2, 0.08)',
              border: '2px solid',
              borderColor: '#ed6c02',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                bgcolor: '#ed6c02',
                animation: 'pulse 2s ease-in-out infinite',
              },
              '@keyframes pulse': {
                '0%, 100%': {
                  opacity: 1,
                },
                '50%': {
                  opacity: 0.5,
                },
              },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <FiberManualRecordIcon 
                  sx={{ 
                    color: '#ed6c02',
                    animation: 'Kk 1.5s ease-in-out infinite',
                    '@keyframes Kk': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.3 },
                    },
                  }} 
                />
                <Typography variant="h6" fontWeight={700} sx={{ color: '#e65100' }}>
                  正在录音中…
                </Typography>
              </Stack>
              
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                sx={{ pt: 1 }}
              >
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                    录音时长
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ fontFamily: 'monospace', color: '#e65100' }}>
                    {formattedDuration}
                  </Typography>
                </Box>
                
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                    输入音量
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={levelPercent}
                      sx={{ 
                        flex: 1,
                        height: 12, 
                        borderRadius: 2,
                        bgcolor: 'rgba(237, 108, 2, 0.15)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                          bgcolor: '#ed6c02',
                          transition: 'transform 0.1s ease-out',
                        }
                      }}
                    />
                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: '40px', fontFamily: 'monospace', color: '#e65100' }}>
                      {levelPercent}%
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Stack>
          </Box>
        </Box>

        {/* 录音按钮区 */}
        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={transcribing || !modelReady}
            size="large"
            sx={{ 
              minWidth: 160,
              height: 56,
              borderRadius: 3,
              fontWeight: 600,
              fontSize: '1rem',
              borderWidth: '2px',
              '&:hover': {
                borderWidth: '2px',
                transform: 'translateY(-2px)',
              },
            }}
          >
            上传音频
          </Button>
          <Button
            variant="contained"
            startIcon={isRecording ? <StopIcon /> : <MicIcon />}
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={primaryActionDisabled}
            size="large"
            sx={{ 
              minWidth: 160,
              height: 56,
              borderRadius: 3,
              fontWeight: 700,
              fontSize: '1.1rem',
              boxShadow: 3,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: 5,
                transform: 'translateY(-2px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
              ...(isRecording && {
                bgcolor: '#ed6c02',
                '&:hover': {
                  bgcolor: '#e65100',
                },
              }),
            }}
          >
            {buttonLabel}
          </Button>
        </Stack>

        {!modelReady && !isRecording && (
          manualModelMessage ? (
            <Stack spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary" textAlign="center">
                {manualModelMessage}
              </Typography>
              {manualModelPath ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                  component="code"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                >
                  {manualModelPath}
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              💡 模型下载完成后按钮会自动启用，请耐心等待
            </Typography>
          )
        )}

        {transcribing && (
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: 'primary.lighter',
              border: '1px solid',
              borderColor: 'primary.light',
              boxShadow: 1,
            }}
          >
            <Stack spacing={2.5}>
              <Stack spacing={1.5}>
                <LinearProgress sx={{ borderRadius: 2, height: 8 }} />
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <AutoAwesomeIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                  <Typography variant="body2" color="primary.main" fontWeight={600}>
                    正在转写录音，请稍候……
                  </Typography>
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2.5}
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <Box flex={1}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={600}
                    sx={{ mb: 1, display: 'block' }}
                  >
                    转写耗时
                  </Typography>
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    sx={{ fontFamily: 'monospace', color: 'primary.main' }}
                  >
                    {formattedTranscriptionDuration}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={onStopTranscription}
                  size="large"
                  sx={{
                    minWidth: 160,
                    height: 52,
                    borderRadius: 3,
                    fontWeight: 700,
                    boxShadow: 2,
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    },
                  }}
                >
                  停止转写
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </Stack>
    </Stack>
  );
};

export default RecorderControls;
