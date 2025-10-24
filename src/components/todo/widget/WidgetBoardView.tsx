import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LaunchIcon from "@mui/icons-material/Launch";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
	Box,
	Button,
	Checkbox,
	Chip,
	Divider,
	IconButton,
	Paper,
	Stack,
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	Typography,
} from "@mui/material";
import React, { type FC } from "react";
import type { TodoTask } from "../../../stores/todoStore";
import {
	PRIORITY_COLORS,
	PRIORITY_LABELS,
	getTaskScheduleInfo,
} from "./utils";

interface WidgetBoardViewProps {
	boardScope: "today" | "week";
	onBoardScopeChange: (scope: "today" | "week") => void;
	sections: Array<{ key: string; title: string; tasks: TodoTask[] }>;
	taskCount: number;
	hasTasks: boolean;
	onToggleTask: (task: TodoTask, completed: boolean) => void;
	onPostponeTomorrow: (task: TodoTask) => void;
	onOpenPostponeMenu: (taskId: string, anchor: HTMLElement) => void;
	onOpenTimeLog: (task: TodoTask) => void;
	onOpenTaskDetails: (task: TodoTask) => void;
}

const WidgetBoardView: FC<WidgetBoardViewProps> = ({
	boardScope,
	onBoardScopeChange,
	sections,
	taskCount,
	hasTasks,
	onToggleTask,
	onPostponeTomorrow,
	onOpenPostponeMenu,
	onOpenTimeLog,
	onOpenTaskDetails,
}) => {
	return (
		<Stack spacing={2} sx={{ flex: 1, overflow: "hidden" }}>
			<Stack direction="row" alignItems="center" justifyContent="space-between">
				<ToggleButtonGroup
					value={boardScope}
					exclusive
					onChange={(_, value) => value && onBoardScopeChange(value)}
					size="small"
					color="primary"
					aria-label="board scope"
				>
					<ToggleButton value="today">今日任务</ToggleButton>
					<ToggleButton value="week">本周计划</ToggleButton>
				</ToggleButtonGroup>
				<Typography variant="caption" color="text.secondary">
					{taskCount} 项待办
				</Typography>
			</Stack>
			<Box
				sx={{
					flex: 1,
					overflowY: "auto",
					borderRadius: 2,
					border: "1px solid rgba(102, 126, 234, 0.2)",
					background: "rgba(255, 255, 255, 0.6)",
					backdropFilter: "blur(10px)",
					p: 1.5,
			}}
			>
				{hasTasks ? (
					<Stack spacing={2}>
						{sections.map((section) => (
							<Stack key={section.key} spacing={1.2}>
								<Stack direction="row" spacing={0.75} alignItems="center">
									<Typography variant="subtitle2" fontWeight={700}>
										{section.title}
									</Typography>
									<Typography variant="caption" color="text.secondary">
										{section.tasks.length}
									</Typography>
									<Divider flexItem sx={{ borderColor: "rgba(102, 126, 234, 0.2)" }} />
								</Stack>
								<Stack spacing={1.2}>
									{section.tasks.map((task) => {
										const scheduleInfo = getTaskScheduleInfo(task);
										const scheduleColor =
											scheduleInfo.tone === "danger"
												? "error.main"
											: scheduleInfo.tone === "warning"
											? "warning.main"
											: "text.secondary";

										return (
											<Paper
												key={task.id}
												variant="outlined"
												onClick={() => onOpenTaskDetails(task)}
												sx={{
													p: 1.25,
													borderRadius: 2,
													display: "flex",
													alignItems: "flex-start",
													gap: 1,
													borderColor: "rgba(102, 126, 234, 0.25)",
													background: "rgba(255, 255, 255, 0.9)",
													cursor: "pointer",
													transition: "transform 0.2s ease, box-shadow 0.2s ease",
													position: "relative",
													"&:hover": {
														transform: "translateY(-2px)",
														boxShadow: "0 12px 24px rgba(102, 126, 234, 0.18)",
													},
													"&:hover .task-actions": {
														opacity: 1,
														pointerEvents: "auto",
													},
												}}
											>
												<Checkbox
													size="small"
													checked={task.completed}
													onClick={(event) => event.stopPropagation()}
													onChange={(event) => {
														event.stopPropagation();
														onToggleTask(task, event.target.checked);
													}}
												/>
												<Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
													<Typography
														variant="body2"
														fontWeight={600}
														sx={{ wordBreak: "break-word" }}
													>
														{task.title}
													</Typography>
													<Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
														{task.priority !== "none" && (
															<Chip
																size="small"
																color={PRIORITY_COLORS[task.priority]}
																label={PRIORITY_LABELS[task.priority]}
																sx={{ height: 22 }}
															/>
														)}
														{task.category && (
															<Chip
																size="small"
																variant="outlined"
																label={`#${task.category}`}
																sx={{ height: 22 }}
															/>
														)}
														{task.tags.slice(0, 2).map((tag) => (
															<Chip
																key={`${task.id}-${tag}`}
																size="small"
																variant="outlined"
																label={`@${tag}`}
																sx={{ height: 22 }}
															/>
														))}
														<Typography variant="caption" sx={{ color: scheduleColor }}>
															{scheduleInfo.label}
														</Typography>
													</Stack>
												</Stack>
												<Stack
													direction="row"
													spacing={0.75}
													alignItems="center"
													className="task-actions"
													sx={{
														opacity: 0,
														pointerEvents: "none",
														transition: "opacity 0.2s ease",
													}}
												>
													<Button
														variant="outlined"
														size="small"
														onClick={(event) => {
															event.stopPropagation();
															onPostponeTomorrow(task);
														}}
													>
														推迟到明天
													</Button>
													<Button
														variant="outlined"
														size="small"
														onClick={(event) => {
															event.stopPropagation();
															onOpenTimeLog(task);
														}}
														startIcon={<AccessTimeIcon fontSize="small" />}
													>
														登记用时
													</Button>
													<Button
														variant="outlined"
														size="small"
														onClick={(event) => {
															event.stopPropagation();
															onOpenTaskDetails(task);
														}}
														startIcon={<LaunchIcon fontSize="small" />}
													>
														详情
													</Button>
													<Tooltip title="更多推迟选项">
														<IconButton
															size="small"
															onClick={(event) => {
																event.stopPropagation();
																onOpenPostponeMenu(task.id, event.currentTarget);
														}}
														>
															<MoreHorizIcon fontSize="small" />
														</IconButton>
														</Tooltip>
												</Stack>
											</Paper>
										);
									})}
								</Stack>
							</Stack>
					))}
					</Stack>
				) : (
					<Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
						<Typography variant="body2" color="text.secondary">
							{boardScope === "today"
								? "今日暂时没有待办，添加一条吧"
								: "本周暂无任务，去规划一下？"}
						</Typography>
					</Stack>
				)}
			</Box>
		</Stack>
	);
};

export default WidgetBoardView;
