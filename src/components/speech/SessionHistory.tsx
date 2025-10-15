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
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import dayjs from 'dayjs';
import { invoke } from '@tauri-apps/api/core';

import type { SpeechSession } from '../../types/speech';

export interface SessionHistoryProps {
  sessions: SpeechSession[];
  selectedSessionId: string | null;
  onSelect: (session: SpeechSession) => void;
  onDelete: (session: SpeechSession) => void;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({ sessions, selectedSessionId, onSelect, onDelete }) => {
  const hasHistory = sessions.length > 0;

  const handleOpenFolder = React.useCallback(async (event: React.MouseEvent, sessionId: string) => {
    event.stopPropagation();
    try {
      await invoke('open_speech_session_folder', { sessionId });
    } catch (error) {
      console.error('打开文件夹失败:', error);
    }
  }, []);

  return (
    <Stack spacing={3} sx={{ height: '100%' }}>
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          历史记录
        </Typography>
        <Typography variant="body2" color="text.secondary">
          查看以往转写结果，可导出音频文件
        </Typography>
      </Box>

      <Divider />

      {hasHistory ? (
        <List 
          disablePadding 
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
          {sessions.map(session => {
            const createdAt = dayjs(session.created_at).format('YYYY-MM-DD HH:mm:ss');
            const isSelected = session.id === selectedSessionId;
            return (
              <ListItem 
                key={session.id} 
                disablePadding 
                sx={{ 
                  mb: 2,
                  borderRadius: 2,
                  border: '1.5px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  bgcolor: isSelected ? 'primary.lighter' : 'background.paper',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? 2 : 0,
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 2,
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemButton 
                  selected={isSelected} 
                  onClick={() => onSelect(session)} 
                  alignItems="flex-start"
                  sx={{ 
                    borderRadius: 2, 
                    py: 2, 
                    px: 2,
                    '&.Mui-selected': {
                      bgcolor: 'transparent',
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1" color="text.primary" fontWeight={700}>
                          {session.title}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={session.language === 'zh' ? '🇨🇳 中文' : '🇺🇸 English'} 
                          variant={isSelected ? 'filled' : 'outlined'}
                          color={isSelected ? 'primary' : 'default'}
                          sx={{ 
                            height: 22, 
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        />
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          🕐 {createdAt}
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
                          🎵 {session.audio_path}
                        </Typography>
                      </Stack>
                    }
                    primaryTypographyProps={{ component: 'div' }}
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItemButton>
                <ListItemSecondaryAction sx={{ right: 12 }}>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="打开文件夹" placement="left">
                      <IconButton
                        onClick={event => handleOpenFolder(event, session.id)}
                        size="small"
                        sx={{ 
                          color: 'text.secondary',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            color: 'primary.main',
                            bgcolor: 'primary.lighter',
                            transform: 'scale(1.1)',
                          }
                        }}
                      >
                        <FolderOpenIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除记录" placement="left">
                      <IconButton
                        edge="end"
                        onClick={event => {
                          event.stopPropagation();
                          onDelete(session);
                        }}
                        size="small"
                        sx={{ 
                          color: 'text.secondary',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            color: 'error.main',
                            bgcolor: 'error.lighter',
                            transform: 'scale(1.1)',
                          }
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 10 }}>
          <Box
            sx={{
              p: 4,
              borderRadius: '50%',
              bgcolor: 'action.hover',
            }}
          >
            <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          </Box>
          <Typography variant="h6" color="text.primary" fontWeight={700}>
            还没有任何转写记录
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            完成一次录音即可在这里看到历史记录
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};

export default SessionHistory;
