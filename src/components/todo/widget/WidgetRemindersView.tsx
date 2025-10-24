import { Button, ButtonGroup, Chip, Paper, Stack, Typography } from "@mui/material";
import React, { type FC } from "react";
import type { TodoTask } from "../../../stores/todoStore";
import type { TodoReminderLogEntry } from "../../../stores/todoReminderStore";
import { formatDateForLabel } from "./utils";

const REMINDER_DELAY_OPTIONS: Array<{ label: string; minutes: number }> = [
	{ label: "+5 分钟", minutes: 5 },
	{ label: "+15 分钟", minutes: 15 },
	{ label: "+30 分钟", minutes: 30 },
];

interface WidgetRemindersViewProps {
	entries: TodoReminderLogEntry[];
	taskLookup: Map<string, TodoTask>;
	onOpenTask: (entry: TodoReminderLogEntry) => void;
	onSnooze: (entry: TodoReminderLogEntry, minutes: number) => void;
	onComplete: (entry: TodoReminderLogEntry) => void;
}

const WidgetRemindersView: FC<WidgetRemindersViewProps> = ({
	entries,
	taskLookup,
	onOpenTask,
	onSnooze,
	onComplete,
}) => {
	if (entries.length === 0) {
		return (
			<Stack spacing={1.5} sx={{ flex: 1 }}>
				<Stack spacing={0.25}>
					<Typography variant="subtitle2" fontWeight={700}>
						提醒记录
					</Typography>
					<Typography variant="caption" color="text.secondary">
						展示最近发送的任务提醒，可快速延后或完成
					</Typography>
				</Stack>
				<Stack
					alignItems="center"
					justifyContent="center"
					sx={{
						flex: 1,
						borderRadius: 2,
						border: "1px solid rgba(102, 126, 234, 0.2)",
						background: "rgba(255, 255, 255, 0.65)",
						backdropFilter: "blur(10px)",
						p: 1.5,
					}}
				>
					<Typography variant="body2" color="text.secondary">
						近期还没有提醒记录
					</Typography>
				</Stack>
			</Stack>
		);
	}

	return (
		<Stack spacing={1.5} sx={{ flex: 1, overflow: "hidden" }}>
			<Stack spacing={0.25}>
				<Typography variant="subtitle2" fontWeight={700}>
					提醒记录
				</Typography>
				<Typography variant="caption" color="text.secondary">
					展示最近发送的任务提醒，可快速延后或完成
				</Typography>
			</Stack>
			<Stack
				sx={{
					flex: 1,
					overflowY: "auto",
					borderRadius: 2,
					border: "1px solid rgba(102, 126, 234, 0.2)",
					background: "rgba(255, 255, 255, 0.65)",
					backdropFilter: "blur(10px)",
					p: 1.5,
				}}
			>
				<Stack spacing={1.2}>
					{entries.map((entry) => {
						const task = taskLookup.get(entry.taskId);
						const isCompleted = Boolean(entry.completed || task?.completed);

						const parseDate = (value?: string) => {
							if (!value) return undefined;
							const date = new Date(value);
							return Number.isNaN(date.getTime()) ? undefined : date;
						};

						const sentDate = parseDate(entry.sentAt);
						const reminderDate = parseDate(
							entry.snoozedUntil ?? task?.reminder ?? entry.reminderAt,
						);
						const originalReminder = parseDate(entry.reminderAt);
						const snoozedLabel = entry.snoozedUntil ? parseDate(entry.snoozedUntil) : undefined;
						const displayTitle = task?.title ?? entry.taskTitle ?? "未命名任务";

						return (
							<Paper
								key={entry.id}
								variant="outlined"
								sx={{
									p: 1.25,
									borderRadius: 2,
									borderColor: "rgba(102, 126, 234, 0.25)",
									background: "rgba(255, 255, 255, 0.9)",
								}}
							>
								<Stack spacing={1.1}>
									<Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
										<Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
											<Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
												{displayTitle}
											</Typography>
											<Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center">
												{isCompleted && (
													<Chip size="small" color="success" label="已完成" sx={{ height: 22 }} />
												)}
												{!task && (
													<Chip
														size="small"
														color="default"
														variant="outlined"
														label="任务已移除"
														sx={{ height: 22 }}
													/>
												)}
												{snoozedLabel && (
													<Chip
														size="small"
														color="warning"
														variant="outlined"
														label={`延后至 ${formatDateForLabel(snoozedLabel)}`}
														sx={{ height: 22 }}
													/>
												)}
											</Stack>
										</Stack>
										<Stack direction="row" spacing={0.75} alignItems="center">
											<Button
												variant="outlined"
												size="small"
												disabled={!task}
												onClick={() => onOpenTask(entry)}
											>
												查看任务
											</Button>
										</Stack>
									</Stack>
									<Stack spacing={0.5}>
										{sentDate && (
											<Typography variant="caption" color="text.secondary">
												发送于 {formatDateForLabel(sentDate)}
											</Typography>
										)}
										{reminderDate && (
											<Typography variant="caption" color="text.secondary">
												提醒时间 {formatDateForLabel(reminderDate)}
											</Typography>
										)}
										{!reminderDate && (
											<Typography variant="caption" color="text.secondary">
												未设置提醒时间
											</Typography>
										)}
										{originalReminder && snoozedLabel &&
											originalReminder.getTime() !== snoozedLabel.getTime() && (
											<Typography variant="caption" color="text.secondary">
												原计划 {formatDateForLabel(originalReminder)}
											</Typography>
										)}
									</Stack>
									<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
										<ButtonGroup variant="outlined" size="small" disabled={!task || isCompleted}>
											{REMINDER_DELAY_OPTIONS.map((option) => (
												<Button
													key={option.minutes}
													onClick={() => onSnooze(entry, option.minutes)}
												>
													{option.label}
												</Button>
											))}
										</ButtonGroup>
										<Button
											variant="contained"
											size="small"
											color="success"
											disabled={!task || isCompleted}
											onClick={() => onComplete(entry)}
											sx={{ px: 2 }}
										>
											标记完成
										</Button>
									</Stack>
								</Stack>
							</Paper>
						);
					})}
				</Stack>
			</Stack>
		</Stack>
	);
};

export default WidgetRemindersView;
