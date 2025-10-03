import React from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { TodoFilterState, TodoPriority, defaultFilterState } from '../../stores/todoStore';

const priorityLabels: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

interface TodoFiltersProps {
  open: boolean;
  value: TodoFilterState;
  onChange: (value: TodoFilterState) => void;
  availableTags: string[];
  availableCategories: string[];
}

const TodoFilters: React.FC<TodoFiltersProps> = ({ open, value, onChange, availableTags, availableCategories }) => {
  const handlePriorityChange = (_: React.MouseEvent<HTMLElement>, newValues: TodoPriority[]) => {
    onChange({ ...value, priorities: newValues ?? [] });
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    onChange({ ...value, status: event.target.value as TodoFilterState['status'] });
  };

  const handleRangeChange = (event: SelectChangeEvent) => {
    const nextRange = event.target.value as TodoFilterState['range'];
    onChange({ ...value, range: nextRange, from: undefined, to: undefined });
  };

  const handleCustomRangeChange = (field: 'from' | 'to', date: string) => {
    onChange({ ...value, [field]: date });
  };

  const handleReset = () => {
    onChange(defaultFilterState);
  };

  return (
    <Collapse in={open} timeout="auto" unmountOnExit>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: 2.5,
          mt: 2,
          backgroundColor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems="flex-start">
          <Stack spacing={2} flex={1}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                状态
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>状态</InputLabel>
                <Select
                  value={value.status}
                  onChange={handleStatusChange}
                  label="状态"
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="active">进行中</MenuItem>
                  <MenuItem value="completed">已完成</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                优先级
              </Typography>
              <ToggleButtonGroup
                value={value.priorities}
                onChange={handlePriorityChange}
                aria-label="优先级筛选器"
                size="small"
              >
                {(['high', 'medium', 'low'] as TodoPriority[]).map(priority => (
                  <ToggleButton key={priority} value={priority} aria-label={priority}>
                    {priorityLabels[priority]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                时间范围
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>范围</InputLabel>
                <Select
                  value={value.range}
                  onChange={handleRangeChange}
                  label="范围"
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="today">今天</MenuItem>
                  <MenuItem value="thisWeek">本周</MenuItem>
                  <MenuItem value="overdue">已逾期</MenuItem>
                  <MenuItem value="custom">自定义</MenuItem>
                </Select>
              </FormControl>
              {value.range === 'custom' && (
                <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
                  <TextField
                    label="起始"
                    type="date"
                    size="small"
                    value={value.from ?? ''}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) => handleCustomRangeChange('from', event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="结束"
                    type="date"
                    size="small"
                    value={value.to ?? ''}
                    InputLabelProps={{ shrink: true }}
                    onChange={(event) => handleCustomRangeChange('to', event.target.value)}
                    fullWidth
                  />
                </Stack>
              )}
            </Box>
          </Stack>

          <Stack spacing={2} flex={1}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                标签
              </Typography>
              <Select
                multiple
                value={value.tags}
                onChange={(event) =>
                  onChange({ ...value, tags: event.target.value as string[] })
                }
                size="small"
                fullWidth
                displayEmpty
                input={<OutlinedInput label="标签" />}
                renderValue={(selected) =>
                  (selected as string[]).length === 0 ? (
                    <Typography color="text.secondary">全部标签</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map(value => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )
                }
              >
                {availableTags.map(tag => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                分类
              </Typography>
              <Select
                multiple
                value={value.categories}
                onChange={(event) =>
                  onChange({ ...value, categories: event.target.value as string[] })
                }
                size="small"
                fullWidth
                displayEmpty
                input={<OutlinedInput label="分类" />}
                renderValue={(selected) =>
                  (selected as string[]).length === 0 ? (
                    <Typography color="text.secondary">全部分类</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map(value => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )
                }
              >
                {availableCategories.map(category => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 'auto' }}>
              <Button onClick={handleReset} size="small">
                重置筛选
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Collapse>
  );
};

export default TodoFilters;
