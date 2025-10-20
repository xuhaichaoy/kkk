import React, { useMemo } from 'react';
import { Box, Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { differenceInCalendarWeeks, addDays, isBefore, isSameDay, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { TodoTask } from '../../stores/todoStore';
import { getTaskDateRange } from '../../utils/todoUtils';

interface TodoStatsPanelProps {
  tasks: TodoTask[];
}

const TodoStatsPanel: React.FC<TodoStatsPanelProps> = ({ tasks }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = tasks.filter(task => !task.completed).length;
    const dayStart = startOfDay(now);
    const dayEnd = addDays(dayStart, 1);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const today = tasks.filter(task => {
      const range = getTaskDateRange(task);
      if (!range) return false;
      return range.start < dayEnd && range.end >= dayStart;
    }).length;

    const thisWeek = tasks.filter(task => {
      const range = getTaskDateRange(task);
      if (!range) return false;
      return range.start <= weekEnd && range.end >= weekStart;
    }).length;

    const overdue = tasks.filter(task => {
      const range = getTaskDateRange(task);
      if (!range) return false;
      return !task.completed && isBefore(range.end, now);
    }).length;

    let longestStreak = 0;
    let currentStreak = 0;
    const sorted = tasks
      .filter(task => task.completedAt)
      .map(task => new Date(task.completedAt as string))
      .sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        currentStreak = 1;
        longestStreak = 1;
        continue;
      }
      const prev = sorted[i - 1];
      const current = sorted[i];
      const diffWeeks = differenceInCalendarWeeks(current, prev);
      if (diffWeeks <= 1) {
        currentStreak += 1;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 1;
      }
    }

    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const nextDue = tasks
      .map(task => ({ task, range: getTaskDateRange(task) }))
      .filter(item => item.range && !item.task.completed)
      .filter((item): item is { task: TodoTask; range: { start: Date; end: Date } } => Boolean(item.range))
      .sort((a, b) => a.range.start.getTime() - b.range.start.getTime())[0] ?? null;

    return {
      total,
      completed,
      active,
      today,
      thisWeek,
      overdue,
      completionRate,
      nextDue,
      longestStreak,
    };
  }, [tasks]);

  return (
    <Grid container spacing={2.5}>
      <Grid item xs={12} sm={6} md={12}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">完成率</Typography>
              <LinearProgress variant="determinate" value={stats.completionRate} sx={{ height: 10, borderRadius: 5 }} />
              <Typography variant="body2" color="text.secondary">
                {stats.completionRate}% 已完成，共 {stats.completed}/{stats.total} 个任务
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={12}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={3} justifyContent="space-between">
              <Box>
                <Typography variant="h4">{stats.today}</Typography>
                <Typography variant="body2" color="text.secondary">今日任务</Typography>
              </Box>
              <Box>
                <Typography variant="h4">{stats.thisWeek}</Typography>
                <Typography variant="body2" color="text.secondary">本周任务</Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="error.main">{stats.overdue}</Typography>
                <Typography variant="body2" color="error.main">已逾期</Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={12}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              下一项任务
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stats.nextDue
                ? `${stats.nextDue.task.title}${(() => {
                    const { range } = stats.nextDue;
                    const sameDay = isSameDay(range.start, range.end);
                    if (sameDay) {
                      return ` · ${range.start.toLocaleString()}`;
                    }
                    return ` · ${range.start.toLocaleDateString()} ~ ${range.end.toLocaleDateString()}`;
                  })()}`
                : '暂无即将到来的任务'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={12}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1">已连续完成周数</Typography>
            <Typography variant="h4">{stats.longestStreak}</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default TodoStatsPanel;
