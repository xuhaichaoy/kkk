import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
	Box,
	Button,
	IconButton,
	List,
	ListItem,
	ListItemText,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import React, { type FC } from "react";
import type { QuickNote } from "./utils";

interface WidgetNotesViewProps {
	draft: string;
	onDraftChange: (value: string) => void;
	notes: QuickNote[];
	onAddNote: () => void;
	onTogglePin: (id: string) => void;
	onDelete: (id: string) => void;
}

const WidgetNotesView: FC<WidgetNotesViewProps> = ({
	draft,
	onDraftChange,
	notes,
	onAddNote,
	onTogglePin,
	onDelete,
}) => {
	return (
		<Stack spacing={1.5} sx={{ flex: 1, overflow: "hidden" }}>
			<Stack direction="row" spacing={1.5}>
				<TextField
					value={draft}
					onChange={(event) => onDraftChange(event.target.value)}
					placeholder="记下灵感..."
					size="small"
					fullWidth
					sx={{
						"& .MuiOutlinedInput-root": {
							borderRadius: 2,
							background: "rgba(255, 255, 255, 0.8)",
							backdropFilter: "blur(10px)",
							"&:hover": {
								background: "rgba(255, 255, 255, 0.9)",
							},
							"&.Mui-focused": {
								background: "rgba(255, 255, 255, 0.95)",
							},
						},
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							onAddNote();
						}
					}}
				/>
				<Button
					variant="contained"
					size="small"
					onClick={onAddNote}
					sx={{
						borderRadius: 2,
						background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
						"&:hover": {
							background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
						},
						px: 2,
					}}
				>
					添加
				</Button>
			</Stack>
			<Box
				sx={{
					flex: 1,
					overflow: "auto",
					borderRadius: 2,
					border: "1px solid rgba(102, 126, 234, 0.2)",
					background: "rgba(255, 255, 255, 0.6)",
					backdropFilter: "blur(10px)",
				}}
			>
				{notes.length === 0 ? (
					<Stack alignItems="center" justifyContent="center" height={160}>
						<Typography variant="caption" color="text.secondary">
							暂无笔记，快速记录一点什么吧
						</Typography>
					</Stack>
				) : (
					<List dense disablePadding>
						{notes.map((note) => (
							<ListItem
								key={note.id}
								secondaryAction={
									<Stack direction="row" spacing={0.5} alignItems="center">
										<IconButton size="small" onClick={() => onTogglePin(note.id)}>
											{note.pinned ? (
												<PushPinIcon fontSize="small" />
											) : (
												<PushPinOutlinedIcon fontSize="small" />
											)}
										</IconButton>
										<IconButton size="small" onClick={() => onDelete(note.id)}>
											<DeleteOutlineIcon fontSize="small" />
										</IconButton>
									</Stack>
								}
								disablePadding
							>
								<ListItemText
									primary={note.text}
									secondary={
										<Typography variant="caption" color="text.secondary">
											{new Date(note.createdAt).toLocaleString()}
										</Typography>
									}
									primaryTypographyProps={{
										style: { wordBreak: "break-word" },
									}}
								/>
							</ListItem>
							))}
					</List>
				)}
			</Box>
		</Stack>
	);
};

export default WidgetNotesView;
