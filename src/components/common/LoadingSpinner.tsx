import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = '正在处理...', 
  size = 'medium' 
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { maxWidth: 120, fontSize: '0.8rem' };
      case 'large':
        return { maxWidth: 300, fontSize: '1rem' };
      default:
        return { maxWidth: 200, fontSize: '0.875rem' };
    }
  };

  return (
    <Box sx={{ 
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      px: 3,
      py: 2,
      bgcolor: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(4px)',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }}>
      <Box sx={{ flex: 1, ...getSizeStyles() }}>
        <LinearProgress 
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
            }
          }}
        />
      </Box>
      <Typography 
        sx={{ 
          fontSize: getSizeStyles().fontSize,
          color: 'text.secondary',
          fontWeight: 500
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingSpinner;
