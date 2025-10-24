import { format, isToday, isTomorrow } from "date-fns";
import type { TodoPriority, TodoTask } from "../../../stores/todoStore";
import {
	getTaskDateRange,
	getTaskStartDate,
} from "../../../utils/todoUtils";

export interface QuickNote {
	id: string;
	text: string;
	createdAt: string;
	pinned?: boolean;
}

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
	high: "高优先",
	medium: "中优先",
	low: "低优先",
	none: "无优先级",
};

export const PRIORITY_COLORS: Record<
	TodoPriority,
	"default" | "error" | "warning" | "info"
> = {
	high: "error",
	medium: "warning",
	low: "info",
	none: "default",
};

export type ScheduleTone = "default" | "warning" | "danger";

export const formatDateForLabel = (value: Date) => {
	if (isToday(value)) return `今天 ${format(value, "HH:mm")}`;
	if (isTomorrow(value)) return `明天 ${format(value, "HH:mm")}`;
	return format(value, "MM-dd HH:mm");
};

export const getTaskScheduleInfo = (
	task: TodoTask,
): { label: string; tone: ScheduleTone } => {
	const range = getTaskDateRange(task);
	const now = new Date();

	if (range) {
		const sameDay =
			format(range.start, "yyyy-MM-dd") ===
			format(range.end, "yyyy-MM-dd");
		const sameMoment = range.start.getTime() === range.end.getTime();
		let label: string;
		if (sameDay) {
			if (sameMoment) {
				label = formatDateForLabel(range.start);
			} else {
				label = `${formatDateForLabel(range.start)} ~ ${format(range.end, "HH:mm")}`;
			}
		} else {
			label = `${formatDateForLabel(range.start)} ~ ${formatDateForLabel(range.end)}`;
		}
		const diff = range.end.getTime() - now.getTime();
		const tone: ScheduleTone =
			diff < 0 ? "danger" : diff <= 2 * 60 * 60 * 1000 ? "warning" : "default";
		return { label, tone };
	}

	if (task.reminder) {
		const reminderDate = new Date(task.reminder);
		if (!Number.isNaN(reminderDate.getTime())) {
			const label = `提醒 ${formatDateForLabel(reminderDate)}`;
			const diff = reminderDate.getTime() - now.getTime();
			const tone: ScheduleTone =
				diff < 0 ? "danger" : diff <= 2 * 60 * 60 * 1000 ? "warning" : "default";
			return { label, tone };
		}
	}

	const startDate = getTaskStartDate(task);
	if (startDate) {
		const label = formatDateForLabel(startDate);
		const diff = startDate.getTime() - now.getTime();
		const tone: ScheduleTone =
			diff < 0 ? "danger" : diff <= 2 * 60 * 60 * 1000 ? "warning" : "default";
		return { label, tone };
	}

	return { label: "未安排时间", tone: "default" };
};

export const createNoteId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2, 10);
};
