import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  todosAtom,
  updateTodoAtom,
  TodoTask,
} from '../stores/todoStore';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

const REMINDER_GRACE_WINDOW_MINUTES = 10;

const shouldTriggerReminder = (task: TodoTask, now: Date): boolean => {
  if (!task.reminder || task.completed) return false;
  if (task.reminderSent) return false;
  const reminderTime = new Date(task.reminder);
  if (Number.isNaN(reminderTime.getTime())) return false;
  if (reminderTime > now) return false;
  const diffMinutes = (now.getTime() - reminderTime.getTime()) / 60000;
  return diffMinutes <= REMINDER_GRACE_WINDOW_MINUTES;
};

const ensureNotificationPermission = async () => {
  const granted = await isPermissionGranted();
  if (!granted) {
    await requestPermission();
  }
};

export const useTodoReminders = () => {
  const todos = useAtomValue(todosAtom);
  const updateTodo = useSetAtom(updateTodoAtom);
  const tasksRef = useRef<TodoTask[]>(todos);

  useEffect(() => {
    tasksRef.current = todos;
  }, [todos]);

  useEffect(() => {
    let active = true;
    ensureNotificationPermission();

    const interval = setInterval(async () => {
      if (!active) return;
      const list = tasksRef.current;
      if (!list || list.length === 0) {
        return;
      }
      const now = new Date();

      for (const task of list) {
        if (!shouldTriggerReminder(task, now)) continue;

        try {
          await sendNotification({
            title: task.title,
            body: task.description ? task.description : '任务提醒',
          });
        } catch (error) {
          console.error('Failed to send reminder notification', error);
        }

        updateTodo({
          id: task.id,
          changes: {
            reminderSent: true,
          },
        });
      }
    }, 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [updateTodo]);
};
