import React, { useMemo, useState } from 'react';
import type { FC, MouseEvent } from 'react';
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
import dayjs from 'dayjs';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import type { TodoPriority, TodoStatus, TodoTask } from '../../stores/todoStore';
import { getTaskDateRange } from '../../utils/todoUtils';
import TaskQuickForm from './TaskQuickForm';

export interface CalendarTaskFormValues {
  title: string;
  description?: string;
  notes?: string;
  reflection?: string;
  priority: TodoPriority;
  completed: boolean;
  dueDate?: string;
  dueDateEnd?: string;
  reminder?: string;
  status?: TodoStatus;
  category?: string;
  tags: string[];
  dateMode: 'single' | 'range';
}

export interface TodoCalendarProps {
  tasks: TodoTask[];
  month: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  onCreateTask: (input: CalendarTaskFormValues) => Promise<void> | void;
  onUpdateTask: (id: string, changes: CalendarTaskFormValues) => Promise<void> | void;
  allTags: string[];
  allCategories: string[];
}

const PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getTaskDateMode = (task: TodoTask | null | undefined): 'single' | 'range' => {
  if (!task) return 'single';
  const range = getTaskDateRange(task);
  if (!range) return 'single';
  return range.start.getTime() !== range.end.getTime() ? 'range' : 'single';
};

const sortByCalendarPriority = (a: TodoTask, b: TodoTask) => {
  if (a.completed !== b.completed) {
    return a.completed ? 1 : -1;
  }

  const aPriority = a.priority ?? 'none';
  const bPriority = b.priority ?? 'none';
  const priorityDiff = PRIORITY_ORDER[aPriority] - PRIORITY_ORDER[bPriority];
  if (priorityDiff !== 0) return priorityDiff;

  const rangeA = getTaskDateRange(a);
  const rangeB = getTaskDateRange(b);
  const startA = rangeA ? rangeA.start.getTime() : Number.POSITIVE_INFINITY;
  const startB = rangeB ? rangeB.start.getTime() : Number.POSITIVE_INFINITY;
  if (startA !== startB) return startA - startB;

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};

const TodoCalendar: FC<TodoCalendarProps> = ({
  tasks,
  month,
  selectedDate,
  onSelectDate,
  onMonthChange,
  onCreateTask,
  onUpdateTask,
  allTags,
  allCategories,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
  const baseCellHeight = isSmallScreen ? 124 : 156;
  const [overflowState, setOverflowState] = useState<{
    anchorEl: HTMLElement;
    dateKey: string;
    date: Date;
  } | null>(null);
  const [editorState, setEditorState] = useState<{
    anchorEl: HTMLElement;
    mode: 'create' | 'edit';
    date: Date;
    task?: TodoTask;
  } | null>(null);
  const [editorValues, setEditorValues] = useState<CalendarTaskFormValues>({
    title: '',
    description: '',
    notes: '',
    reflection: '',
    priority: 'none',
    completed: false,
    dueDate: undefined,
    dueDateEnd: undefined,
    reminder: undefined,
    status: 'notStarted',
    category: undefined,
    tags: [],
    dateMode: 'single',
  });
  const [editorSaving, setEditorSaving] = useState(false);
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
  const handleCloseOverflow = () => {
    setOverflowState(null);
  };
  const resetEditorValues = () => {
    setEditorValues({
      title: '',
      description: '',
      notes: '',
      reflection: '',
      priority: 'none',
      completed: false,
      dueDate: undefined,
      dueDateEnd: undefined,
      reminder: undefined,
      status: 'notStarted',
      category: undefined,
      tags: [],
      dateMode: 'single',
    });
  };
  const handleCloseEditor = () => {
    setEditorState(null);
    resetEditorValues();
    setEditorSaving(false);
  };

  const openTaskEditor = (
    mode: 'create' | 'edit',
    options: {
      anchorEl: HTMLElement;
      date: Date;
      task?: TodoTask;
    },
  ) => {
    handleCloseOverflow();
    const { anchorEl, date, task } = options;
    if (mode === 'edit' && task) {
      setEditorValues({
        title: task.title,
        description: task.description,
        notes: task.notes,
        reflection: task.reflection ?? '',
        priority: task.priority ?? 'none',
        completed: task.completed,
        dueDate: task.dueDate,
        dueDateEnd: task.dueDateEnd,
        reminder: task.reminder,
        status: task.status ?? (task.completed ? 'completed' : 'notStarted'),
        category: task.category,
        tags: task.tags ?? [],
        dateMode: getTaskDateMode(task),
      });
    } else {
      resetEditorValues();
      setEditorValues((prev) => ({
        ...prev,
        dueDate: startOfDay(date).toISOString(),
        status: 'notStarted',
        reflection: '',
        dateMode: 'single',
      }));
    }
    setEditorState({
      anchorEl,
      mode,
      date,
      task,
    });
  };

  const handleDayCellClick = (event: MouseEvent<HTMLElement>, date: Date) => {
    openTaskEditor('create', { anchorEl: event.currentTarget, date });
    onSelectDate(date);
  };

  const handleTaskClick = (
    event: MouseEvent<HTMLElement>,
    task: TodoTask,
    date: Date,
    anchorOverride?: HTMLElement,
  ) => {
    event.stopPropagation();
    const anchorEl = anchorOverride ?? (event.currentTarget as HTMLElement);
    openTaskEditor('edit', { anchorEl, date, task });
    onSelectDate(date);
  };

  const handleEditorFieldChange = <K extends keyof CalendarTaskFormValues>(
    key: K,
    value: CalendarTaskFormValues[K],
  ) => {
    setEditorValues((prev) => {
      const next = {
        ...prev,
        [key]: value,
      } as CalendarTaskFormValues;
      if (key === 'dateMode' && value === 'single') {
        next.dueDateEnd = undefined;
      }
      return next;
    });
  };

  const handleToolbarCreateClick = (event: MouseEvent<HTMLElement>) => {
    const today = startOfDay(new Date());
    openTaskEditor('create', { anchorEl: event.currentTarget, date: today });
    onSelectDate(today);
  };

  const handleEditorSave = async () => {
    if (!editorState) return;
    const title = editorValues.title.trim();
    if (!title) return;

    const categoryInput = editorValues.category?.trim();

    const normalizedValues: CalendarTaskFormValues = {
      ...editorValues,
      title,
      description: editorValues.description?.trim() || undefined,
      notes: editorValues.notes?.trim() || undefined,
      reflection: editorValues.reflection?.trim() || undefined,
      status: editorValues.completed
        ? 'completed'
        : editorValues.status ?? (editorState.task?.status ?? 'notStarted'),
      tags:
        editorValues.tags && editorValues.tags.length > 0
          ? editorValues.tags
          : editorState.task?.tags ?? [],
      category: categoryInput && categoryInput.length > 0 ? categoryInput : undefined,
    };

    normalizedValues.tags = normalizedValues.tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (normalizedValues.dateMode === 'single') {
      if (!normalizedValues.dueDate) {
        normalizedValues.dueDate = startOfDay(editorState.date).toISOString();
      }
      normalizedValues.dueDateEnd = undefined;
    } else {
      if (!normalizedValues.dueDate) {
        normalizedValues.dueDate = startOfDay(editorState.date).toISOString();
      }
      if (!normalizedValues.dueDateEnd) {
        normalizedValues.dueDateEnd = normalizedValues.dueDate;
      }
      if (normalizedValues.dueDate && normalizedValues.dueDateEnd) {
        const start = dayjs(normalizedValues.dueDate);
        const end = dayjs(normalizedValues.dueDateEnd);
        if (start.isAfter(end)) {
          normalizedValues.dueDate = end.toISOString();
          normalizedValues.dueDateEnd = start.toISOString();
        }
      }
    }

    setEditorSaving(true);
    try {
      if (editorState.mode === 'edit' && editorState.task) {
        await onUpdateTask(editorState.task.id, normalizedValues);
      } else {
        await onCreateTask({
          ...normalizedValues,
          tags: normalizedValues.tags,
          status: normalizedValues.completed
            ? 'completed'
            : normalizedValues.status ?? 'notStarted',
        });
      }
      handleCloseEditor();
    } finally {
      setEditorSaving(false);
    }
  };

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
      const range = getTaskDateRange(task);

      if (range) {
        let currentDate = startOfDay(range.start);
        const endDate = startOfDay(range.end);
        while (currentDate <= endDate) {
          pushTask(currentDate, task);
          currentDate = addDays(currentDate, 1);
        }
      } else if (task.reminder) {
        const reminderDate = new Date(task.reminder);
        pushTask(reminderDate, task);
      }

      // 时间记录仍然显示在对应日期
      const entries = task.timeEntries ?? [];
      entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        pushTask(entryDate, task);
      });
    });

    map.forEach(list => {
      list.sort(sortByCalendarPriority);
    });

    return map;
  }, [tasks]);

  const overflowTasks = overflowState
    ? tasksByDay.get(overflowState.dateKey) ?? []
    : [];
  const overflowSortedTasks = overflowTasks.slice().sort(sortByCalendarPriority);

  const renderDayCell = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    const dayTasks = tasksByDay.get(key) ?? [];
    const isCurrentMonth = isSameMonth(date, month);
    const isCurrent = isToday(date);
    const hasTasks = dayTasks.length > 0;
    const maxVisibleTasks = 3;
    const sortedTasks = [...dayTasks].sort(sortByCalendarPriority);
    const visibleTasks = sortedTasks.slice(0, maxVisibleTasks);
    const overflowCount =
      sortedTasks.length > maxVisibleTasks ? sortedTasks.length - maxVisibleTasks : 0;

    return (
      <Box
        key={key}
        onClick={(event) => handleDayCellClick(event, date)}
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
                    width: 24,
                    height: 24,
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
                      fontSize: '0.8rem',
                    }}
                  >
                    {format(date, 'd')}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    color: 'text.primary',
                    fontSize: '0.8rem',
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
            {visibleTasks.map((task, index) => {
              const priority = (task.priority ?? 'none') as TodoPriority;
              const rangeInfo = getTaskDateRange(task);
              const isRangeTask = rangeInfo
                ? rangeInfo.start.getTime() !== rangeInfo.end.getTime()
                : false;
              const taskTime = rangeInfo && !isRangeTask
                ? (() => {
                    const formatted = format(rangeInfo.start, 'HH:mm');
                    return formatted === '00:00' ? '' : formatted;
                  })()
                : '';
              const isCompleted = task.completed;
                const backgroundColor = (() => {
                  if (isCompleted) {
                    return alpha(theme.palette.text.disabled, theme.palette.mode === 'light' ? 0.2 : 0.3);
                  }
                  if (priority === 'high') return alpha('#ef5350', 0.12);
                  if (priority === 'medium') return alpha('#ffa726', 0.12);
                  if (priority === 'low') return alpha('#42a5f5', 0.12);
                  return alpha('#9ca3af', 0.18);
                })();
              const showOverflowBadge = overflowCount > 0 && index === visibleTasks.length - 1;

              return (
                <Tooltip key={task.id} title={task.title} placement="top" arrow disableInteractive>
                  <Box
                    sx={{
                      width: '100%',
                      px: 0.8,
                      py: 0.3,
                      borderRadius: 0.8,
                      backgroundColor,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                    onClick={(event) => handleTaskClick(event, task, date)}
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
                        color: isCompleted ? 'text.disabled' : 'text.primary',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </Typography>
                    {taskTime && taskTime !== '00:00' && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.65rem',
                          color: isCompleted ? 'text.disabled' : 'text.secondary',
                          fontWeight: 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {taskTime}
                      </Typography>
                    )}
                    {showOverflowBadge && (
                      <Box
                        component="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (overflowState && overflowState.dateKey === key) {
                            handleCloseOverflow();
                            return;
                          }
                          setOverflowState({
                            anchorEl: event.currentTarget as HTMLElement,
                            dateKey: key,
                            date,
                          });
                        }}
                        sx={{
                          ml: 0.5,
                          px: 0.5,
                          py: 0.1,
                          borderRadius: '0.6rem',
                          backgroundColor: alpha(theme.palette.text.primary, 0.08),
                          color: 'text.secondary',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          lineHeight: 1,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 20,
                        }}
                      >
                        +{overflowCount}
                      </Box>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
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
        backgroundColor: 'background.paper',
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
        }}
      >
        <Typography variant="h5" fontWeight={600}>
          {format(month, 'MMMM yyyy')}
        </Typography>
        
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="small"
            onClick={handleToolbarCreateClick}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              width: 36,
              height: 36,
            }}
            aria-label="新建任务"
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
                fontSize: '0.7rem',
              }}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

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

      <Popover
        open={Boolean(overflowState)}
        anchorEl={overflowState?.anchorEl}
        onClose={handleCloseOverflow}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
            overflow: 'hidden',
          },
        }}
      >
        {overflowState ? (
          <Stack
            spacing={1}
            sx={{
              p: 1.5,
              minWidth: 220,
              maxWidth: 260,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {format(overflowState.date, 'PPP')}
            </Typography>
            <Stack spacing={0.6}>
              {overflowSortedTasks.map((task) => {
                const priority = (task.priority ?? 'none') as TodoPriority;
                const isCompleted = task.completed;
                const backgroundColor = (() => {
                  if (isCompleted) {
                    return alpha(theme.palette.text.disabled, theme.palette.mode === 'light' ? 0.24 : 0.32);
                  }
                  if (priority === 'high') return alpha('#ef5350', 0.16);
                  if (priority === 'medium') return alpha('#ffa726', 0.16);
                  if (priority === 'low') return alpha('#42a5f5', 0.16);
                  return alpha('#9ca3af', 0.24);
                })();
                const rangeInfo = getTaskDateRange(task);
                const scheduleLabel = rangeInfo
                  ? (() => {
                      const sameDay = format(rangeInfo.start, 'yyyy-MM-dd') === format(rangeInfo.end, 'yyyy-MM-dd');
                      if (sameDay) {
                        const startTime = format(rangeInfo.start, 'HH:mm');
                        const endTime = format(rangeInfo.end, 'HH:mm');
                        const dayLabel = format(rangeInfo.start, 'MM-dd');
                        if (startTime === endTime) {
                          return startTime === '00:00' ? dayLabel : `${dayLabel} ${startTime}`;
                        }
                        return `${dayLabel} ${startTime} ~ ${endTime}`;
                      }
                      return `${format(rangeInfo.start, 'MM-dd')} ~ ${format(rangeInfo.end, 'MM-dd')}`;
                    })()
                  : '';
                return (
                  <Box
                    key={task.id}
                    sx={{
                      px: 1,
                      py: 0.6,
                      borderRadius: 1.2,
                      backgroundColor,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      cursor: 'pointer',
                    }}
                    onClick={(event) =>
                      handleTaskClick(
                        event,
                        task,
                        overflowState?.date ?? (task.dueDate ? new Date(task.dueDate) : new Date()),
                        overflowState?.anchorEl ?? (event.currentTarget as HTMLElement),
                      )
                    }
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        flex: 1,
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        color: isCompleted ? 'text.disabled' : 'text.primary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </Typography>
                    {scheduleLabel && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: isCompleted ? 'text.disabled' : 'text.secondary',
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {scheduleLabel}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        ) : null}
      </Popover>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Popover
          open={Boolean(editorState)}
          anchorEl={editorState?.anchorEl}
          onClose={handleCloseEditor}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          transformOrigin={{ vertical: 'top', horizontal: 'center' }}
          PaperProps={{
            sx: {
              borderRadius: 2,
              width: 320,
              maxWidth: '80vw',
              boxShadow: '0 18px 44px rgba(15, 23, 42, 0.2)',
              p: 2,
            },
          }}
        >
          {editorState ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 480,
                minWidth: 280,
              }}
            >
              <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, pb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {format(editorState.date, 'PPPP')}
                </Typography>
                <TaskQuickForm
                  values={editorValues}
                  onChange={(key, value) => {
                    handleEditorFieldChange(
                      key as keyof CalendarTaskFormValues,
                      value as CalendarTaskFormValues[keyof CalendarTaskFormValues],
                    );
                  }}
                  allTags={allTags}
                  allCategories={allCategories}
                  autoFocusTitle={!editorState.task}
                />
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                  pt: 1.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                }}
              >
                <Button variant="outlined" size="small" onClick={handleCloseEditor}>
                  取消
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleEditorSave}
                  disabled={!editorValues.title.trim() || editorSaving}
                >
                  保存
                </Button>
              </Box>
            </Box>
          ) : null}
        </Popover>
      </LocalizationProvider>
    </Box>
  );
};

export default TodoCalendar;
