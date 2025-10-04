import React from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';

interface TodoHeroBannerProps {
  onOpenWidget: () => void;
  onCreateTask: () => void;
  onGenerateWeeklyReport?: () => void;
  onTestNotification?: () => void;
}

const TodoHeroBanner: React.FC<TodoHeroBannerProps> = ({
  onOpenWidget,
  onCreateTask,
  onGenerateWeeklyReport,
  onTestNotification,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 3, md: 4.5 },
      borderRadius: { xs: 3, md: 5 },
      background: (theme) =>
        theme.palette.mode === 'light'
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #434343 0%, #000000 100%)',
      border: 'none',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 20px 60px -15px rgba(102,126,234,0.5)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
      },
    }}
  >
    <Stack spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5}>
        <Stack spacing={1}>
          <Typography variant="h3" fontWeight={800} sx={{ color: 'white', letterSpacing: '-0.02em' }}>
            任务面板
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            在统一视图中管理你的待办事项、提醒和日程安排。
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            size="medium"
            onClick={onOpenWidget}
            sx={{
              borderColor: 'rgba(255,255,255,0.5)',
              color: 'white',
              fontWeight: 600,
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255,255,255,0.15)',
              },
            }}
          >
            打开桌面小组件
          </Button>
          <Button
            variant="contained"
            size="medium"
            onClick={onCreateTask}
            sx={{
              bgcolor: 'white',
              color: '#667eea',
              fontWeight: 700,
              boxShadow: '0 8px 16px -4px rgba(0,0,0,0.2)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.95)',
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 24px -6px rgba(0,0,0,0.3)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            新建任务
          </Button>
          {onGenerateWeeklyReport && (
            <Button
              variant="outlined"
              size="medium"
              onClick={onGenerateWeeklyReport}
              sx={{
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                fontWeight: 600,
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                },
              }}
            >
              生成周报
            </Button>
          )}
          {onTestNotification && (
            <Button
              variant="outlined"
              size="medium"
              onClick={onTestNotification}
              sx={{
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                fontWeight: 600,
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                },
              }}
            >
              测试通知
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  </Paper>
);

export default TodoHeroBanner;
