import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import type { FC } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { TodoStatus, TodoTask } from "../../stores/todoStore";
import TaskQuickForm from "./TaskQuickForm";
import type { CalendarTaskFormValues } from "./TodoCalendar";
import { normalizeRichTextValue, sanitizeRichText } from "../../utils/richTextUtils";
import { getNextHalfHourIsoString } from "../../utils/todoUtils";

interface TodoFormDialogProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (values: FormValues) => void;
	initialTask?: TodoTask | null;
	allTags: string[];
	allCategories: string[];
	onCreateTag: (tag: string) => void;
	onCreateCategory: (category: string) => void;
	defaultCategory?: string;
}

export interface FormValues extends CalendarTaskFormValues {
	id?: string;
	status: TodoStatus;
}

// 日期时间转换函数
const isoToDayjs = (iso?: string): Dayjs | null => {
	if (!iso) return null;
	return dayjs(iso);
};

const determineDateMode = (dueDate?: string, dueDateEnd?: string): "single" | "range" => {
	const start = isoToDayjs(dueDate);
	const end = isoToDayjs(dueDateEnd);
	if (start && end && !start.isSame(end)) {
		return "range";
	}
	return "single";
};

const createDefaultValues = (): FormValues => ({
	title: "",
	description: "",
	notes: "",
	reflection: "",
	priority: "none",
	completed: false,
	tags: [],
	status: "notStarted",
	dueDate: getNextHalfHourIsoString(),
	dueDateEnd: undefined,
	reminder: undefined,
	dateMode: "single",
});

const TodoFormDialog: FC<TodoFormDialogProps> = ({
	open,
	onClose,
	onSubmit,
	initialTask,
	allTags,
	allCategories,
	onCreateTag,
	onCreateCategory,
	defaultCategory,
}) => {
	const [values, setValues] = useState<FormValues>(() => createDefaultValues());

	useEffect(() => {
	if (!open) return;
	if (initialTask) {
		setValues({
			id: initialTask.id,
			title: initialTask.title,
			description: sanitizeRichText(initialTask.description ?? ""),
			notes: sanitizeRichText(initialTask.notes ?? ""),
			reflection: sanitizeRichText(initialTask.reflection ?? ""),
			priority: initialTask.priority ?? "none",
			completed: initialTask.completed,
			dueDate: initialTask.dueDate,
			dueDateEnd: initialTask.dueDateEnd, // 从任务数据中读取
			reminder: initialTask.reminder,
			tags: initialTask.tags ?? [],
			category: initialTask.category,
			status:
				initialTask.status ??
				(initialTask.completed ? "completed" : "notStarted"),
			dateMode: determineDateMode(initialTask.dueDate, initialTask.dueDateEnd),
		});
	} else {
		// 新建任务时，使用默认分类
		setValues({
			...createDefaultValues(),
			category: defaultCategory,
		});
		}
	}, [open, initialTask, defaultCategory]);

	const titleInvalid = useMemo(
		() => values.title.trim().length === 0,
		[values.title],
	);

	useEffect(() => {
		setValues((prev) => {
			if (prev.completed && prev.status !== "completed") {
				return { ...prev, status: "completed" };
			}
			if (!prev.completed && prev.status === "completed") {
				return { ...prev, status: "inProgress" };
			}
			return prev;
		});
	}, [values.completed]);

	const handleFieldChange = useCallback(
		<K extends keyof CalendarTaskFormValues>(key: K, value: CalendarTaskFormValues[K]) => {
			setValues((prev) => {
				const normalizedValue =
					typeof value === "string" ? sanitizeRichText(value) : value;
				const next: FormValues = {
					...prev,
					[key]: normalizedValue as CalendarTaskFormValues[K],
				};

				if (key === "dateMode" && value === "single") {
					next.dueDateEnd = undefined;
				}

				if (key === "status") {
					if (value === "completed") {
						next.completed = true;
					} else if (prev.completed && value !== "completed") {
						next.completed = false;
					}
				}

				if (key === "completed") {
					if (value && next.status !== "completed") {
						next.status = "completed";
					} else if (!value && next.status === "completed") {
						next.status = "inProgress";
					}
				}

				return next;
			});
		},
		[],
	);

	const handleSubmit = () => {
		if (titleInvalid) return;

		const trimmedTitle = values.title.trim();
		const cleanedTags = Array.from(
			new Set(values.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
		);
		cleanedTags.filter((tag) => !allTags.includes(tag)).forEach(onCreateTag);

		const categoryValue = values.category?.trim();
		if (categoryValue && !allCategories.includes(categoryValue)) {
			onCreateCategory(categoryValue);
		}

	if (values.dateMode === "range") {
		const hasStart = Boolean(values.dueDate);
		const hasEnd = Boolean(values.dueDateEnd);

		if (!hasStart || !hasEnd) {
			return;
		}

		const start = dayjs(values.dueDate);
		const end = dayjs(values.dueDateEnd);
		if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
			return;
		}
	}

	const payload: FormValues = {
		...values,
		title: trimmedTitle,
		tags: cleanedTags,
		category: categoryValue,
		dateMode: values.dateMode,
	};

	payload.description = normalizeRichTextValue(values.description);
	payload.notes = normalizeRichTextValue(values.notes);
	payload.reflection = normalizeRichTextValue(values.reflection);

	if (payload.dateMode === "single") {
		payload.dueDateEnd = undefined;
	} else {
		const start = dayjs(payload.dueDate);
		const end = dayjs(payload.dueDateEnd);
		if (start.isAfter(end)) {
			payload.dueDate = end.toISOString();
			payload.dueDateEnd = start.toISOString();
		}
	}

	onSubmit(payload);

	onClose();
};

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs}>
			<Dialog
				open={open}
				onClose={onClose}
				fullWidth
				maxWidth="sm"
				disableRestoreFocus
			>
				<DialogTitle>{values.id ? "编辑任务" : "新建任务"}</DialogTitle>
				<DialogContent dividers sx={{ p: 0 }}>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							maxHeight: "70vh",
							minHeight: 320,
						}}
					>
						<Box sx={{ flex: 1, overflowY: "auto", p: 2.5, pt: 2 }}>
							<TaskQuickForm
								values={values}
								onChange={handleFieldChange}
								allTags={allTags}
								allCategories={allCategories}
								autoFocusTitle={!values.id}
								titleError={titleInvalid}
								titleHelperText={titleInvalid ? "请输入任务名称" : undefined}
							/>
						</Box>
					</Box>
				</DialogContent>
				<DialogActions
					sx={{
						justifyContent: "flex-end",
						gap: 1,
						px: 3,
						py: 2,
						borderTop: "1px solid",
						borderColor: "divider",
						backgroundColor: "background.paper",
					}}
				>
					<Button onClick={onClose}>取消</Button>
					<Button
						variant="contained"
						onClick={handleSubmit}
						disabled={titleInvalid}
					>
						保存
					</Button>
				</DialogActions>
			</Dialog>
		</LocalizationProvider>
	);
};

export default TodoFormDialog;
