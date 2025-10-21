import {
	addDays,
	addWeeks,
	endOfDay,
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
import { extractTextFromHtml } from "./richTextUtils";

const parseDateValue = (value?: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const getTaskDateRange = (
    task: TodoTask,
): { start: Date; end: Date } | null => {
    const startCandidate = parseDateValue(task.dueDate);
    const endCandidate = parseDateValue(task.dueDateEnd);

    if (startCandidate && endCandidate) {
        const start =
            startCandidate.getTime() <= endCandidate.getTime()
                ? startCandidate
                : endCandidate;
        const end =
            startCandidate.getTime() <= endCandidate.getTime()
                ? endCandidate
                : startCandidate;
        return { start, end };
    }

    if (startCandidate) {
        return { start: startCandidate, end: startCandidate };
    }

    if (endCandidate) {
        return { start: endCandidate, end: endCandidate };
    }

    return null;
};

export const getTaskStartDate = (task: TodoTask): Date | null => {
    const range = getTaskDateRange(task);
    if (range) return range.start;
    return parseDateValue(task.reminder) ?? parseDateValue(task.createdAt);
};

export const getTaskDueDate = (task: TodoTask): Date | null => {
    const range = getTaskDateRange(task);
    if (range) return range.end;
    return parseDateValue(task.reminder);
};

const priorityOrder: Record<TodoPriority, number> = {
	high: 0,
	medium: 1,
	low: 2,
	none: 3,
};

const dueValue = (task: TodoTask) => {
	const range = getTaskDateRange(task);
	if (range) {
		return range.start.getTime();
	}
	const due = getTaskDueDate(task);
	return due ? due.getTime() : Number.POSITIVE_INFINITY;
};

export const getNextHalfHour = (referenceDate: Date = new Date()): Date => {
	const next = new Date(referenceDate);
	next.setSeconds(0, 0);
	if (next.getMinutes() < 30) {
		next.setMinutes(30);
	} else {
		next.setHours(next.getHours() + 1);
		next.setMinutes(0);
	}

	// 如果跨到次日的 00:00，则调整为 00:01
	if (next.getHours() === 0 && next.getMinutes() === 0) {
		next.setMinutes(1);
	}

	return next;
};

export const getNextHalfHourIsoString = (referenceDate?: Date): string =>
	getNextHalfHour(referenceDate).toISOString();

export const matchesSearch = (task: TodoTask, search: string) => {
	if (!search) return true;
	const lower = search.toLowerCase();
	const descriptionText = task.description
		? extractTextFromHtml(task.description).toLowerCase()
		: "";
	const notesText = task.notes
		? extractTextFromHtml(task.notes).toLowerCase()
		: "";
	const reflectionText = task.reflection
		? extractTextFromHtml(task.reflection).toLowerCase()
		: "";
	return (
		task.title.toLowerCase().includes(lower) ||
		descriptionText.includes(lower) ||
		notesText.includes(lower) ||
		reflectionText.includes(lower) ||
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
        const rangeInfo = getTaskDateRange(task);
        if (!rangeInfo) {
            return false;
        }

        const rangeStart = rangeInfo.start;
        const rangeEnd = rangeInfo.end;

        if (filter.range === "today") {
            const dayStart = startOfDay(referenceDate);
            const dayEnd = addDays(dayStart, 1);
            if (rangeStart >= dayEnd || rangeEnd < dayStart) return false;
        } else if (filter.range === "thisWeek") {
            const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
            const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
            if (rangeStart > end || rangeEnd < start) return false;
        } else if (filter.range === "overdue") {
            if (!(rangeEnd < referenceDate && !task.completed)) return false;
        } else if (filter.range === "custom") {
            if (filter.from) {
                const fromDate = new Date(filter.from);
                if (Number.isFinite(fromDate.getTime())) {
                    const fromStart = startOfDay(fromDate);
                    if (rangeEnd < fromStart) return false;
                }
            }
            if (filter.to) {
                const toDate = new Date(filter.to);
                if (Number.isFinite(toDate.getTime())) {
                    const toEnd = addDays(startOfDay(toDate), 1);
                    if (rangeStart >= toEnd) return false;
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
            (() => {
                const range = getTaskDateRange(task);
                if (!range) return false;
                return !task.completed && isBefore(range.end, referenceDate);
            })(),
    );

export const getTodayTodos = (tasks: TodoTask[], baseDate = startOfToday()) =>
    tasks.filter(
        (task) => {
            const range = getTaskDateRange(task);
            if (!range) return false;
            const dayStart = startOfDay(baseDate);
            const dayEnd = addDays(dayStart, 1);
            return range.start < dayEnd && range.end >= dayStart;
        },
    );

export const getWeekTodos = (tasks: TodoTask[], baseDate = new Date()) => {
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    const end = endOfWeek(baseDate, { weekStartsOn: 1 });
    return tasks.filter((task) => {
        const range = getTaskDateRange(task);
        if (!range) return false;
        return range.start <= end && range.end >= start;
    });
};

export const getCalendarTodos = (todos: TodoTask[], selectedDate: Date) => {
	const selectedStart = startOfDay(selectedDate);

	const overdue: TodoTask[] = [];
	const upcoming: TodoTask[] = [];

	todos.forEach((task) => {
		if (task.completed) return;

		const range = getTaskDateRange(task);

		if (!range) {
			upcoming.push(task);
			return;
		}

		if (isBefore(range.end, selectedStart)) {
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

export type DateRange = { start: Date; end: Date };

const normalizeRange = (range: DateRange): DateRange => {
	const start = startOfDay(range.start);
	const end = endOfDay(range.end);
	if (start.getTime() <= end.getTime()) {
		return { start, end };
	}
	return { start: end, end: start };
};

export const getCurrentWeekRange = (referenceDate = new Date()): DateRange =>
	normalizeRange({
		start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
		end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
	});

const priorityLabel: Record<TodoPriority, string> = {
	high: "高",
	medium: "中",
	low: "低",
	none: "无",
};

const formatDateTime = (value?: string) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return format(date, "MM月dd日 HH:mm");
};

const formatDate = (value?: string | Date | null) => {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
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
			const range = getTaskDateRange(task);
			if (range) {
				const sameDay = format(range.start, "yyyy-MM-dd") === format(range.end, "yyyy-MM-dd");
				const label = sameDay
					? format(range.start, "MM月dd日")
					: `${format(range.start, "MM月dd日")} - ${format(range.end, "MM月dd日")}`;
				parts.push(`时间：${label}`);
			}
			return `- ${parts.join(" ｜ ")}`;
		});

type WeeklyReportOptions =
	| Date
	| {
			referenceDate?: Date;
			range?: DateRange;
	  };

export const generateWeeklyReport = (
	todos: TodoTask[],
	options?: WeeklyReportOptions,
) => {
	const normalizedOptions =
		options instanceof Date ? { referenceDate: options } : options ?? {};
	const now = normalizedOptions.referenceDate ?? new Date();
	const resolvedRange = normalizedOptions.range
		? normalizeRange(normalizedOptions.range)
		: getCurrentWeekRange(now);
	const rangeStart = resolvedRange.start;
	const rangeEnd = resolvedRange.end;
	const effectiveRangeEnd = normalizedOptions.range
		? rangeEnd
		: now.getTime() < rangeEnd.getTime()
			? now
			: rangeEnd;
	const baseWeekStart = startOfWeek(rangeStart, { weekStartsOn: 1 });
	const nextWeekStart = addWeeks(baseWeekStart, 1);
	const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

	const totalCount = todos.length;
	const completedCount = todos.filter((task) => task.completed).length;
	const createdThisWeek = todos.filter((task) =>
		isWithinInterval(new Date(task.createdAt), {
			start: rangeStart,
			end: effectiveRangeEnd,
		}),
	);

	const completedThisWeek = todos.filter(
		(task) =>
			task.completed &&
			task.completedAt &&
			isWithinInterval(new Date(task.completedAt), {
				start: rangeStart,
				end: effectiveRangeEnd,
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

	const upcomingNextWeek = todos.filter((task) => {
		if (task.completed) return false;
		const range = getTaskDateRange(task);
		if (!range) return false;
		return range.start <= nextWeekEnd && range.end >= nextWeekStart;
	});

	const overdue = todos.filter((task) => {
		if (task.completed) return false;
		const range = getTaskDateRange(task);
		if (!range) return false;
		return isBefore(range.end, now);
	});

	const lines: string[] = [];
	lines.push("【本周概览】");
	lines.push(
		`- 时间范围：${format(rangeStart, "MM月dd日")} - ${format(
			rangeEnd,
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
			const range = getTaskDateRange(task);
			const dateLabel = range
				? (() => {
						const sameDay = format(range.start, "yyyy-MM-dd") === format(range.end, "yyyy-MM-dd");
						return sameDay
							? format(range.end, "MM月dd日")
							: `${format(range.start, "MM月dd日")} - ${format(range.end, "MM月dd日")}`;
					})()
				: "";
			lines.push(
				`- [${priorityLabel[task.priority]}] ${task.title}${
					dateLabel ? ` ｜ 时间：${dateLabel}` : ""
				}${task.category ? ` ｜ 分类：${task.category}` : ""}`,
			);
		});
	}

	if (overdue.length > 0) {
		lines.push("\n【需要关注】");
		overdue.forEach((task) => {
			const range = getTaskDateRange(task);
			const dateLabel = range
				? (() => {
						const sameDay = format(range.start, "yyyy-MM-dd") === format(range.end, "yyyy-MM-dd");
						return sameDay
							? format(range.end, "MM月dd日")
							: `${format(range.start, "MM月dd日")} - ${format(range.end, "MM月dd日")}`;
					})()
				: "";
			lines.push(
				`- [${priorityLabel[task.priority]}] ${task.title}${
					dateLabel ? ` ｜ 已逾期：${dateLabel}` : ""
				}${task.category ? ` ｜ 分类：${task.category}` : ""}`,
			);
		});
	}

	return lines.join("\n");
};

type WeeklyReflectionOptions =
	| Date
	| {
			referenceDate?: Date;
			range?: DateRange;
	  };

export const generateWeeklyReflection = (
	todos: TodoTask[],
	options?: WeeklyReflectionOptions,
) => {
	const normalizedOptions =
		options instanceof Date ? { referenceDate: options } : options ?? {};
	const now = normalizedOptions.referenceDate ?? new Date();
	const resolvedRange = normalizedOptions.range
		? normalizeRange(normalizedOptions.range)
		: getCurrentWeekRange(now);
	const rangeStart = resolvedRange.start;
	const rangeEnd = resolvedRange.end;

	const isInReflectionWindow = (value?: string) => {
		if (!value) return false;
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return false;
		return isWithinInterval(date, {
			start: rangeStart,
			end: rangeEnd,
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
				start: rangeStart,
				end: rangeEnd,
			}),
	);

	const missingReflection = completedThisWeek.filter(
		(task) => !task.reflection || task.reflection.trim().length === 0,
	);

	const lines: string[] = [];
	lines.push("【本周反思总结】");
	lines.push(
		`- 时间范围：${format(rangeStart, "MM月dd日")} - ${format(
			rangeEnd,
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
				task.category ? `分类：${task.category}` : "",
				completedAt ? `完成：${completedAt}` : "",
				!completedAt && updatedAt ? `更新：${updatedAt}` : "",
			].filter(Boolean);
			lines.push(`- ${labelParts.join(" ｜ ")}`);
			const reflectionText = extractTextFromHtml(task.reflection ?? "");
			if (reflectionText) {
				lines.push(`  反思：${reflectionText}`);
			}
			lines.push(""); // 空行分隔不同任务反思
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
