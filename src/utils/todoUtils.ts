import {
	addDays,
	addWeeks,
	endOfWeek,
	format,
	isBefore,
	isSameDay,
	isWithinInterval,
	startOfDay,
	startOfToday,
	startOfWeek,
} from "date-fns";
import type {
	TodoFilterState,
	TodoPriority,
	TodoStatus,
	TodoTask,
} from "../stores/todoStore";

const priorityOrder: Record<TodoPriority, number> = {
	high: 0,
	medium: 1,
	low: 2,
};

const dueValue = (task: TodoTask) =>
	task.dueDate ? new Date(task.dueDate).getTime() : Number.POSITIVE_INFINITY;

export const matchesSearch = (task: TodoTask, search: string) => {
	if (!search) return true;
	const lower = search.toLowerCase();
	return (
		task.title.toLowerCase().includes(lower) ||
		task.description?.toLowerCase().includes(lower) ||
		task.notes?.toLowerCase().includes(lower) ||
		task.reflection?.toLowerCase().includes(lower) ||
		task.tags.some((tag) => tag.toLowerCase().includes(lower))
	);
};

export const matchesFilters = (
	task: TodoTask,
	filter: TodoFilterState,
	referenceDate: Date,
) => {
	if (filter.status === "active" && task.completed) return false;
	if (filter.status === "completed" && !task.completed) return false;

	if (
		filter.priorities.length > 0 &&
		!filter.priorities.includes(task.priority)
	) {
		return false;
	}

	if (
		filter.tags.length > 0 &&
		!filter.tags.every((tag) => task.tags.includes(tag))
	) {
		return false;
	}

	if (
		filter.categories.length > 0 &&
		(!task.category || !filter.categories.includes(task.category))
	) {
		return false;
	}

	if (filter.range !== "all") {
		if (!task.dueDate) {
			return false;
		}
		const due = new Date(task.dueDate);
		if (Number.isNaN(due.getTime())) return false;

		if (filter.range === "today") {
			if (!isSameDay(due, referenceDate)) return false;
		} else if (filter.range === "thisWeek") {
			const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
			const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
			if (due < start || due > end) return false;
		} else if (filter.range === "overdue") {
			if (!(due < referenceDate && !task.completed)) return false;
		} else if (filter.range === "custom") {
			if (filter.from) {
				const fromDate = new Date(filter.from);
				if (Number.isFinite(fromDate.getTime()) && due < startOfDay(fromDate)) {
					return false;
				}
			}
			if (filter.to) {
				const toDate = new Date(filter.to);
				if (
					Number.isFinite(toDate.getTime()) &&
					due > addDays(startOfDay(toDate), 1)
				) {
					return false;
				}
			}
		}
	}

	return true;
};

export const compareByDueAndPriority = (a: TodoTask, b: TodoTask) => {
	const dueA = dueValue(a);
	const dueB = dueValue(b);

	if (dueA !== dueB) {
		return dueA - dueB;
	}

	const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
	if (priorityDiff !== 0) return priorityDiff;

	return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};

export const sortTasks = (a: TodoTask, b: TodoTask) => {
	if (a.completed !== b.completed) {
		return a.completed ? 1 : -1;
	}

	const comparison = compareByDueAndPriority(a, b);
	if (comparison !== 0) return comparison;

	return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

export const getFilteredTodos = (
	todos: TodoTask[],
	search: string,
	filter: TodoFilterState,
	referenceDate = new Date(),
) =>
	todos
		.filter((task) => matchesSearch(task, search))
		.filter((task) => matchesFilters(task, filter, referenceDate))
		.sort(sortTasks);

export const getOverdueTodos = (
	tasks: TodoTask[],
	referenceDate = new Date(),
) =>
	tasks.filter(
		(task) =>
			task.dueDate &&
			!task.completed &&
			isBefore(new Date(task.dueDate), referenceDate),
	);

export const getTodayTodos = (tasks: TodoTask[], baseDate = startOfToday()) =>
	tasks.filter(
		(task) => task.dueDate && isSameDay(new Date(task.dueDate), baseDate),
	);

export const getWeekTodos = (tasks: TodoTask[], baseDate = new Date()) => {
	const start = startOfWeek(baseDate, { weekStartsOn: 1 });
	const end = endOfWeek(baseDate, { weekStartsOn: 1 });
	return tasks.filter((task) => {
		if (!task.dueDate) return false;
		const due = new Date(task.dueDate);
		return due >= start && due <= end;
	});
};

export const getCalendarTodos = (todos: TodoTask[], selectedDate: Date) => {
	const selectedStart = startOfDay(selectedDate);

	const overdue: TodoTask[] = [];
	const upcoming: TodoTask[] = [];

	todos.forEach((task) => {
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
};

export const resolveTaskStatus = (task: TodoTask): TodoStatus => {
	if (task.completed) return "completed";
	if (task.status) return task.status;
	return "notStarted";
};

export const statusDisplayMap: Record<
	TodoStatus,
	{ label: string; color: "default" | "info" | "warning" | "success" }
> = {
	notStarted: { label: "待开始", color: "default" },
	inProgress: { label: "进行中", color: "info" },
	submitted: { label: "待确认", color: "warning" },
	completed: { label: "已完成", color: "success" },
};

const priorityLabel: Record<TodoPriority, string> = {
	high: "高",
	medium: "中",
	low: "低",
};

const formatDateTime = (value?: string) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return format(date, "MM月dd日 HH:mm");
};

const formatDate = (value?: string) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return format(date, "MM月dd日");
};

const buildTaskLines = (tasks: TodoTask[]) =>
	tasks.map((task) => {
		const parts: string[] = [];
		parts.push(`[${priorityLabel[task.priority]}] ${task.title}`);
		if (task.category) {
			parts.push(`分类：${task.category}`);
		}
		if (task.dueDate) {
			parts.push(`截止：${formatDate(task.dueDate)}`);
		}
		return `- ${parts.join(" ｜ ")}`;
	});

export const generateWeeklyReport = (
	todos: TodoTask[],
	referenceDate = new Date(),
) => {
	const now = referenceDate;
	const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
	const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
	const effectiveWeekEnd =
		now.getTime() < currentWeekEnd.getTime() ? now : currentWeekEnd;
	const nextWeekStart = addWeeks(currentWeekStart, 1);
	const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

	const totalCount = todos.length;
	const completedCount = todos.filter((task) => task.completed).length;
	const createdThisWeek = todos.filter((task) =>
		isWithinInterval(new Date(task.createdAt), {
			start: currentWeekStart,
			end: effectiveWeekEnd,
		}),
	);

	const completedThisWeek = todos.filter(
		(task) =>
			task.completed &&
			task.completedAt &&
			isWithinInterval(new Date(task.completedAt), {
				start: currentWeekStart,
				end: effectiveWeekEnd,
			}),
	);

	const inProgress = todos.filter(
		(task) =>
			!task.completed &&
			(task.status === "inProgress" || task.status === "submitted"),
	);

	const notStarted = todos.filter(
		(task) =>
			!task.completed &&
			(task.status === "notStarted" || !task.status),
	);

	const upcomingNextWeek = todos.filter(
		(task) =>
			!task.completed &&
			task.dueDate &&
			isWithinInterval(new Date(task.dueDate), {
				start: nextWeekStart,
				end: nextWeekEnd,
			}),
	);

	const overdue = todos.filter(
		(task) =>
			!task.completed &&
			task.dueDate &&
			isBefore(new Date(task.dueDate), now),
	);

	const lines: string[] = [];
	lines.push("【本周概览】");
	lines.push(
		`- 时间范围：${format(currentWeekStart, "MM月dd日")} - ${format(
			currentWeekEnd,
			"MM月dd日",
		)}`,
	);
	lines.push(
		`- 总任务 ${totalCount} 项，已完成 ${completedCount} 项，本周新增 ${createdThisWeek.length} 项`,
	);
	lines.push(`- 本周完成 ${completedThisWeek.length} 项`);

	if (completedThisWeek.length > 0) {
		lines.push("\n【本周已完成】");
		completedThisWeek.forEach((task) => {
			const completedAt = formatDateTime(task.completedAt);
			lines.push(
				`- [${priorityLabel[task.priority]}] ${task.title}${
					completedAt ? `（完成：${completedAt}）` : ""
				} ${task.category ? `｜ 分类：${task.category}` : ""}`.trim(),
			);
		});
	}

	if (inProgress.length > 0) {
		lines.push("\n【进行中任务】");
		lines.push(...buildTaskLines(inProgress));
	}

	if (notStarted.length > 0) {
		lines.push("\n【待启动任务】");
		lines.push(...buildTaskLines(notStarted));
	}

	if (upcomingNextWeek.length > 0) {
		lines.push("\n【下周计划】");
		upcomingNextWeek.forEach((task) => {
			lines.push(
				`- [${priorityLabel[task.priority]}] ${task.title} ｜ 截止：${formatDate(
					task.dueDate,
				)}${task.category ? ` ｜ 分类：${task.category}` : ""}`,
			);
		});
	}

	if (overdue.length > 0) {
		lines.push("\n【需要关注】");
		overdue.forEach((task) => {
			lines.push(
				`- [${priorityLabel[task.priority]}] ${task.title} ｜ 已逾期：${formatDate(
					task.dueDate,
				)}${task.category ? ` ｜ 分类：${task.category}` : ""}`,
			);
		});
	}

	return lines.join("\n");
};

export const generateWeeklyReflection = (
	todos: TodoTask[],
	referenceDate = new Date(),
) => {
	const now = referenceDate;
	const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
	const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

	const isInReflectionWindow = (value?: string) => {
		if (!value) return false;
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return false;
		return isWithinInterval(date, {
			start: currentWeekStart,
			end: currentWeekEnd,
		});
	};

	const reflectionCandidates = todos.filter(
		(task) => task.reflection && task.reflection.trim().length > 0,
	);

	const reflectionsThisWeek = reflectionCandidates
		.filter(
			(task) =>
				isInReflectionWindow(task.completedAt) ||
				isInReflectionWindow(task.updatedAt) ||
				isInReflectionWindow(task.createdAt),
		)
		.sort((a, b) => {
			const getTimestamp = (task: TodoTask) => {
				const candidate =
					task.completedAt ?? task.updatedAt ?? task.createdAt;
				const date = new Date(candidate);
				return Number.isNaN(date.getTime()) ? 0 : date.getTime();
			};
			return getTimestamp(b) - getTimestamp(a);
		});

	const completedThisWeek = todos.filter(
		(task) =>
			task.completed &&
			task.completedAt &&
			isWithinInterval(new Date(task.completedAt), {
				start: currentWeekStart,
				end: currentWeekEnd,
			}),
	);

	const missingReflection = completedThisWeek.filter(
		(task) => !task.reflection || task.reflection.trim().length === 0,
	);

	const lines: string[] = [];
	lines.push("【本周反思总结】");
	lines.push(
		`- 时间范围：${format(currentWeekStart, "MM月dd日")} - ${format(
			currentWeekEnd,
			"MM月dd日",
		)}`,
	);

	if (reflectionsThisWeek.length > 0) {
		lines.push("\n【任务反思】");
		reflectionsThisWeek.forEach((task) => {
			const completedAt = formatDateTime(task.completedAt);
			const updatedAt = completedAt ? "" : formatDateTime(task.updatedAt);
			const labelParts = [
				`[${priorityLabel[task.priority]}] ${task.title}`,
			];
			if (task.category) {
				labelParts.push(`分类：${task.category}`);
			}
			if (completedAt) {
				labelParts.push(`完成：${completedAt}`);
			} else if (updatedAt) {
				labelParts.push(`更新：${updatedAt}`);
			}
			lines.push(`- ${labelParts.join(" ｜ ")}`);
			lines.push(`  反思：${task.reflection?.trim() ?? ""}`);
		});
	} else {
		lines.push("- 本周暂无反思记录，可在任务详情中补充「反思」。");
	}

	if (missingReflection.length > 0) {
		lines.push("\n【待补充反思】");
		missingReflection.forEach((task) => {
			const completedAt = formatDateTime(task.completedAt);
			lines.push(
				`- [${priorityLabel[task.priority]}] ${task.title}${
					completedAt ? ` ｜ 完成：${completedAt}` : ""
				}${task.category ? ` ｜ 分类：${task.category}` : ""}`,
			);
		});
	}

	return lines.join("\n");
};
