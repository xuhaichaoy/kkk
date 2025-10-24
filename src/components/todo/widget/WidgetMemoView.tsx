import { TextField } from "@mui/material";
import React, { type FC } from "react";

interface WidgetMemoViewProps {
	value: string;
	onChange: (value: string) => void;
}

const WidgetMemoView: FC<WidgetMemoViewProps> = ({ value, onChange }) => (
	<TextField
		value={value}
		onChange={(event) => onChange(event.target.value)}
		placeholder="写下你的便签..."
		fullWidth
		multiline
		minRows={12}
		sx={{
			flex: 1,
			textarea: { lineHeight: 1.6 },
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
	/>
);

export default WidgetMemoView;
