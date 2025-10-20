import { Box, Paper, Stack, Tooltip, Typography } from "@mui/material";
import {
	addDays,
	differenceInCalendarDays,
	format,
	startOfDay,
} from "date-fns";
import type { FC } from "react";
import React, { useMemo } from "react";
import type { TodoStatus, TodoTask } from "../../stores/todoStore";
import { getTaskDateRange, resolveTaskStatus } from "../../utils/todoUtils";

const DAY_WIDTH = 72;
const LABEL_WIDTH = 160;
const BAR_HEIGHT = 32;
const BAR_GAP = 14;

type StatusConfig = {
	value: TodoStatus;
	label: string;
	color: string;
};

const STATUS_CONFIG: StatusConfig[] = [
	{ value: "notStarted", label: "待开始", color: "#64748b" },
	{ value: "inProgress", label: "进行中", color: "#6366f1" },
	{ value: "submitted", label: "待确认", color: "#f59e0b" },
	{ value: "completed", label: "已完成", color: "#10b981" },
];

type NormalizedTask = TodoTask & {
	status: TodoStatus;
	startDay: Date;
	endDay: Date;
	originalStart: Date;
	originalEnd: Date;
	hasDueDate: boolean;
};

const coerceDate = (value?: string): Date | null => {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const TodoGanttView: FC<{ tasks: TodoTask[] }> = ({ tasks }) => {
	const normalizedTasks = useMemo<NormalizedTask[]>(() => {
	return tasks.map((task) => {
		const created = coerceDate(task.createdAt) ?? new Date();
		const reminder = coerceDate(task.reminder);
		const range = getTaskDateRange(task);
		
		let startReference: Date;
		let endReference: Date;
		
		if (range) {
			startReference = range.start;
			endReference = range.end;
		} else if (reminder) {
			startReference = reminder;
			endReference = reminder;
		} else {
			startReference = created;
			endReference = addDays(created, 1);
		}
		
		const status = resolveTaskStatus(task);
		return {
			...task,
			status,
			startDay: startOfDay(startReference),
			endDay: startOfDay(addDays(endReference, 1)),
			originalStart: startReference,
			originalEnd: endReference,
			hasDueDate: Boolean(range ?? reminder),
		};
	});
	}, [tasks]);

	const timelineBounds = useMemo(() => {
		if (normalizedTasks.length === 0) {
			const today = startOfDay(new Date());
			return { start: today, end: addDays(today, 4) };
		}

		const earliest = normalizedTasks.reduce(
			(min, task) => (task.startDay < min ? task.startDay : min),
			normalizedTasks[0].startDay,
		);
		const latest = normalizedTasks.reduce(
			(max, task) => (task.endDay > max ? task.endDay : max),
			normalizedTasks[0].endDay,
		);
		const today = startOfDay(new Date());
		const startBuffer = addDays(today, -2);
		const start = earliest > startBuffer ? startBuffer : earliest;
		const end = addDays(latest, 1);
		return { start, end };
	}, [normalizedTasks]);

	const totalDays = Math.max(
		differenceInCalendarDays(timelineBounds.end, timelineBounds.start),
		1,
	);

	const groupedTasks = useMemo(() => {
		return STATUS_CONFIG.map((config) => ({
			...config,
			tasks: normalizedTasks.filter((task) => task.status === config.value),
		}));
	}, [normalizedTasks]);

	const timelineTicks = useMemo(() => {
		return Array.from({ length: totalDays }).map((_, index) => {
			const date = addDays(timelineBounds.start, index);
			return (
				<Box
					key={date.toISOString()}
					sx={{
						flex: 1,
						textAlign: "center",
						borderRight: "1px dashed",
						borderColor: "divider",
						py: 0.5,
						minWidth: 0,
					}}
				>
					<Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
						{format(date, "MM/dd")}
					</Typography>
				</Box>
			);
		});
	}, [timelineBounds.start, totalDays]);

	const renderTaskBar = (
		task: NormalizedTask,
		index: number,
		color: string,
	) => {
		const effectiveStart =
			task.startDay < timelineBounds.start
				? timelineBounds.start
				: task.startDay;
		const effectiveEndReference = addDays(timelineBounds.end, -1);
		const effectiveEnd =
			task.endDay > effectiveEndReference ? effectiveEndReference : task.endDay;

		const offsetDays = Math.max(
			differenceInCalendarDays(effectiveStart, timelineBounds.start),
			0,
		);
		const durationDays = Math.max(
			differenceInCalendarDays(addDays(effectiveEnd, 1), effectiveStart),
			1,
		);
		const leftPercent = (offsetDays / totalDays) * 100;
		const widthPercent = (durationDays / totalDays) * 100;
		const top = index * (BAR_HEIGHT + BAR_GAP) + 8;

		return (
			<Tooltip
				key={task.id}
				title={
					<Stack spacing={0.5}>
						<Typography variant="body2" fontWeight={600}>
							{task.title}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{`开始：${format(task.originalStart, "MM-dd HH:mm")}`}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{task.hasDueDate
								? `结束：${format(task.originalEnd, "MM-dd HH:mm")}`
								: "结束：未设置"}
						</Typography>
					</Stack>
				}
				arrow
			>
				<Box
					sx={{
						position: "absolute",
						top,
						left: `${leftPercent}%`,
						width: `${widthPercent}%`,
						minWidth: 40,
						height: BAR_HEIGHT,
						borderRadius: 1.5,
						backgroundColor: color,
						boxShadow: "0 10px 25px rgba(15, 23, 42, 0.15)",
						display: "flex",
						alignItems: "center",
						px: 1.5,
						color: "#fff",
						overflow: "hidden",
					}}
				>
					<Typography
						variant="caption"
						sx={{
							fontWeight: 600,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						{task.title}
					</Typography>
				</Box>
			</Tooltip>
		);
	};

	return (
		<Paper
			variant="outlined"
			sx={{
				p: { xs: 2.5, md: 3 },
				borderRadius: 4,
				border: "none",
				boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
				background: (theme) =>
					theme.palette.mode === "light"
						? "#ffffff"
						: theme.palette.background.paper,
			}}
		>
			<Stack spacing={2.5}>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="center"
				>
					<Typography variant="h6" fontWeight={700}>
						甘特视图
					</Typography>
				</Stack>

				<Box sx={{ width: "100%", overflowX: "hidden", overflowY: "hidden" }}>
					<Box
						sx={{
							width: "100%",
							position: "relative",
						}}
					>
						<Box
							sx={{
								position: "sticky",
								top: 0,
								display: "flex",
								background: (theme) =>
									theme.palette.mode === "light"
										? "#ffffff"
										: theme.palette.background.paper,
								pt: 1,
								pb: 1,
							}}
						>
							<Box sx={{ width: LABEL_WIDTH, flexShrink: 0 }} />
							<Box sx={{ display: "flex", flex: 1 }}>
								{timelineTicks}
							</Box>
						</Box>

						<Stack spacing={1.5} mt={1}>
							{groupedTasks.map((group) => {
								const rowHeight = group.tasks.length * (BAR_HEIGHT + BAR_GAP) + 24;
								return (
									<Box
										key={group.value}
										sx={{
											display: "flex",
											alignItems: "stretch",
											minHeight: rowHeight,
										}}
									>
										<Box
											sx={{
												width: LABEL_WIDTH,
												flexShrink: 0,
												pr: 2,
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
												gap: 0.5,
											}}
										>
											<Typography variant="subtitle2" fontWeight={600}>
												{group.label}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												{group.tasks.length} 项
											</Typography>
										</Box>
										<Box
											sx={{
												position: "relative",
												flex: 1,
												borderRadius: 3,
												backgroundColor: "rgba(148, 163, 184, 0.03)",
												border: "1px dashed",
												borderColor: "divider",
											}}
										>
											<Box
												sx={{
													position: "relative",
													width: "100%",
													minHeight: rowHeight,
												}}
											>
												{group.tasks.map((task, index) =>
													renderTaskBar(task, index, group.color),
												)}
											</Box>
										</Box>
									</Box>
								);
							})}
						</Stack>
					</Box>
				</Box>
			</Stack>
		</Paper>
	);
};

export default TodoGanttView;
