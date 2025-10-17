import { Box, Stack, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import React from "react";
import TodoTimeSummaryPanel from "../components/todo/TodoTimeSummaryPanel";
import { todosAtom } from "../stores/todoStore";

const TimeInvestPage: FC = () => {
	const todos = useAtomValue(todosAtom);

	return (
		<Box sx={{ pb: 4, px: { xs: 2, sm: 3, md: 4 } }}>
			<Stack spacing={3}>
				<Box sx={{ pt: 2 }}>
					<Stack
						direction="row"
						justifyContent="space-between"
						alignItems="center"
						spacing={2}
						sx={{ mb: 2 }}
					>
						<Typography
							variant="h4"
							fontWeight={700}
							sx={{ letterSpacing: "-0.02em" }}
						>
							⏱️ 时间投入概览
						</Typography>
					</Stack>
				</Box>

				<Box sx={{ width: "100%" }}>
					<TodoTimeSummaryPanel tasks={todos} />
				</Box>
			</Stack>
		</Box>
	);
};

export default TimeInvestPage;

