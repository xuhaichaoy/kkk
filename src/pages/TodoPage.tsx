import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodoFormDialog, {
	type FormValues,
} from "../components/todo/TodoFormDialog";
import TodoHeroBanner from "../components/todo/TodoHeroBanner";
import TodoTaskListSection from "../components/todo/TodoTaskListSection";
import TodoWeeklyReportDialog from "../components/todo/TodoWeeklyReportDialog";
import TodoTimeLogDialog from "../components/todo/TodoTimeLogDialog";
import TodoSidebar, {
	type SidebarView,
} from "../components/todo/TodoSidebar";
import { useTodoReminders } from "../hooks/useTodoReminders";
import {
	DEFAULT_CATEGORY,
	addTodoAtom,
	categoriesAtom,
	clearCompletedAtom,
	filterAtom,
	removeCategoryAtom,
	removeTodoAtom,
	type TodoStatus,
	type TodoTask,
	tagsAtom,
	todosAtom,
	toggleTodoAtom,
	updateTodoAtom,
	upsertCategoryAtom,
	upsertTagAtom,
	upsertTimeEntryAtom,
	removeTimeEntryAtom,
} from "../stores/todoStore";
import {
	getFilteredTodos,
	generateWeeklyReport,
	generateWeeklyReflection,
	getCurrentWeekRange,
	type DateRange,
	getTodayTodos,
	getWeekTodos,
} from "../utils/todoUtils";
import {
	ensureNotificationPermission,
	sendNativeNotification,
} from "../utils/notificationUtils";
import { debugError, debugLog } from "../utils/logger";

const VIEW_MODE_STORAGE_KEY = "blink_todo_view_mode";

const TodoPage: FC = () => {
	useTodoReminders();

	const [filters, setFilters] = useAtom(filterAtom);
	const todos = useAtomValue(todosAtom);
	const tags = useAtomValue(tagsAtom);
	const categories = useAtomValue(categoriesAtom);
	const categoryOptions = useMemo(() => {
		const normalized = categories
			.map((category) => category.trim())
			.filter((category) => category.length > 0 && category !== DEFAULT_CATEGORY);
		return Array.from(new Set([DEFAULT_CATEGORY, ...normalized]));
	}, [categories]);

	const addTodo = useSetAtom(addTodoAtom);
	const updateTodo = useSetAtom(updateTodoAtom);
	const removeTodo = useSetAtom(removeTodoAtom);
	const toggleTodo = useSetAtom(toggleTodoAtom);
	const upsertTag = useSetAtom(upsertTagAtom);
	const upsertCategory = useSetAtom(upsertCategoryAtom);
	const removeCategory = useSetAtom(removeCategoryAtom);
	const upsertTimeEntry = useSetAtom(upsertTimeEntryAtom);
	const removeTimeEntry = useSetAtom(removeTimeEntryAtom);
	const clearCompleted = useSetAtom(clearCompletedAtom);

	const [showFilters, setShowFilters] = useState(false);
	const [search, setSearch] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [summaryOpen, setSummaryOpen] = useState(false);
	const [reportRange, setReportRange] = useState<DateRange>(() =>
		getCurrentWeekRange(),
	);
	const [summaryRange, setSummaryRange] = useState<DateRange>(() =>
		getCurrentWeekRange(),
	);
	const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [timeLogOpen, setTimeLogOpen] = useState(false);
	const [timeLogTaskId, setTimeLogTaskId] = useState<string | null>(null);
	const [taskViewMode, setTaskViewMode] = useState<"list" | "gantt" | "board">(
		() => {
			if (typeof window === "undefined") return "list";
			const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
			return stored === "gantt" || stored === "board" ? stored : "list";
		},
	);
	const [sidebarView, setSidebarView] = useState<SidebarView>("welcome");
	const [sidebarOpen, setSidebarOpen] = useState(true);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, taskViewMode);
	}, [taskViewMode]);

	const filteredTasks = useMemo(() => {
		let baseTasks = todos;

		if (sidebarView.startsWith("category:")) {
			const categoryName = sidebarView.slice("category:".length);
			baseTasks = todos.filter((t) => t.category === categoryName);
		} else {
			// 根据侧边栏视图过滤
			switch (sidebarView) {
				case "today":
					baseTasks = getTodayTodos(todos.filter((t) => !t.completed));
					break;
				case "next7days":
					baseTasks = getWeekTodos(todos.filter((t) => !t.completed));
					break;
				case "inbox":
					baseTasks = todos.filter((t) => !t.completed && !t.category);
					break;
				case "completed":
					baseTasks = todos.filter((t) => t.completed);
					break;
				case "trash":
					baseTasks = [];
					break;
				case "welcome":
				default:
					baseTasks = todos;
					break;
			}
		}

		return getFilteredTodos(baseTasks, search, filters);
	}, [todos, search, filters, sidebarView]);

	const filteredSummary = useMemo(() => {
		const completed = filteredTasks.filter((task) => task.completed).length;
		return {
			count: filteredTasks.length,
			completed,
		};
	}, [filteredTasks]);

	const timeLogTask = useMemo(() => {
		if (!timeLogTaskId) return null;
		return todos.find((item) => item.id === timeLogTaskId) ?? null;
	}, [timeLogTaskId, todos]);

	const weeklyReport = useMemo(
		() =>
			generateWeeklyReport(todos, {
				range: reportRange,
			}),
		[todos, reportRange],
	);
	const weeklyReflectionSummary = useMemo(
		() =>
			generateWeeklyReflection(todos, {
				range: summaryRange,
			}),
		[todos, summaryRange],
	);

	const hasCompletedTodos = useMemo(
		() => todos.some((task) => task.completed),
		[todos],
	);

	const handleOpenCreateForm = useCallback(() => {
		setEditingTask(null);
		setFormOpen(true);
	}, [setEditingTask, setFormOpen]);

	const handleFormSubmit = useCallback(
		(values: FormValues) => {
			if (values.id) {
				updateTodo({
					id: values.id,
					changes: {
						title: values.title,
						description: values.description,
						notes: values.notes,
						reflection: values.reflection,
						priority: values.priority,
						completed: values.completed,
						dueDate: values.dueDate,
						dueDateEnd: values.dueDateEnd,
						reminder: values.reminder,
						tags: values.tags,
						category: values.category,
						status: values.status,
						reminderSent: values.completed ? true : undefined,
					},
				});
			} else {
				addTodo({
					title: values.title,
					description: values.description,
					notes: values.notes,
					reflection: values.reflection,
					priority: values.priority,
					completed: values.completed,
					dueDate: values.dueDate,
					dueDateEnd: values.dueDateEnd,
					reminder: values.reminder,
					tags: values.tags,
					category: values.category,
					reminderSent: values.completed,
					status: values.status,
				});
			}
		},
		[updateTodo, addTodo],
	);

	const handleEditTask = useCallback(
		(task: TodoTask) => {
			setEditingTask(task);
			setFormOpen(true);
			setSelectedTaskId(task.id);
		},
		[setEditingTask, setFormOpen, setSelectedTaskId],
	);

	const handleDeleteTask = useCallback(
		(task: TodoTask) => {
			removeTodo(task.id);
		},
		[removeTodo],
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

	const handleOpenWidget = useCallback(async () => {
		try {
			await invoke("open_todo_widget");
		} catch (error) {
			console.error("Failed to open todo widget", error);
		}
	}, []);

	const handleReportRangeChange = useCallback((range: DateRange) => {
		setReportRange((previous) => {
			if (
				previous.start.getTime() === range.start.getTime() &&
				previous.end.getTime() === range.end.getTime()
			) {
				return previous;
			}
			return range;
		});
	}, []);

	const handleSummaryRangeChange = useCallback((range: DateRange) => {
		setSummaryRange((previous) => {
			if (
				previous.start.getTime() === range.start.getTime() &&
				previous.end.getTime() === range.end.getTime()
			) {
				return previous;
			}
			return range;
		});
	}, []);

	const handleOpenWeeklyReport = useCallback(() => {
		setReportRange(getCurrentWeekRange());
		setReportOpen(true);
	}, []);

	const handleCloseWeeklyReport = useCallback(() => {
		setReportOpen(false);
	}, []);

	const handleOpenWeeklySummary = useCallback(() => {
		setSummaryRange(getCurrentWeekRange());
		setSummaryOpen(true);
	}, []);

	const handleCloseWeeklySummary = useCallback(() => {
		setSummaryOpen(false);
	}, []);

	const handleTestNotification = useCallback(async () => {
		try {
			debugLog("Checking notification permission...");
			const hasPermission = await ensureNotificationPermission();
			debugLog("Permission granted:", hasPermission);

			if (!hasPermission) {
				debugError("Notification permission not granted");
				alert("通知权限未授予，请在系统设置中允许通知");
				return;
			}

			debugLog("Attempting to send test notification from main page...");
			await sendNativeNotification({
				title: "主页面测试通知",
				body: "来自主页面的桌面通知测试！",
			});
			debugLog("Test notification sent successfully from main page");
		} catch (error) {
			debugError("Failed to send test notification from main page:", error);
		}
	}, []);

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

	const sidebarTitle = useMemo(() => {
		if (sidebarView.startsWith("category:")) {
			const categoryName = sidebarView.slice("category:".length);
			return categoryName ? `📋 ${categoryName}` : "📋 列表";
		}

		switch (sidebarView) {
			case "today":
				return "📅 Today";
			case "next7days":
				return "📆 Next 7 Days";
			case "inbox":
				return "📥 Inbox";
			case "completed":
				return "✅ Completed";
			case "trash":
				return "🗑️ Trash";
			case "welcome":
			default:
				return "👋 欢迎";
		}
	}, [sidebarView]);

	const handleToggleSidebar = useCallback(() => {
		setSidebarOpen((prev) => !prev);
	}, []);

	// 获取当前分类（用于新建任务时的默认分类）
	const currentCategory = useMemo(() => {
		if (sidebarView.startsWith("category:")) {
			return sidebarView.slice("category:".length);
		}
		return undefined;
	}, [sidebarView]);

	return (
		<Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
			{sidebarOpen && (
				<TodoSidebar
					tasks={todos}
					selectedView={sidebarView}
					onViewChange={setSidebarView}
					categories={categories}
					onCreateCategory={upsertCategory}
					onRemoveCategory={removeCategory}
				/>
			)}
			<Box
				sx={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: 2, pb: 2 }}>
					<Stack direction="row" alignItems="center" spacing={2}>
						<Tooltip title={sidebarOpen ? "收起列表" : "展开列表"} arrow>
							<IconButton
								onClick={handleToggleSidebar}
								size="small"
								sx={{
									borderRadius: 2,
									backgroundColor: "background.paper",
									boxShadow: 1,
									"&:hover": {
										backgroundColor: "action.hover",
									},
								}}
							>
								{sidebarOpen ? (
									<ChevronLeftIcon fontSize="small" />
								) : (
									<ChevronRightIcon fontSize="small" />
								)}
							</IconButton>
						</Tooltip>
						<Box sx={{ flex: 1 }}>
							<TodoHeroBanner
								onOpenWidget={handleOpenWidget}
								onCreateTask={handleOpenCreateForm}
								onGenerateWeeklyReport={handleOpenWeeklyReport}
								onGenerateWeeklySummary={handleOpenWeeklySummary}
								onTestNotification={handleTestNotification}
								title={sidebarTitle}
							/>
						</Box>
					</Stack>
				</Box>

				<Box sx={{ flex: 1, overflow: "hidden", px: { xs: 2, sm: 3, md: 4 } }}>
					<TodoTaskListSection
						filteredTasks={filteredTasks}
						filteredCount={filteredSummary.count}
						filteredCompletedCount={filteredSummary.completed}
						hasCompletedTodos={hasCompletedTodos}
						onClearCompleted={clearCompleted}
						search={search}
						onSearchChange={setSearch}
						onAddTask={handleOpenCreateForm}
						filtersVisible={showFilters}
						onToggleFilters={() => setShowFilters((prev) => !prev)}
						filters={filters}
						onFiltersChange={setFilters}
						tags={tags}
						categories={categories}
						selectedTaskId={selectedTaskId}
						onSelectTask={(task) => setSelectedTaskId(task.id)}
						onToggleComplete={(task) => toggleTodo(task.id)}
						onEditTask={handleEditTask}
						onDeleteTask={handleDeleteTask}
						onStatusChange={handleStatusChange}
						viewMode={taskViewMode}
						onViewModeChange={setTaskViewMode}
						onLogTime={handleOpenTimeLog}
					/>
				</Box>

				<TodoFormDialog
					open={formOpen}
					initialTask={editingTask ?? undefined}
					onClose={() => setFormOpen(false)}
					onSubmit={handleFormSubmit}
				allTags={tags}
				allCategories={categoryOptions}
					onCreateTag={upsertTag}
					onCreateCategory={upsertCategory}
					defaultCategory={currentCategory}
				/>
				<TodoWeeklyReportDialog
					open={reportOpen}
					report={weeklyReport}
					onClose={handleCloseWeeklyReport}
					editable
					title="周报工作汇总"
					description="以下内容根据最近任务动态自动生成，可在复制前自行调整。"
					range={reportRange}
					onRangeChange={handleReportRangeChange}
				/>
				<TodoWeeklyReportDialog
					open={summaryOpen}
					report={weeklyReflectionSummary}
					onClose={handleCloseWeeklySummary}
					editable
					title="本周反思总结"
					description="根据任务的「反思」字段自动生成，可在此补充或修改后再复制。"
					range={summaryRange}
					onRangeChange={handleSummaryRangeChange}
				/>
				<TodoTimeLogDialog
					open={timeLogOpen}
					task={timeLogTask}
					onClose={handleCloseTimeLog}
					onSubmit={handleSubmitTimeEntry}
					onDeleteEntry={handleDeleteTimeEntry}
				/>
			</Box>
		</Box>
	);
};

export default TodoPage;
