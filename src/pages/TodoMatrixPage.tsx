import AddIcon from "@mui/icons-material/Add";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { Box, Button, IconButton, Stack, Tooltip } from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import React, { useCallback, useMemo, useRef, useState } from "react";
import PageHeader from "../components/common/PageHeader";
import TodoFormDialog, {
	type FormValues,
} from "../components/todo/TodoFormDialog";
import TodoEisenhowerMatrix, {
	type TodoEisenhowerMatrixHandles,
} from "../components/todo/TodoEisenhowerMatrix";
import {
	DEFAULT_CATEGORY,
	addTodoAtom,
	categoriesAtom,
	tagsAtom,
	toggleTodoAtom,
	todosAtom,
	type TodoPriority,
	type TodoTask,
	updateTodoAtom,
	upsertCategoryAtom,
	upsertTagAtom,
} from "../stores/todoStore";

const TodoMatrixPage: React.FC = () => {
	const matrixRef = useRef<TodoEisenhowerMatrixHandles>(null);
	const todos = useAtomValue(todosAtom);
	const tags = useAtomValue(tagsAtom);
	const categories = useAtomValue(categoriesAtom);
	const categoryOptions = useMemo(() => {
		const normalized = categories
			.map((category) => category.trim())
			.filter((category) => category.length > 0 && category !== DEFAULT_CATEGORY);
		return Array.from(new Set([DEFAULT_CATEGORY, ...normalized]));
	}, [categories]);

	const addTodo = useSetAtom(addTodoAtom);
	const updateTodo = useSetAtom(updateTodoAtom);
	const toggleTodo = useSetAtom(toggleTodoAtom);
	const upsertTag = useSetAtom(upsertTagAtom);
	const upsertCategory = useSetAtom(upsertCategoryAtom);

	const [formOpen, setFormOpen] = useState(false);
	const [editingTask, setEditingTask] = useState<TodoTask | null>(null);

	const handleCreateTask = useCallback(() => {
		setEditingTask(null);
		setFormOpen(true);
	}, []);

	const handleEditTask = useCallback((task: TodoTask) => {
		setEditingTask(task);
		setFormOpen(true);
	}, []);

	const handleFormSubmit = useCallback(
		(values: FormValues) => {
			if (values.id) {
				updateTodo({
					id: values.id,
					changes: {
						title: values.title,
						description: values.description,
						notes: values.notes,
						reflection: values.reflection,
						priority: values.priority,
						completed: values.completed,
						dueDate: values.dueDate,
						dueDateEnd: values.dueDateEnd,
						reminder: values.reminder,
						tags: values.tags,
						category: values.category,
						status: values.status,
						reminderSent: values.completed ? true : undefined,
					},
				});
			} else {
				addTodo({
					title: values.title,
					description: values.description,
					notes: values.notes,
					reflection: values.reflection,
					priority: values.priority,
					completed: values.completed,
					dueDate: values.dueDate,
					dueDateEnd: values.dueDateEnd,
					reminder: values.reminder,
					tags: values.tags,
					category: values.category,
					reminderSent: values.completed,
					status: values.status,
				});
			}
		},
		[updateTodo, addTodo],
	);

	const handleCloseForm = useCallback(() => {
		setFormOpen(false);
		setEditingTask(null);
	}, []);

	const handleToggleComplete = useCallback(
		(task: TodoTask) => {
			toggleTodo(task.id);
		},
		[toggleTodo],
	);

	const handlePriorityChange = useCallback(
		(taskId: string, priority?: TodoPriority) => {
			const nextPriority: TodoPriority = priority ?? "none";
			updateTodo({
				id: taskId,
				changes: {
					priority: nextPriority,
				},
			});
		},
		[updateTodo],
	);

	const handleOpenQuadrantLayout = useCallback(() => {
		matrixRef.current?.openQuadrantLayoutDialog();
	}, []);

	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: "column",
				height: "100vh",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					px: 2,
					pt: 2,
					pb: 1.5,
					flexShrink: 0,
				}}
			>
				<PageHeader
					title="Eisenhower Matrix"
					action={
						<Stack direction="row" spacing={1} alignItems="center">
							<Tooltip title="调整象限顺序">
								<IconButton
									size="small"
									onClick={handleOpenQuadrantLayout}
									aria-label="调整象限顺序"
								>
									<SwapVertIcon fontSize="small" />
								</IconButton>
							</Tooltip>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								onClick={handleCreateTask}
								sx={{ borderRadius: 2 }}
							>
								新建任务
							</Button>
						</Stack>
					}
				/>
			</Box>

			<Box
				sx={{
					flex: 1,
					overflow: "hidden",
					px: 2,
					pb: 2,
				}}
			>
				<TodoEisenhowerMatrix
					ref={matrixRef}
					tasks={todos}
					onToggleComplete={handleToggleComplete}
					onPriorityChange={handlePriorityChange}
					onEditTask={handleEditTask}
				/>
			</Box>

			<TodoFormDialog
				open={formOpen}
				initialTask={editingTask ?? undefined}
				onClose={handleCloseForm}
				onSubmit={handleFormSubmit}
				allTags={tags}
				allCategories={categoryOptions}
				onCreateTag={upsertTag}
				onCreateCategory={upsertCategory}
			/>
		</Box>
	);
};

export default TodoMatrixPage;
