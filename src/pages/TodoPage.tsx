import { Box, Stack } from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { startOfToday } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import TodoCalendar from "../components/todo/TodoCalendar";
import TodoFormDialog, {
	type FormValues,
} from "../components/todo/TodoFormDialog";
import TodoHeroBanner from "../components/todo/TodoHeroBanner";
import TodoMetricsPanel from "../components/todo/TodoMetricsPanel";
import TodoSelectedDatePanel from "../components/todo/TodoSelectedDatePanel";
import TodoTaskListSection from "../components/todo/TodoTaskListSection";
import TodoWeeklyReportDialog from "../components/todo/TodoWeeklyReportDialog";
import { useTodoReminders } from "../hooks/useTodoReminders";
import {
	addTodoAtom,
	bulkCompleteAtom,
	calendarMonthAtom,
	categoriesAtom,
	clearCompletedAtom,
	filterAtom,
	removeTodoAtom,
	type TodoStatus,
	type TodoTask,
	tagsAtom,
	todosAtom,
	toggleTodoAtom,
	updateTodoAtom,
	upsertCategoryAtom,
	upsertTagAtom,
} from "../stores/todoStore";
import {
	getCalendarTodos,
	getFilteredTodos,
	generateWeeklyReport,
	getOverdueTodos,
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
	const [search, setSearch] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const [reportOpen, setReportOpen] = useState(false);
	const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
	const [taskViewMode, setTaskViewMode] = useState<"list" | "gantt" | "board">(
		() => {
			if (typeof window === "undefined") return "list";
			const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
			return stored === "gantt" || stored === "board" ? stored : "list";
		},
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, taskViewMode);
	}, [taskViewMode]);

	const filteredTasks = useMemo(
		() => getFilteredTodos(todos, search, filters),
		[todos, search, filters],
	);

	const filteredSummary = useMemo(() => {
		const completed = filteredTasks.filter((task) => task.completed).length;
		const hasIncomplete = filteredTasks.some((task) => !task.completed);
		return {
			count: filteredTasks.length,
			completed,
			hasIncomplete,
		};
	}, [filteredTasks]);

	const overdueTasks = useMemo(
		() => getOverdueTodos(filteredTasks),
		[filteredTasks],
	);

	const todayTasks = useMemo(
		() => getTodayTodos(filteredTasks),
		[filteredTasks],
	);

	const weekTasks = useMemo(() => getWeekTodos(filteredTasks), [filteredTasks]);

	const selectedDateTasks = useMemo(
		() => getCalendarTodos(todos, selectedDate),
		[todos, selectedDate],
	);

	const completedCount = useMemo(
		() => todos.filter((task) => task.completed).length,
		[todos],
	);

	const totalTasks = todos.length;
	const completionRate =
		totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);

	const weeklyReport = useMemo(
		() => generateWeeklyReport(todos),
		[todos],
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
						priority: values.priority,
						completed: values.completed,
						dueDate: values.dueDate,
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
					priority: values.priority,
					completed: values.completed,
					dueDate: values.dueDate,
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

	const handleBulkComplete = useCallback(() => {
		const ids = filteredTasks
			.filter((task) => !task.completed)
			.map((task) => task.id);
		bulkComplete(ids);
	}, [filteredTasks, bulkComplete]);

	const handleCompleteSelectedDate = useCallback(() => {
		const ids = selectedDateTasks
			.filter((task) => !task.completed)
			.map((task) => task.id);
		bulkComplete(ids);
	}, [selectedDateTasks, bulkComplete]);

	const handleOpenWidget = useCallback(async () => {
		try {
			await invoke("open_todo_widget");
		} catch (error) {
			console.error("Failed to open todo widget", error);
		}
	}, []);

	const handleOpenWeeklyReport = useCallback(() => {
		setReportOpen(true);
	}, []);

	const handleCloseWeeklyReport = useCallback(() => {
		setReportOpen(false);
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

	return (
		<Box sx={{ pb: 6, px: { xs: 2, sm: 3, md: 4 } }}>
			<Stack spacing={4}>
			<TodoHeroBanner
				onOpenWidget={handleOpenWidget}
				onCreateTask={handleOpenCreateForm}
				onGenerateWeeklyReport={handleOpenWeeklyReport}
				onTestNotification={handleTestNotification}
			/>

				<TodoTaskListSection
					filteredTasks={filteredTasks}
					filteredCount={filteredSummary.count}
					filteredCompletedCount={filteredSummary.completed}
					hasIncompleteFiltered={filteredSummary.hasIncomplete}
					hasCompletedTodos={hasCompletedTodos}
					onBulkComplete={handleBulkComplete}
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
				/>

				<Box
					sx={{
						display: "flex",
						flexDirection: { xs: "column", lg: "row" },
						gap: 3.5,
						width: "100%",
						alignItems: "flex-start",
					}}
				>
					<Box
						sx={{
							flex: 1,
							minHeight: { xs: "auto", lg: "680px" },
						}}
					>
						<TodoCalendar
							tasks={todos}
							month={calendarMonth}
							selectedDate={selectedDate}
							onSelectDate={setSelectedDate}
							onMonthChange={setCalendarMonth}
						/>
					</Box>

					<Stack
						spacing={3}
						sx={{
							width: { xs: "100%", lg: "420px" },
							flexShrink: 0,
							height: { xs: "auto", lg: "680px" },
						}}
					>
						<TodoMetricsPanel
							completionRate={completionRate}
							completedCount={completedCount}
							totalCount={totalTasks}
							todayCount={todayTasks.length}
							weekCount={weekTasks.length}
							overdueCount={overdueTasks.length}
							filteredCount={filteredSummary.count}
							filteredCompletedCount={filteredSummary.completed}
						/>
						<TodoSelectedDatePanel
							date={selectedDate}
							tasks={selectedDateTasks}
							onCompleteAll={handleCompleteSelectedDate}
							onAddTask={handleOpenCreateForm}
							onEditTask={handleEditTask}
							onDeleteTask={handleDeleteTask}
						/>
					</Stack>
				</Box>
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
		<TodoWeeklyReportDialog
			open={reportOpen}
			report={weeklyReport}
			onClose={handleCloseWeeklyReport}
		/>
		</Box>
	);
};

export default TodoPage;
