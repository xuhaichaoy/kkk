import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AlarmIcon from "@mui/icons-material/Alarm";
import CloseIcon from "@mui/icons-material/Close";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import {
	Box,
	Button,
	IconButton,
	Menu,
	MenuItem,
	Paper,
	Stack,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	Typography,
} from "@mui/material";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isThisWeek, isToday, startOfToday } from "date-fns";
import TodoFormDialog from "../components/todo/TodoFormDialog";
import TodoTimeLogDialog from "../components/todo/TodoTimeLogDialog";
import WidgetBoardView from "../components/todo/widget/WidgetBoardView";
import WidgetMemoView from "../components/todo/widget/WidgetMemoView";
import WidgetNotesView from "../components/todo/widget/WidgetNotesView";
import WidgetRemindersView from "../components/todo/widget/WidgetRemindersView";
import {
	QuickNote,
	createNoteId,
} from "../components/todo/widget/utils";
import { useTodoReminders } from "../hooks/useTodoReminders";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import type { TodoPriority, TodoStatus, TodoTask } from "../stores/todoStore";
import {
	addTodoAtom,
	removeTimeEntryAtom,
	upsertCategoryAtom,
	todosAtom,
	updateTodoAtom,
	upsertTagAtom,
	upsertTimeEntryAtom,
} from "../stores/todoStore";
import {
	reminderLogAtom,
	updateReminderLogAtom,
	type TodoReminderLogEntry,
} from "../stores/todoReminderStore";
import {
	getNextHalfHourIsoString,
	getOverdueTodos,
	getTodayTodos,
	getWeekTodos,
	sortTasks,
} from "../utils/todoUtils";

const VIEW_MODE_KEY = "todo_widget_view_mode_v1";
const NOTES_KEY = "todo_widget_notes_v1";
const MEMO_KEY = "todo_widget_memo_v1";

const PRIORITY_ALIASES: Record<string, TodoPriority> = {
	high: "high",
	h: "high",
	urgent: "high",
	"1": "high",
	"高": "high",
	"高优先": "high",
	"緊急": "high",
	"紧急": "high",
	"重要": "high",
	medium: "medium",
	m: "medium",
	"2": "medium",
	"中": "medium",
	"中优先": "medium",
	low: "low",
	l: "low",
	"3": "low",
	"低": "low",
	"低优先": "low",
};

const POSTPONE_OPTIONS: Array<{ label: string; minutes: number }> = [
	{ label: "推迟 5 分钟", minutes: 5 },
	{ label: "推迟 15 分钟", minutes: 15 },
	{ label: "推迟 30 分钟", minutes: 30 },
	{ label: "推迟到明天", minutes: 24 * 60 },
];

const parseQuickTaskInput = (input: string): {
	title: string;
	tags: string[];
	category?: string;
	priority: TodoPriority;
} => {
	const normalizedInput = input
		.replace(/＠/g, "@")
		.replace(/＃/g, "#")
		.replace(/！/g, "!");
	const tokens = normalizedInput.trim().split(/\s+/);
	const tags: string[] = [];
	let category: string | undefined;
	let priority: TodoPriority = "none";
	const titleParts: string[] = [];

	tokens.forEach((token) => {
		if (!token) return;
		if (token.startsWith("@") && token.length > 1) {
			const tag = token.slice(1);
			if (tag && !tags.includes(tag)) {
				tags.push(tag);
			}
			return;
		}
		if (token.startsWith("#") && token.length > 1) {
			category = token.slice(1);
			return;
		}
		if (token.startsWith("!") && token.length > 1) {
			const normalized = token.slice(1).toLowerCase();
			const mapped = PRIORITY_ALIASES[normalized];
			if (mapped) {
				priority = mapped;
			} else if (PRIORITY_ALIASES[token.slice(1)]) {
				priority = PRIORITY_ALIASES[token.slice(1)];
			}
			return;
		}
		titleParts.push(token);
	});

	const title = titleParts.join(" ").trim();
	return {
		title: title || input.trim(),
		tags,
		category,
		priority,
	};
};

const TodoWidgetPage: FC = () => {
	const todos = useAtomValue(todosAtom);
	const addTodo = useSetAtom(addTodoAtom);
	const updateTodo = useSetAtom(updateTodoAtom);
	const upsertTimeEntry = useSetAtom(upsertTimeEntryAtom);
	const removeTimeEntry = useSetAtom(removeTimeEntryAtom);
	const reminderLog = useAtomValue(reminderLogAtom);
	const updateReminderLog = useSetAtom(updateReminderLogAtom);
	const upsertTag = useSetAtom(upsertTagAtom);
	const upsertCategory = useSetAtom(upsertCategoryAtom);

	// 启用任务提醒功能
	useTodoReminders();
	const [title, setTitle] = useState("");
	const [isPinned, setIsPinned] = useState(true);
	const currentWindow = useMemo(() => getCurrentWebviewWindow(), []);
	const [boardScope, setBoardScope] = useState<"today" | "week">("today");
	const [postponeMenu, setPostponeMenu] = useState<
		{ taskId: string; anchor: HTMLElement } | null
	>(null);
	const [viewMode, setViewMode] = useState<
		"board" | "notes" | "reminders" | "memo"
	>(() => {
		if (typeof window === "undefined") return "board";
		const stored = window.localStorage.getItem(VIEW_MODE_KEY);
		return stored === "notes" || stored === "reminders" || stored === "memo"
			? stored
			: "board";
	});
	const [notes, setNotes] = useState<QuickNote[]>([]);
	const [memoText, setMemoText] = useState("");
	const [noteDraft, setNoteDraft] = useState("");
	const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
	const [timeLogOpen, setTimeLogOpen] = useState(false);
	const [timeLogTaskId, setTimeLogTaskId] = useState<string | null>(null);
	const timeLogTask = useMemo(() => {
		if (!timeLogTaskId) return null;
		return todos.find((item) => item.id === timeLogTaskId) ?? null;
	}, [timeLogTaskId, todos]);

	const boardTaskGroups = useMemo(() => {
		const active = todos.filter((task) => !task.completed);
		if (active.length === 0) {
			return { overdue: [] as TodoTask[], today: [] as TodoTask[], week: [] as TodoTask[] };
		}

		const sorted = [...active].sort(sortTasks);
		const now = new Date();

		const overdueMap = new Map<string, TodoTask>();
		getOverdueTodos(sorted).forEach((task) => {
			overdueMap.set(task.id, task);
		});
		sorted.forEach((task) => {
			if (overdueMap.has(task.id)) return;
			if (!task.reminder) return;
			const reminderDate = new Date(task.reminder);
			if (Number.isNaN(reminderDate.getTime())) return;
			if (reminderDate < now) {
				overdueMap.set(task.id, task);
			}
		});

		const todayMap = new Map<string, TodoTask>();
		getTodayTodos(sorted).forEach((task) => {
			if (!overdueMap.has(task.id)) {
				todayMap.set(task.id, task);
			}
		});
		sorted.forEach((task) => {
			if (overdueMap.has(task.id) || todayMap.has(task.id)) return;
			if (!task.reminder) return;
			const reminderDate = new Date(task.reminder);
			if (Number.isNaN(reminderDate.getTime())) return;
			if (isToday(reminderDate)) {
				todayMap.set(task.id, task);
			}
		});

		const weekMap = new Map<string, TodoTask>();
		getWeekTodos(sorted).forEach((task) => {
			if (!overdueMap.has(task.id) && !todayMap.has(task.id)) {
				weekMap.set(task.id, task);
			}
		});
		sorted.forEach((task) => {
			if (overdueMap.has(task.id) || todayMap.has(task.id) || weekMap.has(task.id)) return;
			if (!task.reminder) return;
			const reminderDate = new Date(task.reminder);
			if (Number.isNaN(reminderDate.getTime())) return;
			if (isThisWeek(reminderDate, { weekStartsOn: 1 })) {
				weekMap.set(task.id, task);
			}
		});

		const toSortedArray = (map: Map<string, TodoTask>) =>
			Array.from(map.values()).sort(sortTasks);

		return {
			overdue: toSortedArray(overdueMap),
			today: toSortedArray(todayMap),
			week: toSortedArray(weekMap),
		};
	}, [todos]);

	const boardSections = useMemo(() => {
		const sections: Array<{ key: string; title: string; tasks: TodoTask[] }> = [];
		if (boardTaskGroups.overdue.length > 0) {
			sections.push({ key: "overdue", title: "逾期", tasks: boardTaskGroups.overdue });
		}
		if (boardScope === "today") {
			if (boardTaskGroups.today.length > 0) {
				sections.push({ key: "today", title: "今日", tasks: boardTaskGroups.today });
			}
		} else if (boardTaskGroups.week.length > 0) {
			sections.push({ key: "week", title: "本周", tasks: boardTaskGroups.week });
		}
		return sections;
	}, [boardScope, boardTaskGroups]);

	const boardTaskCount = useMemo(() => {
		const overdueCount = boardTaskGroups.overdue.length;
		if (boardScope === "today") {
			return overdueCount + boardTaskGroups.today.length;
		}
		return overdueCount + boardTaskGroups.week.length;
	}, [boardScope, boardTaskGroups]);

	const hasBoardTasks = boardTaskCount > 0;

	const reminderEntries = useMemo(
		() =>
			[...reminderLog]
				.sort(
					(a, b) =>
						new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
				)
				.slice(0, 20),
		[reminderLog],
	);

	const todoMap = useMemo(() => new Map(todos.map((task) => [task.id, task])), [todos]);

	const todayBase = useMemo(() => startOfToday(), []);

	const todayTasks = useMemo(
		() => getTodayTodos(todos, todayBase),
		[todos, todayBase],
	);

	const overviewCounts = useMemo(() => {
		const ids = new Set<string>();
		boardTaskGroups.overdue.forEach((task) => ids.add(task.id));
		boardTaskGroups.today.forEach((task) => ids.add(task.id));
		todayTasks.forEach((task) => ids.add(task.id));
		let completed = 0;
		ids.forEach((id) => {
			const task = todoMap.get(id);
			if (task?.completed) {
				completed += 1;
			}
		});
		return {
			completed,
			total: ids.size,
		};
	}, [boardTaskGroups.overdue, boardTaskGroups.today, todayTasks, todoMap]);

	const todayLoggedMinutes = useMemo(() => {
		return todos.reduce((sum, task) => {
			if (!task.timeEntries) return sum;
			const entrySum = task.timeEntries.reduce((entryTotal, entry) => {
				const date = entry.date ? new Date(entry.date) : null;
				if (!date || !isToday(date)) return entryTotal;
				return entryTotal + (Number(entry.durationMinutes) || 0);
			}, 0);
			return sum + entrySum;
		}, 0);
	}, [todos]);

	const formatDuration = useCallback((minutes: number) => {
		if (minutes <= 0) return "0h";
		if (minutes < 60) return `${minutes}min`;
		const hours = minutes / 60;
		return hours % 1 === 0 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
	}, []);

	const pendingReminderCount = useMemo(
		() => reminderLog.filter((entry) => !entry.completed).length,
		[reminderLog],
	);

	const primaryTask = useMemo(() => {
		for (const section of boardSections) {
			const candidate = section.tasks.find((task) => !task.completed);
			if (candidate) return candidate;
		}
		return null;
	}, [boardSections]);

	useEffect(() => {
		let isMounted = true;
		currentWindow
			.isAlwaysOnTop()
			.then((result) => {
				if (isMounted) {
					setIsPinned(result);
				}
			})
			.catch((error) => {
				console.error("Failed to read always-on-top state", error);
			});
		return () => {
			isMounted = false;
		};
	}, [currentWindow]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const storedNotes = window.localStorage.getItem(NOTES_KEY);
		const storedMemo = window.localStorage.getItem(MEMO_KEY);
		if (storedNotes) {
			try {
				setNotes(JSON.parse(storedNotes));
			} catch (error) {
				console.warn("Failed to parse notes", error);
			}
		}
		if (storedMemo) {
			setMemoText(storedMemo);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
	}, [viewMode]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
	}, [notes]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(MEMO_KEY, memoText);
	}, [memoText]);


	const handleAddTask = () => {
		const trimmed = title.trim();
		if (!trimmed) return;
		const parsed = parseQuickTaskInput(trimmed);
		if (!parsed.title) return;
		parsed.tags.forEach((tag) => upsertTag(tag));
		if (parsed.category) {
			upsertCategory(parsed.category);
		}
		addTodo({
			title: parsed.title,
			description: "",
			notes: "",
			reflection: "",
			priority: parsed.priority,
			completed: false,
			dueDate: getNextHalfHourIsoString(),
			tags: parsed.tags,
			category: parsed.category,
			reminderSent: false,
		});
		setTitle("");
	};

	const handleClose = useCallback(async () => {
		try {
			await currentWindow.hide();
		} catch (error) {
			console.error("Failed to close widget window", error);
		}
	}, [currentWindow]);

	const handleTogglePin = useCallback(async () => {
		try {
			const next = !isPinned;
			await currentWindow.setAlwaysOnTop(next);
			setIsPinned(next);
		} catch (error) {
			console.error("Failed to toggle always-on-top", error);
		}
	}, [currentWindow, isPinned]);

	const handleToggleTaskCompletion = useCallback(
		(task: TodoTask, completed: boolean) => {
			const nextStatus: TodoStatus = completed
				? "completed"
				: task.status && task.status !== "completed"
					? task.status
					: "notStarted";
			updateTodo({
				id: task.id,
				changes: {
					completed,
					status: nextStatus,
					reminderSent: completed ? true : false,
				},
			});
		},
		[updateTodo],
	);

	const handleOpenPostponeMenu = useCallback((taskId: string, anchor: HTMLElement) => {
		setPostponeMenu({ taskId, anchor });
	}, []);

	const handleClosePostponeMenu = useCallback(() => {
		setPostponeMenu(null);
	}, []);

	const handlePostponeTask = useCallback(
		(taskId: string, minutes: number): string | undefined => {
			const target = todos.find((item) => item.id === taskId);
			if (!target) return undefined;

			const deltaMs = minutes * 60 * 1000;
			const shiftValue = (value?: string) => {
				if (!value) return undefined;
				const date = new Date(value);
				if (Number.isNaN(date.getTime())) return undefined;
				return new Date(date.getTime() + deltaMs).toISOString();
			};

			const changes: Partial<TodoTask> = {
				reminderSent: false,
			};
			let resultingReminder: string | undefined;

			const nextDue = shiftValue(target.dueDate);
			const nextDueEnd = shiftValue(target.dueDateEnd);
			const nextReminder = shiftValue(target.reminder);

			if (nextDue) {
				changes.dueDate = nextDue;
			} else if (!target.dueDate && nextDueEnd) {
				changes.dueDate = nextDueEnd;
			}
			if (nextDueEnd) {
				changes.dueDateEnd = nextDueEnd;
			}
			if (nextReminder) {
				changes.reminder = nextReminder;
				resultingReminder = nextReminder;
			} else if (!target.reminder && (changes.dueDate || nextDue)) {
				const fallbackReminder = changes.dueDate ?? nextDue;
				if (fallbackReminder) {
					changes.reminder = fallbackReminder;
					resultingReminder = fallbackReminder;
				}
			}

			if (!changes.dueDate && !changes.reminder) {
				const fallback = new Date(Date.now() + deltaMs).toISOString();
				changes.dueDate = fallback;
				changes.reminder = fallback;
				resultingReminder = fallback;
			}

			if (!resultingReminder && typeof changes.reminder === "string") {
				resultingReminder = changes.reminder;
			}

			updateTodo({
				id: taskId,
				changes,
			});
			setPostponeMenu(null);
		return resultingReminder;
	},
	[todos, updateTodo],
	);

	const handleSnoozeReminderEntry = useCallback(
		(entry: TodoReminderLogEntry, minutes: number) => {
			const task = todoMap.get(entry.taskId);
			if (!task) return;
			const nextReminder = handlePostponeTask(entry.taskId, minutes);
			if (nextReminder) {
				updateReminderLog({
					id: entry.id,
					changes: {
						snoozedUntil: nextReminder,
						completed: false,
					},
				});
			}
		},
		[handlePostponeTask, todoMap, updateReminderLog],
	);

	const handleCompleteReminderEntry = useCallback(
		(entry: TodoReminderLogEntry) => {
			const task = todoMap.get(entry.taskId);
			if (task) {
				updateTodo({
					id: entry.taskId,
					changes: {
						completed: true,
						status: "completed",
						reminderSent: true,
					},
				});
			}
			updateReminderLog({
				id: entry.id,
				changes: {
					completed: true,
				},
			});
		},
		[todoMap, updateReminderLog, updateTodo],
	);

	const handleEditTask = useCallback((task: TodoTask) => {
		setEditingTask(task);
	}, []);

	const handleCloseEditDialog = useCallback(() => {
		setEditingTask(null);
	}, []);

	const handleOpenReminderDetails = useCallback(
		(entry: TodoReminderLogEntry) => {
			const task = todoMap.get(entry.taskId);
			if (task) {
				handleEditTask(task);
			}
		},
		[handleEditTask, todoMap],
	);

const handleOpenTimeLog = useCallback((task: TodoTask) => {
	setTimeLogTaskId(task.id);
	setTimeLogOpen(true);
}, []);

const handleCloseTimeLog = useCallback(() => {
	setTimeLogOpen(false);
	setTimeLogTaskId(null);
}, []);

const handleStartFocus = useCallback(() => {
	if (!primaryTask) return;
	if (primaryTask.status !== "inProgress") {
		updateTodo({
			id: primaryTask.id,
			changes: {
				status: "inProgress",
			},
		});
	}
	handleEditTask(primaryTask);
}, [handleEditTask, primaryTask, updateTodo]);

const handleQuickLog = useCallback(() => {
	if (!primaryTask) return;
	handleOpenTimeLog(primaryTask);
}, [handleOpenTimeLog, primaryTask]);

	const handleSubmitTimeEntry = useCallback(
		(payload: {
			taskId: string;
			entryId?: string;
			date: string;
			durationMinutes: number;
			comment?: string;
		}) => {
			upsertTimeEntry(payload);
		},
		[upsertTimeEntry],
	);

	const handleDeleteTimeEntry = useCallback(
		(taskId: string, entryId: string) => {
			removeTimeEntry({ taskId, entryId });
		},
		[removeTimeEntry],
	);

	const sortedNotes = useMemo(() => {
		return [...notes].sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}, [notes]);

	const addNote = () => {
		const trimmed = noteDraft.trim();
		if (!trimmed) return;
		setNotes((prev) => [
			{
				id: createNoteId(),
				text: trimmed,
				createdAt: new Date().toISOString(),
			},
			...prev,
		]);
		setNoteDraft("");
	};

	const togglePinNote = (id: string) => {
		setNotes((prev) =>
			prev.map((note) =>
				note.id === id ? { ...note, pinned: !note.pinned } : note,
			),
		);
	};

const deleteNote = (id: string) => {
	setNotes((prev) => prev.filter((note) => note.id !== id));
};

const handlePostponeTomorrow = useCallback(
	(task: TodoTask) => {
		handlePostponeTask(task.id, 24 * 60);
	},
	[handlePostponeTask],
);

const handleTestNotification = useCallback(async () => {
		try {
			console.log("Checking notification permission in widget...");
			const granted = await isPermissionGranted();
			console.log("Widget permission granted:", granted);
			
			if (!granted) {
				console.log("Requesting notification permission in widget...");
				const permission = await requestPermission();
				console.log("Widget permission request result:", permission);
				
				if (permission !== 'granted') {
					console.error("Widget notification permission not granted:", permission);
					return;
				}
			}
			
			console.log("Attempting to send test notification from widget...");
			await sendNotification({
				title: "小组件测试通知",
				body: "来自小组件的桌面通知测试！",
			});
			console.log("Test notification sent successfully from widget");
		} catch (error) {
			console.error("Failed to send test notification from widget:", error);
		}
	}, []);

	// 快捷键支持
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Ctrl/Cmd + N: 快速添加任务
			if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
				event.preventDefault();
				if (viewMode === "board") {
					const input = document.querySelector('input[placeholder="快速记录任务"]') as HTMLInputElement;
					if (input) {
						input.focus();
					}
				}
			}
			// Ctrl/Cmd + 1-4: 切换视图模式
			else if ((event.ctrlKey || event.metaKey) && ['1', '2', '3', '4'].includes(event.key)) {
				event.preventDefault();
				const modes = ['board', 'notes', 'reminders', 'memo'] as const;
				const index = parseInt(event.key) - 1;
				if (modes[index]) {
					setViewMode(modes[index]);
				}
			}
			// Escape: 关闭小组件
			else if (event.key === 'Escape') {
				event.preventDefault();
				handleClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [viewMode, handleClose]);

	return (
		<Paper
			elevation={24}
			sx={{
				width: "100%",
				height: "100%",
				borderRadius: 0,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
				position: "relative",
				"&::before": {
					content: '""',
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: "rgba(255, 255, 255, 0.95)",
					backdropFilter: "blur(20px)",
					zIndex: 0,
				},
			}}
		>
			<Stack
				direction="row"
				alignItems="center"
				justifyContent="space-between"
				sx={{
					p: 1,
					pb: 0.5,
					borderBottom: "1px solid rgba(102, 126, 234, 0.2)",
					backdropFilter: "blur(20px)",
					background: "rgba(255, 255, 255, 0.8)",
					position: "relative",
					zIndex: 1,
					minHeight: 32,
				}}
			>
				<Box
					data-tauri-drag-region
					sx={{ flex: 1, display: "flex", alignItems: "center" }}
				>
					<Typography
						variant="subtitle2"
						fontWeight={600}
						sx={{ 
							cursor: "default",
							background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
							backgroundClip: "text",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							fontSize: "0.9rem",
						}}
					>
						kk
					</Typography>
				</Box>
				<Stack
					direction="row"
					spacing={0.5}
					sx={{ position: "relative", zIndex: 10 }}
				>
					<Tooltip title="测试通知">
						<IconButton 
							size="small" 
							onClick={handleTestNotification}
							sx={{
								"&:hover": {
									background: "rgba(76, 175, 80, 0.1)",
								},
							}}
						>
							<AlarmIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip title={isPinned ? "取消置顶" : "固定置顶"}>
						<IconButton 
							size="small" 
							onClick={handleTogglePin}
							sx={{
								background: isPinned ? "rgba(102, 126, 234, 0.1)" : "transparent",
								"&:hover": {
									background: "rgba(102, 126, 234, 0.2)",
								},
							}}
						>
							{isPinned ? (
								<PushPinIcon fontSize="small" sx={{ color: "#667eea" }} />
							) : (
								<PushPinOutlinedIcon fontSize="small" />
							)}
						</IconButton>
					</Tooltip>
					<Tooltip title="关闭">
						<IconButton 
							size="small" 
							onClick={handleClose}
							sx={{
								"&:hover": {
									background: "rgba(244, 67, 54, 0.1)",
								},
							}}
						>
							<CloseIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Stack>
			</Stack>

			<Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 1.5, pb: 1, position: "relative", zIndex: 1 }}>
				{[
					{
						label: "今日已完成",
						value: `${overviewCounts.completed}/${overviewCounts.total || 0}`,
					},
					{
						label: "累计用时",
						value: formatDuration(todayLoggedMinutes),
					},
					{
						label: "提醒",
						value: `${pendingReminderCount} 条`,
					},
				].map((item) => (
					<Box
						key={item.label}
						sx={{
							flex: 1,
							px: 2,
							py: 1.25,
							borderRadius: 2,
							background: "linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)",
							border: "1px solid rgba(102, 126, 234, 0.2)",
							backdropFilter: "blur(12px)",
						}}
					>
						<Typography variant="caption" color="text.secondary">
							{item.label}
						</Typography>
						<Typography variant="subtitle1" fontWeight={700}>
							{item.value}
						</Typography>
					</Box>
				))}
			</Stack>

			<Stack spacing={2} sx={{ px: 2.5, pb: 2, flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
				<ToggleButtonGroup
					value={viewMode}
					exclusive
					onChange={(_, value) => value && setViewMode(value)}
					size="small"
					color="primary"
					fullWidth
					sx={{
						display: "grid",
						gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
						gap: 1,
						bgcolor: "rgba(255, 255, 255, 0.6)",
						borderRadius: 2,
						p: 0.5,
						backdropFilter: "blur(10px)",
						border: "1px solid rgba(102, 126, 234, 0.2)",
					}}
				>
					<ToggleButton
						value="board"
						sx={{
							borderRadius: 1.5,
							"&.Mui-selected": {
								background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								"&:hover": {
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								},
							},
							"&:hover": {
								background: "rgba(102, 126, 234, 0.1)",
							},
						}}
					>
						<Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
							<ViewKanbanIcon fontSize="small" />
							<Typography variant="caption">今日任务</Typography>
						</Stack>
					</ToggleButton>
					<ToggleButton
						value="reminders"
						sx={{
							borderRadius: 1.5,
							"&.Mui-selected": {
								background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								"&:hover": {
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								},
							},
							"&:hover": {
								background: "rgba(102, 126, 234, 0.1)",
							},
						}}
					>
						<Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
							<AlarmIcon fontSize="small" />
							<Typography variant="caption">提醒</Typography>
						</Stack>
					</ToggleButton>
					<ToggleButton
						value="notes"
						sx={{
							borderRadius: 1.5,
							"&.Mui-selected": {
								background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								"&:hover": {
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								},
							},
							"&:hover": {
								background: "rgba(102, 126, 234, 0.1)",
							},
						}}
					>
						<Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
							<NoteAltIcon fontSize="small" />
							<Typography variant="caption">便签</Typography>
						</Stack>
					</ToggleButton>
					<ToggleButton
						value="memo"
						sx={{
							borderRadius: 1.5,
							"&.Mui-selected": {
								background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								color: "white",
								"&:hover": {
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
								},
							},
							"&:hover": {
								background: "rgba(102, 126, 234, 0.1)",
							},
						}}
					>
						<Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
							<StickyNote2Icon fontSize="small" />
							<Typography variant="caption">备忘</Typography>
						</Stack>
					</ToggleButton>
				</ToggleButtonGroup>

				{(viewMode === "board" || viewMode === "reminders") && (
					<Box
						sx={{
							borderRadius: 2,
							border: "1px solid rgba(102, 126, 234, 0.2)",
							background: "rgba(255, 255, 255, 0.85)",
							backdropFilter: "blur(10px)",
							p: 1.5,
						}}
					>
						<Stack direction="row" spacing={1.5} alignItems="center">
							<TextField
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="快速添加今日任务，支持 @标签 #分类 !优先级"
								size="small"
								fullWidth
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										background: "rgba(255, 255, 255, 0.9)",
										"&:hover": {
											background: "rgba(255, 255, 255, 0.95)",
										},
										"&.Mui-focused": {
											background: "rgba(255, 255, 255, 1)",
										},
									},
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										handleAddTask();
									}
								}}
							/>
							<Button
								variant="contained"
								onClick={handleAddTask}
								sx={{ borderRadius: 2, px: 3, flexShrink: 0 }}
							>
								添加
							</Button>
							<Button
								variant="outlined"
								startIcon={<AccessTimeIcon fontSize="small" />}
								onClick={handleQuickLog}
								disabled={!primaryTask}
								sx={{ flexShrink: 0 }}
							>
								登记用时
							</Button>
						</Stack>
					</Box>
				)}

				{viewMode === "board" && (
					<WidgetBoardView
						boardScope={boardScope}
						onBoardScopeChange={setBoardScope}
						sections={boardSections}
						taskCount={boardTaskCount}
						hasTasks={hasBoardTasks}
						onToggleTask={handleToggleTaskCompletion}
						onPostponeTomorrow={handlePostponeTomorrow}
						onOpenPostponeMenu={handleOpenPostponeMenu}
						onOpenTimeLog={handleOpenTimeLog}
						onOpenTaskDetails={handleEditTask}
					/>
				)}

				{viewMode === "reminders" && (
					<WidgetRemindersView
						entries={reminderEntries}
						taskLookup={todoMap}
						onOpenTask={handleOpenReminderDetails}
						onSnooze={handleSnoozeReminderEntry}
						onComplete={handleCompleteReminderEntry}
					/>
				)}

				{viewMode === "notes" && (
					<WidgetNotesView
						draft={noteDraft}
						onDraftChange={setNoteDraft}
						notes={sortedNotes}
						onAddNote={addNote}
						onTogglePin={togglePinNote}
						onDelete={deleteNote}
					/>
				)}

				{viewMode === "memo" && (
					<WidgetMemoView value={memoText} onChange={setMemoText} />
				)}
			</Stack>


	<Menu
		anchorEl={postponeMenu?.anchor ?? null}
		open={Boolean(postponeMenu)}
		onClose={handleClosePostponeMenu}
		anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
		transformOrigin={{ vertical: "top", horizontal: "right" }}
	>
		{POSTPONE_OPTIONS.map((option) => (
			<MenuItem
				key={option.minutes}
				onClick={() => {
					if (postponeMenu) {
						handlePostponeTask(postponeMenu.taskId, option.minutes);
					}
				}}
			>
				{option.label}
			</MenuItem>
		))}
	</Menu>

	<TodoTimeLogDialog
		open={timeLogOpen}
		task={timeLogTask}
		onClose={handleCloseTimeLog}
		onSubmit={handleSubmitTimeEntry}
		onDeleteEntry={handleDeleteTimeEntry}
		mode="simple"
	/>

	{/* 任务编辑对话框 */}
	{editingTask && (
		<TodoFormDialog
			open={!!editingTask}
					onClose={handleCloseEditDialog}
					onSubmit={(values) => {
						updateTodo({
							id: editingTask.id,
							changes: values,
						});
						handleCloseEditDialog();
					}}
					initialTask={editingTask}
					allTags={[]}
					allCategories={[]}
					onCreateTag={() => {}}
					onCreateCategory={() => {}}
				/>
			)}
		</Paper>
	);
};

export default TodoWidgetPage;
