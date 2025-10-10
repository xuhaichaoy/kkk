import {
	Box,
	Card,
	CardContent,
	Divider,
	List,
	ListItem,
	ListItemText,
	Stack,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
	LinearProgress,
} from "@mui/material";
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import React, { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
	ResponsiveContainer,
	Tooltip as RechartsTooltip,
	PieChart,
	Pie,
	Cell,
	Treemap,
} from "recharts";
import type { TodoTask } from "../../stores/todoStore";
import { DateRangePicker } from "@mui/x-date-pickers-pro/DateRangePicker";
import { LocalizationProvider } from "@mui/x-date-pickers-pro/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers-pro/AdapterDayjs";

type RangeOption = "7" | "14" | "30" | "90" | "custom";

interface TodoTimeSummaryPanelProps {
	tasks: TodoTask[];
}

interface ChartDataPoint {
	key: string;
	label: string;
	minutes: number;
}

interface TaskDistributionPoint {
	key: string;
	title: string;
	minutes: number;
}

const RANGE_OPTIONS: Array<{ value: RangeOption; label: string }> = [
	{ value: "7", label: "最近 7 天" },
	{ value: "14", label: "最近 14 天" },
	{ value: "30", label: "最近 30 天" },
	{ value: "90", label: "最近 90 天" },
	{ value: "custom", label: "自定义" },
];

const COLORS = ["#1976d2", "#9c27b0", "#2e7d32", "#ff9800", "#d32f2f", "#0288d1", "#7b1fa2", "#5d4037"];

const TodoTimeSummaryPanel: React.FC<TodoTimeSummaryPanelProps> = ({ tasks }) => {
	const [range, setRange] = useState<RangeOption>("7");
	const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

	const {
		chartData,
		totalMinutes,
		topTasks,
		rangeLabel,
		taskDistribution,
		daySpan,
	} = useMemo(() => {
		const today = endOfDay(new Date());
		let effectiveEnd = today;
		let effectiveStart = startOfDay(subDays(today, 6));
		let label = "";

		if (range === "custom" && customRange.from && customRange.to) {
			const fromDate = startOfDay(new Date(customRange.from));
			const toDate = endOfDay(new Date(customRange.to));
			if (fromDate <= toDate) {
				effectiveStart = fromDate;
				effectiveEnd = toDate;
			}
		}

		if (range !== "custom") {
			const days = Number.parseInt(range, 10);
			const start = startOfDay(subDays(today, days - 1));
			effectiveStart = start;
			effectiveEnd = today;
		}

		const totalDays = differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
		const days: Array<{ date: Date; key: string; label: string }> = [];
		for (let index = 0; index < totalDays; index += 1) {
			const day = addDays(effectiveStart, index);
			days.push({
				date: day,
				key: format(day, "yyyy-MM-dd"),
				label: format(day, totalDays > 9 ? "MM-dd" : "MM/dd"),
			});
		}

		const dailyMinutes = new Map<string, number>();
		days.forEach((day) => dailyMinutes.set(day.key, 0));
		const perTask = new Map<string, { title: string; minutes: number }>();

		tasks.forEach((task) => {
			const entries = task.timeEntries ?? [];
			entries.forEach((entry) => {
				const entryDate = new Date(entry.date);
				if (Number.isNaN(entryDate.getTime())) return;
				if (entryDate < effectiveStart || entryDate > effectiveEnd) return;
				const key = format(startOfDay(entryDate), "yyyy-MM-dd");
				const prev = dailyMinutes.get(key) ?? 0;
				dailyMinutes.set(key, prev + entry.durationMinutes);
				perTask.set(task.id, {
					title: task.title,
					minutes: (perTask.get(task.id)?.minutes ?? 0) + entry.durationMinutes,
				});
			});
		});

		const chartData: ChartDataPoint[] = days.map((day) => ({
			key: day.key,
			label: day.label,
			minutes: dailyMinutes.get(day.key) ?? 0,
		}));

		const taskDistribution: TaskDistributionPoint[] = Array.from(perTask.entries())
			.sort(([, a], [, b]) => b.minutes - a.minutes)
			.map(([id, item]) => ({ key: id, title: item.title, minutes: item.minutes }));

		const topTasks = taskDistribution.slice(0, 5);
		const totalMinutes = chartData.reduce((sum, point) => sum + point.minutes, 0);
		label = `${format(effectiveStart, "yyyy-MM-dd")} ~ ${format(effectiveEnd, "yyyy-MM-dd")}`;

		return { chartData, totalMinutes, topTasks, rangeLabel: label, taskDistribution, daySpan: totalDays };
	}, [tasks, range, customRange.from, customRange.to]);

	const hasData = totalMinutes > 0;
	const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

	const [customPickerValue, setCustomPickerValue] = useState<[Dayjs | null, Dayjs | null]>(
		() =>
			customRange.from && customRange.to
				? [dayjs(customRange.from), dayjs(customRange.to)]
				: [null, null],
	);

	useEffect(() => {
		if (customRange.from && customRange.to) {
			setCustomPickerValue([dayjs(customRange.from), dayjs(customRange.to)]);
		}
	}, [customRange.from, customRange.to]);

	const shortcuts = useMemo(
		() => [
			{
				label: "今天",
				getValue: () => {
					const today = dayjs().startOf("day");
					return [today, today] as [Dayjs, Dayjs];
				},
			},
			{
				label: "最近 7 天",
				getValue: () => {
					const end = dayjs().startOf("day");
					const start = end.subtract(6, "day");
					return [start, end] as [Dayjs, Dayjs];
				},
			},
			{
				label: "最近 30 天",
				getValue: () => {
					const end = dayjs().startOf("day");
					const start = end.subtract(29, "day");
					return [start, end] as [Dayjs, Dayjs];
				},
			},
		],
		[],
	);

	const commitCustomRange = (value: [Dayjs | null, Dayjs | null]) => {
		if (!value[0] || !value[1]) return;
		setCustomRange({
			from: value[0].startOf("day").format("YYYY-MM-DD"),
			to: value[1].startOf("day").format("YYYY-MM-DD"),
		});
	};

	const handleCustomChange = (value: [Dayjs | null, Dayjs | null]) => {
		setCustomPickerValue(value);
		if (value[0] && value[1]) {
			commitCustomRange(value);
		}
		if (!value[0] && !value[1]) {
			setCustomRange({ from: "", to: "" });
		}
	};

	const handleCustomAccept = (value: [Dayjs | null, Dayjs | null]) => {
		if (value[0] && value[1]) {
			commitCustomRange(value);
		}
	};

	const handleRangeChange = (
		_event: React.MouseEvent<HTMLElement>,
		next: RangeOption | null,
	) => {
		if (!next) return;
		setRange(next);
		if (next === "custom") {
			if (!customRange.from || !customRange.to) {
				const end = dayjs().startOf("day");
				const start = end.subtract(6, "day");
				setCustomRange({
					from: start.format("YYYY-MM-DD"),
					to: end.format("YYYY-MM-DD"),
				});
				setCustomPickerValue([start, end]);
			}
		} else {
			setCustomPickerValue([null, null]);
		}
	};

	const renderPieChart = (
		<Box sx={{ flex: 1, minWidth: 0, height: 260 }}>
			<ResponsiveContainer width="100%" height="100%">
				<PieChart>
					<RechartsTooltip formatter={(value: number) => `${Math.round((value / 60) * 10) / 10} 小时`} />
					<Pie
						data={taskDistribution}
						dataKey="minutes"
						nameKey="title"
						innerRadius={60}
						outerRadius={100}
						paddingAngle={4}
						label={({ percent }) =>
							Number.isFinite(percent) ? `${Math.round(percent * 100)}%` : ""
						}
					>
						{taskDistribution.map((entry, index) => (
							<Cell key={entry.key} fill={COLORS[index % COLORS.length]} />
						))}
					</Pie>
				</PieChart>
			</ResponsiveContainer>
		</Box>
	);

	const renderTreemap = (
		<Box sx={{ flex: 1, minWidth: 0, height: 260 }}>
			<ResponsiveContainer width="100%" height="100%">
				<Treemap
					data={taskDistribution.map((item, index) => ({
						name: item.title,
						value: item.minutes,
						fill: COLORS[index % COLORS.length],
					}))}
					dataKey="value"
					stroke="#fff"
				/>
			</ResponsiveContainer>
		</Box>
	);

	const shouldShowPie = true;
	const shouldShowTreemap = true;

	const customRangeValid =
		range !== "custom" || (
			Boolean(customRange.from && customRange.to) &&
			new Date(customRange.from) <= new Date(customRange.to)
		);

	return (
		<Card variant="outlined" sx={{ borderRadius: 4, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.08)" }}>
			<CardContent>
				<Stack spacing={2.5}>
					<Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
						<Stack spacing={0.5}>
							<Typography variant="subtitle1" fontWeight={700} sx={{ color: "primary.main" }}>
								时间投入概览
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{rangeLabel}
							</Typography>
						</Stack>
					<Stack
						direction={{ xs: "column", md: "row" }}
						spacing={1}
						alignItems={{ xs: "stretch", md: "center" }}
						sx={{
							width: "100%",
							'& .MuiToggleButtonGroup-root': {
								width: { xs: "100%", md: "auto" },
								display: "flex",
								flexWrap: { xs: "wrap", md: "nowrap" },
							},
							'& .MuiToggleButton-root': {
								flex: { xs: "1 1 110px", md: "0 0 auto" },
								whiteSpace: "nowrap",
								px: 1.5,
							},
						}}
					>
				<ToggleButtonGroup
					value={range}
					exclusive
					size="small"
					onChange={handleRangeChange}
					sx={{ width: "100%", display: "flex", flexWrap: { xs: "wrap", md: "nowrap" } }}
				>
					{RANGE_OPTIONS.map((option) => (
						<ToggleButton
							value={option.value}
							key={option.value}
							sx={{ flex: { xs: "1 1 110px", md: "0 0 auto" }, px: 1.5, whiteSpace: "nowrap" }}
						>
							{option.label}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			</Stack>
		</Stack>

					{range === "custom" && (
						<LocalizationProvider dateAdapter={AdapterDayjs}>
							<DateRangePicker
								value={customPickerValue}
								onChange={handleCustomChange}
								onAccept={handleCustomAccept}
								disableFuture
								slotProps={{
									textField: { fullWidth: true },
									shortcuts: { items: shortcuts },
								}}
								sx={{ width: "100%" }}
							/>
						</LocalizationProvider>
					)}

			{hasData && customRangeValid ? (
				<Stack spacing={2.5}>
					<Stack
						direction={{ xs: "column", sm: "row" }}
						justifyContent="space-between"
						alignItems={{ xs: "flex-start", sm: "center" }}
						spacing={1.5}
					>
						<Stack spacing={0.5}>
							<Typography variant="h4" fontWeight={700}>
								{totalHours} 小时
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{`共 ${daySpan} 天`}
							</Typography>
						</Stack>
					</Stack>

					<Stack direction={{ xs: "column", md: "row" }} spacing={2}>
						{shouldShowPie && renderPieChart}
						{shouldShowTreemap && renderTreemap}
					</Stack>

					<Divider sx={{ my: 1 }} />
					<Stack spacing={1.5}>
						<Typography variant="subtitle2" fontWeight={600}>
							任务耗时占比
						</Typography>
						<List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
							{topTasks.map((item, index) => {
								const percentage = totalMinutes > 0 ? Math.round((item.minutes / totalMinutes) * 1000) / 10 : 0;
								return (
									<ListItem key={item.key} sx={{ py: 0.6 }}>
										<ListItemText
											primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
											secondaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
											primary={`${index + 1}. ${item.title}`}
											secondary={`累计 ${Math.round((item.minutes / 60) * 10) / 10} 小时 · ${percentage}%`}
										/>
										<Stack sx={{ minWidth: { xs: 120, md: 160 }, pl: 2 }} spacing={0.4}>
											<LinearProgress
												variant="determinate"
												value={Math.min(100, Math.max(0, (item.minutes / Math.max(1, totalMinutes)) * 100))}
												sx={{ height: 6, borderRadius: 3, backgroundColor: "action.hover" }}
											/>
										</Stack>
									</ListItem>
								);
							})}
							{topTasks.length === 0 && (
								<ListItem sx={{ py: 0.6 }}>
									<ListItemText
										primary="暂无时间记录"
										primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
										/>
								</ListItem>
							)}
						</List>
					</Stack>
				</Stack>
			) : (
				<Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 6, color: "text.secondary" }}>
					<Typography variant="body2">
						{customRangeValid ? "还没有任何用时记录" : "请选择有效的时间范围"}
					</Typography>
					<Typography variant="caption">
						在任务列表中使用“登记用时”按钮，开始记录你的实际投入。
					</Typography>
				</Stack>
			)}
				</Stack>
			</CardContent>
		</Card>
	);
};

export default TodoTimeSummaryPanel;
