import React from 'react';
import { Paper, Stack, Typography } from '@mui/material';

interface TodoMetricsPanelProps {
  completionRate: number;
  completedCount: number;
  totalCount: number;
  todayCount: number;
  weekCount: number;
  overdueCount: number;
  filteredCount: number;
  filteredCompletedCount: number;
}

const TodoMetricsPanel: React.FC<TodoMetricsPanelProps> = ({
  completionRate,
  completedCount,
  totalCount,
  todayCount,
  weekCount,
  overdueCount,
  filteredCount,
  filteredCompletedCount,
}) => {
  const activeCount = filteredCount - filteredCompletedCount;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 4,
        background: (theme) =>
          theme.palette.mode === 'light'
            ? 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            : theme.palette.background.paper,
        border: 'none',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
      }}
    >
      <Stack
        direction="row"
        spacing={3}
        flexWrap="wrap"
        useFlexGap
        sx={{
          '& > *': {
            flex: { xs: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
            minWidth: { xs: 'calc(50% - 12px)', md: 140 },
          },
        }}
      >
        <Stack
          spacing={0.8}
          sx={{
            p: 2,
            borderRadius: 2.5,
            background: (theme) => (theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)'),
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}
          >
            完成率
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: 'primary.main' }}>
            {completionRate}%
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {completedCount}/{totalCount}
          </Typography>
        </Stack>

        <Stack
          spacing={0.8}
          sx={{
            p: 2,
            borderRadius: 2.5,
            background: (theme) => (theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)'),
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}
          >
            今日任务
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ color: 'success.main' }}>
            {todayCount}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            本周 {weekCount}
          </Typography>
        </Stack>

        <Stack
          spacing={0.8}
          sx={{
            p: 2,
            borderRadius: 2.5,
            background: (theme) => (theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)'),
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}
          >
            已逾期
          </Typography>
          <Typography variant="h4" fontWeight={700} color={overdueCount > 0 ? 'error.main' : 'text.primary'}>
            {overdueCount}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            筛选 {filteredCount} 项
          </Typography>
        </Stack>

        <Stack
          spacing={0.8}
          sx={{
            p: 2,
            borderRadius: 2.5,
            background: (theme) => (theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)'),
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
            },
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}
          >
            活跃任务
          </Typography>
          <Typography variant="body2" fontWeight={700} noWrap sx={{ color: 'warning.main', fontSize: '0.95rem' }}>
            {filteredCount} 项
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
            进行中 {activeCount} 项
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default TodoMetricsPanel;
