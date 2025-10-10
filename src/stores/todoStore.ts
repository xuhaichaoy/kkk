import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { debugLog } from "../utils/logger";

export type TodoPriority = "high" | "medium" | "low";
export type TodoStatus = "notStarted" | "inProgress" | "submitted" | "completed";

export interface TodoTimeEntry {
	id: string;
	date: string; // ISO string
	durationMinutes: number;
	comment?: string;
}

export interface TodoTask {
	id: string;
	title: string;
	description?: string;
	notes?: string;
	completed: boolean;
	priority: TodoPriority;
	status?: TodoStatus;
	dueDate?: string; // ISO string
	reminder?: string; // ISO string
	tags: string[];
	category?: string;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
	reminderSent?: boolean;
	timeEntries?: TodoTimeEntry[];
}

export interface TodoFilterState {
	search: string;
	priorities: TodoPriority[];
	tags: string[];
	categories: string[];
	status: "all" | "active" | "completed";
	range: "all" | "today" | "overdue" | "thisWeek" | "custom";
	from?: string;
	to?: string;
}

export const defaultFilterState: TodoFilterState = {
	search: "",
	priorities: [],
	tags: [],
	categories: [],
	status: "all",
	range: "all",
};

const STORAGE_KEY = "blink_todos_v1";
const TAG_STORAGE_KEY = "blink_todo_tags_v1";
const CATEGORY_STORAGE_KEY = "blink_todo_categories_v1";

export const todosAtom = atomWithStorage<TodoTask[]>(STORAGE_KEY, []);
export const tagsAtom = atomWithStorage<string[]>(TAG_STORAGE_KEY, []);
export const categoriesAtom = atomWithStorage<string[]>(
	CATEGORY_STORAGE_KEY,
	[],
);
export const filterAtom = atom<TodoFilterState>(defaultFilterState);
export const calendarMonthAtom = atom<Date>(new Date());

export const addTodoAtom = atom(
	false,
	(get, set, task: Omit<TodoTask, "id" | "createdAt" | "updatedAt">) => {
		const existing = get(todosAtom);
		const now = new Date().toISOString();
		const newTask = {
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now,
			...task,
			timeEntries: task.timeEntries ?? [],
		};

		debugLog("➕ 新建任务:", {
			newTask,
			dueDate: newTask.dueDate,
			reminder: newTask.reminder,
			dueDateType: typeof newTask.dueDate,
			reminderType: typeof newTask.reminder,
			dueDateValid: newTask.dueDate
				? new Date(newTask.dueDate).toString()
				: "no date",
			reminderValid: newTask.reminder
				? new Date(newTask.reminder).toString()
				: "no reminder",
		});

		set(todosAtom, [newTask, ...existing]);
	},
);

const ensureTimeEntries = (task: TodoTask): TodoTimeEntry[] =>
	Array.isArray(task.timeEntries) ? task.timeEntries : [];

export const upsertTimeEntryAtom = atom(
	null,
	(
		_get,
		set,
		{
			taskId,
			entryId,
			date,
			durationMinutes,
			comment,
		}: {
			taskId: string;
			entryId?: string;
			date: string;
			durationMinutes: number;
			comment?: string;
		},
	) => {
		set(todosAtom, (current) =>
			current.map((task) => {
				if (task.id !== taskId) return task;

				const entries = ensureTimeEntries(task);
				const now = new Date().toISOString();

				if (entryId) {
					return {
						...task,
						timeEntries: entries.map((entry) =>
							entry.id === entryId
								? {
									...entry,
									date,
									durationMinutes,
									comment,
								}
								: entry,
						),
						updatedAt: now,
					};
				}

				const newEntry: TodoTimeEntry = {
					id: crypto.randomUUID(),
					date,
					durationMinutes,
					comment,
				};

				return {
					...task,
					timeEntries: [newEntry, ...entries],
					updatedAt: now,
				};
			}),
		);
	},
);

export const removeTimeEntryAtom = atom(
	null,
	(_get, set, { taskId, entryId }: { taskId: string; entryId: string }) => {
		set(todosAtom, (current) =>
			current.map((task) =>
				task.id === taskId
					? {
						...task,
						timeEntries: ensureTimeEntries(task).filter(
							(entry) => entry.id !== entryId,
						),
						updatedAt: new Date().toISOString(),
					}
					: task,
				),
		);
	},
);

export const updateTodoAtom = atom(
	false,
	(get, set, update: { id: string; changes: Partial<TodoTask> }) => {
		const existing = get(todosAtom);
		debugLog("🔄 更新任务:", {
			updateId: update.id,
			changes: update.changes,
			dueDate: update.changes.dueDate,
			reminder: update.changes.reminder,
			dueDateType: typeof update.changes.dueDate,
			reminderType: typeof update.changes.reminder,
		});

		const newTodos = existing.map((todo) =>
			todo.id === update.id
				? {
						...todo,
						...update.changes,
						updatedAt: new Date().toISOString(),
						completedAt:
							update.changes.completed === true
								? new Date().toISOString()
								: update.changes.completed === false
									? undefined
									: todo.completedAt,
					}
				: todo,
		);

		const updatedTodo = newTodos.find((todo) => todo.id === update.id);
		debugLog("✅ 任务更新结果:", {
			id: updatedTodo?.id,
			title: updatedTodo?.title,
			dueDate: updatedTodo?.dueDate,
			reminder: updatedTodo?.reminder,
			dueDateValid: updatedTodo?.dueDate
				? new Date(updatedTodo.dueDate).toString()
				: "no date",
			reminderValid: updatedTodo?.reminder
				? new Date(updatedTodo.reminder).toString()
				: "no reminder",
		});

		set(todosAtom, newTodos);
	},
);

export const removeTodoAtom = atom(null, (get, set, id: string) => {
	const existing = get(todosAtom);
	set(
		todosAtom,
		existing.filter((todo) => todo.id !== id),
	);
});

export const toggleTodoAtom = atom(null, (get, set, id: string) => {
	const existing = get(todosAtom);
	set(
		todosAtom,
		existing.map((todo) =>
			todo.id === id
				? {
						...todo,
						completed: !todo.completed,
						updatedAt: new Date().toISOString(),
						completedAt: !todo.completed ? new Date().toISOString() : undefined,
					}
				: todo,
		),
	);
});

export const upsertTagAtom = atom(null, (get, set, tag: string) => {
	if (!tag.trim()) return;
	const existing = get(tagsAtom);
	if (existing.includes(tag)) {
		return;
	}
	set(tagsAtom, [...existing, tag]);
});

export const removeTagAtom = atom(null, (get, set, tag: string) => {
	set(
		tagsAtom,
		get(tagsAtom).filter((item) => item !== tag),
	);
	set(
		todosAtom,
		get(todosAtom).map((todo) => ({
			...todo,
			tags: todo.tags.filter((t) => t !== tag),
		})),
	);
});

export const upsertCategoryAtom = atom(null, (get, set, category: string) => {
	if (!category.trim()) return;
	const existing = get(categoriesAtom);
	if (existing.includes(category)) {
		return;
	}
	set(categoriesAtom, [...existing, category]);
});

export const removeCategoryAtom = atom(null, (get, set, category: string) => {
	set(
		categoriesAtom,
		get(categoriesAtom).filter((item) => item !== category),
	);
	set(
		todosAtom,
		get(todosAtom).map((todo) => ({
			...todo,
			category: todo.category === category ? undefined : todo.category,
		})),
	);
});

export const bulkCompleteAtom = atom(null, (get, set, ids: string[]) => {
	const setIds = new Set(ids);
	set(
		todosAtom,
		get(todosAtom).map((todo) =>
			setIds.has(todo.id)
				? {
						...todo,
						completed: true,
						completedAt: todo.completedAt ?? new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					}
				: todo,
		),
	);
});

export const clearCompletedAtom = atom(null, (get, set) => {
	set(
		todosAtom,
		get(todosAtom).filter((todo) => !todo.completed),
	);
});

export const todayTasksAtom = atom((get) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);
	return get(todosAtom).filter((todo) => {
		if (!todo.dueDate) return false;
		const due = new Date(todo.dueDate);
		return due >= today && due < tomorrow;
	});
});

export const overdueTasksAtom = atom((get) => {
	const now = new Date();
	return get(todosAtom).filter((todo) => {
		if (!todo.dueDate || todo.completed) return false;
		return new Date(todo.dueDate) < now;
	});
});

export const completionRateAtom = atom((get) => {
	const todos = get(todosAtom);
	if (todos.length === 0) return 0;
	const completed = todos.filter((todo) => todo.completed).length;
	return Math.round((completed / todos.length) * 100);
});
