import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  Divider,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import dayjs from 'dayjs';

import type { SpeechSession } from '../../types/speech';

export interface SessionHistoryProps {
  sessions: SpeechSession[];
  selectedSessionId: string | null;
  onSelect: (session: SpeechSession) => void;
  onDelete: (session: SpeechSession) => void;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({ sessions, selectedSessionId, onSelect, onDelete }) => {
  const hasHistory = sessions.length > 0;

  return (
    <Stack spacing={3} sx={{ height: '100%' }}>
      <Box>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          历史记录
        </Typography>
        <Typography variant="body2" color="text.secondary">
          查看以往转写结果，可导出音频文件
        </Typography>
      </Box>

      <Divider />

      {hasHistory ? (
        <List disablePadding sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {sessions.map(session => {
            const createdAt = dayjs(session.created_at).format('YYYY-MM-DD HH:mm:ss');
            const isSelected = session.id === selectedSessionId;
            return (
              <ListItem 
                key={session.id} 
                disablePadding 
                sx={{ 
                  mb: 1,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'action.selected' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <ListItemButton 
                  selected={isSelected} 
                  onClick={() => onSelect(session)} 
                  alignItems="flex-start"
                  sx={{ borderRadius: 2, py: 1.5 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle2" color="text.primary" fontWeight={600}>
                          {session.title}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={session.language === 'zh' ? '中文' : 'English'} 
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.75rem' }}
                        />
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {createdAt}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="text.secondary" 
                          sx={{ 
                            wordBreak: 'break-all',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          音频文件：{session.audio_path}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItemButton>
                <ListItemSecondaryAction>
                  <Tooltip title="删除记录">
                    <IconButton
                      edge="end"
                      onClick={event => {
                        event.stopPropagation();
                        onDelete(session);
                      }}
                      sx={{ 
                        color: 'error.main',
                        '&:hover': {
                          bgcolor: 'error.lighter',
                        }
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 8 }}>
          <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.primary" fontWeight={600}>
            还没有任何转写记录
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            完成一次录音即可在这里看到历史记录
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};

export default SessionHistory;
