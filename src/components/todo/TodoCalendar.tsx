import React, { useMemo } from 'react';
import type { FC } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CircleIcon from '@mui/icons-material/Circle';
import type { TodoTask } from '../../stores/todoStore';
import { compareByDueAndPriority } from '../../utils/todoUtils';

interface TodoCalendarProps {
  tasks: TodoTask[];
  month: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];

const TodoCalendar: FC<TodoCalendarProps> = ({ tasks, month, selectedDate, onSelectDate, onMonthChange }) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
  const cellHeight = isSmallScreen ? 124 : 156;
  const calendarMatrix = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days: Date[] = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TodoTask[]>();

    const pushTask = (date: Date, task: TodoTask) => {
      if (!date || Number.isNaN(date.getTime())) return;
      const key = format(startOfDay(date), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      if (!list.some(existing => existing.id === task.id)) {
        list.push(task);
        map.set(key, list);
      }
    };

    tasks.forEach(task => {
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        pushTask(dueDate, task);
      }

      if (task.reminder) {
        const reminderDate = new Date(task.reminder);
        pushTask(reminderDate, task);
      }

      const entries = task.timeEntries ?? [];
      entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        pushTask(entryDate, task);
      });
    });

    map.forEach(list => {
      list.sort(compareByDueAndPriority);
    });

    return map;
  }, [tasks]);

  const renderDayCell = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    const dayTasks = tasksByDay.get(key) ?? [];
    const completed = dayTasks.filter(task => task.completed).length;
    const pending = dayTasks.length - completed;
    const isCurrentMonth = isSameMonth(date, month);
    const isSelected = isSameDay(selectedDate, date);
    const isCurrent = isToday(date);

    return (
      <Box
        key={key}
        onClick={() => onSelectDate(date)}
        sx={{
          position: 'relative',
          p: 1,
          height: cellHeight,
          width: '100%',
          borderRadius: 2,
          border: '1px solid',
          borderColor: isSelected ? 'primary.main' : 'divider',
          backgroundColor: isSelected ? 'primary.main' + '10' : 'background.paper',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          opacity: isCurrentMonth ? 1 : 0.35,
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: (theme) => theme.shadows[2],
          },
        }}
      >
        <Stack spacing={0.5} sx={{ height: '100%', width: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: isSelected ? 700 : 500,
                color: isCurrent ? 'primary.main' : 'text.primary',
              }}
            >
              {format(date, 'd')}
            </Typography>
            {isCurrent && <Chip size="small" label="今天" color="primary" />}
          </Stack>
          <Stack spacing={0.6} alignItems="flex-start" sx={{ flex: 1, width: '100%' }}>
            {dayTasks
              .sort((a, b) => {
                const orderA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                const orderB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                return orderA - orderB;
              })
              .slice(0, 2)
              .map(task => {
                const paletteKey: 'success' | 'error' | 'warning' | 'info' = task.completed
                  ? 'success'
                  : task.priority === 'high'
                    ? 'error'
                    : task.priority === 'medium'
                      ? 'warning'
                      : 'info';

                return (
                  <Stack
                    key={task.id}
                    direction="row"
                    alignItems="center"
                    spacing={0.8}
                    sx={{
                      px: 1,
                      py: 0.35,
                      borderRadius: 1.5,
                      maxWidth: '100%',
                      backgroundColor: (theme) => alpha(theme.palette[paletteKey].main, 0.12),
                    }}
                  >
                    <CircleIcon sx={{ fontSize: 11, color: `${paletteKey}.main` }} />
                    <Tooltip title={task.title} placement="top" arrow disableInteractive>
                      <Typography
                        variant="caption"
                        sx={{
                          maxWidth: isSmallScreen ? 120 : 170,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                          fontWeight: 600,
                        }}
                      >
                        {task.title}
                      </Typography>
                    </Tooltip>
                  </Stack>
                );
              })}
          </Stack>
          {dayTasks.length > 2 && (
            <Typography variant="caption" color="text.secondary">
              +{dayTasks.length - 2} 更多
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            {pending > 0 && (
              <Typography variant="caption" color="warning.main">
                ● {pending}
              </Typography>
            )}
            {completed > 0 && (
              <Typography variant="caption" color="success.main">
                ✓ {completed}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        borderRadius: 4,
        p: { xs: 2.5, sm: 3 },
        height: '100%',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        flex: 1,
        background: theme.palette.mode === 'light'
          ? 'linear-gradient(180deg, #fdfdfd 0%, #f5f8ff 100%)'
          : theme.palette.background.paper,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 20px 45px -28px rgba(44,64,97,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, sm: 2.5 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={{ xs: 2, sm: 0 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4" fontWeight={600}>
            {format(month, 'yyyy年 MMM')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            点击日期查看当天任务。
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: { xs: 1, sm: 1.2 },
          textAlign: 'center',
          width: '100%',
        }}
      >
        {dayLabels.map(label => (
          <Box key={label} sx={{ minWidth: 0, width: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack spacing={1.2} sx={{ flex: 1, width: '100%' }}>
        {calendarMatrix.map(week => {
          const weekKey = format(week[0], 'yyyy-MM-dd');
          return (
            <Box
              key={weekKey}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: { xs: 1, sm: 1.2 },
                width: '100%',
              }}
            >
              {week.map(date => renderDayCell(date))}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export default TodoCalendar;
