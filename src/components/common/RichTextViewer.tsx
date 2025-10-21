import React, { useMemo, useState, useCallback } from "react";
import { Box, Dialog, DialogContent, Typography } from "@mui/material";
import { sanitizeRichText } from "../../utils/richTextUtils";

interface RichTextViewerProps {
	value?: string;
	placeholder?: string;
	minHeight?: number;
}

const RichTextViewer: React.FC<RichTextViewerProps> = ({
	value,
	placeholder,
	minHeight = 160,
}) => {
	const sanitized = useMemo(() => sanitizeRichText(value ?? ""), [value]);
	const [previewSrc, setPreviewSrc] = useState<string | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const hasContent = Boolean(sanitized?.trim());

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const target = event.target as HTMLElement | null;
			if (!target) return;
			if (target.tagName === "IMG") {
				event.preventDefault();
				const src = (target as HTMLImageElement).src;
				if (src) {
					setPreviewSrc(src);
					setPreviewOpen(true);
				}
			}
		},
		[],
	);

	const handleClosePreview = useCallback(() => {
		setPreviewOpen(false);
		setPreviewSrc(null);
	}, []);

	return (
		<Box sx={{ minHeight, position: "relative" }}>
			<Box
				onClick={handleClick}
				sx={{
					borderRadius: 2,
					border: "1px solid",
					borderColor: "divider",
					backgroundColor: "background.paper",
					p: 2,
					minHeight: "inherit",
					color: "text.primary",
					"& img": {
						maxWidth: "min(60%, 320px)",
						width: "min(60%, 320px)",
						borderRadius: 2,
						margin: 1,
						cursor: "zoom-in",
						boxShadow: "0 4px 16px rgba(15, 23, 42, 0.15)",
					},
				}}
			>
				{hasContent ? (
					<Box
						sx={{ "& p": { m: 0, mb: 1.2, lineHeight: 1.7 } }}
						dangerouslySetInnerHTML={{ __html: sanitized }}
					/>
				) : (
					<Typography variant="body2" color="text.disabled">
						{placeholder ?? "暂无内容"}
					</Typography>
				)}
			</Box>
			<Dialog open={previewOpen} onClose={handleClosePreview} maxWidth="md">
				<DialogContent
					sx={{
						p: 0,
						backgroundColor: "black",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{previewSrc && (
						<Box
							component="img"
							src={previewSrc}
							alt="预览图片"
							sx={{
								maxWidth: "90vw",
								maxHeight: "80vh",
								objectFit: "contain",
								borderRadius: 2,
							}}
						/>
					)}
				</DialogContent>
			</Dialog>
		</Box>
	);
};

export default RichTextViewer;

