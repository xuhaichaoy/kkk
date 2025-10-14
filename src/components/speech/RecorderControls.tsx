import React from 'react';
import {
  Box,
  Button,
  Chip,
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

import type { ModelDownloadProgress, SpeechLanguage } from '../../types/speech';

export interface RecorderControlsProps {
  language: SpeechLanguage;
  onLanguageChange: (language: SpeechLanguage) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEnsureModel: () => void;
  disabled?: boolean;
  modelReady: boolean;
  progress: ModelDownloadProgress | null;
  transcribing: boolean;
  ensuringModel: boolean;
  audioLevel: number;
  recordingDuration: number;
}

const RecorderControls: React.FC<RecorderControlsProps> = ({
  language,
  onLanguageChange,
  isRecording,
  onStartRecording,
  onStopRecording,
  onEnsureModel,
  disabled = false,
  modelReady,
  progress,
  transcribing,
  ensuringModel,
  audioLevel,
  recordingDuration,
}) => {
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
  }, [isRecording, modelReady, transcribing]);

  const buttonVariant = React.useMemo(() => {
    if (isRecording) {
      return 'outlined' as const;
    }
    return modelReady ? ('contained' as const) : ('outlined' as const);
  }, [isRecording, modelReady]);

  const levelPercent = React.useMemo(() => {
    const clamped = Math.max(0, Math.min(audioLevel, 1));
    return Math.round(clamped * 100);
  }, [audioLevel]);

  const formattedDuration = React.useMemo(() => {
    const totalSeconds = Math.floor(recordingDuration);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [recordingDuration]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          录音控制
        </Typography>
        <Typography variant="body2" color="text.secondary">
          选择语言并开始录音，系统会自动完成离线识别
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={3}>
        <FormControl fullWidth>
          <InputLabel id="speech-language-label">识别语言</InputLabel>
          <Select
            labelId="speech-language-label"
            value={language}
            label="识别语言"
            onChange={event => onLanguageChange(event.target.value as SpeechLanguage)}
            disabled={isRecording || transcribing}
          >
            <MenuItem value="zh">中文</MenuItem>
            <MenuItem value="en">英语</MenuItem>
          </Select>
        </FormControl>

        {!modelReady && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <DownloadIcon color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                首次使用需要下载 Whisper Small 模型（约 244MB）
              </Typography>
            </Stack>
            <LinearProgress
              variant={percent === null || ensuringModel ? 'indeterminate' : 'determinate'}
              value={percent ?? undefined}
              sx={{ borderRadius: 1, height: 8 }}
            />
            {percent !== null && (
              <Typography variant="caption" color="text.secondary">
                已完成 {percent}%
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                size="small"
                onClick={onEnsureModel}
                disabled={ensuringModel}
              >
                {ensuringModel ? '正在下载…' : '立即下载模型'}
              </Button>
            </Stack>
          </Stack>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'stretch' }}
        >
          <Stack spacing={0.5} flex={1} sx={{ minWidth: 160 }}>
            <Typography variant="body2" color="text.secondary">
              录音时长
            </Typography>
            <Typography variant="h5" fontWeight={600}>
              {formattedDuration}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              录音开始后实时更新
            </Typography>
          </Stack>
          <Stack spacing={0.5} flex={1} sx={{ minWidth: 160 }}>
            <Typography variant="body2" color="text.secondary">
              输入音量
            </Typography>
            <LinearProgress
              variant="determinate"
              value={levelPercent}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary">
              {levelPercent}%
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Button
            color={isRecording ? 'error' : 'primary'}
            variant={buttonVariant}
            startIcon={isRecording ? <StopIcon /> : <MicIcon />}
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={primaryActionDisabled}
            size="large"
            sx={{ 
              minWidth: 160,
              height: 48,
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            {buttonLabel}
          </Button>
          <Chip
            icon={isRecording ? <FiberManualRecordIcon color="error" fontSize="small" /> : undefined}
            label={isRecording ? '录音中' : transcribing ? '转写中' : modelReady ? '待命' : '准备中'}
            color={isRecording ? 'error' : 'default'}
            variant={isRecording ? 'filled' : 'outlined'}
            sx={{ height: 32, fontSize: '0.875rem', fontWeight: 500 }}
          />
        </Stack>

        {!modelReady && (
          <Typography variant="caption" color="text.secondary">
            模型下载完成后按钮会自动启用，请耐心等待。
          </Typography>
        )}

        {transcribing && (
          <Stack spacing={1}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">
              正在转写录音，请稍候……
            </Typography>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};

export default RecorderControls;
