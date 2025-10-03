import React, { useCallback, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  addTodoAtom,
  bulkCompleteAtom,
  calendarMonthAtom,
  categoriesAtom,
  clearCompletedAtom,
  filterAtom,
  removeTodoAtom,
  tagsAtom,
  todosAtom,
  toggleTodoAtom,
  updateTodoAtom,
  upsertCategoryAtom,
  upsertTagAtom,
} from '../stores/todoStore';
import type { TodoFilterState, TodoPriority, TodoTask } from '../stores/todoStore';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import TodoToolbar from '../components/todo/TodoToolbar';
import TodoFilters from '../components/todo/TodoFilters';
import TodoList from '../components/todo/TodoList';
import TodoFormDialog, { type FormValues } from '../components/todo/TodoFormDialog';
import TodoCalendar from '../components/todo/TodoCalendar';
import { useTodoReminders } from '../hooks/useTodoReminders';
import { invoke } from '@tauri-apps/api/core';
import {
  addDays,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  startOfDay,
  startOfToday,
  startOfWeek,
} from 'date-fns';

const matchesSearch = (task: TodoTask, search: string) => {
  if (!search) return true;
  const lower = search.toLowerCase();
  return (
    task.title.toLowerCase().includes(lower) ||
    task.description?.toLowerCase().includes(lower) ||
    task.notes?.toLowerCase().includes(lower) ||
    task.tags.some(tag => tag.toLowerCase().includes(lower))
  );
};

const matchesFilters = (task: TodoTask, filter: TodoFilterState, now: Date) => {
  if (filter.status === 'active' && task.completed) return false;
  if (filter.status === 'completed' && !task.completed) return false;

  if (filter.priorities.length > 0 && !filter.priorities.includes(task.priority)) {
    return false;
  }

  if (filter.tags.length > 0 && !filter.tags.every(tag => task.tags.includes(tag))) {
    return false;
  }

  if (filter.categories.length > 0 && (!task.category || !filter.categories.includes(task.category))) {
    return false;
  }

  if (filter.range !== 'all') {
    if (!task.dueDate) {
      return false;
    }
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;

    if (filter.range === 'today') {
      if (!isSameDay(due, now)) return false;
    } else if (filter.range === 'thisWeek') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      if (due < start || due > end) return false;
    } else if (filter.range === 'overdue') {
      if (!(due < now && !task.completed)) return false;
    } else if (filter.range === 'custom') {
      if (filter.from) {
        const fromDate = new Date(filter.from);
        if (Number.isFinite(fromDate.getTime()) && due < startOfDay(fromDate)) {
          return false;
        }
      }
      if (filter.to) {
        const toDate = new Date(filter.to);
        if (Number.isFinite(toDate.getTime()) && due > addDays(startOfDay(toDate), 1)) {
          return false;
        }
      }
    }
  }

  return true;
};

const priorityOrder: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const dueValue = (task: TodoTask) => (task.dueDate ? new Date(task.dueDate).getTime() : Number.POSITIVE_INFINITY);

const compareByDueAndPriority = (a: TodoTask, b: TodoTask) => {
  const dueA = dueValue(a);
  const dueB = dueValue(b);

  if (dueA !== dueB) {
    return dueA - dueB;
  }

  const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (priorityDiff !== 0) return priorityDiff;

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};

const sortTasks = (a: TodoTask, b: TodoTask) => {
  if (a.completed !== b.completed) {
    return a.completed ? 1 : -1;
  }

  const comparison = compareByDueAndPriority(a, b);
  if (comparison !== 0) return comparison;

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

const TodoPage: React.FC = () => {
  useTodoReminders();

  const [filters, setFilters] = useAtom(filterAtom);
  const todos = useAtomValue(todosAtom);
  const tags = useAtomValue(tagsAtom);
  const categories = useAtomValue(categoriesAtom);
  const [calendarMonth, setCalendarMonth] = useAtom(calendarMonthAtom);

  const addTodo = useSetAtom(addTodoAtom);
  const updateTodo = useSetAtom(updateTodoAtom);
  const removeTodo = useSetAtom(removeTodoAtom);
  const toggleTodo = useSetAtom(toggleTodoAtom);
  const upsertTag = useSetAtom(upsertTagAtom);
  const upsertCategory = useSetAtom(upsertCategoryAtom);
  const clearCompleted = useSetAtom(clearCompletedAtom);
  const bulkComplete = useSetAtom(bulkCompleteAtom);

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());

  const filteredTasks = useMemo(() => {
    const now = new Date();
    return todos
      .filter(task => matchesSearch(task, search))
      .filter(task => matchesFilters(task, filters, now))
      .sort(sortTasks);
  }, [todos, search, filters]);

  const handleFormSubmit = useCallback(
    (values: FormValues) => {
      if (values.id) {
        updateTodo({
          id: values.id,
          changes: {
            title: values.title,
            description: values.description,
            notes: values.notes,
            priority: values.priority,
            completed: values.completed,
            dueDate: values.dueDate,
            reminder: values.reminder,
            tags: values.tags,
            category: values.category,
            reminderSent: values.completed ? true : undefined,
          },
        });
      } else {
        addTodo({
          title: values.title,
          description: values.description,
          notes: values.notes,
          priority: values.priority,
          completed: values.completed,
          dueDate: values.dueDate,
          reminder: values.reminder,
          tags: values.tags,
          category: values.category,
          reminderSent: values.completed,
        });
      }
    },
    [updateTodo, addTodo],
  );

  const handleEditTask = (task: TodoTask) => {
    setEditingTask(task);
    setFormOpen(true);
    setSelectedTaskId(task.id);
  };

  const handleDeleteTask = (task: TodoTask) => {
    removeTodo(task.id);
  };

  const handleBulkComplete = () => {
    const ids = filteredTasks.filter(task => !task.completed).map(task => task.id);
    bulkComplete(ids);
  };

  const handleCompleteSelectedDate = () => {
    const ids = selectedDateTasks.filter(task => !task.completed).map(task => task.id);
    bulkComplete(ids);
  };

  const handleOpenWidget = async () => {
    try {
      await invoke('open_todo_widget');
    } catch (error) {
      console.error('Failed to open todo widget', error);
    }
  };

  const overdueTasks = useMemo(() => {
    const now = new Date();
    return filteredTasks.filter(task => task.dueDate && !task.completed && isBefore(new Date(task.dueDate), now));
  }, [filteredTasks]);

  const todayTasks = useMemo(() => {
    const today = startOfToday();
    return filteredTasks.filter(task => task.dueDate && isSameDay(new Date(task.dueDate), today));
  }, [filteredTasks]);

  const weekTasks = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return filteredTasks.filter(task => {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      return due >= start && due <= end;
    });
  }, [filteredTasks]);

  const selectedDateTasks = useMemo(() => {
    const selectedStart = startOfDay(selectedDate);

    const overdue: TodoTask[] = [];
    const upcoming: TodoTask[] = [];

    todos.forEach(task => {
      if (task.completed) return;

      if (!task.dueDate) {
        upcoming.push(task);
        return;
      }

      const due = new Date(task.dueDate);
      if (isBefore(due, selectedStart)) {
        overdue.push(task);
      } else {
        upcoming.push(task);
      }
    });

    overdue.sort(compareByDueAndPriority);
    upcoming.sort(compareByDueAndPriority);

    return [...overdue, ...upcoming];
  }, [todos, selectedDate]);

  const completedCount = useMemo(() => todos.filter(task => task.completed).length, [todos]);
  const totalTasks = todos.length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);

  return (
    <Box sx={{ pb: 6, px: { xs: 2, sm: 3, md: 4 } }}>
      <Stack spacing={4}>
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
            }
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
                  onClick={handleOpenWidget}
                  sx={{ 
                    borderColor: 'rgba(255,255,255,0.5)', 
                    color: 'white',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: 'white',
                      backgroundColor: 'rgba(255,255,255,0.15)',
                    }
                  }}
                >
                  打开桌面小组件
                </Button>
                <Button
                  variant="contained"
                  size="medium"
                  onClick={() => {
                    setEditingTask(null);
                    setFormOpen(true);
                  }}
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
              </Stack>
            </Stack>

          </Stack>
        </Paper>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3.5, width: '100%', alignItems: 'flex-start' }}>
          <Box sx={{ 
            flex: 1,
            minHeight: { xs: 'auto', lg: '680px' }
          }}>
            <TodoCalendar
              tasks={todos}
              month={calendarMonth}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onMonthChange={setCalendarMonth}
            />
          </Box>

          <Box sx={{ 
            width: { xs: '100%', lg: '420px' },
            flexShrink: 0,
            height: { xs: 'auto', lg: '680px' }
          }}>
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
                      minWidth: { xs: 'calc(50% - 12px)', md: 140 }
                    }
                  }}
                >
                  <Stack 
                    spacing={0.8} 
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      background: (theme) => theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}>
                      完成率
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ color: 'primary.main' }}>
                      {completionRate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {completedCount}/{totalTasks}
                    </Typography>
                  </Stack>
                  
                  <Stack 
                    spacing={0.8}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      background: (theme) => theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}>
                      今日任务
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ color: 'success.main' }}>
                      {todayTasks.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      本周 {weekTasks.length}
                    </Typography>
                  </Stack>
                  
                  <Stack 
                    spacing={0.8}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      background: (theme) => theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}>
                      已逾期
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={overdueTasks.length > 0 ? 'error.main' : 'text.primary'}>
                      {overdueTasks.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      筛选 {filteredTasks.length} 项
                    </Typography>
                  </Stack>
                  
                  <Stack 
                    spacing={0.8}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      background: (theme) => theme.palette.mode === 'light' ? 'white' : 'rgba(255,255,255,0.05)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.65rem' }}>
                      活跃任务
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap sx={{ color: 'warning.main', fontSize: '0.95rem' }}>
                      {filteredTasks.length} 项
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                      进行中 {filteredTasks.filter(t => !t.completed).length} 项
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 4,
                flex: 1,
                border: 'none',
                boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
                background: (theme) => (theme.palette.mode === 'light' ? 'white' : theme.palette.background.paper),
                height: { xs: 'auto', lg: '100%' },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack spacing={2} sx={{ height: { xs: 'auto', lg: '100%' }, flex: { xs: 'none', lg: 1 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'primary.main', fontSize: '1.1rem' }}>
                    {format(selectedDate, 'MM月dd日')} · {selectedDateTasks.length} 项任务
                  </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleCompleteSelectedDate}
                      disabled={selectedDateTasks.every(task => task.completed)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 600,
                        boxShadow: 'none',
                        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                      }}
                    >
                      全部完成
                    </Button>
                  </Stack>
                  <Divider sx={{ borderColor: 'divider', opacity: 0.4, borderWidth: '0.5px' }} />
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 1.5 }}>
                    {selectedDateTasks.length === 0 ? (
                      <Stack height="100%" alignItems="center" justifyContent="center" spacing={2.5}>
                        <Box sx={{ 
                          fontSize: '4.5rem', 
                          opacity: 0.25,
                          filter: 'grayscale(1)'
                        }}>
                          📋
                        </Box>
                        <Typography variant="body1" color="text.secondary" fontWeight={500}>
                          这一天还没有安排任务
                        </Typography>
                        <Button 
                          size="medium" 
                          variant="contained"
                          onClick={() => {
                            setEditingTask(null);
                            setFormOpen(true);
                          }}
                          sx={{ 
                            borderRadius: 2, 
                            fontWeight: 600,
                            boxShadow: 'none',
                            '&:hover': {
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }
                          }}
                        >
                          添加任务
                        </Button>
                      </Stack>
                    ) : (
                      <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedDateTasks.map(task => {
                          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                          const dueLabel = dueDate ? format(dueDate, 'MM-dd HH:mm') : undefined;
                          const isOverdue = Boolean(dueDate && !task.completed && isBefore(dueDate, new Date()));

                          return (
                            <ListItem
                              key={task.id}
                              disableGutters
                              alignItems="flex-start"
                              sx={{
                                px: 1.5,
                                py: 1.2,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: isOverdue ? 'error.light' : 'divider',
                                backgroundColor: (theme) =>
                                  theme.palette.mode === 'light'
                                    ? task.completed
                                      ? 'rgba(76, 175, 80, 0.04)'
                                      : 'rgba(25, 118, 210, 0.02)'
                                    : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  backgroundColor: (theme) =>
                                    theme.palette.mode === 'light'
                                      ? task.completed
                                        ? 'rgba(76, 175, 80, 0.08)'
                                        : 'rgba(25, 118, 210, 0.06)'
                                      : 'rgba(255,255,255,0.05)',
                                  borderColor: isOverdue ? 'error.main' : 'primary.main',
                                },
                              }}
                                secondaryAction={
                                <Stack direction="row" spacing={0.3}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditTask(task)}
                                    sx={{
                                      color: 'primary.main',
                                      p: 0.5,
                                      '&:hover': { 
                                        backgroundColor: 'primary.main', 
                                        color: 'white',
                                      },
                                    }}
                                  >
                                    <EditIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteTask(task)}
                                    sx={{
                                      color: 'error.main',
                                      p: 0.5,
                                      '&:hover': { 
                                        backgroundColor: 'error.main', 
                                        color: 'white',
                                      },
                                    }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Stack>
                              }
                            >
                                <ListItemAvatar sx={{ minWidth: 42 }}>
                                  <Avatar
                                    sx={{
                                    width: 32,
                                    height: 32,
                                    fontSize: '0.75rem',
                                    bgcolor: task.completed
                                      ? 'success.main'
                                      : task.priority === 'high'
                                        ? 'error.main'
                                        : task.priority === 'medium'
                                          ? 'warning.main'
                                          : 'info.main',
                                    color: '#fff',
                                    fontWeight: 700,
                                  }}
                                >
                                  {task.completed ? '✓' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                                </Avatar>
                              </ListItemAvatar>
                                <ListItemText
                                  disableTypography
                                  sx={{ pr: 7 }}
                                  primary={
                                    <Stack spacing={0.5} sx={{ width: '100%' }}>
                                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          flexGrow: 1,
                                          minWidth: 0,
                                          fontWeight: task.completed ? 400 : 600,
                                          textDecoration: task.completed ? 'line-through' : 'none',
                                          color: task.completed ? 'text.secondary' : 'text.primary',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          fontSize: '0.875rem',
                                        }}
                                      >
                                        {task.title}
                                      </Typography>
                                      {dueLabel && (
                                        <Chip
                                          size="small"
                                          label={dueLabel}
                                          color={isOverdue ? 'error' : 'primary'}
                                          sx={{ 
                                            height: 20, 
                                            fontSize: '0.7rem', 
                                            borderRadius: 1, 
                                            fontWeight: 600,
                                            '& .MuiChip-label': { px: 0.75 },
                                          }}
                                        />
                                      )}
                                      {isOverdue && (
                                        <Chip
                                          size="small"
                                          label="逾期"
                                          color="error"
                                          variant="outlined"
                                          sx={{ 
                                            height: 20, 
                                            fontSize: '0.7rem', 
                                            borderRadius: 1,
                                            fontWeight: 600,
                                            '& .MuiChip-label': { px: 0.75 },
                                          }}
                                        />
                                      )}
                                    </Stack>

                                    {task.description && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        title={task.description}
                                        sx={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {task.description}
                                      </Typography>
                                    )}

                                    {task.tags.length > 0 && (
                                      <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                                        {task.tags.slice(0, 3).map(tag => (
                                          <Chip
                                            key={tag}
                                            label={tag}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                              height: 18,
                                              fontSize: '0.65rem',
                                              borderColor: 'divider',
                                              borderRadius: 1,
                                              maxWidth: 80,
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              '& .MuiChip-label': { px: 0.5 },
                                            }}
                                          />
                                        ))}
                                        {task.tags.length > 3 && (
                                          <Chip
                                            label={`+${task.tags.length - 3}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                              height: 18,
                                              fontSize: '0.65rem',
                                              '& .MuiChip-label': { px: 0.5 },
                                            }}
                                          />
                                        )}
                                      </Stack>
                                    )}
                                  </Stack>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </Box>
                </Stack>
              </Paper>

          </Box>
        </Box>

        <Paper 
          variant="outlined" 
          sx={{ 
            p: { xs: 3, md: 4 }, 
            borderRadius: 4,
            border: 'none',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            background: (theme) => theme.palette.mode === 'light' ? 'white' : theme.palette.background.paper,
          }}
        >
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
              <Stack spacing={0.3}>
                <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>
                  任务列表
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                  共 {filteredTasks.length} 项任务，已完成 {filteredTasks.filter(t => t.completed).length} 项
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1.5} flexWrap="wrap">
                <Button 
                  variant="contained" 
                  size="medium" 
                  onClick={handleBulkComplete} 
                  disabled={filteredTasks.every(task => task.completed)}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 600,
                    boxShadow: 'none',
                    '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                  }}
                >
                  批量完成筛选结果
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="medium" 
                  onClick={() => clearCompleted()} 
                  disabled={todos.every(task => !task.completed)}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 600,
                  }}
                >
                  清空已完成
                </Button>
              </Stack>
            </Stack>

            <TodoToolbar
              search={search}
              onSearchChange={setSearch}
              onAddTask={() => {
                setEditingTask(null);
                setFormOpen(true);
              }}
              onToggleFilters={() => setShowFilters(prev => !prev)}
              filtersVisible={showFilters}
            />
            <TodoFilters
              open={showFilters}
              value={filters}
              onChange={setFilters}
              availableTags={tags}
              availableCategories={categories}
            />

            <Box>
              <TodoList
                tasks={filteredTasks}
                onToggleComplete={(task) => toggleTodo(task.id)}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                selectedId={selectedTaskId}
                onSelect={(task) => setSelectedTaskId(task.id)}
              />
            </Box>
          </Stack>
        </Paper>
      </Stack>

      <TodoFormDialog
        open={formOpen}
        initialTask={editingTask ?? undefined}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        allTags={tags}
        allCategories={categories}
        onCreateTag={upsertTag}
        onCreateCategory={upsertCategory}
      />
    </Box>
  );
};

export default TodoPage;
