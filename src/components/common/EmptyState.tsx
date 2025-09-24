import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  height?: string | number;
}

const EmptyStateContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4),
  textAlign: 'center',
  minHeight: '200px',
}));

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  action,
  height = '200px'
}) => {
  return (
    <EmptyStateContainer sx={{ minHeight: height }}>
      {icon && (
        <Box sx={{ mb: 2, color: 'text.secondary' }}>
          {icon}
        </Box>
      )}
      <Typography 
        variant="h6" 
        gutterBottom
        sx={{ 
          fontWeight: 600,
          color: 'text.primary',
          mb: description ? 1 : 2
        }}
      >
        {title}
      </Typography>
      {description && (
        <Typography 
          color="text.secondary"
          sx={{ 
            mb: action ? 2 : 0,
            maxWidth: '400px',
            lineHeight: 1.5
          }}
        >
          {description}
        </Typography>
      )}
      {action && action}
    </EmptyStateContainer>
  );
};

export default EmptyState;
