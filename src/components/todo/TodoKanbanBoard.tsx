import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
	Chip,
	IconButton,
	Paper,
	Stack,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import { differenceInHours, format, isBefore, startOfDay } from "date-fns";
import type { FC } from "react";
import React, { useMemo, useState } from "react";
import type { TodoStatus, TodoTask } from "../../stores/todoStore";
import { resolveTaskStatus } from "../../utils/todoUtils";

interface TodoKanbanBoardProps {
	tasks: TodoTask[];
	onStatusChange: (id: string, status: TodoStatus) => void;
	onEditTask: (task: TodoTask) => void;
}

const columns: Array<{
	key: TodoStatus;
	title: string;
	description: string;
}> = [
	{ key: "notStarted", title: "待处理", description: "" },
	{ key: "inProgress", title: "进行中", description: "" },
	{ key: "submitted", title: "待确认", description: "" },
	{ key: "completed", title: "已完成", description: "" },
];

const priorityColorMap: Record<
	string,
	"default" | "info" | "warning" | "error" | "success"
> = {
	high: "error",
	medium: "warning",
	low: "info",
};

const TodoKanbanBoard: FC<TodoKanbanBoardProps> = ({
	tasks,
	onStatusChange,
	onEditTask,
}) => {
	const theme = useTheme();
	const [collapsedColumns, setCollapsedColumns] = useState<Set<TodoStatus>>(
		() => new Set(),
	);

	const grouped = useMemo(() => {
		const map = new Map<TodoStatus, TodoTask[]>();
		columns.forEach((column) => {
			map.set(column.key, []);
		});
		tasks.forEach((task) => {
			const status = resolveTaskStatus(task);
			if (!map.has(status)) {
				map.set(status, []);
			}
			map.get(status)!.push(task);
		});

		columns.forEach((column) => {
			const list = map.get(column.key);
			if (!list) return;

			if (column.key === "completed") {
				list.sort((a, b) => {
					const aTime = a.completedAt
						? new Date(a.completedAt).getTime()
						: new Date(a.updatedAt ?? a.createdAt).getTime();
					const bTime = b.completedAt
						? new Date(b.completedAt).getTime()
						: new Date(b.updatedAt ?? b.createdAt).getTime();
					return bTime - aTime;
				});
				return;
			}

			list.sort((a, b) => {
				const aDate = a.dueDate
					? new Date(a.dueDate).getTime()
					: Number.POSITIVE_INFINITY;
				const bDate = b.dueDate
					? new Date(b.dueDate).getTime()
					: Number.POSITIVE_INFINITY;
				if (aDate !== bDate) return aDate - bDate;
				return (
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
			});
		});

		return map;
	}, [tasks]);

	const handleToggleColumn = (status: TodoStatus) => {
		setCollapsedColumns((prev) => {
			const next = new Set(prev);
			if (next.has(status)) {
				next.delete(status);
			} else {
				next.add(status);
			}
			return next;
		});
	};

	const handleDragEnd = (result: DropResult) => {
		const { destination, source, draggableId } = result;
		if (!destination) return;
		if (destination.droppableId === source.droppableId) return;

		const nextStatus = destination.droppableId as TodoStatus;
		onStatusChange(draggableId, nextStatus);
	};

	const renderTaskCard = (task: TodoTask, index: number) => {
		const dueDate = task.dueDate ? new Date(task.dueDate) : null;
		const isDueValid =
			dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
		const now = new Date();
		const isOverdue = Boolean(
			isDueValid && !task.completed && isBefore(isDueValid, now),
		);
		const hoursUntilDue = isDueValid
			? differenceInHours(isDueValid, now)
			: null;
		const isDueSoon = Boolean(
			isDueValid &&
				!task.completed &&
				!isOverdue &&
				hoursUntilDue !== null &&
				hoursUntilDue <= 24,
		);

		return (
			<Draggable key={task.id} draggableId={task.id} index={index}>
				{(provided, snapshot) => (
					<Paper
						ref={provided.innerRef}
						{...provided.draggableProps}
						{...provided.dragHandleProps}
						elevation={snapshot.isDragging ? 8 : 1}
						onClick={() => onEditTask(task)}
						sx={{
							p: 1.2,
							borderRadius: 2,
							cursor: "grab",
							boxShadow: snapshot.isDragging
								? theme.shadows[8]
								: theme.shadows[1],
							border: "1px solid",
							borderColor: snapshot.isDragging ? "primary.main" : "divider",
							backgroundColor: snapshot.isDragging
								? theme.palette.background.paper
								: theme.palette.mode === "light"
									? "#fff"
									: theme.palette.background.default,
							transition: "box-shadow 0.2s ease, transform 0.2s ease",
						}}
					>
						<Stack spacing={1}>
							<Stack spacing={0.3}>
								<Typography
									variant="body2"
									fontWeight={600}
									sx={{ wordBreak: "break-word", fontSize: "0.875rem" }}
								>
									{task.title}
								</Typography>
								{/* {task.description && (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ wordBreak: "break-word" }}
									>
										{task.description}
									</Typography>
								)} */}
							</Stack>

							<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
								<Chip
									label={
										task.priority === "high"
											? "高"
											: task.priority === "medium"
												? "中"
												: "低"
									}
									size="small"
									color={priorityColorMap[task.priority]}
									sx={{ fontSize: "0.75rem", height: "20px" }}
								/>
								{task.category && (
									<Chip 
										label={task.category} 
										size="small" 
										variant="outlined" 
										sx={{ fontSize: "0.75rem", height: "20px" }}
									/>
								)}
								{isOverdue && <Chip label="逾期" size="small" color="error" sx={{ fontSize: "0.75rem", height: "20px" }} />}
								{isDueSoon && (
									<Chip label="即将到期" size="small" color="warning" sx={{ fontSize: "0.75rem", height: "20px" }} />
								)}
								{isDueValid && (
									<Chip
										label={`截止 ${format(isDueValid, "MM-dd HH:mm")}`}
										size="small"
										variant="outlined"
										color={isOverdue ? "error" : "primary"}
										sx={{ fontSize: "0.75rem", height: "20px" }}
									/>
								)}
							</Stack>

							{task.tags.length > 0 && (
								<Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
									{task.tags.slice(0, 3).map((tag) => (
										<Chip
											key={tag}
											label={tag}
											size="small"
											variant="outlined"
											sx={{ fontSize: "0.75rem", height: "20px" }}
										/>
									))}
									{task.tags.length > 3 && (
										<Chip
											label={`+${task.tags.length - 3}`}
											size="small"
											variant="outlined"
											sx={{ fontSize: "0.75rem", height: "20px" }}
										/>
									)}
								</Stack>
							)}

							<Stack
								direction="row"
								justifyContent="space-between"
								alignItems="center"
							>
								<Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
									创建 {format(startOfDay(new Date(task.createdAt)), "MM-dd")}
								</Typography>
								<Tooltip
									title={task.notes ? task.notes : "点击查看详情"}
									placement="top"
									arrow
									disableInteractive
								>
									<Typography
										variant="caption"
										color="primary.main"
										sx={{ cursor: "pointer", fontSize: "0.7rem" }}
										onClick={(e) => {
											e.stopPropagation();
											onEditTask(task);
										}}
									>
										查看详情
									</Typography>
								</Tooltip>
							</Stack>
						</Stack>
					</Paper>
				)}
			</Draggable>
		);
	};

	return (
		<DragDropContext onDragEnd={handleDragEnd}>
			<Stack
				direction="row"
				spacing={1}
				alignItems="flex-start"
				sx={{ overflowX: "auto", pb: 1 }}
			>
				{columns.map((column) => {
					const columnTasks = grouped.get(column.key) ?? [];
					const isCollapsed = collapsedColumns.has(column.key);
					if (isCollapsed) {
						return (
							<Stack
								key={column.key}
								spacing={1.2}
								sx={{
									minWidth: 60,
									maxWidth: 72,
									flex: "0 0 auto",
								}}
							>
								<Paper
									sx={{
										height: "100%",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										px: 1,
										py: 2,
										borderRadius: 2,
										backgroundColor:
											theme.palette.mode === "light"
												? "rgba(255,255,255,0.92)"
												: theme.palette.background.paper,
										boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
										border: "1px solid",
										borderColor: "divider",
									}}
								>
									<Stack spacing={1} alignItems="center">
										<IconButton
											size="small"
											onClick={() => handleToggleColumn(column.key)}
										>
											<ChevronRightIcon fontSize="small" />
										</IconButton>
										<Typography
											variant="subtitle2"
											fontWeight={700}
											sx={{
												writingMode: "vertical-rl",
												textOrientation: "mixed",
												letterSpacing: "0.12em",
											}}
										>
											{column.title}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{columnTasks.length}
										</Typography>
									</Stack>
								</Paper>
							</Stack>
						);
					}

					return (
						<Stack
							key={column.key}
							spacing={1}
							sx={{
							  width: 300,
								flex: "0 0 auto",
							}}
						>
							<Paper
								sx={{
									p: 1,
									borderRadius: 2,
									backgroundColor:
										theme.palette.mode === "light"
											? "rgba(255,255,255,0.92)"
											: theme.palette.background.paper,
									boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
									border: "1px solid",
									borderColor: "divider",
								}}
							>
								<Stack spacing={1}>
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="center"
									>
										<Stack spacing={0.3}>
											<Typography variant="subtitle1" fontWeight={700}>
												{column.title}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												{column.description}
											</Typography>
										</Stack>
										<Stack direction="row" spacing={0.5} alignItems="center">
											<Chip
												label={`${columnTasks.length}`}
												size="small"
												color="primary"
												variant="outlined"
											/>
											<IconButton
												size="small"
												onClick={() => handleToggleColumn(column.key)}
											>
												<ChevronLeftIcon fontSize="small" />
											</IconButton>
										</Stack>
									</Stack>

									<Droppable droppableId={column.key}>
										{(provided, snapshot) => (
											<Stack
												ref={provided.innerRef}
												spacing={0.8}
												{...provided.droppableProps}
												sx={{
													minHeight: 100,
													maxHeight: "62vh",
													overflowY: "auto",
													px: 0.3,
													py: 0.3,
													borderRadius: 1.5,
													backgroundColor: snapshot.isDraggingOver
														? theme.palette.mode === "light"
															? "rgba(59, 130, 246, 0.08)"
															: "rgba(59, 130, 246, 0.14)"
														: "transparent",
												}}
											>
												{columnTasks.map(renderTaskCard)}
												{provided.placeholder}
												{columnTasks.length === 0 &&
													!snapshot.isDraggingOver && (
														<Typography
															variant="caption"
															color="text.disabled"
															sx={{ textAlign: "center", py: 4 }}
														>
															暂无任务，拖拽任务到此列
														</Typography>
													)}
											</Stack>
										)}
									</Droppable>
								</Stack>
							</Paper>
						</Stack>
					);
				})}
			</Stack>
		</DragDropContext>
	);
};

export default TodoKanbanBoard;
