import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
	Box,
	IconButton,
	Stack,
	Typography,
	useTheme,
} from "@mui/material";
import { format } from "date-fns";
import type { FC } from "react";
import React, { useMemo, useState } from "react";
import type { TodoStatus, TodoTask } from "../../stores/todoStore";
import { getTaskDueDate, resolveTaskStatus } from "../../utils/todoUtils";

interface TodoKanbanBoardProps {
	tasks: TodoTask[];
	onStatusChange: (id: string, status: TodoStatus) => void;
	onEditTask: (task: TodoTask) => void;
	onLogTime?: (task: TodoTask) => void;
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
				const aDate = getTaskDueDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
				const bDate = getTaskDueDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
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

	const getPriorityIcon = (priority: string) => {
		const colors = {
			high: "#ef4444",
			medium: "#f97316",
			low: "#3b82f6",
		};
		const labels = {
			high: "高",
			medium: "中",
			low: "低",
		};
		return (
			<Box
				sx={{
					width: 28,
					height: 28,
					borderRadius: "50%",
					backgroundColor: colors[priority as keyof typeof colors],
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "white",
					fontSize: "0.75rem",
					fontWeight: 600,
				}}
			>
				{labels[priority as keyof typeof labels]}
			</Box>
		);
	};

	const renderTaskCard = (task: TodoTask, index: number) => {
		const dueDate = getTaskDueDate(task);
		const isDueValid = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;

		return (
			<Draggable key={task.id} draggableId={task.id} index={index}>
				{(provided, snapshot) => (
					<Box
						ref={provided.innerRef}
						{...provided.draggableProps}
						{...provided.dragHandleProps}
						onClick={() => onEditTask(task)}
						sx={{
							p: 1.5,
							borderRadius: 2,
							cursor: "grab",
							border: "1px solid",
							borderColor: snapshot.isDragging
								? "primary.main"
								: theme.palette.mode === "light"
									? "rgba(229, 231, 235, 1)"
									: "divider",
							backgroundColor:
								theme.palette.mode === "light" ? "#ffffff" : "background.paper",
							transition: "all 0.2s ease",
							"&:hover": {
								boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
							},
						}}
					>
						<Stack spacing={1.5}>
							<Typography
								variant="body2"
								sx={{
									wordBreak: "break-word",
									fontSize: "0.875rem",
									lineHeight: 1.5,
								}}
							>
								{task.title}
							</Typography>

							<Stack
								direction="row"
								justifyContent="space-between"
								alignItems="center"
							>
								<Stack direction="row" spacing={1} alignItems="center">
									{getPriorityIcon(task.priority)}
									{isDueValid && (
										<Typography
											variant="caption"
											sx={{
												color: "text.secondary",
												fontSize: "0.75rem",
											}}
										>
											截止 {format(isDueValid, "MM-dd HH:mm")}
										</Typography>
									)}
								</Stack>
								<AccessTimeIcon
									sx={{
										fontSize: 16,
										color: "text.disabled",
									}}
								/>
							</Stack>
						</Stack>
					</Box>
				)}
			</Draggable>
		);
	};

	return (
		<DragDropContext onDragEnd={handleDragEnd}>
			<Box
				sx={{
					width: "100%",
					height: "100%",
					overflowX: "auto",
					overflowY: "hidden",
					"&::-webkit-scrollbar": {
						height: 8,
					},
					"&::-webkit-scrollbar-track": {
						backgroundColor: "transparent",
					},
					"&::-webkit-scrollbar-thumb": {
						backgroundColor: theme.palette.mode === "light" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)",
						borderRadius: 4,
						"&:hover": {
							backgroundColor: theme.palette.mode === "light" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)",
						},
					},
				}}
			>
				<Stack
					direction="row"
					spacing={2}
					alignItems="stretch"
					sx={{ 
						minWidth: "max-content",
						height: "100%",
					}}
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
									minWidth: 48,
									maxWidth: 60,
									flex: "0 0 auto",
								}}
							>
								<Box
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
												? "rgba(249, 250, 251, 1)"
												: theme.palette.background.paper,
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
											variant="caption"
											fontWeight={600}
											sx={{
												writingMode: "vertical-rl",
												textOrientation: "mixed",
												letterSpacing: "0.05em",
											}}
										>
											{column.title}
										</Typography>
										<Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
											{columnTasks.length}
										</Typography>
									</Stack>
								</Box>
							</Stack>
						);
					}

					return (
						<Box
							key={column.key}
							sx={{
								flex: "0 0 auto",
								width: 280,
								height: "100%",
								display: "flex",
								flexDirection: "column",
							}}
						>
							<Stack
								direction="row"
								alignItems="center"
								justifyContent="space-between"
								sx={{ px: 1, pb: 2 }}
							>
								<Stack direction="row" spacing={1} alignItems="center">
									<Typography
										variant="body2"
										fontWeight={600}
										sx={{ fontSize: "0.875rem" }}
									>
										{column.title}
									</Typography>
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ fontSize: "0.875rem" }}
									>
										{columnTasks.length}
									</Typography>
								</Stack>
								<IconButton
									size="small"
									onClick={() => handleToggleColumn(column.key)}
									sx={{
										width: 24,
										height: 24,
										"&:hover": {
											backgroundColor: "action.hover",
										},
									}}
								>
									<ChevronLeftIcon sx={{ fontSize: 18 }} />
								</IconButton>
							</Stack>

							<Droppable droppableId={column.key}>
								{(provided, snapshot) => (
									<Stack
										ref={provided.innerRef}
										spacing={1.5}
										{...provided.droppableProps}
										sx={{
											flex: 1,
											overflowY: "auto",
											px: 1,
											py: 1,
											borderRadius: 2,
											backgroundColor: snapshot.isDraggingOver
												? theme.palette.mode === "light"
													? "rgba(219, 234, 254, 0.5)"
													: "rgba(59, 130, 246, 0.1)"
												: "transparent",
											transition: "background-color 0.2s ease",
										}}
									>
											{columnTasks.map(renderTaskCard)}
											{provided.placeholder}
											{columnTasks.length === 0 && !snapshot.isDraggingOver && (
												<Typography
													variant="caption"
													color="text.disabled"
													sx={{
														textAlign: "center",
														py: 6,
														fontSize: "0.75rem",
													}}
												>
													暂无任务，拖拽任务到此列
												</Typography>
											)}
										</Stack>
									)}
								</Droppable>
						</Box>
					);
				})}
			</Stack>
		</Box>
		</DragDropContext>
	);
};

export default TodoKanbanBoard;
