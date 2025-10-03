import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  addTodoAtom,
  todosAtom,
  toggleTodoAtom,
  TodoTask,
} from '../stores/todoStore';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { addDays, isBefore, startOfDay } from 'date-fns';

const TodoWidgetPage: React.FC = () => {
  const todos = useAtomValue(todosAtom);
  const addTodo = useSetAtom(addTodoAtom);
  const toggleTodo = useSetAtom(toggleTodoAtom);
  const [title, setTitle] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const currentWindow = useMemo(() => getCurrentWebviewWindow(), []);

  useEffect(() => {
    let isMounted = true;
    currentWindow
      .isAlwaysOnTop()
      .then(result => {
        if (isMounted) {
          setIsPinned(result);
        }
      })
      .catch(error => {
        console.error('Failed to read always-on-top state', error);
      });
    return () => {
      isMounted = false;
    };
  }, [currentWindow]);

  const quickAdds = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);

    const pending = todos.filter(task => !task.completed);
    const withDueDate = pending
      .filter(task => task.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const overdue = withDueDate
      .filter(task => isBefore(new Date(task.dueDate!), todayStart))
      .slice(0, 12);

    const todayTasks = withDueDate
      .filter(task => {
        const due = new Date(task.dueDate!);
        return !isBefore(due, todayStart) && isBefore(due, tomorrowStart);
      })
      .slice(0, 12);

    const unscheduled = pending
      .filter(task => !task.dueDate)
      .slice(0, Math.max(0, 12 - todayTasks.length));

    return { overdue, today: [...todayTasks, ...unscheduled] };
  }, [todos]);

  const handleAdd = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    addTodo({
      title: trimmed,
      description: '',
      notes: '',
      priority: 'medium',
      completed: false,
      tags: [],
      reminderSent: false,
    });
    setTitle('');
  };

  const handleClose = useCallback(async () => {
    try {
      await currentWindow.hide();
    } catch (error) {
      console.error('Failed to close widget window', error);
    }
  }, [currentWindow]);

  const handleTogglePin = useCallback(async () => {
    try {
      const next = !isPinned;
      await currentWindow.setAlwaysOnTop(next);
      setIsPinned(next);
    } catch (error) {
      console.error('Failed to toggle always-on-top', error);
    }
  }, [currentWindow, isPinned]);

  const renderTask = (task: TodoTask) => (
    <ListItem
      key={task.id}
      dense
      disableGutters
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: 0.5,
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Checkbox edge="start" checked={task.completed} tabIndex={-1} onChange={() => toggleTodo(task.id)} size="small" />
      <ListItemText
        primary={task.title}
        secondary={
          <Typography variant="caption" color="text.secondary">
            {task.dueDate ? new Date(task.dueDate).toLocaleString() : '无截止'}
            {task.category ? ` · ${task.category}` : ''}
          </Typography>
        }
        primaryTypographyProps={{ noWrap: true, fontSize: 14 }}
      />
    </ListItem>
  );

  return (
    <Paper
      elevation={16}
      sx={{
        width: '100%',
        height: '100%',
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #f6f8ff 0%, #ffffff 68%)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          p: 1.5,
          pb: 1.2,
          borderBottom: '1px solid rgba(120,144,255,0.2)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Box data-tauri-drag-region sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ cursor: 'default' }}>
            快览任务
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ position: 'relative', zIndex: 10 }}>
          <Tooltip title={isPinned ? '取消置顶' : '固定置顶'}>
            <IconButton size="small" onClick={handleTogglePin}>
              {isPinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="关闭">
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack spacing={1.5} sx={{ p: 2, pt: 1.5, flex: 1, overflow: 'hidden' }}>
        <Stack direction="row" spacing={1}>
          <TextField
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="快速记录任务"
            size="small"
            fullWidth
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button variant="contained" size="small" onClick={handleAdd}>
            添加
          </Button>
        </Stack>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 0.5 }}>
          逾期任务
        </Typography>
        <Box sx={{ 
          maxHeight: quickAdds.overdue.length === 0 ? '60px' : '150px', 
          minHeight: '60px',
          overflow: 'auto', 
          borderRadius: 2, 
          border: '1px solid', 
          borderColor: 'divider', 
          backgroundColor: 'background.paper' 
        }}>
          {quickAdds.overdue.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" height={60}>
              <Typography variant="caption" color="text.secondary">
                没有逾期任务
              </Typography>
            </Stack>
          ) : (
            <List dense disablePadding>
              {quickAdds.overdue.map(renderTask)}
            </List>
          )}
        </Box>

        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1 }}>
          今日 / 即将到期
        </Typography>
        <Box sx={{ 
          flex: 1,
          minHeight: '60px',
          overflow: 'auto', 
          borderRadius: 2, 
          border: '1px solid', 
          borderColor: 'divider', 
          backgroundColor: 'background.paper' 
        }}>
          {quickAdds.today.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" height={60}>
              <Typography variant="caption" color="text.secondary">
                今天没有任务
              </Typography>
            </Stack>
          ) : (
            <List dense disablePadding>
              {quickAdds.today.map(renderTask)}
            </List>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

export default TodoWidgetPage;
