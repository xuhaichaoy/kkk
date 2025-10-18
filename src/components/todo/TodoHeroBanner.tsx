import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

interface TodoHeroBannerProps {
  onOpenWidget: () => void;
  onCreateTask: () => void;
  onGenerateWeeklyReport?: () => void;
  onGenerateWeeklySummary?: () => void;
  onTestNotification?: () => void;
  title?: string;
}

const TodoHeroBanner: React.FC<TodoHeroBannerProps> = ({
  onOpenWidget,
  onCreateTask,
  onGenerateWeeklyReport,
  onGenerateWeeklySummary,
  onTestNotification,
  title,
}) => (
  <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
      <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>
        {title || '任务面板'}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          onClick={onOpenWidget}
          sx={{
            borderRadius: 2,
            fontWeight: 600,
          }}
        >
          桌面小组件
        </Button>
        {onGenerateWeeklyReport && (
          <Button
            variant="outlined"
            size="small"
            onClick={onGenerateWeeklyReport}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            周报
          </Button>
        )}
        {onGenerateWeeklySummary && (
          <Button
            variant="outlined"
            size="small"
            onClick={onGenerateWeeklySummary}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            总结
          </Button>
        )}
      </Stack>
    </Stack>
  </Box>
);

export default TodoHeroBanner;
