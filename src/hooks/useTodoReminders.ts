import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  todosAtom,
  updateTodoAtom,
  TodoTask,
} from '../stores/todoStore';
import {
  ensureNotificationPermission,
  sendNativeNotification,
} from '../utils/notificationUtils';
import { debugError, debugLog } from '../utils/logger';
import { extractTextFromHtml } from '../utils/richTextUtils';

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

export const useTodoReminders = () => {
  const todos = useAtomValue(todosAtom);
  const updateTodo = useSetAtom(updateTodoAtom);
  const tasksRef = useRef<TodoTask[]>(todos);

  useEffect(() => {
    tasksRef.current = todos;
  }, [todos]);

  useEffect(() => {
    let active = true;
    
    const initNotifications = async () => {
      try {
        const hasPermission = await ensureNotificationPermission();
        debugLog('Notification permission status:', hasPermission);
      } catch (error) {
        debugError('Error requesting notification permission:', error);
      }
    };
    
    initNotifications();

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
          debugLog('Sending notification for task:', task.title);
          const notificationBody = task.description
            ? extractTextFromHtml(task.description) || '该完成任务了！'
            : '该完成任务了！';
          await sendNativeNotification({
            title: `任务提醒: ${task.title}`,
            body: notificationBody,
          });
          debugLog('Notification sent successfully for task:', task.title);
        } catch (error) {
          debugError('Failed to send reminder notification for task:', task.title, error);
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
