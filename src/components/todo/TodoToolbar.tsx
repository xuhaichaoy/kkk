import React from 'react';
import { Box, Button, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';

interface TodoToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAddTask: () => void;
  onToggleFilters: () => void;
  filtersVisible: boolean;
  onOpenWidget?: () => void;
}

const TodoToolbar: React.FC<TodoToolbarProps> = ({
  search,
  onSearchChange,
  onAddTask,
  onToggleFilters,
  filtersVisible,
  onOpenWidget,
}) => {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', md: 'center' }}
      justifyContent="space-between"
    >
      <TextField
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="搜索任务或备注"
        size="small"
        fullWidth
      />
      <Stack direction="row" spacing={1.5} alignItems="center">
        {onOpenWidget && (
          <Tooltip title="打开桌面小组件" arrow>
            <IconButton color="primary" onClick={onOpenWidget} size="small">
              <ViewCompactIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={filtersVisible ? '隐藏筛选器' : '显示筛选器'} arrow>
          <IconButton color={filtersVisible ? 'primary' : 'default'} onClick={onToggleFilters} size="small">
            <FilterAltIcon />
          </IconButton>
        </Tooltip>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddTask}
            size="small"
          >
            新建任务
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};

export default TodoToolbar;
