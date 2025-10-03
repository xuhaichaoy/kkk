import React, { useMemo } from 'react';
import { addDays, format, startOfDay, subDays } from 'date-fns';
import { Card, CardContent, Typography } from '@mui/material';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  Area,
  Bar,
} from 'recharts';
import { TodoTask } from '../../stores/todoStore';

interface ProductivityChartProps {
  tasks: TodoTask[];
}

const DAYS = 14;

const ProductivityChart: React.FC<ProductivityChartProps> = ({ tasks }) => {
  const data = useMemo(() => {
    const today = startOfDay(new Date());
    const start = subDays(today, DAYS - 1);
    const bucket = new Map<string, { date: Date; created: number; completed: number }>();

    for (let i = 0; i < DAYS; i++) {
      const day = addDays(start, i);
      const key = format(day, 'yyyy-MM-dd');
      bucket.set(key, { date: day, created: 0, completed: 0 });
    }

    tasks.forEach(task => {
      const createdKey = format(startOfDay(new Date(task.createdAt)), 'yyyy-MM-dd');
      const createdBucket = bucket.get(createdKey);
      if (createdBucket) {
        createdBucket.created += 1;
      }

      if (task.completedAt) {
        const completedKey = format(startOfDay(new Date(task.completedAt)), 'yyyy-MM-dd');
        const completedBucket = bucket.get(completedKey);
        if (completedBucket) {
          completedBucket.completed += 1;
        }
      }
    });

    return Array.from(bucket.values()).map(entry => ({
      label: format(entry.date, 'MM-dd'),
      created: entry.created,
      completed: entry.completed,
    }));
  }, [tasks]);

  return (
    <Card variant="outlined" sx={{ height: 320 }}>
      <CardContent sx={{ height: '100%' }}>
        <Typography variant="subtitle1" gutterBottom>
          近两周生产力曲线
        </Typography>
        <ResponsiveContainer width="100%" height="90%">
          <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <ChartTooltip formatter={(value: number) => `${value} 项`} />
            <Legend />
            <Area type="monotone" dataKey="completed" name="完成" fill="#4caf5033" stroke="#4caf50" />
            <Bar dataKey="created" name="新增" fill="#2196f3" barSize={18} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ProductivityChart;
