import {
	DragDropContext,
	Draggable,
	Droppable,
	type DropResult,
} from "@hello-pangea/dnd";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
	Box,
	Checkbox,
	Stack,
	Typography,
	useTheme,
	Collapse,
} from "@mui/material";
import type { FC } from "react";
import React, { useCallback, useMemo, useState } from "react";
import type { TodoQuadrant, TodoTask, TodoPriority } from "../../stores/todoStore";

interface TodoEisenhowerMatrixProps {
	tasks: TodoTask[];
	onPriorityChange: (taskId: string, priority?: TodoPriority) => void;
	onToggleComplete: (task: TodoTask) => void;
	onEditTask: (task: TodoTask) => void;
}

interface QuadrantConfig {
	id: TodoQuadrant;
	title: string;
	accent: string;
	priority?: TodoPriority; // undefined means no priority set
}

const QUADRANTS: QuadrantConfig[] = [
	{
		id: "urgentImportant",
		title: "Urgent & Important",
		accent: "#ef4444",
		priority: "high",
	},
	{
		id: "notUrgentImportant",
		title: "Not Urgent & Important",
		accent: "#f59e0b",
		priority: "medium",
	},
	{
		id: "urgentNotImportant",
		title: "Urgent & Unimportant",
		accent: "#3b82f6",
		priority: "low",
	},
	{
		id: "notUrgentNotImportant",
		title: "Not Urgent & Unimportant",
		accent: "#10b981",
		priority: undefined, // no priority
	},
];

const TodoEisenhowerMatrix: FC<TodoEisenhowerMatrixProps> = ({
	tasks,
	onPriorityChange,
	onToggleComplete,
	onEditTask,
}) => {
	const theme = useTheme();

	// 折叠状态管理：key 格式为 "quadrantId-section" (section: "incomplete" | "completed")
	const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

	const toggleSection = (quadrantId: string, section: "incomplete" | "completed") => {
		const key = `${quadrantId}-${section}`;
		setCollapsedSections(prev => ({
			...prev,
			[key]: !prev[key]
		}));
	};

	const grouped = useMemo(() => {
		const map = new Map<TodoQuadrant, { incomplete: TodoTask[], completed: TodoTask[] }>();
		
		// 初始化每个象限
		QUADRANTS.forEach((quadrant) => {
			map.set(quadrant.id, { incomplete: [], completed: [] });
		});

		// 根据优先级分配任务到对应象限
		tasks.forEach((task) => {
			const quadrant = QUADRANTS.find(q => {
				if (q.priority === undefined) {
					// 第四象限：没有设置优先级的任务
					return !task.priority;
				}
				return q.priority === task.priority;
			});

			if (quadrant) {
				const group = map.get(quadrant.id)!;
				if (task.completed) {
					group.completed.push(task);
				} else {
					group.incomplete.push(task);
				}
			}
		});

		// 排序每个组
		QUADRANTS.forEach((quadrant) => {
			const group = map.get(quadrant.id)!;
			const sortFn = (a: TodoTask, b: TodoTask) => {
				const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
				const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
				return bTime - aTime; // 最新的在前
			};
			group.incomplete.sort(sortFn);
			group.completed.sort(sortFn);
		});

		return map;
	}, [tasks]);

	const handleDragEnd = useCallback(
		(result: DropResult) => {
			const { destination, source, draggableId } = result;
			if (!destination) return;
			if (destination.droppableId === source.droppableId) return;
			
			// 根据目标象限找到对应的优先级
			const targetQuadrant = QUADRANTS.find(q => q.id === destination.droppableId);
			if (!targetQuadrant) return;
			
			onPriorityChange(draggableId, targetQuadrant.priority);
		},
		[onPriorityChange],
	);

	const renderTask = (task: TodoTask, index: number) => (
		<Draggable key={task.id} draggableId={task.id} index={index}>
			{(provided) => (
				<Box
					ref={provided.innerRef}
					{...provided.draggableProps}
					{...provided.dragHandleProps}
					sx={{
						borderBottom: "1px solid",
						borderColor: theme.palette.divider,
						p: 0.5,

					}}
				>
					<Stack direction="row" spacing={1} alignItems="flex-start">
						<Checkbox
							size="small"
							checked={task.completed}
							onChange={(event) => {
								event.stopPropagation();
								onToggleComplete(task);
							}}
							sx={{ 
								mt: -0.5, 
								p: 0.5,
								color: task.completed ? theme.palette.text.disabled : theme.palette.primary.main,
								'&.Mui-checked': {
									color: theme.palette.text.disabled,
								},
							}}
						/>
						<Box
							sx={{ flex: 1, cursor: "pointer", minWidth: 0 }}
							onClick={() => onEditTask(task)}
						>
							<Typography
								variant="subtitle2"
								sx={{
									fontWeight: 500,
									textDecoration: task.completed ? "line-through" : "none",
									color: task.completed
										? theme.palette.text.disabled
										: theme.palette.text.primary,
									fontSize: "0.75rem",
									height: "26px",
									lineHeight: "26px",
								}}
							>
								{task.title}
							</Typography>
						</Box>
					</Stack>
				</Box>
			)}
		</Draggable>
	);

	// 渲染分组标题
	const renderSectionHeader = (
		quadrantId: string,
		section: "incomplete" | "completed",
		count: number,
		icon?: React.ReactNode
	) => {
		const key = `${quadrantId}-${section}`;
		const isCollapsed = collapsedSections[key];
		const title = section === "incomplete" ? "Lists" : "Completed";

		return (
			<Box
				onClick={() => toggleSection(quadrantId, section)}
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 0.5,
					cursor: "pointer",
					py: 0.5,
					px: 0.5,
					borderRadius: 1,
					"&:hover": {
						backgroundColor: theme.palette.action.hover,
					},
				}}
			>
				{isCollapsed ? (
					<ChevronRightIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
				) : (
					<ExpandMoreIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
				)}
				{icon}
				<Typography
					variant="caption"
					sx={{
						fontWeight: 600,
						color: "text.secondary",
						fontSize: "0.75rem",
					}}
				>
					{title}
				</Typography>
				<Typography
					variant="caption"
					sx={{
						color: "text.disabled",
						fontSize: "0.75rem",
					}}
				>
					{count}
				</Typography>
			</Box>
		);
	};

	return (
		<DragDropContext onDragEnd={handleDragEnd}>
			<Box
				sx={{
					display: "grid",
					gap: 1.5,
					gridTemplateColumns: {
						xs: "1fr",
						md: "1fr 1fr",
					},
					gridTemplateRows: {
						xs: "auto",
						md: "1fr 1fr",
					},
					height: "100%",
					overflow: "hidden",
				}}
			>
				{QUADRANTS.map((quadrant) => {
					const group = grouped.get(quadrant.id) ?? { incomplete: [], completed: [] };
					const incompleteKey = `${quadrant.id}-incomplete`;
					const completedKey = `${quadrant.id}-completed`;
					const isIncompleteCollapsed = collapsedSections[incompleteKey];
					const isCompletedCollapsed = collapsedSections[completedKey];

					// 为拖拽准备：合并所有任务，但按顺序排列
					const allTasks = [...group.incomplete, ...group.completed];

					return (
						<Box
							key={quadrant.id}
							sx={{
								borderRadius: 2,
								backgroundColor:
									theme.palette.mode === "light"
										? "background.paper"
										: "background.default",
								p: 1,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
								minHeight: { xs: 300, md: 0 },
							}}
						>
							<Box sx={{ mb: 1, flexShrink: 0 }}>
								<Typography
									variant="subtitle1"
									sx={{
										fontWeight: 700,
										color: quadrant.accent,
										display: "flex",
										alignItems: "center",
										gap: 1,
										fontSize: "1rem",
									}}
								>
									{quadrant.title}
								</Typography>
							</Box>

							<Droppable droppableId={quadrant.id}>
								{(provided, snapshot) => (
									<Box
										ref={provided.innerRef}
										{...provided.droppableProps}
										sx={{
											flex: 1,
											overflowY: "auto",
											overflowX: "hidden",
											display: "flex",
											flexDirection: "column",
											backgroundColor: snapshot.isDraggingOver
												? `${quadrant.accent}16`
												: "transparent",
											borderRadius: 2,
											transition: "background-color 0.2s ease",
											p: 0.5,
											"&::-webkit-scrollbar": {
												width: "6px",
											},
											"&::-webkit-scrollbar-track": {
												background: "transparent",
											},
											"&::-webkit-scrollbar-thumb": {
												background: theme.palette.mode === "light" 
													? "rgba(0,0,0,0.2)" 
													: "rgba(255,255,255,0.2)",
												borderRadius: "3px",
											},
											"&::-webkit-scrollbar-thumb:hover": {
												background: theme.palette.mode === "light" 
													? "rgba(0,0,0,0.3)" 
													: "rgba(255,255,255,0.3)",
											},
										}}
									>
										{allTasks.length === 0 && (
											<Box
												sx={{
													flex: 1,
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													color: "text.disabled",
													fontSize: "0.813rem",
													py: 3,
												}}
											>
												No tasks
											</Box>
										)}

										{group.incomplete.length > 0 && (
											<Box sx={{ mb: 0.5 }}>
												{renderSectionHeader(quadrant.id, "incomplete", group.incomplete.length)}
												<Collapse in={!isIncompleteCollapsed}>
													<Box>
														{group.incomplete.map((task, index) =>
															renderTask(task, index),
														)}
													</Box>
												</Collapse>
											</Box>
										)}

										{group.completed.length > 0 && (
											<Box>
												{renderSectionHeader(quadrant.id, "completed", group.completed.length)}
												<Collapse in={!isCompletedCollapsed}>
													<Box>
														{group.completed.map((task, index) =>
															renderTask(task, group.incomplete.length + index),
														)}
													</Box>
												</Collapse>
											</Box>
										)}

										{provided.placeholder}
									</Box>
								)}
							</Droppable>
						</Box>
					);
				})}
			</Box>
		</DragDropContext>
	);
};

export default TodoEisenhowerMatrix;
