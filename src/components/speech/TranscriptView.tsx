import React from 'react';
import {
  Box,
  Chip,
  Divider,
  Stack,
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
}

const formatTimestamp = (seconds: number) => {
  const date = new Date(seconds * 1000);
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${mm}:${ss}`;
};

const TranscriptView: React.FC<TranscriptViewProps> = ({ transcript, segments, isLoading, language }) => {
  const hasContent = Boolean(transcript.trim());

  return (
    <Stack spacing={3} sx={{ height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
            实时转写
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hasContent ? '最新的一次转写记录' : '录制并停止以查看转写内容'}
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
      ) : hasContent ? (
        <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
          <Stack spacing={2.5}>
            {segments
              .filter(segment => segment.text.trim().length > 0)
              .map(segment => (
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
        </Box>
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
