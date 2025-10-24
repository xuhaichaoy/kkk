import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import {
	Box,
	Button,
	ButtonGroup,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { format } from "date-fns";
import dayjs, { type Dayjs } from "dayjs";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { TodoTask, TodoTimeEntry } from "../../stores/todoStore";

interface TodoTimeLogDialogProps {
	open: boolean;
	task: TodoTask | null;
	onClose: () => void;
	onSubmit: (payload: {
		taskId: string;
		entryId?: string;
		date: string;
		durationMinutes: number;
		comment?: string;
	}) => void;
	onDeleteEntry: (taskId: string, entryId: string) => void;
	mode?: "full" | "simple";
}

interface FormState {
	entryId?: string;
	date: Dayjs;
	durationMinutes: number;
	comment: string;
}

const DEFAULT_DURATION = 60;
const QUICK_DURATION_OPTIONS = [15, 30, 45, 60];

const createInitialState = (): FormState => ({
	date: dayjs(),
	durationMinutes: DEFAULT_DURATION,
	comment: "",
});

const toDayjs = (value?: string): Dayjs => {
	if (!value) return dayjs();
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed : dayjs();
};

const TodoTimeLogDialog: React.FC<TodoTimeLogDialogProps> = ({
	open,
	task,
	onClose,
	onSubmit,
	onDeleteEntry,
	mode = "full",
}) => {
	const [formState, setFormState] = useState<FormState>(() => createInitialState());
	const isSimpleMode = mode === "simple";

	const resetForm = useCallback(() => {
		setFormState(createInitialState());
	}, []);

	useEffect(() => {
		if (!open) return;
		resetForm();
	}, [open, task?.id, resetForm]);

	const entries = useMemo<TodoTimeEntry[]>(() => {
		if (!task?.timeEntries) return [];
		return [...task.timeEntries].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);
	}, [task]);

	const totalMinutes = useMemo(
		() => entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
		[entries],
	);

	const handleSubmit = () => {
		if (!task) return;
		if (!formState.date || !formState.date.isValid()) return;
		if (!Number.isFinite(formState.durationMinutes) || formState.durationMinutes <= 0) {
			return;
		}

		onSubmit({
			taskId: task.id,
			entryId: formState.entryId,
			date: formState.date.toISOString(),
			durationMinutes: Math.round(formState.durationMinutes),
			comment: formState.comment.trim() ? formState.comment.trim() : undefined,
		});

		resetForm();
		if (isSimpleMode) {
			onClose();
		}
	};

	const handleQuickSelect = (minutes: number) => {
		setFormState((prev) => ({
			...prev,
			entryId: undefined,
			durationMinutes: minutes,
		}));
	};


	const handleEdit = (entry: TodoTimeEntry) => {
		setFormState({
			entryId: entry.id,
			date: toDayjs(entry.date),
			durationMinutes: entry.durationMinutes,
			comment: entry.comment ?? "",
		});
	};

	const handleDelete = (entry: TodoTimeEntry) => {
		if (!task) return;
		onDeleteEntry(task.id, entry.id);
		setFormState((prev) => (prev.entryId === entry.id ? createInitialState() : prev));
	};

	const handleCancelEdit = () => {
		resetForm();
	};

	const isEditing = Boolean(formState.entryId);

	if (isSimpleMode) {
		return (
			<LocalizationProvider dateAdapter={AdapterDayjs}>
				<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
					<DialogTitle sx={{ fontWeight: 700 }}>
						快速登记用时 · {task?.title ?? "未选择任务"}
					</DialogTitle>
					<DialogContent dividers>
						<Stack spacing={2} sx={{ mt: 0.5 }}>
							<Typography variant="body2" color="text.secondary">
								输入分钟数即可保存，用时详情可在主应用中继续完善。
							</Typography>
							<ButtonGroup variant="outlined" size="small" disabled={!task}>
								{QUICK_DURATION_OPTIONS.map((option) => (
									<Button key={option} onClick={() => handleQuickSelect(option)}>
										{option} 分钟
									</Button>
								))}
							</ButtonGroup>
							<TextField
								label="耗时（分钟）"
								type="number"
								value={formState.durationMinutes}
								onChange={(event) =>
									setFormState((prev) => ({
										...prev,
										durationMinutes: Number(event.target.value ?? 0),
									}))
								}
								fullWidth
								inputProps={{ min: 1 }}
								disabled={!task}
							/>
							<Typography variant="caption" color="text.secondary">
								已登记 {entries.length} 条 · 小计 {Math.round((totalMinutes / 60) * 10) / 10} 小时
							</Typography>
						</Stack>
					</DialogContent>
					<DialogActions sx={{ px: 3, pb: 2 }}>
						<Button
							variant="contained"
							onClick={handleSubmit}
							disabled={!task || formState.durationMinutes <= 0}
							sx={{ px: 3, fontWeight: 600 }}
						>
							保存记录
						</Button>
					</DialogActions>
				</Dialog>
			</LocalizationProvider>
		);
	}

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs}>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
				<DialogTitle sx={{ fontWeight: 700 }}>
					用时登记 · {task?.title ?? ""}
				</DialogTitle>
				<DialogContent dividers>
					<Stack spacing={3} sx={{ mt: 0.5 }}>
						<Stack spacing={2.5}>
							<DateTimePicker
								label="日期"
								value={formState.date}
								onChange={(value) =>
									setFormState((prev) => ({
										...prev,
										date: value && value.isValid() ? value : prev.date,
									}))
								}
								disabled={!task}
								ampm={false}
								views={["year", "month", "day", "hours", "minutes"]}
								format="YYYY-MM-DD HH:mm"
								timeSteps={{ minutes: 1 }}
								slotProps={{
									textField: {
										fullWidth: true,
										disabled: !task,
									},
								}}
							/>
							<TextField
								label="耗时（分钟）"
								type="number"
								value={formState.durationMinutes}
								onChange={(event) =>
									setFormState((prev) => ({
										...prev,
										durationMinutes: Number(event.target.value ?? 0),
									}))
								}
								fullWidth
								inputProps={{ min: 1 }}
								disabled={!task}
							/>
							<TextField
								label="备注"
								value={formState.comment}
								onChange={(event) =>
									setFormState((prev) => ({
										...prev,
										comment: event.target.value,
									}))
								}
								fullWidth
								multiline
								minRows={2}
								disabled={!task}
							/>
							{isEditing && (
								<Typography variant="caption" color="text.secondary">
									正在编辑历史记录，提交后将覆盖原数据。
								</Typography>
							)}
							<Stack direction="row" spacing={1} justifyContent="flex-end">
								{isEditing && (
									<Button
										variant="outlined"
										color="inherit"
										onClick={handleCancelEdit}
										sx={{ borderRadius: 2, px: 2.5, fontWeight: 600 }}
									>
										取消编辑
									</Button>
								)}
								<Button
									variant="contained"
									onClick={handleSubmit}
									disabled={!task || formState.durationMinutes <= 0}
									sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
								>
									{formState.entryId ? "更新记录" : "添加记录"}
								</Button>
							</Stack>
						</Stack>

						<Divider sx={{ my: 1 }} />

						<Stack spacing={1.5}>
							<Stack direction="row" alignItems="center" spacing={1}>
								<AccessTimeIcon fontSize="small" color="primary" />
								<Typography variant="subtitle2" fontWeight={700}>
									历史记录（共 {entries.length} 条 / {Math.round((totalMinutes / 60) * 10) / 10} 小时）
								</Typography>
							</Stack>
							{entries.length === 0 ? (
								<Box
									sx={{
									py: 6,
									textAlign: "center",
									color: "text.secondary",
									borderRadius: 2,
									backgroundColor: "action.hover",
								}}
								>
									<Typography variant="body2">暂未登记用时</Typography>
								</Box>
							) : (
								<List
									sx={{
										display: "flex",
										flexDirection: "column",
										gap: 1,
										maxHeight: 240,
										overflowY: "auto",
										pr: 0.5,
									}}
									disablePadding
								>
									{entries.map((entry) => {
										const formattedDate = format(new Date(entry.date), "MM-dd HH:mm");
										const hours = Math.floor(entry.durationMinutes / 60);
										const minutes = entry.durationMinutes % 60;
										const durationLabel = hours > 0 ? `${hours} 小时 ${minutes} 分` : `${minutes} 分`;

										return (
											<ListItem
												key={entry.id}
												alignItems="flex-start"
												sx={{
													px: 1.2,
													py: 1,
													borderRadius: 2,
													border: "2px solid",
													borderColor:
														formState.entryId === entry.id ? "primary.main" : "divider",
													backgroundColor:
														formState.entryId === entry.id
															? (theme) => theme.palette.primary.main + "14"
															: "transparent",
												}}
											>
												<ListItemAvatar sx={{ minWidth: 40 }}>
													<Box
														sx={{
														width: 32,
														height: 32,
														borderRadius: 1,
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														backgroundColor: "primary.main",
														color: "primary.contrastText",
														fontSize: "0.75rem",
													}}
													>
														{Math.round(entry.durationMinutes)}
													</Box>
												</ListItemAvatar>
												<ListItemText
													primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
													secondaryTypographyProps={{ variant: "caption" }}
													primary={`${formattedDate} · ${durationLabel}`}
													secondary={entry.comment}
												/>
												<Stack direction="row" spacing={0.5} alignItems="center">
													{formState.entryId === entry.id && (
														<Box
															sx={{
															px: 1,
															py: 0.25,
															borderRadius: 1,
															backgroundColor: "primary.main",
															color: "primary.contrastText",
															fontSize: "0.65rem",
															fontWeight: 600,
															textTransform: "uppercase",
														}}
														>
															编辑中
														</Box>
													)}
													<IconButton size="small" onClick={() => handleEdit(entry)}>
														<EditIcon fontSize="small" />
													</IconButton>
													<IconButton size="small" onClick={() => handleDelete(entry)}>
														<DeleteOutlineIcon fontSize="small" />
													</IconButton>
												</Stack>
											</ListItem>
										);
									})}
								</List>
							)}
						</Stack>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose}>关闭</Button>
				</DialogActions>
			</Dialog>
		</LocalizationProvider>
	);
};

export default TodoTimeLogDialog;
