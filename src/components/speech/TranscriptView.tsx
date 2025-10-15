import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import type { SpeechLanguage, TranscriptSegment } from '../../types/speech';

export interface TranscriptViewProps {
  transcript: string;
  segments: TranscriptSegment[];
  isLoading: boolean;
  language: SpeechLanguage;
  onTranscriptChange?: (value: string) => void;
  canEdit?: boolean;
  isSavingTranscript?: boolean;
  onSaveTranscript?: () => void;
  hasChanges?: boolean;
  audioSrc?: string | null;
}

const formatTimestamp = (seconds: number) => {
  const date = new Date(seconds * 1000);
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
};

const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  segments,
  isLoading,
  language,
  onTranscriptChange,
  canEdit = true,
  isSavingTranscript = false,
  onSaveTranscript,
  hasChanges = false,
  audioSrc,
}) => {
  const filteredSegments = React.useMemo(
    () => segments.filter(segment => segment.text.trim().length > 0),
    [segments],
  );
  const isEditable = Boolean(onTranscriptChange) && canEdit;
  const hasSession =
    transcript.trim().length > 0 || filteredSegments.length > 0 || isEditable;
  const showSaveButton = Boolean(onSaveTranscript) && isEditable;

  return (
    <Stack spacing={3} sx={{ height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            转写内容
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hasSession ? '可编辑整体文案，并在下方查看分段内容' : '录制并停止以查看转写内容'}
          </Typography>
        </Box>
        <Chip 
          label={language === 'zh' ? '🇨🇳 中文' : '🇺🇸 English'} 
          size="medium" 
          variant="outlined"
          sx={{ 
            fontWeight: 600,
            borderWidth: '1.5px',
            px: 1,
          }}
        />
      </Box>

      <Divider />

      {isLoading ? (
        <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 10 }}>
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
            }}
          >
            <CircularProgress size={80} thickness={3} />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AutoAwesomeIcon color="primary" sx={{ fontSize: 36 }} />
            </Box>
          </Box>
          <Typography variant="h6" color="text.primary" fontWeight={600}>
            正在生成转写结果……
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI 正在努力识别您的语音内容
          </Typography>
        </Stack>
      ) : hasSession ? (
        <Stack spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
          {/* 音频播放器和保存按钮 */}
          {(audioSrc || showSaveButton) && (
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', md: 'center' }}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
              }}
            >
              {audioSrc && (
                <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 300 } }}>
                  <audio 
                    controls 
                    src={audioSrc} 
                    style={{ 
                      width: '100%',
                      height: '40px',
                      borderRadius: '8px',
                    }}
                  >
                    当前浏览器不支持音频播放
                  </audio>
                </Box>
              )}
              {showSaveButton && (
                <Button
                  variant="contained"
                  onClick={onSaveTranscript}
                  disabled={!hasChanges || isSavingTranscript}
                  startIcon={
                    isSavingTranscript ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : undefined
                  }
                  sx={{
                    minWidth: 120,
                    height: 40,
                    borderRadius: 2,
                    fontWeight: 600,
                    boxShadow: hasChanges ? 2 : 0,
                    '&:hover': {
                      boxShadow: hasChanges ? 4 : 0,
                    }
                  }}
                >
                  {isSavingTranscript ? '保存中…' : '保存文案'}
                </Button>
              )}
            </Stack>
          )}

          {/* 文案编辑区 */}
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">
              📝 文案内容
            </Typography>
            <TextField
              multiline
              minRows={6}
              fullWidth
              value={transcript}
              placeholder="暂无文案，可在此编辑或补充整体内容"
              onChange={event => {
                if (isEditable && onTranscriptChange) {
                  onTranscriptChange(event.target.value);
                }
              }}
              InputProps={{
                readOnly: !isEditable,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  alignItems: 'flex-start',
                  borderRadius: 2,
                  borderWidth: '1.5px',
                  '&:hover': {
                    borderColor: 'primary.main',
                  },
                  '&.Mui-focused': {
                    borderWidth: '2px',
                  }
                },
                '& textarea': {
                  lineHeight: 1.8,
                  fontSize: '1rem',
                },
              }}
            />
          </Stack>

          {/* 片段内容区 */}
          <Stack spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">
              🎯 片段内容
            </Typography>
            <Box 
              sx={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                pr: 1,
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'divider',
                  borderRadius: '4px',
                  '&:hover': {
                    bgcolor: 'text.secondary',
                  },
                },
              }}
            >
              {filteredSegments.length > 0 ? (
                <Stack spacing={2}>
                  {filteredSegments.map((segment, index) => (
                    <Paper 
                      key={`${segment.start}-${segment.end}`}
                      elevation={0}
                      sx={{ 
                        p: 2.5, 
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: '1.5px solid',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: 2,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                          <Chip
                            label={`#${index + 1}`}
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 700, height: 24 }}
                          />
                          <Typography variant="body2" color="primary.main" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                            {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                          </Typography>
                        </Stack>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            whiteSpace: 'pre-wrap', 
                            lineHeight: 1.8,
                            color: 'text.primary',
                          }}
                        >
                          {segment.text}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Box
                  sx={{
                    p: 4,
                    borderRadius: 2,
                    border: '2px dashed',
                    borderColor: 'divider',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    暂无片段内容
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 10 }}>
          <Box
            sx={{
              p: 4,
              borderRadius: '50%',
              bgcolor: 'action.hover',
            }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          </Box>
          <Typography variant="h5" color="text.primary" fontWeight={700}>
            尚无转写内容
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            点击"开始录音"，完成后停止即可查看识别结果
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};

export default TranscriptView;
