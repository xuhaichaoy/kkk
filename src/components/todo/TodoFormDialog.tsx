import {
	Autocomplete,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	MenuItem,
	Stack,
	Switch,
	TextField,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs, { type Dayjs } from "dayjs";
import type { FC } from "react";
import React, { useEffect, useMemo, useState } from "react";
import type {
	TodoPriority,
	TodoStatus,
	TodoTask,
} from "../../stores/todoStore";

interface TodoFormDialogProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (values: FormValues) => void;
	initialTask?: TodoTask | null;
	allTags: string[];
	allCategories: string[];
	onCreateTag: (tag: string) => void;
	onCreateCategory: (category: string) => void;
}

export interface FormValues {
	id?: string;
	title: string;
	description?: string;
	notes?: string;
	priority: TodoPriority;
	completed: boolean;
	dueDate?: string;
	reminder?: string;
	tags: string[];
	category?: string;
	status: TodoStatus;
}

// 日期时间转换函数
const isoToDayjs = (iso?: string): Dayjs | null => {
	if (!iso) return null;
	return dayjs(iso);
};

const dayjsToIso = (dayjs?: Dayjs | null): string | undefined => {
	if (!dayjs || !dayjs.isValid()) return undefined;
	return dayjs.toISOString();
};

const createDefaultValues = (): FormValues => ({
	title: "",
	description: "",
	notes: "",
	priority: "medium",
	completed: false,
	tags: [],
	status: "notStarted",
	dueDate: undefined,
	reminder: undefined,
});

const STATUS_OPTIONS: Array<{ label: string; value: TodoStatus }> = [
	{ value: "notStarted", label: "待开始" },
	{ value: "inProgress", label: "进行中" },
	{ value: "submitted", label: "待确认" },
	{ value: "completed", label: "已完成" },
];

const TodoFormDialog: FC<TodoFormDialogProps> = ({
	open,
	onClose,
	onSubmit,
	initialTask,
	allTags,
	allCategories,
	onCreateTag,
	onCreateCategory,
}) => {
	const [values, setValues] = useState<FormValues>(() => createDefaultValues());

	useEffect(() => {
		if (!open) return;
		if (initialTask) {
			setValues({
				id: initialTask.id,
				title: initialTask.title,
				description: initialTask.description ?? "",
				notes: initialTask.notes ?? "",
				priority: initialTask.priority,
				completed: initialTask.completed,
				dueDate: initialTask.dueDate,
				reminder: initialTask.reminder,
				tags: initialTask.tags,
				category: initialTask.category,
				status:
					initialTask.status ??
					(initialTask.completed ? "completed" : "notStarted"),
			});
		} else {
			setValues(createDefaultValues());
		}
	}, [open, initialTask]);

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

	const handleSubmit = () => {
		if (titleInvalid) return;

		values.tags.filter((tag) => !allTags.includes(tag)).forEach(onCreateTag);

		if (values.category && !allCategories.includes(values.category)) {
			onCreateCategory(values.category);
		}

		onSubmit(values);
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
				<DialogContent dividers>
					<Stack spacing={2.5} sx={{ mt: 1 }}>
						<TextField
							label="任务名称"
							value={values.title}
							onChange={(event) =>
								setValues((prev) => ({ ...prev, title: event.target.value }))
							}
							required
							error={titleInvalid}
							helperText={titleInvalid ? "请输入任务名称" : " "}
							fullWidth
							autoFocus
						/>
						<TextField
							label="描述"
							value={values.description}
							multiline
							minRows={2}
							onChange={(event) =>
								setValues((prev) => ({
									...prev,
									description: event.target.value,
								}))
							}
							fullWidth
						/>
						<TextField
							label="备注"
							value={values.notes}
							multiline
							minRows={2}
							onChange={(event) =>
								setValues((prev) => ({ ...prev, notes: event.target.value }))
							}
							fullWidth
						/>

						<Autocomplete
							options={["high", "medium", "low"] as TodoPriority[]}
							value={values.priority}
							onChange={(_, newValue) =>
								setValues((prev) => ({
									...prev,
									priority: newValue ?? "medium",
								}))
							}
							disableClearable
							renderInput={(params) => <TextField {...params} label="优先级" />}
						/>

						<TextField
							select
							label="状态"
							value={values.status}
							onChange={(event) => {
								const nextStatus = event.target.value as TodoStatus;
								setValues((prev) => ({
									...prev,
									status: nextStatus,
									completed: nextStatus === "completed",
								}));
							}}
							helperText="待开始 / 进行中 / 待确认 / 已完成"
						>
							{STATUS_OPTIONS.map((option) => (
								<MenuItem key={option.value} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>

						<DateTimePicker
							label="截止时间"
							value={isoToDayjs(values.dueDate)}
							onChange={(newValue) => {
								const isoValue = dayjsToIso(newValue);
								setValues((prev) => ({ ...prev, dueDate: isoValue }));
							}}
							slotProps={{
								textField: { fullWidth: true },
							}}
						/>
						<DateTimePicker
							label="提醒时间"
							value={isoToDayjs(values.reminder)}
							onChange={(newValue) => {
								const isoValue = dayjsToIso(newValue);
								setValues((prev) => ({ ...prev, reminder: isoValue }));
							}}
							slotProps={{
								textField: {
									fullWidth: true,
									helperText: "到达提醒时间后将在桌面弹出通知",
								},
							}}
						/>

						<Autocomplete
							multiple
							freeSolo
							options={allTags}
							value={values.tags}
							onChange={(_, newValue) =>
								setValues((prev) => ({ ...prev, tags: newValue }))
							}
							renderInput={(params) => (
								<TextField
									{...params}
									label="标签"
									placeholder="输入回车添加标签"
								/>
							)}
						/>

						<Autocomplete
							freeSolo
							options={allCategories}
							value={values.category ?? ""}
							onChange={(_, newValue) =>
								setValues((prev) => ({
									...prev,
									category: newValue || undefined,
								}))
							}
							renderInput={(params) => (
								<TextField
									{...params}
									label="分类"
									placeholder="如：工作 / 个人"
								/>
							)}
						/>

						<FormControlLabel
							control={
								<Switch
									checked={values.completed}
									onChange={(_, checked) =>
										setValues((prev) => ({ ...prev, completed: checked }))
									}
								/>
							}
							label="标记为已完成"
						/>
					</Stack>
				</DialogContent>
				<DialogActions>
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
