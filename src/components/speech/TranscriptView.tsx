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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
            转写内容
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hasSession ? '可编辑整体文案，并在下方查看分段内容' : '录制并停止以查看转写内容'}
          </Typography>
        </Box>
        <Chip 
          label={language === 'zh' ? '中文' : 'English'} 
          size="small" 
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      </Box>

      <Divider />

      {isLoading ? (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 8 }}>
          <AutoAwesomeIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="body1" color="text.secondary" fontWeight={500}>
            正在生成转写结果……
          </Typography>
        </Stack>
      ) : hasSession ? (
        <Stack spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
              spacing={1.5}
            >
              <Typography variant="subtitle1" fontWeight={600} style={{ flexShrink: 0 }}>
                文案内容
              </Typography>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                sx={{ width: '100%', maxWidth: { xs: '100%', md: 'auto' } }}
              >
                {audioSrc ? (
                  <Box sx={{ width: { xs: '100%', md: 350 } }}>
                    <audio controls src={audioSrc} style={{ width: '100%' }}>
                      当前浏览器不支持音频播放
                    </audio>
                  </Box>
                ) : null}
                {showSaveButton ? (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={onSaveTranscript}
                    disabled={!hasChanges || isSavingTranscript}
                    startIcon={
                      isSavingTranscript ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                  >
                    {isSavingTranscript ? '保存中…' : '保存文案'}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
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
                },
                '& textarea': {
                  lineHeight: 1.7,
                },
              }}
            />
          </Stack>

          <Stack spacing={1.5} sx={{ flexGrow: 1, minHeight: 0 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              片段内容
            </Typography>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
              {filteredSegments.length > 0 ? (
                <Stack spacing={2.5}>
                  {filteredSegments.map(segment => (
                    <Paper 
                      key={`${segment.start}-${segment.end}`}
                      elevation={0}
                      sx={{ 
                        p: 2, 
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="caption" color="primary" fontWeight={600}>
                          {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                        </Typography>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                          {segment.text}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  暂无片段内容
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 8 }}>
          <DescriptionOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.primary" fontWeight={600}>
            尚无转写内容
          </Typography>
          <Typography variant="body2" color="text.secondary">
            点击"开始录音"，完成后停止即可查看识别结果
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};

export default TranscriptView;
