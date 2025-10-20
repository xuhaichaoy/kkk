import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import {
	Box,
	Checkbox,
	Chip,
	IconButton,
	Stack,
	Tooltip,
	Typography,
} from "@mui/material";
import { format } from "date-fns";
import React, { type ChangeEvent, type MouseEvent } from "react";
import type { TodoPriority, TodoTask } from "../../stores/todoStore";
import { getTaskDateRange } from "../../utils/todoUtils";

interface TodoListProps {
	tasks: TodoTask[];
	onToggleComplete: (task: TodoTask) => void;
	onEdit: (task: TodoTask) => void;
	onDelete: (task: TodoTask) => void;
	selectedId?: string | null;
	onSelect?: (task: TodoTask) => void;
	onLogTime: (task: TodoTask) => void;
}

const priorityColorMap: Record<TodoPriority, string> = {
	high: "error",
	medium: "warning",
	low: "info",
	none: "default",
};

const priorityLabelMap: Record<TodoPriority, string> = {
	high: "高",
	medium: "中",
	low: "低",
	none: "未设置",
};

const formatDate = (date?: string | Date | null) => {
	if (!date) return undefined;
	const parsed = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(parsed.getTime())) return undefined;
	return format(parsed, "MM-dd HH:mm");
};

const formatTaskSchedule = (task: TodoTask) => {
	const range = getTaskDateRange(task);
	if (!range) return undefined;
	const sameDay = format(range.start, "yyyy-MM-dd") === format(range.end, "yyyy-MM-dd");
	if (sameDay) {
		const startTime = format(range.start, "HH:mm");
		const endTime = format(range.end, "HH:mm");
		const dayLabel = format(range.start, "MM-dd");
		if (startTime === endTime) {
			return startTime === "00:00" ? dayLabel : `${dayLabel} ${startTime}`;
		}
		return `${dayLabel} ${startTime} ~ ${endTime}`;
	}
	return `${format(range.start, "MM-dd")} ~ ${format(range.end, "MM-dd")}`;
};

const TodoList = ({
	tasks,
	onToggleComplete,
	onEdit,
	onDelete,
	selectedId,
	onSelect,
	onLogTime,
}: TodoListProps) => {
	const renderTask = (task: TodoTask) => {
		const priority = task.priority ?? "none";
		const scheduleLabel = formatTaskSchedule(task);
		const reminderLabel = formatDate(task.reminder);
		const isSelected = selectedId === task.id;
		const totalMinutes = (task.timeEntries ?? []).reduce(
			(sum, entry) => sum + entry.durationMinutes,
			0,
		);

		const tags = task.tags ?? [];
		const visibleTags = tags.slice(0, 3);
		const extraTagCount = Math.max(tags.length - 3, 0);

		const handleEditClick = (event: MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onEdit(task);
		};

		const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onDelete(task);
		};

		const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
			event.stopPropagation();
			onToggleComplete(task);
		};

		return (
			<Box
				key={task.id}
				sx={{
					// px: { xs: 1.8, sm: 2.4 },
					py: { xs: 0.8, sm: 0.9 },
					borderRadius: 1,
					border: "1px solid",
					borderColor: isSelected ? "primary.light" : "divider",
					backgroundColor: isSelected
						? "primary.main" + "12"
						: task.completed
							? "action.disabledBackground"
							: "background.paper",
					transition: "all 0.18s ease",
					cursor: onSelect ? "pointer" : "default",
					boxShadow: isSelected ? "0 6px 20px -18px rgba(56,99,206,0.65)" : "none",
					position: "relative",
					"&:hover": {
						borderColor: "primary.main",
						backgroundColor: isSelected
							? "primary.main" + "18"
							: task.completed
								? "action.disabledBackground"
								: "action.hover",
					},
				}}
				onClick={() => onSelect?.(task)}
			>
				{/* 左侧优先级色条 */}
				<Box
					sx={{
						position: "absolute",
						left: 0,
						top: 0,
						bottom: 0,
						width: 3,
						borderTopLeftRadius: 4,
						borderBottomLeftRadius: 4,
						bgcolor:
							priority === "none"
								? "divider"
								: (priorityColorMap[priority] as any) + ".main",
					}}
				/>
				<Stack
					direction="row"
					spacing={1.25}
					alignItems="flex-start"
					sx={{ width: "100%" }}
				>
						<Checkbox
							checked={task.completed}
							onChange={handleToggle}
							onClick={(event) => event.stopPropagation()}
							size="small"
							color={task.completed ? "default" : "primary"}
						/>

						<Stack spacing={0.5} flex={1} minWidth={0} sx={{ py: 0.1 }}>
						<Stack
							direction={{ xs: "column", sm: "row" }}
							spacing={1}
							alignItems={{ xs: "flex-start", sm: "center" }}
							flexWrap="wrap"
							useFlexGap
						>
						<Typography
								variant="subtitle1"
								sx={{
									fontWeight: 600,
								textDecoration: task.completed ? "line-through" : "none",
								color: task.completed ? "text.disabled" : "text.primary",
								wordBreak: "break-word",
								fontSize: { xs: "0.9rem", sm: "0.95rem" },
								}}
							>
								{task.title}
							</Typography>
						{task.category && (
							<Chip
								label={task.category}
								size="small"
								sx={{
									borderColor: "divider",
									backgroundColor: "transparent",
								}}
							/>
						)}
						</Stack>

						<Stack
							direction="row"
							spacing={0.75}
							alignItems="center"
							flexWrap="wrap"
							useFlexGap
						>
							{scheduleLabel && (
								<Chip
									icon={<CalendarMonthIcon sx={{ fontSize: 16 }} />}
									label={scheduleLabel}
									size="small"
									variant="outlined"
									color={task.completed ? "default" : "default"}
									sx={{ px: 0.25, "& .MuiChip-icon": { mr: 0.2, fontSize: 16 } }}
								/>
							)}
							{reminderLabel && (
								<Chip
									icon={<NotificationsNoneIcon sx={{ fontSize: 14 }} />}
									label={`提醒 ${reminderLabel}`}
									size="small"
									variant="outlined"
								/>
							)}
							{totalMinutes > 0 && (
								<Chip
									icon={<HourglassBottomIcon sx={{ fontSize: 14 }} />}
									label={`累计 ${Math.round((totalMinutes / 60) * 10) / 10} 小时`}
									size="small"
									color={task.completed ? "default" : "secondary"}
								/>
							)}
							{visibleTags.map((tag) => (
								<Chip
									key={tag}
									label={tag}
									size="small"
									variant="outlined"
									color="default"
								/>
							))}
							{extraTagCount > 0 && (
								<Chip label={`+${extraTagCount}`} size="small" variant="outlined" color="default" />
							)}
						</Stack>

						{false && task.notes && (
							<Box
								sx={{
									mt: 0.25,
									px: 0.75,
									py: 0.5,
									borderRadius: 1,
									backgroundColor: task.completed ? "primary.main" + "06" : "primary.main" + "0A",
									border: "1px solid",
									borderColor: "primary.main" + "24",
								}}
							>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{
										opacity: 0.9,
										wordBreak: "break-word",
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
									}}
								>
									{task.notes}
								</Typography>
							</Box>
						)}
						{false && task.reflection && (
							<Box
								sx={{
									mt: 0.25,
									px: 0.75,
									py: 0.5,
									borderRadius: 1,
									backgroundColor: task.completed ? "primary.main" + "06" : "primary.main" + "0A",
									border: "1px solid",
									borderColor: "primary.main" + "24",
								}}
							>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{
										opacity: 0.9,
										wordBreak: "break-word",
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
									}}
								>
									{task.reflection}
								</Typography>
							</Box>
						)}
					</Stack>

					<Stack direction="row" spacing={1} alignItems="center" sx={{ opacity: 0.75, transition: "opacity .15s", "&:hover": { opacity: 1 } }}>
						<Tooltip title="登记用时" arrow>
							<IconButton
								onClick={(event) => {
									event.stopPropagation();
									onLogTime(task);
								}}
								size="small"
							>
								<AccessTimeIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="编辑" arrow>
							<IconButton onClick={handleEditClick} size="small">
								<EditIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title="删除" arrow>
							<IconButton
								onClick={handleDeleteClick}
								size="small"
								color="error"
							>
								<DeleteOutlineIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Stack>
				</Stack>
			</Box>
		);
	};

	return (
		<Box
			sx={{
				maxHeight: { xs: 520, md: 640 },
				minHeight: tasks.length > 0 ? 220 : 180,
				overflowY: "auto",
				pr: 0.5,
			}}
		>
			{tasks.length === 0 ? (
				<Stack
					height="100%"
					alignItems="center"
					justifyContent="center"
					spacing={1}
				>
					<Typography variant="subtitle1" color="text.secondary">
						暂无任务
					</Typography>
					<Typography variant="body2" color="text.disabled">
						点击“新建任务”快速创建第一条任务。
					</Typography>
				</Stack>
			) : (
				<Stack spacing={1.5} pb={1}>
					{tasks.map(renderTask)}
				</Stack>
			)}
		</Box>
	);
};

export default TodoList;
