import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import {
	Avatar,
	Box,
	Button,
	Chip,
	Divider,
	IconButton,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	Paper,
	Stack,
	Typography,
} from "@mui/material";
import { differenceInHours, format, isBefore } from "date-fns";
import React, { type FC } from "react";
import type { TodoTask } from "../../stores/todoStore";
import { getTaskDueDate, resolveTaskStatus, statusDisplayMap } from "../../utils/todoUtils";

interface TodoSelectedDatePanelProps {
	date: Date;
	tasks: TodoTask[];
	onCompleteAll: () => void;
	onAddTask: () => void;
	onEditTask: (task: TodoTask) => void;
	onDeleteTask: (task: TodoTask) => void;
 	onLogTime: (task: TodoTask) => void;
}

const TodoSelectedDatePanel: FC<TodoSelectedDatePanelProps> = ({
	date,
	tasks,
	onCompleteAll,
	onAddTask,
	onEditTask,
	onDeleteTask,
	onLogTime,
}) => {
	const formattedDate = format(date, "MM月dd日");
	const allCompleted = tasks.every((task) => task.completed);

	return (
		<Paper
			variant="outlined"
			sx={{
				p: 2.5,
				borderRadius: 4,
				flex: 1,
				border: "none",
				boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
				background: (theme) =>
					theme.palette.mode === "light"
						? "white"
						: theme.palette.background.paper,
				height: { xs: "auto", lg: "100%" },
				display: "flex",
				flexDirection: "column",
			}}
		>
			<Stack
				spacing={2}
				sx={{ height: { xs: "auto", lg: "100%" }, flex: { xs: "none", lg: 1 } }}
			>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="center"
				>
					<Typography
						variant="h6"
						fontWeight={700}
						sx={{ color: "primary.main", fontSize: "1.1rem" }}
					>
						{formattedDate} · {tasks.length} 项任务
					</Typography>
					<Button
						size="small"
						variant="contained"
						onClick={onCompleteAll}
						disabled={allCompleted}
						sx={{
							borderRadius: 2,
							fontWeight: 600,
							boxShadow: "none",
							"&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
						}}
					>
						全部完成
					</Button>
				</Stack>
				<Divider
					sx={{ borderColor: "divider", opacity: 0.4, borderWidth: "0.5px" }}
				/>
				<Box sx={{ flex: 1, overflowY: "auto", pr: 1.5 }}>
					{tasks.length === 0 ? (
						<Stack
							height="100%"
							alignItems="center"
							justifyContent="center"
							spacing={2.5}
						>
							<Box
								sx={{
									fontSize: "4.5rem",
									opacity: 0.25,
									filter: "grayscale(1)",
								}}
							>
								📋
							</Box>
							<Typography
								variant="body1"
								color="text.secondary"
								fontWeight={500}
							>
								这一天还没有安排任务
							</Typography>
							<Button
								size="medium"
								variant="contained"
								onClick={onAddTask}
								sx={{
									borderRadius: 2,
									fontWeight: 600,
									boxShadow: "none",
									"&:hover": {
										boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
									},
								}}
							>
								添加任务
							</Button>
						</Stack>
					) : (
						<List
							dense
							disablePadding
							sx={{ display: "flex", flexDirection: "column", gap: 1 }}
						>
						{tasks.map((task) => {
							const dueDate = getTaskDueDate(task);
							const isDueDateValid =
								dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;
							const dueLabel = isDueDateValid
								? format(isDueDateValid, "MM-dd HH:mm")
								: undefined;
							const totalMinutes = (task.timeEntries ?? []).reduce(
								(sum, entry) => sum + entry.durationMinutes,
								0,
							);
								const now = new Date();
								const isOverdue = Boolean(
									isDueDateValid &&
										!task.completed &&
										isBefore(isDueDateValid, now),
								);
								const hoursUntilDue = isDueDateValid
									? differenceInHours(isDueDateValid, now)
									: null;
								const isDueSoon = Boolean(
									isDueDateValid &&
										!task.completed &&
										!isOverdue &&
										hoursUntilDue !== null &&
										hoursUntilDue <= 24,
								);
								const statusMeta = statusDisplayMap[resolveTaskStatus(task)];

								return (
									<ListItem
										key={task.id}
										disableGutters
										alignItems="flex-start"
										sx={{
											px: 1.5,
											py: 1.2,
											borderRadius: 2,
											border: "1px solid",
											borderColor: isOverdue ? "error.light" : "divider",
											backgroundColor: (theme) =>
												theme.palette.mode === "light"
													? task.completed
														? "rgba(76, 175, 80, 0.04)"
														: "rgba(25, 118, 210, 0.02)"
													: "rgba(255,255,255,0.02)",
											transition: "all 0.2s ease",
											"&:hover": {
												backgroundColor: (theme) =>
													theme.palette.mode === "light"
														? task.completed
															? "rgba(76, 175, 80, 0.08)"
															: "rgba(25, 118, 210, 0.06)"
														: "rgba(255,255,255,0.05)",
												borderColor: isOverdue ? "error.main" : "primary.main",
											},
										}}
					secondaryAction={
						<Stack direction="row" spacing={0.3}>
								<IconButton
									size="small"
									onClick={(event) => {
										event.stopPropagation();
										onLogTime(task);
									}}
								sx={{
									color: "secondary.main",
									p: 0.5,
									"&:hover": {
										backgroundColor: "secondary.main",
										color: "white",
									},
								}}
							>
								<AccessTimeIcon sx={{ fontSize: 18 }} />
							</IconButton>
							<IconButton
								size="small"
								onClick={() => onEditTask(task)}
								sx={{
														color: "primary.main",
														p: 0.5,
														"&:hover": {
															backgroundColor: "primary.main",
															color: "white",
														},
													}}
												>
													<EditIcon sx={{ fontSize: 18 }} />
												</IconButton>
							<IconButton
								size="small"
								onClick={() => onDeleteTask(task)}
								sx={{
														color: "error.main",
														p: 0.5,
														"&:hover": {
															backgroundColor: "error.main",
															color: "white",
														},
													}}
												>
													<DeleteIcon sx={{ fontSize: 18 }} />
												</IconButton>
											</Stack>
										}
									>
										<ListItemAvatar sx={{ minWidth: 42 }}>
											<Avatar
												sx={{
													width: 32,
													height: 32,
													fontSize: "0.75rem",
													bgcolor: task.completed
														? "success.main"
														: task.priority === "high"
															? "error.main"
															: task.priority === "medium"
																? "warning.main"
																: "info.main",
													color: "#fff",
													fontWeight: 700,
												}}
											>
												{task.completed
													? "✓"
													: task.priority === "high"
														? "高"
														: task.priority === "medium"
															? "中"
															: "低"}
											</Avatar>
										</ListItemAvatar>
										<ListItemText
											disableTypography
											sx={{ pr: 7 }}
											primary={
												<Stack spacing={0.5} sx={{ width: "100%" }}>
													<Stack
														direction="row"
														spacing={0.5}
														alignItems="center"
														flexWrap="wrap"
														useFlexGap
													>
														<Typography
															variant="body2"
															sx={{
																flexGrow: 1,
																minWidth: 0,
																fontWeight: task.completed ? 400 : 600,
																textDecoration: task.completed
																	? "line-through"
																	: "none",
																color: task.completed
																	? "text.secondary"
																	: "text.primary",
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
																fontSize: "0.875rem",
															}}
														>
															{task.title}
														</Typography>
														{dueLabel && (
															<Chip
																size="small"
																label={dueLabel}
																color={isOverdue ? "error" : "primary"}
																sx={{
																	height: 20,
																	fontSize: "0.7rem",
																	borderRadius: 1,
																	fontWeight: 600,
																	"& .MuiChip-label": { px: 0.75 },
																}}
															/>
														)}
														{isOverdue && (
															<Chip
																size="small"
																label="逾期"
																color="error"
																variant="outlined"
																sx={{
																	height: 20,
																	fontSize: "0.7rem",
																	borderRadius: 1,
																	fontWeight: 600,
																	"& .MuiChip-label": { px: 0.75 },
																}}
															/>
														)}
														{isDueSoon && (
															<Chip
																size="small"
																label="即将到期"
																color="warning"
																variant="outlined"
																sx={{
																	height: 20,
																	fontSize: "0.7rem",
																	borderRadius: 1,
																	fontWeight: 600,
																	"& .MuiChip-label": { px: 0.75 },
																}}
															/>
														)}
												{statusMeta && (
													<Chip
														size="small"
														label={statusMeta.label}
														color={statusMeta.color}
														variant="outlined"
														sx={{
															height: 20,
															fontSize: "0.7rem",
															borderRadius: 1,
															fontWeight: 600,
															"& .MuiChip-label": { px: 0.75 },
														}}
													/>
												)}
											{totalMinutes > 0 && (
												<Chip
													size="small"
													label={`累计 ${Math.round((totalMinutes / 60) * 10) / 10} 小时`}
													color="secondary"
													variant="outlined"
													sx={{
														height: 20,
														fontSize: "0.7rem",
														borderRadius: 1,
														fontWeight: 600,
														"& .MuiChip-label": { px: 0.75 },
													}}
												/>
											)}
													</Stack>

													{task.description && (
														<Typography
															variant="caption"
															color="text.secondary"
															title={task.description}
															sx={{
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
																fontSize: "0.75rem",
															}}
														>
															{task.description}
														</Typography>
													)}

													{task.tags.length > 0 && (
														<Stack
															direction="row"
															spacing={0.4}
															flexWrap="wrap"
															useFlexGap
														>
															{task.tags.slice(0, 3).map((tag) => (
																<Chip
																	key={tag}
																	label={tag}
																	size="small"
																	variant="outlined"
																	sx={{
																		height: 18,
																		fontSize: "0.65rem",
																		borderColor: "divider",
																		borderRadius: 1,
																		maxWidth: 80,
																		overflow: "hidden",
																		textOverflow: "ellipsis",
																		"& .MuiChip-label": { px: 0.5 },
																	}}
																/>
															))}
															{task.tags.length > 3 && (
																<Chip
																	label={`+${task.tags.length - 3}`}
																	size="small"
																	variant="outlined"
																	sx={{
																		height: 18,
																		fontSize: "0.65rem",
																		"& .MuiChip-label": { px: 0.5 },
																	}}
																/>
															)}
														</Stack>
													)}
												</Stack>
											}
										/>
									</ListItem>
								);
							})}
						</List>
					)}
				</Box>
			</Stack>
		</Paper>
	);
};

export default TodoSelectedDatePanel;
