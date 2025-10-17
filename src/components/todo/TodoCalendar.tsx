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
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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
  const baseCellHeight = isSmallScreen ? 124 : 156;
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

  const weeksCount = calendarMatrix.length;
  const enforceBaseHeight = weeksCount <= 5;

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
    const isCurrentMonth = isSameMonth(date, month);
    const isSelected = isSameDay(selectedDate, date);
    const isCurrent = isToday(date);
    const hasTasks = dayTasks.length > 0;

    return (
      <Box
        key={key}
        onClick={() => onSelectDate(date)}
        sx={{
          position: 'relative',
          p: 0.8,
          height: '100%',
          minHeight: enforceBaseHeight ? baseCellHeight : undefined,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'background.paper',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          opacity: isCurrentMonth ? 1 : 0.4,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        <Stack spacing={0.3} sx={{ height: '100%', width: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isCurrent ? (
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: '#fff',
                      fontSize: '0.875rem',
                    }}
                  >
                    {format(date, 'd')}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isSelected ? 600 : 400,
                    color: 'text.primary',
                    fontSize: '0.875rem',
                  }}
                >
                  {format(date, 'd')}
                </Typography>
              )}
            </Box>
            {hasTasks && !isCurrent && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'error.main',
                  mt: 0.5,
                }}
              />
            )}
          </Stack>
          <Stack spacing={0.3} alignItems="flex-start" sx={{ flex: 1, width: '100%', overflow: 'hidden' }}>
            {dayTasks
              .sort((a, b) => {
                const orderA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                const orderB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                return orderA - orderB;
              })
              .slice(0, 4)
              .map(task => {
                const getTaskColor = () => {
                  if (task.completed) return '#4caf50';
                  if (task.priority === 'high') return '#ef5350';
                  if (task.priority === 'medium') return '#ffa726';
                  return '#42a5f5';
                };
                
                const getTaskBgColor = () => {
                  if (task.completed) return alpha('#4caf50', 0.12);
                  if (task.priority === 'high') return alpha('#ef5350', 0.12);
                  if (task.priority === 'medium') return alpha('#ffa726', 0.12);
                  return alpha('#42a5f5', 0.12);
                };

                const taskTime = task.dueDate ? format(new Date(task.dueDate), 'HH:mm') : '';

                return (
                  <Tooltip key={task.id} title={task.title} placement="top" arrow disableInteractive>
                    <Box
                      sx={{
                        width: '100%',
                        px: 0.8,
                        py: 0.3,
                        borderRadius: 0.8,
                        backgroundColor: getTaskBgColor(),
                        borderLeft: `3px solid ${getTaskColor()}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          color: 'text.primary',
                        }}
                      >
                        {task.title}
                      </Typography>
                      {taskTime && taskTime !== '00:00' && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            color: 'text.secondary',
                            fontWeight: 400,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {taskTime}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            {dayTasks.length > 4 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  pl: 0.8,
                }}
              >
                +{dayTasks.length - 4}
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
        height: 'calc(100vh)', // 减去Layout的padding
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
        // margin: '-24px', // 抵消Container的padding
      }}
    >
      {/* 顶部工具栏 */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h5" fontWeight={600}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="small"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              width: 36,
              height: 36,
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          
          <Select
            value="month"
            size="small"
            sx={{
              minWidth: 100,
              height: 36,
              borderRadius: 1.5,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'divider',
              },
            }}
          >
            <MenuItem value="month">Month</MenuItem>
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="day">Day</MenuItem>
          </Select>
          
          <IconButton
            size="small"
            onClick={() => onMonthChange(addMonths(month, -1))}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              width: 36,
              height: 36,
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          
          <Button
            variant="outlined"
            size="small"
            onClick={() => onMonthChange(new Date())}
            sx={{
              height: 36,
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 500,
              borderColor: 'divider',
              color: 'text.primary',
            }}
          >
            Today
          </Button>
          
          <IconButton
            size="small"
            onClick={() => onMonthChange(addMonths(month, 1))}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              width: 36,
              height: 36,
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            size="small"
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              width: 36,
              height: 36,
            }}
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* 星期标题 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        {dayLabels.map(label => (
          <Box
            key={label}
            sx={{
              py: 1.5,
              textAlign: 'center',
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:last-child': {
                borderRight: 'none',
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: 'text.secondary',
                fontSize: '0.875rem',
              }}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 日历网格 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {calendarMatrix.map((week, weekIndex) => {
          const weekKey = format(week[0], 'yyyy-MM-dd');
          return (
            <Box
              key={weekKey}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                flex: 1,
                minHeight: enforceBaseHeight ? baseCellHeight : 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-of-type': {
                  borderBottom: '1px solid',
                },
              }}
            >
              {week.map((date, dateIndex) => (
                <Box
                  key={format(date, 'yyyy-MM-dd')}
                  sx={{
                    borderRight: dateIndex === 6 ? 'none' : '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {renderDayCell(date)}
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default TodoCalendar;
