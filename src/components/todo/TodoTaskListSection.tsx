import ListAltIcon from "@mui/icons-material/ListAlt";
import TimelineIcon from "@mui/icons-material/Timeline";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import {
	Box,
	Button,
	Paper,
	Stack,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from "@mui/material";
import React, { type FC } from "react";
import type {
	TodoFilterState,
	TodoStatus,
	TodoTask,
} from "../../stores/todoStore";
import TodoFilters from "./TodoFilters";
import TodoGanttView from "./TodoGanttView";
import TodoKanbanBoard from "./TodoKanbanBoard";
import TodoList from "./TodoList";
import TodoToolbar from "./TodoToolbar";

interface TodoTaskListSectionProps {
	filteredTasks: TodoTask[];
	filteredCount: number;
	filteredCompletedCount: number;
	hasIncompleteFiltered: boolean;
	hasCompletedTodos: boolean;
	onBulkComplete: () => void;
	onClearCompleted: () => void;
	search: string;
	onSearchChange: (value: string) => void;
	onAddTask: () => void;
	filtersVisible: boolean;
	onToggleFilters: () => void;
	filters: TodoFilterState;
	onFiltersChange: (filters: TodoFilterState) => void;
	tags: string[];
	categories: string[];
	selectedTaskId: string | null;
	onSelectTask: (task: TodoTask) => void;
	onToggleComplete: (task: TodoTask) => void;
	onEditTask: (task: TodoTask) => void;
  onDeleteTask: (task: TodoTask) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  viewMode: "list" | "gantt" | "board";
  onViewModeChange: (mode: "list" | "gantt" | "board") => void;
  onLogTime: (task: TodoTask) => void;
}

const TodoTaskListSection: FC<TodoTaskListSectionProps> = ({
	filteredTasks,
	filteredCount,
	filteredCompletedCount,
	hasIncompleteFiltered,
	hasCompletedTodos,
	onBulkComplete,
	onClearCompleted,
	search,
	onSearchChange,
	onAddTask,
	filtersVisible,
	onToggleFilters,
	filters,
	onFiltersChange,
	tags,
	categories,
	selectedTaskId,
	onSelectTask,
	onToggleComplete,
	onEditTask,
  onDeleteTask,
  onStatusChange,
  viewMode,
  onViewModeChange,
  onLogTime,
}) => {
	const activeCount = filteredCount - filteredCompletedCount;

	const handleViewModeChange = (
		_event: React.MouseEvent<HTMLElement>,
		value: "list" | "gantt" | "board" | null,
	) => {
		if (value) {
			onViewModeChange(value);
		}
	};

	return (
		<Paper
			variant="outlined"
			sx={{
				p: { xs: 3, md: 4 },
				borderRadius: 4,
				border: "none",
				boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
				background: (theme) =>
					theme.palette.mode === "light"
						? "white"
						: theme.palette.background.paper,
			}}
		>
			<Stack spacing={2.5}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", md: "center" }}
					spacing={2}
				>
					<Stack spacing={0.3}>
						<Typography
							variant="h5"
							fontWeight={700}
							sx={{ color: "primary.main" }}
						>
							任务列表
						</Typography>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ fontSize: "0.8rem" }}
						>
							共 {filteredCount} 项任务，已完成 {filteredCompletedCount} 项
						</Typography>
					</Stack>
					<Stack
						direction="row"
						spacing={1.5}
						flexWrap="wrap"
						alignItems="center"
					>
						<ToggleButtonGroup
							value={viewMode}
							exclusive
							onChange={handleViewModeChange}
							size="small"
							color="primary"
						>
							<ToggleButton value="list" sx={{ px: 1.5 }}>
								<Stack direction="row" spacing={0.5} alignItems="center">
									<ListAltIcon fontSize="small" />
									<Typography variant="caption" fontWeight={600}>
										列表
									</Typography>
								</Stack>
							</ToggleButton>
							<ToggleButton value="gantt" sx={{ px: 1.5 }}>
								<Stack direction="row" spacing={0.5} alignItems="center">
									<TimelineIcon fontSize="small" />
									<Typography variant="caption" fontWeight={600}>
										甘特图
									</Typography>
								</Stack>
							</ToggleButton>
							<ToggleButton value="board" sx={{ px: 1.5 }}>
								<Stack direction="row" spacing={0.5} alignItems="center">
									<ViewKanbanIcon fontSize="small" />
									<Typography variant="caption" fontWeight={600}>
										看板
									</Typography>
								</Stack>
							</ToggleButton>
						</ToggleButtonGroup>
						<Button
							variant="contained"
							size="medium"
							onClick={onBulkComplete}
							disabled={!hasIncompleteFiltered}
							sx={{
								borderRadius: 2,
								fontWeight: 600,
								boxShadow: "none",
								"&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
							}}
						>
							批量完成筛选结果
						</Button>
						<Button
							variant="outlined"
							color="error"
							size="medium"
							onClick={onClearCompleted}
							disabled={!hasCompletedTodos}
							sx={{
								borderRadius: 2,
								fontWeight: 600,
							}}
						>
							清空已完成
						</Button>
					</Stack>
				</Stack>

				<TodoToolbar
					search={search}
					onSearchChange={onSearchChange}
					onAddTask={onAddTask}
					onToggleFilters={onToggleFilters}
					filtersVisible={filtersVisible}
				/>
				<TodoFilters
					open={filtersVisible}
					value={filters}
					onChange={onFiltersChange}
					availableTags={tags}
					availableCategories={categories}
				/>

				{viewMode === "list" ? (
					<>
						<Box>
            <TodoList
              tasks={filteredTasks}
              onToggleComplete={onToggleComplete}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              selectedId={selectedTaskId ?? undefined}
              onSelect={onSelectTask}
              onLogTime={onLogTime}
            />
						</Box>

						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ fontSize: "0.75rem", textAlign: "right" }}
						>
							进行中 {activeCount} 项
						</Typography>
					</>
				) : viewMode === "gantt" ? (
					<TodoGanttView tasks={filteredTasks} />
				) : (
					<TodoKanbanBoard
						tasks={filteredTasks}
						onStatusChange={onStatusChange}
						onEditTask={onEditTask}
						onLogTime={onLogTime}
					/>
				)}
			</Stack>
		</Paper>
	);
};

export default TodoTaskListSection;
