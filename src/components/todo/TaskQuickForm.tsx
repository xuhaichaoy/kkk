import React from "react";
import {
	Box,
	FormControlLabel,
	MenuItem,
	Select,
	Stack,
	Switch,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import Autocomplete from "@mui/material/Autocomplete";
import dayjs, { type Dayjs } from "dayjs";
import type { CalendarTaskFormValues } from "./TodoCalendar";
import type { TodoPriority, TodoStatus } from "../../stores/todoStore";
import RichTextEditor from "../common/RichTextEditor";

const isoToDayjs = (value?: string): Dayjs | null => {
	if (!value) return null;
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed : null;
};

const dayjsToIso = (
	value: Dayjs | null,
	options?: {
		fallback?: "startOfDay" | "endOfDay";
		offsetHours?: number;
	},
): string | undefined => {
	if (!value || !value.isValid()) return undefined;

	const offsetHours = options?.offsetHours;
	if (typeof offsetHours === "number") {
		value = value.add(offsetHours, "hour");
	}

	if (options?.fallback === "startOfDay") {
		return value.startOf("day").toISOString();
	}

	if (options?.fallback === "endOfDay") {
		return value.endOf("day").toISOString();
	}

	return value.toISOString();
};

const STATUS_OPTIONS: Array<{ value: TodoStatus; label: string }> = [
	{ value: "notStarted", label: "待开始" },
	{ value: "inProgress", label: "进行中" },
	{ value: "submitted", label: "待确认" },
	{ value: "completed", label: "已完成" },
];

export interface TaskQuickFormProps {
	values: CalendarTaskFormValues;
	onChange: <K extends keyof CalendarTaskFormValues>(
		key: K,
		value: CalendarTaskFormValues[K],
	) => void;
	allTags: string[];
	allCategories: string[];
	titleError?: boolean;
	titleHelperText?: string;
	autoFocusTitle?: boolean;
}

const TaskQuickForm: React.FC<TaskQuickFormProps> = ({
	values,
	onChange,
	allTags,
	allCategories,
	titleError,
	titleHelperText,
	autoFocusTitle,
}) => {
	const startDate = isoToDayjs(values.dueDate);
	const rawEndDate = isoToDayjs(values.dueDateEnd);
	const displayEndDate =
		rawEndDate ??
		(values.dateMode === "range" && startDate
			? startDate.add(1, "hour")
			: null);

	return (
		<Stack spacing={2}>
			<Stack spacing={1.5}>
				<ToggleButtonGroup
					color="primary"
					size="small"
					value={values.dateMode}
					exclusive
					onChange={(_, mode) => {
						if (!mode) return;
						if (mode === "range") {
							const effectiveStart = startDate?.isValid()
								? startDate
								: dayjs();
							onChange("dueDate", dayjsToIso(effectiveStart));
							const currentEnd = isoToDayjs(values.dueDateEnd);
							if (
								!currentEnd ||
								!currentEnd.isAfter(effectiveStart)
							) {
								onChange(
									"dueDateEnd",
									dayjsToIso(effectiveStart, { offsetHours: 1 }),
								);
							}
						} else {
							onChange("dueDateEnd", undefined);
						}
						onChange("dateMode", mode);
					}}
					sx={{ alignSelf: "flex-start" }}
				>
					<ToggleButton value="single">单日任务</ToggleButton>
					<ToggleButton value="range">时间范围</ToggleButton>
				</ToggleButtonGroup>

				{values.dateMode === "single" ? (
					<DateTimePicker
						label="任务日期"
						value={startDate}
						onChange={(value) => onChange("dueDate", dayjsToIso(value))}
						ampm={false}
						views={["year", "month", "day", "hours", "minutes"]}
						format="YYYY-MM-DD HH:mm"
						timeSteps={{ minutes: 1 }}
						slotProps={{ textField: { size: "small", fullWidth: true } }}
					/>
				) : (
					<Stack spacing={1.5}>
						<DateTimePicker
							label="开始时间"
							value={startDate}
							onChange={(pickerValue) => {
								onChange("dueDate", dayjsToIso(pickerValue));
								if (!pickerValue || !pickerValue.isValid()) {
									return;
								}
								const previousStart = startDate;
								const previousEnd = rawEndDate;
								const previousWasDefault =
									!previousEnd ||
									(previousStart &&
										previousEnd.diff(previousStart, "minute") === 60);

								const shouldUpdateEnd =
									previousWasDefault ||
									(previousEnd ? !previousEnd.isAfter(pickerValue) : true);

								if (shouldUpdateEnd) {
									onChange("dueDateEnd", dayjsToIso(pickerValue, { offsetHours: 1 }));
								}
							}}
							ampm={false}
							views={["year", "month", "day", "hours", "minutes"]}
							format="YYYY-MM-DD HH:mm"
							timeSteps={{ minutes: 1 }}
							slotProps={{
								textField: { size: "small", fullWidth: true, required: true },
							}}
						/>
						<DateTimePicker
							label="结束时间"
							value={displayEndDate}
							onChange={(value) => onChange("dueDateEnd", dayjsToIso(value))}
							ampm={false}
							views={["year", "month", "day", "hours", "minutes"]}
							format="YYYY-MM-DD HH:mm"
							timeSteps={{ minutes: 1 }}
							minDateTime={startDate ?? undefined}
							slotProps={{
								textField: {
									size: "small",
									fullWidth: true,
									required: true,
									helperText: "结束时间必须大于或等于开始时间",
								},
							}}
						/>
					</Stack>
				)}
			</Stack>

			<TextField
				label="任务标题"
				size="small"
				fullWidth
				value={values.title}
				autoFocus={autoFocusTitle}
				error={Boolean(titleError)}
				helperText={titleHelperText ?? " "}
				onChange={(event) => onChange("title", event.target.value)}
			/>

			<RichTextEditor
				label="描述"
				placeholder="补充任务细节，可粘贴图片"
				value={values.description ?? ""}
				onChange={(html) => onChange("description", html)}
				minHeight={120}
			/>

			<RichTextEditor
				label="备注"
				placeholder="记录补充信息，可粘贴图片"
				value={values.notes ?? ""}
				onChange={(html) => onChange("notes", html)}
				minHeight={100}
			/>

			<RichTextEditor
				label="反思"
				placeholder="记录复盘心得，可粘贴图片"
				value={values.reflection ?? ""}
				onChange={(html) => onChange("reflection", html)}
				minHeight={100}
			/>

			<Stack direction="row" spacing={1.5}>
				<Select
					size="small"
					value={values.priority}
					onChange={(event) =>
						onChange("priority", event.target.value as TodoPriority)
					}
					fullWidth
				>
					<MenuItem value="none">未设置</MenuItem>
					<MenuItem value="high">高优先级</MenuItem>
					<MenuItem value="medium">中优先级</MenuItem>
					<MenuItem value="low">低优先级</MenuItem>
				</Select>
				<Select
					size="small"
					value={values.status ?? "notStarted"}
					onChange={(event) =>
						onChange("status", event.target.value as TodoStatus)
					}
					fullWidth
				>
					{STATUS_OPTIONS.map((option) => (
						<MenuItem key={option.value} value={option.value}>
							{option.label}
						</MenuItem>
					))}
				</Select>
			</Stack>

			<DateTimePicker
			label="提醒时间"
			value={isoToDayjs(values.reminder)}
			onChange={(value) => onChange("reminder", dayjsToIso(value))}
				ampm={false}
				views={["year", "month", "day", "hours", "minutes"]}
				format="YYYY-MM-DD HH:mm"
				timeSteps={{ minutes: 1 }}
				slotProps={{
					textField: {
						size: "small",
						fullWidth: true,
						helperText: "到达提醒时间后将在桌面弹出通知",
					},
				}}
			/>

			<Autocomplete<string, true, false, true>
				multiple
				freeSolo
				size="small"
				options={allTags}
				value={values.tags ?? []}
				onChange={(_, newValue) => onChange("tags", newValue)}
				renderInput={(params) => (
					<TextField
						{...params}
						label="标签"
						placeholder="输入回车添加标签"
					/>
				)}
			/>

			<Autocomplete<string, false, false, true>
				freeSolo
				size="small"
				options={allCategories}
				value={values.category ?? ""}
				onChange={(_, newValue) =>
					onChange(
						"category",
						newValue && newValue.trim().length > 0 ? newValue.trim() : undefined,
					)
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="分类"
						placeholder="如：工作 / 个人"
					/>
				)}
			/>

			<Box>
				<FormControlLabel
					control={
						<Switch
							checked={values.completed}
							onChange={(_, checked) => onChange("completed", checked)}
						/>
					}
					label="标记为已完成"
				/>
			</Box>
		</Stack>
	);
};

export default TaskQuickForm;
