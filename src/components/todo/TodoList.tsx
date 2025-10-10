import AccessTimeIcon from "@mui/icons-material/AccessTime";
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
import type { TodoTask } from "../../stores/todoStore";

interface TodoListProps {
	tasks: TodoTask[];
	onToggleComplete: (task: TodoTask) => void;
	onEdit: (task: TodoTask) => void;
	onDelete: (task: TodoTask) => void;
	selectedId?: string | null;
	onSelect?: (task: TodoTask) => void;
	onLogTime: (task: TodoTask) => void;
}

const priorityColorMap: Record<string, string> = {
	high: "error",
	medium: "warning",
	low: "info",
};

const formatDate = (date?: string) => {
	if (!date) return undefined;
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return undefined;
	return format(parsed, "MM-dd HH:mm");
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
		const dueLabel = formatDate(task.dueDate);
		const reminderLabel = formatDate(task.reminder);
		const isSelected = selectedId === task.id;
		const totalMinutes = (task.timeEntries ?? []).reduce(
			(sum, entry) => sum + entry.durationMinutes,
			0,
		);

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
					px: { xs: 1.8, sm: 2.4 },
					py: { xs: 1.4, sm: 1.6 },
					borderRadius: 2.5,
					border: "1px solid",
					borderColor: isSelected ? "primary.light" : "divider",
					backgroundColor: isSelected
						? "primary.main" + "12"
						: task.completed
							? "success.main" + "08"
							: "background.paper",
					transition: "all 0.2s ease",
					cursor: onSelect ? "pointer" : "default",
					boxShadow: isSelected
						? "0 12px 28px -20px rgba(56,99,206,0.6)"
						: "none",
					"&:hover": {
						borderColor: "primary.main",
						backgroundColor: isSelected
							? "primary.main" + "18"
							: task.completed
								? "success.main" + "12"
								: "action.hover",
					},
				}}
				onClick={() => onSelect?.(task)}
			>
				<Stack
					direction="row"
					spacing={2}
					alignItems="flex-start"
					sx={{ width: "100%" }}
				>
					<Checkbox
						checked={task.completed}
						onChange={handleToggle}
						onClick={(event) => event.stopPropagation()}
						size="small"
					/>

					<Stack spacing={0.75} flex={1} minWidth={0} sx={{ py: 0.25 }}>
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
									wordBreak: "break-word",
								}}
							>
								{task.title}
							</Typography>
							<Chip
								label={
									task.priority === "high"
										? "高"
										: task.priority === "medium"
											? "中"
											: "低"
								}
								color={priorityColorMap[task.priority] as any}
								size="small"
							/>
							{task.category && (
								<Chip label={task.category} size="small" variant="outlined" />
							)}
						</Stack>

			{task.description && (
				<Typography
					variant="body2"
					color="text.secondary"
					sx={{ wordBreak: "break-word" }}
				>
					{task.description}
				</Typography>
			)}

			<Stack
				direction="row"
				spacing={1}
				alignItems="center"
				flexWrap="wrap"
				useFlexGap
			>
				{dueLabel && (
					<Chip
						label={`截止 ${dueLabel}`}
						size="small"
						variant="outlined"
						color={task.completed ? "default" : "primary"}
					/>
				)}
				{reminderLabel && (
					<Chip
						label={`提醒 ${reminderLabel}`}
						size="small"
						variant="outlined"
					/>
				)}
				{totalMinutes > 0 && (
					<Chip
						label={`累计 ${Math.round((totalMinutes / 60) * 10) / 10} 小时`}
						size="small"
						color="secondary"
						variant="outlined"
					/>
				)}
				{task.tags.map((tag) => (
					<Chip key={tag} label={tag} size="small" variant="outlined" />
				))}
			</Stack>

			{task.notes && (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ opacity: 0.8, wordBreak: "break-word" }}
				>
					{task.notes}
				</Typography>
			)}
		</Stack>

		<Stack direction="row" spacing={1} alignItems="center">
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
