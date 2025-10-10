import AlarmIcon from "@mui/icons-material/Alarm";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
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
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	Typography,
} from "@mui/material";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import TodoKanbanBoard from "../components/todo/TodoKanbanBoard";
import TodoFormDialog from "../components/todo/TodoFormDialog";
import TodoTimeLogDialog from "../components/todo/TodoTimeLogDialog";
import { useTodoReminders } from "../hooks/useTodoReminders";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import type { TodoStatus, TodoTask } from "../stores/todoStore";
import {
	addTodoAtom,
	removeTimeEntryAtom,
	todosAtom,
	updateTodoAtom,
	upsertTimeEntryAtom,
} from "../stores/todoStore";

type QuickNote = {
	id: string;
	text: string;
	createdAt: string;
	pinned?: boolean;
};

type Reminder = {
	id: string;
	text: string;
	time?: string;
	done: boolean;
};

const VIEW_MODE_KEY = "todo_widget_view_mode_v1";
const NOTES_KEY = "todo_widget_notes_v1";
const REMINDERS_KEY = "todo_widget_reminders_v1";
const MEMO_KEY = "todo_widget_memo_v1";

const createId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
};

const TodoWidgetPage: FC = () => {
	const todos = useAtomValue(todosAtom);
	const addTodo = useSetAtom(addTodoAtom);
	const updateTodo = useSetAtom(updateTodoAtom);
	const upsertTimeEntry = useSetAtom(upsertTimeEntryAtom);
	const removeTimeEntry = useSetAtom(removeTimeEntryAtom);
	
	// 启用任务提醒功能
	useTodoReminders();
	const [title, setTitle] = useState("");
	const [isPinned, setIsPinned] = useState(true);
	const currentWindow = useMemo(() => getCurrentWebviewWindow(), []);
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
	const [reminders, setReminders] = useState<Reminder[]>([]);
	const [memoText, setMemoText] = useState("");
	const [reminderDraft, setReminderDraft] = useState({ text: "", time: "" });
	const [noteDraft, setNoteDraft] = useState("");
	const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
	const [timeLogOpen, setTimeLogOpen] = useState(false);
	const [timeLogTaskId, setTimeLogTaskId] = useState<string | null>(null);
	const timeLogTask = useMemo(() => {
		if (!timeLogTaskId) return null;
		return todos.find((item) => item.id === timeLogTaskId) ?? null;
	}, [timeLogTaskId, todos]);

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
		const storedReminders = window.localStorage.getItem(REMINDERS_KEY);
		const storedMemo = window.localStorage.getItem(MEMO_KEY);
		if (storedNotes) {
			try {
				setNotes(JSON.parse(storedNotes));
			} catch (error) {
				console.warn("Failed to parse notes", error);
			}
		}
		if (storedReminders) {
			try {
				setReminders(JSON.parse(storedReminders));
			} catch (error) {
				console.warn("Failed to parse reminders", error);
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
		window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
	}, [reminders]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(MEMO_KEY, memoText);
	}, [memoText]);


	const handleAddTask = () => {
		const trimmed = title.trim();
		if (!trimmed) return;
		addTodo({
			title: trimmed,
			description: "",
			notes: "",
			priority: "medium",
			completed: false,
			tags: [],
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

const handleStatusChange = useCallback(
	(id: string, status: TodoStatus) => {
		updateTodo({
			id,
			changes: {
				status,
				completed: status === "completed",
				reminderSent: status === "completed" ? true : undefined,
			},
		});
	},
	[updateTodo],
);

	const handleOpenTimeLog = useCallback((task: TodoTask) => {
		setTimeLogTaskId(task.id);
		setTimeLogOpen(true);
	}, []);

	const handleCloseTimeLog = useCallback(() => {
		setTimeLogOpen(false);
		setTimeLogTaskId(null);
	}, []);

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

	const upcomingReminders = useMemo(() => {
		return [...reminders].sort((a, b) => {
			const timeA = a.time
				? new Date(a.time).getTime()
				: Number.POSITIVE_INFINITY;
			const timeB = b.time
				? new Date(b.time).getTime()
				: Number.POSITIVE_INFINITY;
			return timeA - timeB;
		});
	}, [reminders]);

	const addNote = () => {
		const trimmed = noteDraft.trim();
		if (!trimmed) return;
		setNotes((prev) => [
			{
				id: createId(),
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

	const addReminder = () => {
		const trimmed = reminderDraft.text.trim();
		if (!trimmed) return;
		setReminders((prev) => [
			{
				id: createId(),
				text: trimmed,
				time: reminderDraft.time || undefined,
				done: false,
			},
			...prev,
		]);
		setReminderDraft({ text: "", time: "" });
	};

	const toggleReminderDone = (id: string) => {
		setReminders((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, done: !item.done } : item,
			),
		);
	};

	const deleteReminder = (id: string) => {
		setReminders((prev) => prev.filter((item) => item.id !== id));
	};

	const handleEditTask = useCallback((task: TodoTask) => {
		setEditingTask(task);
	}, []);

	const handleCloseEditDialog = useCallback(() => {
		setEditingTask(null);
	}, []);

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
						掌上任务助手
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

			<Stack spacing={2} sx={{ p: 2.5, pt: 2, flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
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
						<Stack
							direction="row"
							spacing={0.5}
							alignItems="center"
							justifyContent="center"
						>
							<ViewKanbanIcon fontSize="small" />
							<Typography variant="caption">看板</Typography>
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
						<Stack
							direction="row"
							spacing={0.5}
							alignItems="center"
							justifyContent="center"
						>
							<NoteAltIcon fontSize="small" />
							<Typography variant="caption">速记</Typography>
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
						<Stack
							direction="row"
							spacing={0.5}
							alignItems="center"
							justifyContent="center"
						>
							<AlarmIcon fontSize="small" />
							<Typography variant="caption">提醒</Typography>
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
						<Stack
							direction="row"
							spacing={0.5}
							alignItems="center"
							justifyContent="center"
						>
							<StickyNote2Icon fontSize="small" />
							<Typography variant="caption">便签</Typography>
						</Stack>
					</ToggleButton>
				</ToggleButtonGroup>

				{viewMode === "board" && (
					<Stack spacing={1.5} sx={{ flex: 1, overflow: "hidden" }}>
						<Stack direction="row" spacing={1.5}>
							<TextField
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="快速记录任务"
								size="small"
								fullWidth
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										background: "rgba(255, 255, 255, 0.8)",
										backdropFilter: "blur(10px)",
										"&:hover": {
											background: "rgba(255, 255, 255, 0.9)",
										},
										"&.Mui-focused": {
											background: "rgba(255, 255, 255, 0.95)",
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
								size="small" 
								onClick={handleAddTask}
								sx={{
									borderRadius: 2,
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
									"&:hover": {
										background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
									},
									px: 2,
								}}
							>
								添加
							</Button>
						</Stack>
					<Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
						<TodoKanbanBoard
							tasks={todos}
							onStatusChange={handleStatusChange}
							onEditTask={handleEditTask}
							onLogTime={handleOpenTimeLog}
						/>
					</Box>
				</Stack>
			)}

				{viewMode === "notes" && (
					<Stack spacing={1.5} sx={{ flex: 1, overflow: "hidden" }}>
						<Stack direction="row" spacing={1.5}>
							<TextField
								value={noteDraft}
								onChange={(event) => setNoteDraft(event.target.value)}
								placeholder="记下灵感..."
								size="small"
								fullWidth
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										background: "rgba(255, 255, 255, 0.8)",
										backdropFilter: "blur(10px)",
										"&:hover": {
											background: "rgba(255, 255, 255, 0.9)",
										},
										"&.Mui-focused": {
											background: "rgba(255, 255, 255, 0.95)",
										},
									},
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addNote();
									}
								}}
							/>
							<Button 
								variant="contained" 
								size="small" 
								onClick={addNote}
								sx={{
									borderRadius: 2,
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
									"&:hover": {
										background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
									},
									px: 2,
								}}
							>
								添加
							</Button>
						</Stack>
						<Box
							sx={{
								flex: 1,
								overflow: "auto",
								borderRadius: 2,
								border: "1px solid rgba(102, 126, 234, 0.2)",
								background: "rgba(255, 255, 255, 0.6)",
								backdropFilter: "blur(10px)",
							}}
						>
							{sortedNotes.length === 0 ? (
								<Stack alignItems="center" justifyContent="center" height={160}>
									<Typography variant="caption" color="text.secondary">
										暂无笔记，快速记录一点什么吧
									</Typography>
								</Stack>
							) : (
								<List dense disablePadding>
									{sortedNotes.map((note) => (
										<ListItem
											key={note.id}
											secondaryAction={
												<Stack
													direction="row"
													spacing={0.5}
													alignItems="center"
												>
													<IconButton
														size="small"
														onClick={() => togglePinNote(note.id)}
													>
														{note.pinned ? (
															<PushPinIcon fontSize="small" />
														) : (
															<PushPinOutlinedIcon fontSize="small" />
														)}
													</IconButton>
													<IconButton
														size="small"
														onClick={() => deleteNote(note.id)}
													>
														<DeleteOutlineIcon fontSize="small" />
													</IconButton>
												</Stack>
											}
											disablePadding
										>
											<ListItemText
												primary={note.text}
												secondary={
													<Typography variant="caption" color="text.secondary">
														{new Date(note.createdAt).toLocaleString()}
													</Typography>
												}
												primaryTypographyProps={{
													style: { wordBreak: "break-word" },
												}}
											/>
										</ListItem>
									))}
								</List>
							)}
						</Box>
					</Stack>
				)}

				{viewMode === "reminders" && (
					<Stack spacing={1.5} sx={{ flex: 1, overflow: "hidden" }}>
						<Stack direction="row" spacing={1.5}>
							<TextField
								value={reminderDraft.text}
								onChange={(event) =>
									setReminderDraft((prev) => ({
										...prev,
										text: event.target.value,
									}))
								}
								placeholder="提醒内容"
								size="small"
								fullWidth
								sx={{
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										background: "rgba(255, 255, 255, 0.8)",
										backdropFilter: "blur(10px)",
										"&:hover": {
											background: "rgba(255, 255, 255, 0.9)",
										},
										"&.Mui-focused": {
											background: "rgba(255, 255, 255, 0.95)",
										},
									},
								}}
							/>
							<TextField
								type="datetime-local"
								value={reminderDraft.time}
								onChange={(event) =>
									setReminderDraft((prev) => ({
										...prev,
										time: event.target.value,
									}))
								}
								size="small"
								InputLabelProps={{ shrink: true }}
								sx={{ 
									width: 180,
									"& .MuiOutlinedInput-root": {
										borderRadius: 2,
										background: "rgba(255, 255, 255, 0.8)",
										backdropFilter: "blur(10px)",
										"&:hover": {
											background: "rgba(255, 255, 255, 0.9)",
										},
										"&.Mui-focused": {
											background: "rgba(255, 255, 255, 0.95)",
										},
									},
								}}
							/>
							<Button 
								variant="contained" 
								size="small" 
								onClick={addReminder}
								sx={{
									borderRadius: 2,
									background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
									"&:hover": {
										background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
									},
									px: 2,
								}}
							>
								添加
							</Button>
						</Stack>
						<Box
							sx={{
								flex: 1,
								overflow: "auto",
								borderRadius: 2,
								border: "1px solid rgba(102, 126, 234, 0.2)",
								background: "rgba(255, 255, 255, 0.6)",
								backdropFilter: "blur(10px)",
							}}
						>
							{upcomingReminders.length === 0 ? (
								<Stack alignItems="center" justifyContent="center" height={160}>
									<Typography variant="caption" color="text.secondary">
										暂无提醒，添加一条吧
									</Typography>
								</Stack>
							) : (
								<List dense disablePadding>
									{upcomingReminders.map((item) => (
										<ListItem
											key={item.id}
											disablePadding
											secondaryAction={
												<IconButton
													size="small"
													onClick={() => deleteReminder(item.id)}
												>
													<DeleteOutlineIcon fontSize="small" />
												</IconButton>
											}
										>
											<Checkbox
												size="small"
												checked={item.done}
												onChange={() => toggleReminderDone(item.id)}
											/>
											<ListItemText
												primary={
													<Typography
														variant="body2"
														sx={{
															textDecoration: item.done
																? "line-through"
																: "none",
														}}
													>
														{item.text}
													</Typography>
												}
												secondary={
													item.time ? (
														<Typography
															variant="caption"
															color="text.secondary"
														>
															{new Date(item.time).toLocaleString()}
														</Typography>
													) : (
														<Typography
															variant="caption"
															color="text.secondary"
														>
															无具体时间
														</Typography>
													)
												}
												primaryTypographyProps={{
													style: { wordBreak: "break-word" },
												}}
											/>
										</ListItem>
									))}
								</List>
							)}
						</Box>
					</Stack>
				)}

				{viewMode === "memo" && (
					<TextField
						value={memoText}
						onChange={(event) => setMemoText(event.target.value)}
						placeholder="写下你的便签..."
						fullWidth
						multiline
						minRows={12}
						sx={{ 
							flex: 1, 
							textarea: { lineHeight: 1.6 },
							"& .MuiOutlinedInput-root": {
								borderRadius: 2,
								background: "rgba(255, 255, 255, 0.8)",
								backdropFilter: "blur(10px)",
								"&:hover": {
									background: "rgba(255, 255, 255, 0.9)",
								},
								"&.Mui-focused": {
									background: "rgba(255, 255, 255, 0.95)",
								},
							},
						}}
					/>
		)}
	</Stack>

	<TodoTimeLogDialog
		open={timeLogOpen}
		task={timeLogTask}
		onClose={handleCloseTimeLog}
		onSubmit={handleSubmitTimeEntry}
		onDeleteEntry={handleDeleteTimeEntry}
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
