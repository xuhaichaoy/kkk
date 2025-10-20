import { useEffect, useMemo, useState } from "react";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import dayjs, { type Dayjs } from "dayjs";
import { DateRangePicker } from "@mui/x-date-pickers-pro/DateRangePicker";
import { AdapterDayjs } from "@mui/x-date-pickers-pro/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers-pro/LocalizationProvider";
import { getCurrentWeekRange, type DateRange } from "../../utils/todoUtils";

interface TodoWeeklyReportDialogProps {
	open: boolean;
	report: string;
	onClose: () => void;
	title?: string;
	description?: string;
	editable?: boolean;
	copyButtonLabel?: string;
	range: DateRange;
	onRangeChange: (range: DateRange) => void;
}

const copyToClipboard = async (text: string) => {
	if (navigator?.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return true;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "absolute";
	textarea.style.left = "-9999px";
	document.body.appendChild(textarea);
	const selection = document.getSelection();
	const selected = selection?.rangeCount ? selection.getRangeAt(0) : null;
	textarea.select();
	const success = document.execCommand("copy");
	document.body.removeChild(textarea);
	if (selected) {
		selection?.removeAllRanges();
		selection?.addRange(selected);
	}
	return success;
};

const TodoWeeklyReportDialog = ({
	open,
	report,
	onClose,
	title = "周报工作汇总",
	description = "以下内容根据最近任务动态自动生成，可直接复制到工作周报中。",
	editable = true,
	copyButtonLabel = "复制到剪贴板",
	range,
	onRangeChange,
}: TodoWeeklyReportDialogProps) => {
	const [copied, setCopied] = useState(false);
	const [content, setContent] = useState(report);
	const [pickerValue, setPickerValue] = useState<[Dayjs | null, Dayjs | null]>(() => [
		dayjs(range.start),
		dayjs(range.end),
	]);

	const rangeStartMillis = range.start.getTime();
	const rangeEndMillis = range.end.getTime();

	useEffect(() => {
		if (!open) {
			setCopied(false);
		}
	}, [open]);

	useEffect(() => {
		if (open) {
			setContent(report);
		}
	}, [open, report]);

	useEffect(() => {
		setPickerValue([dayjs(range.start), dayjs(range.end)]);
	}, [rangeStartMillis, rangeEndMillis]);

	const shortcuts = useMemo(
		() => [
			{
				label: "本周",
				getValue: () => {
					const { start, end } = getCurrentWeekRange();
					return [dayjs(start), dayjs(end)] as [Dayjs, Dayjs];
				},
			},
			{
				label: "上周",
				getValue: () => {
					const reference = dayjs().subtract(1, "week").toDate();
					const { start, end } = getCurrentWeekRange(reference);
					return [dayjs(start), dayjs(end)] as [Dayjs, Dayjs];
				},
			},
			{
				label: "最近 14 天",
				getValue: () => {
					const end = dayjs().endOf("day");
					const start = end.subtract(13, "day").startOf("day");
					return [start, end] as [Dayjs, Dayjs];
				},
			},
		],
		[],
	);

	const handlePickerChange = (value: [Dayjs | null, Dayjs | null]) => {
		setPickerValue(value);
		if (!value[0] || !value[1]) return;
		let start = value[0].startOf("day");
		let end = value[1].endOf("day");
		if (start.isAfter(end)) {
			[start, end] = [end, start];
		}

		const nextRange: DateRange = {
			start: start.toDate(),
			end: end.toDate(),
		};

		if (
			nextRange.start.getTime() === rangeStartMillis &&
			nextRange.end.getTime() === rangeEndMillis
		) {
			return;
		}

		onRangeChange(nextRange);
	};

	const handleCopy = async () => {
		try {
			const success = await copyToClipboard(content);
			setCopied(success);
			if (success) {
				setTimeout(() => setCopied(false), 2000);
			}
		} catch (error) {
			console.error("Failed to copy weekly report:", error);
			setCopied(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
			<DialogTitle>{title}</DialogTitle>
			<DialogContent dividers>
				<Stack spacing={2}>
					<Stack spacing={0.75}>
						<Typography variant="subtitle2" fontWeight={600}>
							时间范围
						</Typography>
						<LocalizationProvider dateAdapter={AdapterDayjs}>
							<DateRangePicker
								value={pickerValue}
								onChange={handlePickerChange}
								disableFuture
								slotProps={{
									textField: { fullWidth: true, size: "small" },
									shortcuts: { items: shortcuts },
								}}
								sx={{ width: "100%" }}
							/>
						</LocalizationProvider>
					</Stack>
					<Typography variant="body2" color="text.secondary">
						{description}
					</Typography>
					<TextField
						multiline
						fullWidth
						minRows={14}
						value={content}
						onChange={(event) => {
							if (!editable) return;
							setContent(event.target.value);
						}}
						InputProps={{ readOnly: !editable }}
					/>
				</Stack>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>关闭</Button>
				<Button variant="contained" onClick={handleCopy} disabled={!content.trim()}>
					{copied ? "已复制" : copyButtonLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default TodoWeeklyReportDialog;
