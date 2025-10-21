import { startOfToday } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useMemo, useState, type FC } from "react";
import TodoCalendar, {
	type CalendarTaskFormValues,
} from "../components/todo/TodoCalendar";
import type { TodoTask } from "../stores/todoStore";
import {
	DEFAULT_CATEGORY,
	addTodoAtom,
	calendarMonthAtom,
	categoriesAtom,
	tagsAtom,
	todosAtom,
	updateTodoAtom,
	upsertCategoryAtom,
	upsertTagAtom,
} from "../stores/todoStore";
import { normalizeRichTextValue } from "../utils/richTextUtils";

const TodoCalendarPage: FC = () => {
	const todos = useAtomValue(todosAtom);
	const tags = useAtomValue(tagsAtom);
	const categories = useAtomValue(categoriesAtom);
	const categoryOptions = useMemo(() => {
		const normalized = categories
			.map((category) => category.trim())
			.filter((category) => category.length > 0 && category !== DEFAULT_CATEGORY);
		return Array.from(new Set([DEFAULT_CATEGORY, ...normalized]));
	}, [categories]);
	const [calendarMonth, setCalendarMonth] = useAtom(calendarMonthAtom);
	const [selectedDate, setSelectedDate] = useState(startOfToday());
	const addTodo = useSetAtom(addTodoAtom);
	const updateTodo = useSetAtom(updateTodoAtom);
	const upsertTag = useSetAtom(upsertTagAtom);
	const upsertCategory = useSetAtom(upsertCategoryAtom);

	const handleCreateTask = useCallback(
		(input: CalendarTaskFormValues) => {
			let dueDate = input.dueDate;
			let dueDateEnd = input.dueDateEnd;

			if (input.dateMode === "single") {
				dueDateEnd = undefined;
				if (!dueDate) {
					dueDate = new Date().toISOString();
				}
			} else {
				if (!dueDateEnd && dueDate) {
					dueDateEnd = dueDate;
				}
				if (dueDate && dueDateEnd && new Date(dueDate) > new Date(dueDateEnd)) {
					const tmp = dueDate;
					dueDate = dueDateEnd;
					dueDateEnd = tmp;
				}
			}

			const cleanedTags = Array.from(
				new Set(
					(input.tags ?? [])
						.map((tag) => tag.trim())
						.filter((tag) => tag.length > 0),
					),
			);

			cleanedTags
				.filter((tag) => !tags.includes(tag))
				.forEach((tag) => upsertTag(tag));

			const categoryValue = input.category?.trim();
			if (
				categoryValue &&
				categoryValue !== DEFAULT_CATEGORY &&
				!categories.includes(categoryValue)
			) {
				upsertCategory(categoryValue);
			}

			const normalizedDescription = normalizeRichTextValue(input.description);
			const normalizedNotes = normalizeRichTextValue(input.notes);
			const normalizedReflection = normalizeRichTextValue(input.reflection);

			addTodo({
				title: input.title,
				description: normalizedDescription,
				notes: normalizedNotes,
				reflection: normalizedReflection,
				priority: input.priority,
				completed: input.completed,
				dueDate,
				dueDateEnd,
				reminder: input.reminder,
				status: input.status ?? (input.completed ? "completed" : "notStarted"),
				category: categoryValue,
				tags: cleanedTags,
			});
		},
		[addTodo, categories, tags, upsertCategory, upsertTag],
	);

	const handleUpdateTask = useCallback(
		(id: string, changes: CalendarTaskFormValues) => {
			const categoryValue = changes.category?.trim();
			const cleanedTags = Array.from(
				new Set(
					(changes.tags ?? [])
						.map((tag) => tag.trim())
						.filter((tag) => tag.length > 0),
					),
			);

			cleanedTags
				.filter((tag) => !tags.includes(tag))
				.forEach((tag) => upsertTag(tag));

			if (
				categoryValue &&
				categoryValue !== DEFAULT_CATEGORY &&
				!categories.includes(categoryValue)
			) {
				upsertCategory(categoryValue);
			}

			const normalizedDescription = normalizeRichTextValue(changes.description);
			const normalizedNotes = normalizeRichTextValue(changes.notes);
			const normalizedReflection = normalizeRichTextValue(changes.reflection);

			const updatePayload: Partial<TodoTask> = {
				title: changes.title,
				description: normalizedDescription,
				notes: normalizedNotes,
				reflection: normalizedReflection,
				priority: changes.priority,
				completed: changes.completed,
				dueDate: changes.dueDate,
				dueDateEnd: changes.dueDateEnd,
				reminder: changes.reminder,
			};

			if (changes.status !== undefined) {
				updatePayload.status = changes.status;
			} else if (changes.completed) {
				updatePayload.status = "completed";
			}

			if (changes.category !== undefined) {
				updatePayload.category = categoryValue;
			}

			if (changes.tags !== undefined) {
				updatePayload.tags = cleanedTags;
			}

			updateTodo({
				id,
				changes: updatePayload,
			});
		},
		[categories, tags, updateTodo, upsertCategory, upsertTag],
	);

	return (
		<TodoCalendar
			tasks={todos}
			month={calendarMonth}
			selectedDate={selectedDate}
			onSelectDate={setSelectedDate}
			onMonthChange={setCalendarMonth}
			onCreateTask={handleCreateTask}
			onUpdateTask={handleUpdateTask}
			allTags={tags}
			allCategories={categoryOptions}
		/>
	);
};

export default TodoCalendarPage;
