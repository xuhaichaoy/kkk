import ListAltIcon from "@mui/icons-material/ListAlt";
import TimelineIcon from "@mui/icons-material/Timeline";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import {
	Box,
	Button,
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
import { extractTextFromHtml } from "../../utils/richTextUtils";

interface TodoTaskListSectionProps {
	filteredTasks: TodoTask[];
	filteredCount: number;
	filteredCompletedCount: number;
	hasCompletedTodos: boolean;
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
	hasCompletedTodos,
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
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
			<Stack spacing={2.5} sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="center"
					spacing={2}
					sx={{ mb: 1 }}
				>
					<Stack direction="row" spacing={2} alignItems="center">
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
						<Typography variant="body2" color="text.secondary">
							共 {filteredCount} 项，已完成 {filteredCompletedCount} 项
						</Typography>
					</Stack>
					<Stack
						direction="row"
						spacing={1}
						alignItems="center"
					>
						<Button
							variant="outlined"
							color="error"
							size="small"
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

				<Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
					{viewMode === "list" ? (
						<Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
							<Box sx={{ flex: 1 }}>
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
						</Box>
					) : viewMode === "gantt" ? (
						<Box sx={{ flex: 1, overflowY: "auto" }}>
							<TodoGanttView tasks={filteredTasks} />
						</Box>
					) : (
						<Box sx={{ flex: 1, overflow: "hidden" }}>
							<TodoKanbanBoard
								tasks={filteredTasks}
								onStatusChange={onStatusChange}
								onEditTask={onEditTask}
								onLogTime={onLogTime}
							/>
						</Box>
					)}
				</Box>
			</Stack>
		</Box>
	);
};

export default TodoTaskListSection;
