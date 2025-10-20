import {
	Box,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Stack,
	Typography,
	Badge,
	Divider,
	Collapse,
	IconButton,
	Tooltip,
	useTheme,
	alpha,
	TextField,
} from "@mui/material";
import React, { type FC, useMemo, useState } from "react";
import TodayIcon from "@mui/icons-material/Today";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import InboxIcon from "@mui/icons-material/Inbox";
import WavingHandIcon from "@mui/icons-material/WavingHand";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import type { TodoTask } from "../../stores/todoStore";
import { getTodayTodos, getWeekTodos } from "../../utils/todoUtils";

export type SidebarView =
	| "today"
	| "next7days"
	| "inbox"
	| "welcome"
	| "completed"
	| "trash"
	| `category:${string}`;

interface TodoSidebarProps {
	tasks: TodoTask[];
	selectedView: SidebarView;
	onViewChange: (view: SidebarView) => void;
	categories: string[];
	onCreateCategory: (category: string) => void;
	onRemoveCategory: (category: string) => void;
}

const TodoSidebar: FC<TodoSidebarProps> = ({
	tasks,
	selectedView,
	onViewChange,
	categories,
	onCreateCategory,
	onRemoveCategory,
}) => {
	const theme = useTheme();
	const [listsExpanded, setListsExpanded] = useState(true);
	const [isCreatingList, setIsCreatingList] = useState(false);
	const [newListName, setNewListName] = useState("");

	const categoryCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		tasks.forEach((task) => {
			if (!task.category || task.completed) return;
			counts[task.category] = (counts[task.category] ?? 0) + 1;
		});
		return counts;
	}, [tasks]);

	const todayCount = useMemo(
		() => getTodayTodos(tasks.filter((t) => !t.completed)).length,
		[tasks],
	);

	const next7DaysCount = useMemo(
		() => getWeekTodos(tasks.filter((t) => !t.completed)).length,
		[tasks],
	);

	const inboxCount = useMemo(
		() => tasks.filter((t) => !t.completed && !t.category).length,
		[tasks],
	);

	const welcomeCount = useMemo(() => tasks.filter((t) => !t.completed).length, [
		tasks,
	]);

	const completedCount = useMemo(
		() => tasks.filter((t) => t.completed).length,
		[tasks],
	);

	const renderListItem = (
		view: SidebarView,
		icon: React.ReactNode,
		label: string,
		count?: number,
		onDelete?: () => void,
	) => {
		const isSelected = selectedView === view;
		return (
			<ListItemButton
				key={view}
				selected={isSelected}
				onClick={() => onViewChange(view)}
				sx={{
					borderRadius: 2,
					mb: 0.5,
					px: 1.5,
					py: 1,
					"&.Mui-selected": {
						backgroundColor: alpha(theme.palette.primary.main, 0.12),
						"&:hover": {
							backgroundColor: alpha(theme.palette.primary.main, 0.18),
						},
					},
				}}
			>
				<ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
					{icon}
				</ListItemIcon>
				<ListItemText
					primary={label}
					primaryTypographyProps={{
						fontSize: "0.9rem",
						fontWeight: isSelected ? 600 : 400,
					}}
				/>
				{count !== undefined && count > 0 && (
					<Badge
						badgeContent={count}
						color="primary"
						sx={{
							"& .MuiBadge-badge": {
								position: "static",
								transform: "none",
								fontSize: "0.7rem",
								minWidth: 20,
								height: 20,
							},
						}}
					/>
				)}
				{onDelete && (
					<Tooltip title="删除列表" arrow>
						<IconButton
							size="small"
							onClick={(event) => {
								event.stopPropagation();
								onDelete();
							}}
							sx={{
								ml: 0.5,
								color: "text.disabled",
								"&:hover": {
									color: theme.palette.error.main,
									backgroundColor: alpha(theme.palette.error.main, 0.08),
								},
							}}
						>
							<DeleteOutlineIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				)}
			</ListItemButton>
		);
	};

	const resetNewListState = () => {
		setNewListName("");
		setIsCreatingList(false);
	};

	const commitNewList = () => {
		const trimmed = newListName.trim();
		if (!trimmed) {
			resetNewListState();
			return;
		}

		onCreateCategory(trimmed);
		onViewChange(`category:${trimmed}` as SidebarView);
		resetNewListState();
	};

	const handleRemoveCategory = async (category: string) => {
		let confirmed = true;
		if (typeof window !== "undefined" && typeof window.confirm === "function") {
			const result = window.confirm(`确定要删除列表「${category}」吗？`);
			confirmed = result;
		}
		if (!confirmed) {
			return;
		}
		const normalized = category.trim();
		if (!normalized) return;
		onRemoveCategory(normalized);
		if (selectedView === `category:${category}`) {
			onViewChange("welcome");
		}
	};

	const handleNewListKeyDown = (
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (event.key === "Enter") {
			event.preventDefault();
			commitNewList();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			resetNewListState();
		}
	};

	return (
		<Box
			sx={{
				width: 280,
				height: "100vh",
				borderRight: `1px solid ${theme.palette.divider}`,
				backgroundColor: theme.palette.background.paper,
				display: "flex",
				flexDirection: "column",
				overflowY: "auto",
			}}
		>
			<Box sx={{ p: 2, pt: 3 }}>
				<List sx={{ p: 0 }}>
					{renderListItem(
						"today",
						<TodayIcon fontSize="small" />,
						"Today",
						todayCount,
					)}
					{renderListItem(
						"next7days",
						<CalendarTodayIcon fontSize="small" />,
						"Next 7 Days",
						next7DaysCount,
					)}
					{renderListItem(
						"inbox",
						<InboxIcon fontSize="small" />,
						"Inbox",
						inboxCount,
					)}
				</List>

				<Divider sx={{ my: 2 }} />

				<Box sx={{ mb: 1 }}>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 0.5,
					}}
				>
					<Tooltip title={listsExpanded ? "收起列表" : "展开列表"} arrow>
						<IconButton
							size="small"
							onClick={() => setListsExpanded((prev) => !prev)}
							sx={{
							color: "text.secondary",
							borderRadius: 2,
							p: 0.5,
							"&:hover": {
								backgroundColor: alpha(theme.palette.primary.main, 0.08),
							},
						}}
						>
							{listsExpanded ? (
								<ExpandLess fontSize="small" />
							) : (
								<ExpandMore fontSize="small" />
							)}
						</IconButton>
					</Tooltip>
					<ListItemText
							primary="Lists"
							primaryTypographyProps={{
								fontSize: "0.85rem",
								fontWeight: 600,
								color: "text.secondary",
							}}
						/>
					<Tooltip title="新建列表" arrow>
						<IconButton
							size="small"
							onClick={() => {
							setListsExpanded(true);
							setIsCreatingList(true);
						}}
							sx={{
							color: "text.secondary",
							borderRadius: 2,
							p: 0.5,
							"&:hover": {
								backgroundColor: alpha(theme.palette.primary.main, 0.08),
							},
						}}
						>
							<AddIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Box>
				<Collapse in={listsExpanded} timeout="auto" unmountOnExit>
					<List sx={{ p: 0, pl: 0.5 }}>
						{renderListItem(
							"welcome",
							<WavingHandIcon fontSize="small" />,
							"👋 欢迎",
							welcomeCount,
						)}
				{categories.map((category) =>
					renderListItem(
						`category:${category}` as SidebarView,
						<FolderOpenIcon fontSize="small" />,
						category,
						categoryCounts[category],
						() => handleRemoveCategory(category),
					),
				)}
						{isCreatingList && (
							<Box sx={{ px: 1.5, py: 0.75 }}>
								<TextField
									value={newListName}
									onChange={(event) => setNewListName(event.target.value)}
									size="small"
									fullWidth
									autoFocus
									placeholder="输入列表名称"
									onBlur={commitNewList}
									onKeyDown={handleNewListKeyDown}
								/>
							</Box>
						)}
					</List>
				</Collapse>
			</Box>

			<Divider sx={{ my: 2 }} />

				<Box>
					<Stack spacing={2} sx={{ px: 1.5 }}>
						<Box>
							<Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
								<FilterAltIcon
									fontSize="small"
									sx={{ color: "text.secondary" }}
								/>
								<Typography
									variant="caption"
									fontWeight={600}
									color="text.secondary"
								>
									Filters
								</Typography>
							</Stack>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ fontSize: "0.75rem", lineHeight: 1.4 }}
							>
								Display tasks filtered by list, date, priority, tag, and more
							</Typography>
						</Box>

						<Box>
							<Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
								<LocalOfferIcon
									fontSize="small"
									sx={{ color: "text.secondary" }}
								/>
								<Typography
									variant="caption"
									fontWeight={600}
									color="text.secondary"
								>
									Tags
								</Typography>
							</Stack>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ fontSize: "0.75rem", lineHeight: 1.4 }}
							>
								Categorize your tasks with tags. Quickly select a tag by typing
								"#" when adding a task
							</Typography>
						</Box>
					</Stack>
				</Box>

				<Divider sx={{ my: 2 }} />

				<List sx={{ p: 0 }}>
					{renderListItem(
						"completed",
						<CheckCircleOutlineIcon fontSize="small" />,
						"Completed",
						completedCount,
					)}
					{renderListItem(
						"trash",
						<DeleteOutlineIcon fontSize="small" />,
						"Trash",
					)}
				</List>
			</Box>
		</Box>
	);
};

export default TodoSidebar;
