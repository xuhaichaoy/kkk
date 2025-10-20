import React, { useMemo } from 'react';
import { Box, Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { differenceInCalendarWeeks, isBefore, isSameDay, isSameWeek, isToday } from 'date-fns';
import { TodoTask } from '../../stores/todoStore';
import { getTaskDueDate } from '../../utils/todoUtils';

interface TodoStatsPanelProps {
  tasks: TodoTask[];
}

const TodoStatsPanel: React.FC<TodoStatsPanelProps> = ({ tasks }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = tasks.filter(task => !task.completed).length;
    const today = tasks.filter(task => {
      const due = getTaskDueDate(task);
      return due ? isToday(due) : false;
    }).length;
    const thisWeek = tasks.filter(task => {
      const due = getTaskDueDate(task);
      return due ? isSameWeek(due, now) : false;
    }).length;
    const overdue = tasks.filter(task => {
      const due = getTaskDueDate(task);
      return due ? !task.completed && isBefore(due, now) : false;
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
      .map(task => ({ task, due: getTaskDueDate(task) }))
      .filter(item => item.due && !item.task.completed)
      .filter((item): item is { task: TodoTask; due: Date } => {
        if (!item.due) return false;
        return !Number.isNaN(item.due.getTime());
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0] ?? null;

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
                ? `${stats.nextDue.task.title}${
                    stats.nextDue.due && !isSameDay(stats.nextDue.due, new Date())
                      ? ` · ${stats.nextDue.due.toLocaleString()}`
                      : ''
                  }`
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
