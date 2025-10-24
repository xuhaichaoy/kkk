import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export interface TodoReminderLogEntry {
	id: string;
	taskId: string;
	taskTitle: string;
	reminderAt?: string;
	sentAt: string;
	snoozedUntil?: string;
	completed?: boolean;
}

const REMINDER_LOG_STORAGE_KEY = "todo_reminder_log_v1";
const MAX_REMINDER_LOG_ENTRIES = 50;

const createEntryId = () => {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const reminderLogAtom = atomWithStorage<TodoReminderLogEntry[]>(
	REMINDER_LOG_STORAGE_KEY,
	[],
);

export const appendReminderLogAtom = atom(
	null,
	(get, set, payload: Omit<TodoReminderLogEntry, "id"> & { id?: string }) => {
		const current = get(reminderLogAtom);
		const id = payload.id ?? createEntryId();
		const entry: TodoReminderLogEntry = { ...payload, id };
		const next = [entry, ...current.filter((item) => item.id !== id)];
		if (next.length > MAX_REMINDER_LOG_ENTRIES) {
			next.length = MAX_REMINDER_LOG_ENTRIES;
		}
		set(reminderLogAtom, next);
	},
);

export const updateReminderLogAtom = atom(
	null,
	(
		get,
		set,
		{
			id,
			changes,
		}: {
			id: string;
			changes: Partial<Omit<TodoReminderLogEntry, "id" | "taskId" | "taskTitle">>;
		},
	) => {
		const current = get(reminderLogAtom);
		set(
			reminderLogAtom,
			current.map((item) =>
				item.id === id
					? {
						...item,
						...changes,
					}
					: item,
			),
		);
	},
);

export const pruneReminderLogAtom = atom(null, (get, set) => {
	const current = get(reminderLogAtom);
	if (current.length <= MAX_REMINDER_LOG_ENTRIES) return;
	set(reminderLogAtom, current.slice(0, MAX_REMINDER_LOG_ENTRIES));
});
