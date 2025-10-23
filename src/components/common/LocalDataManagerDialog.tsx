import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { invoke } from '@tauri-apps/api/core';
import { useSetAtom } from 'jotai';

import EmptyState from './EmptyState';
import {
  categoriesAtom,
  tagsAtom,
  todosAtom,
} from '../../stores/todoStore';
import type { SpeechSession } from '../../types/speech';

type LocalDataCategory = 'tasks' | 'excel' | 'speech' | 'other';

interface LocalStorageEntry {
  key: string;
  label: string;
  description?: string;
  raw: string;
  parsed: unknown;
  sizeInBytes: number;
  category: LocalDataCategory;
}

interface SpeechSessionBackup {
  id: string;
  title: string;
  language: SpeechSession['language'];
  transcript: string;
  segments: SpeechSession['segments'];
  created_at: string;
  audio_filename: string;
  audio_base64: string;
}

interface BlinkBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  localStorage: Record<string, string>;
  speechSessions?: SpeechSessionBackup[];
}

const BACKUP_SCHEMA_VERSION = 1;

interface LocalDataManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

const KEY_METADATA: Record<
  string,
  { label: string; description?: string; category: LocalDataCategory }
> = {
  blink_todos_v1: {
    label: '任务列表',
    description: '所有任务的主数据，包括状态、标签、时间记录等。',
    category: 'tasks',
  },
  blink_todo_tags_v1: {
    label: '任务标签',
    description: '任务标签集合，用于任务筛选与标记。',
    category: 'tasks',
  },
  blink_todo_categories_v1: {
    label: '任务分类',
    description: '自定义的任务分类列表。',
    category: 'tasks',
  },
  blink_todo_view_mode: {
    label: '任务视图模式',
    description: '任务面板最近使用的视图模式设置。',
    category: 'tasks',
  },
  todo_widget_view_mode_v1: {
    label: '桌面小组件视图模式',
    description: '便捷任务组件的视图切换记录。',
    category: 'tasks',
  },
  todo_widget_notes_v1: {
    label: '桌面小组件便签',
    description: '任务桌面组件中保存的便签内容。',
    category: 'tasks',
  },
  todo_widget_reminders_v1: {
    label: '桌面小组件提醒',
    description: '任务桌面组件中的提醒事项。',
    category: 'tasks',
  },
  todo_widget_memo_v1: {
    label: '桌面小组件备忘录',
    description: '任务桌面组件的备忘录文本内容。',
    category: 'tasks',
  },
};

const EXCEL_PREFIX = 'excel_edits_';

const isTauriEnvironment = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const global = window as unknown as {
    __TAURI__?: Record<string, unknown>;
    __TAURI_IPC__?: unknown;
  };
  return Boolean(global.__TAURI__ || global.__TAURI_IPC__);
};

let dialogModule: typeof import('@tauri-apps/plugin-dialog') | null = null;
let fsModule: typeof import('@tauri-apps/plugin-fs') | null = null;

const ensureTauriModules = async () => {
  if (!dialogModule) {
    dialogModule = await import('@tauri-apps/plugin-dialog');
  }
  if (!fsModule) {
    fsModule = await import('@tauri-apps/plugin-fs');
  }
  return { dialog: dialogModule, fs: fsModule };
};

const formatSize = (sizeInBytes: number) => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }
  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
};

const stringifyData = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.error('序列化本地数据失败:', error);
    return String(value);
  }
};

const buildLocalStorageEntry = (key: string, raw: string): LocalStorageEntry => {
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  let category: LocalDataCategory = 'other';
  let label = key;
  let description: string | undefined;

  if (KEY_METADATA[key]) {
    const meta = KEY_METADATA[key];
    category = meta.category;
    label = meta.label;
    description = meta.description;
  } else if (key.startsWith(EXCEL_PREFIX)) {
    category = 'excel';
    const fileId = key.slice(EXCEL_PREFIX.length);
    label = fileId === 'excel_multi_upload' ? 'Excel 合并会话' : `Excel 编辑记录 (${fileId})`;
    description =
      fileId === 'excel_multi_upload'
        ? '多文件合并流程的编辑缓存数据。'
        : '针对指定 Excel 文件的单元格编辑缓存。';
  } else if (key.includes('todo')) {
    category = 'tasks';
    label = `任务相关数据 (${key})`;
  }

  return {
    key,
    raw,
    parsed,
    category,
    label,
    description,
    sizeInBytes: raw ? new Blob([raw]).size : 0,
  };
};

const LocalDataManagerDialog: React.FC<LocalDataManagerDialogProps> = ({
  open,
  onClose,
}) => {
  const [activeTab, setActiveTab] = React.useState<LocalDataCategory>('tasks');
  const [expandedEntry, setExpandedEntry] = React.useState<string | null>(null);
  const [localData, setLocalData] = React.useState<{
    tasks: LocalStorageEntry[];
    excel: LocalStorageEntry[];
    other: LocalStorageEntry[];
  }>({
    tasks: [],
    excel: [],
    other: [],
  });
  const [speechSessions, setSpeechSessions] = React.useState<SpeechSession[]>([]);
  const [speechLoading, setSpeechLoading] = React.useState(false);
  const [speechError, setSpeechError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [exportSummary, setExportSummary] = React.useState<{
    title: string;
    lines: string[];
  } | null>(null);

  const setTodos = useSetAtom(todosAtom);
  const setTags = useSetAtom(tagsAtom);
  const setCategories = useSetAtom(categoriesAtom);

  const refreshLocalStorage = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      setLocalData({ tasks: [], excel: [], other: [] });
      return;
    }
    const tasks: LocalStorageEntry[] = [];
    const excel: LocalStorageEntry[] = [];
    const other: LocalStorageEntry[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      const entry = buildLocalStorageEntry(key, raw);
      if (entry.category === 'tasks') {
        tasks.push(entry);
      } else if (entry.category === 'excel') {
        excel.push(entry);
      } else {
        other.push(entry);
      }
    }

    const sortEntries = (entries: LocalStorageEntry[]) =>
      entries.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

    setLocalData({
      tasks: sortEntries(tasks),
      excel: sortEntries(excel),
      other: sortEntries(other),
    });
  }, []);

  const refreshSpeechSessions = React.useCallback(async () => {
    if (!open) return;
    if (!isTauriEnvironment()) {
      setSpeechSessions([]);
      setSpeechError('当前环境暂不支持管理语音数据。');
      return;
    }

    setSpeechLoading(true);
    setSpeechError(null);
    try {
      const list = await invoke<SpeechSession[]>('list_speech_sessions');
      setSpeechSessions(list);
    } catch (error) {
      console.error('加载语音会话失败:', error);
      setSpeechError('加载语音历史记录失败，请稍后重试。');
    } finally {
      setSpeechLoading(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (open) {
      refreshLocalStorage();
      void refreshSpeechSessions();
      setFeedback(null);
    }
  }, [open, refreshLocalStorage, refreshSpeechSessions]);

  const handleChangeTab = React.useCallback(
    (_event: React.SyntheticEvent, value: LocalDataCategory) => {
      setActiveTab(value);
      if (value === 'speech') {
        void refreshSpeechSessions();
      }
    },
    [refreshSpeechSessions],
  );

  const handleToggleView = React.useCallback((key: string) => {
    setExpandedEntry(prev => (prev === key ? null : key));
  }, []);

  const handleCopyRaw = React.useCallback(async (raw: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(raw);
        setFeedback({ type: 'success', message: '数据已复制到剪贴板。' });
      } catch (error) {
        console.error('复制数据失败:', error);
        setFeedback({ type: 'error', message: '复制失败，请稍后重试。' });
      }
    } else {
      setFeedback({
        type: 'error',
        message: '当前环境不支持复制到剪贴板。',
      });
    }
  }, []);

  const clearTodoAtomByKey = React.useCallback((key: string) => {
    if (key === 'blink_todos_v1') {
      setTodos([]);
    } else if (key === 'blink_todo_tags_v1') {
      setTags([]);
    } else if (key === 'blink_todo_categories_v1') {
      setCategories([]);
    }
  }, [setCategories, setTags, setTodos]);

  const collectLocalStorageSnapshot = React.useCallback((): Record<string, string> => {
    const snapshot: Record<string, string> = {};
    if (typeof window === 'undefined' || !window.localStorage) {
      return snapshot;
    }
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        snapshot[key] = raw;
      }
    }
    return snapshot;
  }, []);

  const applyLocalStorageSnapshot = React.useCallback(
    (snapshot: Record<string, string>) => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      const managedKeys = [
        'blink_todos_v1',
        'blink_todo_tags_v1',
        'blink_todo_categories_v1',
        'blink_todo_view_mode',
        'todo_widget_view_mode_v1',
        'todo_widget_notes_v1',
        'todo_widget_reminders_v1',
        'todo_widget_memo_v1',
      ];

      managedKeys.forEach(key => {
        if (!(key in snapshot)) {
          try {
            window.localStorage.removeItem(key);
          } catch (error) {
            console.warn(`清理本地数据失败 (${key}):`, error);
          }
        }
      });

      Object.entries(snapshot).forEach(([key, value]) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (error) {
          console.error(`写入本地数据失败 (${key}):`, error);
        }
      });

      if (snapshot.blink_todos_v1) {
        try {
          const todos = JSON.parse(snapshot.blink_todos_v1);
          if (Array.isArray(todos)) {
            setTodos(todos);
          }
        } catch (error) {
          console.warn('解析任务列表失败', error);
        }
      } else {
        setTodos([]);
      }

      if (snapshot.blink_todo_tags_v1) {
        try {
          const tags = JSON.parse(snapshot.blink_todo_tags_v1);
          if (Array.isArray(tags)) {
            setTags(tags);
          }
        } catch (error) {
          console.warn('解析任务标签失败', error);
        }
      } else {
        setTags([]);
      }

      if (snapshot.blink_todo_categories_v1) {
        try {
          const categories = JSON.parse(snapshot.blink_todo_categories_v1);
          if (Array.isArray(categories)) {
            setCategories(categories);
          }
        } catch (error) {
          console.warn('解析任务分类失败', error);
        }
      } else {
        setCategories([]);
      }
    },
    [setCategories, setTags, setTodos],
  );

  const processBackupPayload = React.useCallback(
    async (payload: BlinkBackupPayload) => {
      const snapshot = payload.localStorage ?? {};
      applyLocalStorageSnapshot(snapshot);
      refreshLocalStorage();
      setSpeechError(null);

      let importedSpeechCount = 0;
      if (payload.speechSessions && payload.speechSessions.length > 0) {
        if (isTauriEnvironment()) {
          try {
            importedSpeechCount = await invoke<number>('import_speech_sessions', {
              sessions: payload.speechSessions,
            });
            await refreshSpeechSessions();
          } catch (error) {
            console.error('导入语音数据失败:', error);
            throw new Error('语音数据导入失败，请确认已在桌面应用中使用。');
          }
        } else {
          console.warn('检测到语音数据，但当前环境不支持导入。');
          importedSpeechCount = 0;
        }
      } else {
        await refreshSpeechSessions();
      }

      const storageCount = Object.keys(snapshot).length;
      const speechNote =
        !isTauriEnvironment() && payload.speechSessions && payload.speechSessions.length > 0
          ? '（当前环境未导入语音记录，请在桌面版完成导入）'
          : '';

      setFeedback({
        type: 'success',
        message: `导入完成：本地存储 ${storageCount} 项，语音记录 ${importedSpeechCount} 条${speechNote}`,
      });
    },
    [applyLocalStorageSnapshot, refreshLocalStorage, refreshSpeechSessions],
  );

  const handleImportBackupContent = React.useCallback(
    async (content: string) => {
      setIsImporting(true);
      setFeedback(null);
      try {
        const parsed = JSON.parse(content) as Partial<BlinkBackupPayload>;
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('备份文件格式不正确。');
        }
        if (typeof parsed.schemaVersion !== 'number') {
          throw new Error('备份文件缺少版本信息。');
        }
        if (parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
          throw new Error('备份文件版本过新，请升级应用后再试。');
        }

        await processBackupPayload({
          schemaVersion: parsed.schemaVersion,
          exportedAt: parsed.exportedAt ?? new Date().toISOString(),
          localStorage: parsed.localStorage ?? {},
          speechSessions: parsed.speechSessions ?? [],
        });
      } catch (error) {
        console.error('导入备份失败:', error);
        const message =
          error instanceof Error ? error.message : '导入失败，请检查备份文件后重试。';
        setFeedback({ type: 'error', message });
      } finally {
        setIsImporting(false);
      }
    },
    [processBackupPayload],
  );

  const handleImportClick = React.useCallback(async () => {
    setFeedback(null);
    if (isTauriEnvironment()) {
      try {
        const { dialog, fs } = await ensureTauriModules();
        const selected = await dialog.open({
          multiple: false,
          filters: [{ name: 'Kk 数据备份', extensions: ['json'] }],
        });
        if (!selected) {
          return;
        }
        const filePath = Array.isArray(selected) ? selected[0] : selected;
        if (!filePath) {
          return;
        }
        const bytes = await fs.readFile(filePath);
        const content = new TextDecoder().decode(bytes);
        await handleImportBackupContent(content);
      } catch (error) {
        console.error('读取备份文件失败:', error);
        setFeedback({ type: 'error', message: '读取备份文件失败，请重试。' });
      }
      return;
    }
    fileInputRef.current?.click();
  }, [handleImportBackupContent]);

  const handleImportFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (event.target) {
        event.target.value = '';
      }
      if (!file) {
        return;
      }
      try {
        const content = await file.text();
        await handleImportBackupContent(content);
      } catch (error) {
        console.error('读取备份文件失败:', error);
        setFeedback({ type: 'error', message: '读取备份文件失败，请重试。' });
      }
    },
    [handleImportBackupContent],
  );

  const handleExportData = React.useCallback(async () => {
    setFeedback(null);
    setIsExporting(true);
    setExportSummary(null);
    try {
      const snapshot = collectLocalStorageSnapshot();
      let speechSessionsBackup: SpeechSessionBackup[] | undefined;

      if (isTauriEnvironment()) {
        try {
          speechSessionsBackup = await invoke<SpeechSessionBackup[]>('export_speech_sessions');
        } catch (error) {
          console.error('导出语音数据失败:', error);
          throw new Error('导出语音数据失败，请稍后重试。');
        }
      }

      const payload: BlinkBackupPayload = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        localStorage: snapshot,
        ...(speechSessionsBackup && speechSessionsBackup.length
          ? { speechSessions: speechSessionsBackup }
          : {}),
      };

      const json = JSON.stringify(payload, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `Kk-backup-${timestamp}.json`;
      const storageCount = Object.keys(snapshot).length;
      const speechCount = speechSessionsBackup?.length ?? 0;

      if (isTauriEnvironment()) {
        const { dialog, fs } = await ensureTauriModules();
        const filePath = await dialog.save({
          title: '保存 Kk 数据备份',
          filters: [{ name: 'Kk 数据备份', extensions: ['json'] }],
          defaultPath: fileName,
        });
        if (!filePath) {
          return;
        }
        const bytes = new TextEncoder().encode(json);
        await fs.writeFile(filePath, bytes);
        setFeedback({
          type: 'success',
          message: `导出完成：本地存储 ${storageCount} 项，语音记录 ${speechCount} 条，文件已保存至 ${filePath}`,
        });
        setExportSummary({
          title: '备份已保存',
          lines: [
            `本地存储：${storageCount} 项`,
            `语音记录：${speechCount} 条`,
            `保存路径：${filePath}`,
          ],
        });
      } else {
        const hasFilePicker =
          typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function';
        const speechNote =
          speechCount === 0 && speechSessions.length > 0
            ? '（导出文件不包含语音数据，请在桌面版完成备份）'
            : '';

        if (hasFilePicker) {
          try {
            const saveHandle = await (window as any).showSaveFilePicker({
              suggestedName: fileName,
              types: [
                {
                  description: 'Kk 数据备份',
                  accept: { 'application/json': ['.json'] },
                },
              ],
            });
            const writable = await saveHandle.createWritable();
            await writable.write(json);
            await writable.close();

            setFeedback({
              type: 'success',
              message: `备份文件已保存：本地存储 ${storageCount} 项。${speechNote}`,
            });
            const summaryLines = [
              `本地存储：${storageCount} 项`,
              `文件名：${saveHandle?.name ?? fileName}`,
              '保存位置：您在文件选择器中指定的目录',
            ];
            if (speechNote) {
              summaryLines.push('语音数据需在桌面版进行备份。');
            }
            setExportSummary({
              title: '备份文件已保存',
              lines: summaryLines,
            });
          } catch (pickerError) {
            if ((pickerError as DOMException)?.name === 'AbortError') {
              setFeedback({
                type: 'error',
                message: '导出已取消。',
              });
              setExportSummary(null);
              return;
            }
            throw pickerError;
          }
        } else {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setFeedback({
            type: 'success',
            message: `备份文件已下载：本地存储 ${storageCount} 项。${speechNote}`,
          });
          const summaryLines = [
            `本地存储：${storageCount} 项`,
            '保存位置：浏览器默认的下载目录',
          ];
          if (speechNote) {
            summaryLines.push('语音数据需在桌面版进行备份。');
          }
          setExportSummary({
            title: '备份文件已下载',
            lines: summaryLines,
          });
        }
      }
    } catch (error) {
      console.error('导出本地数据失败:', error);
      const message =
        error instanceof Error ? error.message : '导出失败，请稍后重试。';
      setFeedback({ type: 'error', message });
    } finally {
      setIsExporting(false);
    }
  }, [collectLocalStorageSnapshot, speechSessions.length]);

  const handleDeleteEntry = React.useCallback(
    (entry: LocalStorageEntry) => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      const confirmed = window.confirm(
        `确定要删除「${entry.label}」的数据吗？此操作不可撤销。`,
      );
      if (!confirmed) {
        return;
      }
      try {
        window.localStorage.removeItem(entry.key);
        clearTodoAtomByKey(entry.key);
        setFeedback({ type: 'success', message: `已删除 ${entry.label}。` });
      } catch (error) {
        console.error('删除本地存储失败:', error);
        setFeedback({ type: 'error', message: '删除失败，请稍后重试。' });
      } finally {
        refreshLocalStorage();
      }
    },
    [clearTodoAtomByKey, refreshLocalStorage],
  );

  const handleDeleteSpeechSession = React.useCallback(
    async (session: SpeechSession) => {
      if (!isTauriEnvironment()) {
        setFeedback({
          type: 'error',
          message: '当前环境暂不支持删除语音数据。',
        });
        return;
      }
      const confirmed = window.confirm(
        `确定要删除「${session.title}」的语音记录吗？音频与转写内容将被一起移除。`,
      );
      if (!confirmed) return;
      try {
        await invoke('delete_speech_session', { sessionId: session.id });
        setFeedback({ type: 'success', message: '语音记录已删除。' });
      } catch (error) {
        console.error('删除语音记录失败:', error);
        setFeedback({
          type: 'error',
          message: '删除语音记录失败，请稍后重试。',
        });
      } finally {
        await refreshSpeechSessions();
      }
    },
    [refreshSpeechSessions],
  );

  const categoryTabs: Array<{ value: LocalDataCategory; label: string; count?: number }> =
    React.useMemo(
      () => [
        { value: 'tasks', label: '任务数据', count: localData.tasks.length },
        { value: 'excel', label: 'Excel 数据', count: localData.excel.length },
        { value: 'speech', label: '语音记录', count: speechSessions.length },
        { value: 'other', label: '其他数据', count: localData.other.length },
      ],
      [localData.excel.length, localData.other.length, localData.tasks.length, speechSessions.length],
    );

  const renderLocalStorageEntries = (entries: LocalStorageEntry[]) => {
    if (!entries.length) {
      return (
        <EmptyState
          title="暂无数据"
          description="这一分类下暂无可管理的本地数据。"
          height="180px"
        />
      );
    }

    return (
      <Stack spacing={2}>
        {entries.map(entry => {
          const isExpanded = expandedEntry === entry.key;
          return (
            <Paper
              key={entry.key}
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                borderColor: isExpanded ? 'primary.main' : 'divider',
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      {entry.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ wordBreak: 'break-all' }}
                    >
                      {entry.description ?? entry.key}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={formatSize(entry.sizeInBytes)}
                    color="default"
                    sx={{ fontWeight: 600 }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    size="small"
                    startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                    onClick={() => handleToggleView(entry.key)}
                  >
                    {isExpanded ? '隐藏内容' : '查看内容'}
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon fontSize="small" />}
                    onClick={() => handleCopyRaw(entry.raw)}
                  >
                    复制数据
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    onClick={() => handleDeleteEntry(entry)}
                  >
                    删除数据
                  </Button>
                </Stack>

                {isExpanded && (
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: 'grey.50',
                      borderRadius: 1.5,
                      p: 2,
                      fontSize: 13,
                      maxHeight: 260,
                      overflow: 'auto',
                    }}
                  >
                    {stringifyData(entry.parsed)}
                  </Box>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    );
  };

  const renderSpeechSessions = () => {
    if (!isTauriEnvironment()) {
      return (
        <EmptyState
          title="未启用语音数据"
          description="当前运行环境无法访问语音转写存储，请在 Tauri 应用内使用该功能。"
          height="200px"
        />
      );
    }

    if (speechLoading) {
      return (
        <Stack
          spacing={2}
          alignItems="center"
          justifyContent="center"
          sx={{ py: 8 }}
        >
          <CircularProgress size={32} />
          <Typography color="text.secondary">正在加载语音历史记录...</Typography>
        </Stack>
      );
    }

    if (speechError) {
      return (
        <EmptyState
          title="加载失败"
          description={speechError}
          height="200px"
          action={
            <Button
              variant="contained"
              size="small"
              onClick={() => refreshSpeechSessions()}
              startIcon={<RefreshOutlinedIcon fontSize="small" />}
            >
              重试
            </Button>
          }
        />
      );
    }

    if (!speechSessions.length) {
      return (
        <EmptyState
          title="暂无语音记录"
          description="完成一次语音识别后，可在此处查看与管理本地数据。"
          height="200px"
        />
      );
    }

    return (
      <Stack spacing={2}>
        {speechSessions.map(session => {
          const isExpanded = expandedEntry === session.id;
          return (
            <Paper
              key={session.id}
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                borderColor: isExpanded ? 'primary.main' : 'divider',
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      {session.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ wordBreak: 'break-all' }}
                    >
                      创建于：{new Date(session.created_at).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      语言：{session.language === 'zh' ? '中文' : 'English'} · 音频路径：{session.audio_path}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                      onClick={() => handleToggleView(session.id)}
                    >
                      {isExpanded ? '隐藏内容' : '查看内容'}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => void handleDeleteSpeechSession(session)}
                    >
                      删除记录
                    </Button>
                  </Stack>
                </Stack>
                {isExpanded && (
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: 'grey.50',
                      borderRadius: 1.5,
                      p: 2,
                      fontSize: 13,
                      maxHeight: 260,
                      overflow: 'auto',
                    }}
                  >
                    {stringifyData({
                      transcript: session.transcript,
                      segments: session.segments,
                    })}
                  </Box>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
        TransitionProps={{ onExited: () => setExpandedEntry(null) }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>本地数据管理中心</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<FileDownloadOutlinedIcon />}
                  onClick={() => void handleExportData()}
                  disabled={isExporting}
                >
                  {isExporting ? '导出中…' : '导出数据'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FileUploadOutlinedIcon />}
                  onClick={() => void handleImportClick()}
                  disabled={isImporting}
                >
                  {isImporting ? '导入中…' : '导入数据'}
                </Button>
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  ref={fileInputRef}
                  onChange={handleImportFileChange}
                />
              </Stack>
              {!isTauriEnvironment() && (
                <Typography variant="caption" color="text.secondary">
                  语音数据导入导出仅支持桌面版
                </Typography>
              )}
            </Stack>

            <Tabs
              value={activeTab}
              onChange={handleChangeTab}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                '& .MuiTab-root': {
                  alignItems: 'center',
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 48,
                },
              }}
            >
              {categoryTabs.map(tab => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography component="span">{tab.label}</Typography>
                      <Chip size="small" label={tab.count ?? 0} />
                    </Stack>
                  }
                />
              ))}
            </Tabs>

            {feedback && (
              <Alert
                severity={feedback.type}
                onClose={() => setFeedback(null)}
                sx={{ borderRadius: 2 }}
              >
                {feedback.message}
              </Alert>
            )}

            {activeTab === 'tasks' && renderLocalStorageEntries(localData.tasks)}
            {activeTab === 'excel' && renderLocalStorageEntries(localData.excel)}
            {activeTab === 'other' && renderLocalStorageEntries(localData.other)}
            {activeTab === 'speech' && renderSpeechSessions()}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Tooltip title="重新扫描本地存储与语音记录">
            <span>
              <IconButton
                color="primary"
                onClick={() => {
                  refreshLocalStorage();
                  void refreshSpeechSessions();
                }}
              >
                <RefreshOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={onClose}>关闭</Button>
        </DialogActions>
      </Dialog>

      {exportSummary && (
        <Dialog
          open
          onClose={() => setExportSummary(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{exportSummary.title}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              {exportSummary.lines.map((line, index) => (
                <Typography key={index} variant="body2" color="text.primary">
                  {line}
                </Typography>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportSummary(null)} autoFocus>
              确定
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default LocalDataManagerDialog;
