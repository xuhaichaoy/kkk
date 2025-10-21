import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Box, Dialog, DialogContent, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { sanitizeRichText } from "../../utils/richTextUtils";

export interface RichTextEditorProps {
	value?: string;
	onChange: (value: string) => void;
	placeholder?: string;
	label?: string;
	minHeight?: number;
	maxHeight?: number;
	disabled?: boolean;
	helperText?: string;
}

const EditorContainer = styled(Box)(({ theme }) => ({
	border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
	borderRadius: theme.shape.borderRadius * 1.5,
	padding: theme.spacing(1.5),
	backgroundColor: alpha(theme.palette.background.paper, 0.85),
	transition: "border-color 0.2s ease, box-shadow 0.2s ease",
	"&:focus-within": {
		borderColor: theme.palette.primary.main,
		boxShadow: `${alpha(theme.palette.primary.main, 0.15)} 0 0 0 3px`,
	},
	"&.RichTextEditor-disabled": {
		backgroundColor: theme.palette.action.disabledBackground,
		borderColor: theme.palette.action.disabled,
		cursor: "not-allowed",
	},
}));

const ContentEditable = styled("div")(({ theme }) => ({
	outline: "none",
	width: "100%",
	lineHeight: 1.6,
	fontSize: theme.typography.body2.fontSize,
	color: theme.palette.text.primary,
	"&:empty:before": {
		content: "attr(data-placeholder)",
		color: theme.palette.text.disabled,
	},
	"& img": {
		maxWidth: "min(60%, 320px)",
		width: "min(60%, 320px)",
		borderRadius: theme.shape.borderRadius,
		boxShadow: `${alpha(theme.palette.common.black, 0.08)} 0 4px 16px`,
		margin: theme.spacing(0.75, 0),
		cursor: "zoom-in",
	},
}));

const preventEmptyHtml = (html: string): string => {
	if (!html) return "";
	if (html === "<br>" || html === "<div><br></div>") return "";
	return html;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(file);
	});

const insertNodeAtSelection = (node: Node) => {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return;
	}
	const range = selection.getRangeAt(0);
	range.deleteContents();
	range.insertNode(node);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
};

const insertHtmlAtCursor = (html: string) => {
	const temp = document.createElement("div");
	temp.innerHTML = html;
	const fragment = document.createDocumentFragment();
	while (temp.firstChild) {
		fragment.appendChild(temp.firstChild);
	}
	insertNodeAtSelection(fragment);
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
	value,
	onChange,
	placeholder,
	label,
	minHeight = 140,
	maxHeight,
	disabled,
	helperText,
}) => {
	const editorRef = useRef<HTMLDivElement | null>(null);
	const [previewSrc, setPreviewSrc] = useState<string | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const sanitizedValue = useMemo(
		() => sanitizeRichText(value ?? ""),
		[value],
	);

	useEffect(() => {
		const element = editorRef.current;
		if (!element) return;
		const currentHtml = preventEmptyHtml(element.innerHTML);
		if (sanitizedValue !== currentHtml) {
			element.innerHTML = sanitizedValue || "";
		}
	}, [sanitizedValue]);

	const emitChange = useCallback(() => {
		const element = editorRef.current;
		if (!element) return;
		const html = preventEmptyHtml(element.innerHTML);
		const sanitized = sanitizeRichText(html);
		if (sanitized !== sanitizedValue) {
			onChange(sanitized);
		}
	}, [onChange, sanitizedValue]);

	const handleInput = useCallback(() => {
		if (disabled) return;
		emitChange();
	}, [disabled, emitChange]);

	const handlePaste = useCallback(
		async (event: React.ClipboardEvent<HTMLDivElement>) => {
			if (disabled) return;
			const clipboardData = event.clipboardData;
			if (!clipboardData) return;

			const items = Array.from(clipboardData.items);
			const imageItems = items.filter((item) =>
				item.type.startsWith("image/"),
			);

			if (imageItems.length === 0) {
				return;
			}

			event.preventDefault();

			for (const item of imageItems) {
				const file = item.getAsFile();
				if (file) {
					try {
						const dataUrl = await readFileAsDataUrl(file);
						insertHtmlAtCursor(
							`<img src="${dataUrl}" alt="pasted" style="max-width:min(60%,320px);width:min(60%,320px);border-radius:8px;cursor:zoom-in;" />`,
						);
					} catch (error) {
						console.warn("Failed to read pasted image", error);
					}
				}
			}

			const text = clipboardData.getData("text/plain");
			if (text) {
				insertHtmlAtCursor(
					text
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/\n/g, "<br />"),
				);
			}

			emitChange();
		},
		[disabled, emitChange],
	);

	const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
		if (disabled) return;
		event.preventDefault();
	}, [disabled]);

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
		<Box>
			{label && (
				<Typography
					variant="subtitle2"
					sx={{ mb: 0.5, fontWeight: 600, color: "text.secondary" }}
				>
					{label}
				</Typography>
			)}
			<EditorContainer
				className={disabled ? "RichTextEditor-disabled" : undefined}
				sx={{
					minHeight,
					maxHeight,
					overflowY: maxHeight ? "auto" : "visible",
				}}
			>
				<ContentEditable
					ref={editorRef}
					contentEditable={!disabled}
					data-placeholder={placeholder ?? "请输入内容..."}
					onInput={handleInput}
					onBlur={handleInput}
					onPaste={handlePaste}
					onDrop={handleDrop}
					onClick={handleClick}
					suppressContentEditableWarning
				/>
			</EditorContainer>
			{helperText && (
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ display: "block", mt: 0.5 }}
				>
					{helperText}
				</Typography>
			)}
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

export default RichTextEditor;
