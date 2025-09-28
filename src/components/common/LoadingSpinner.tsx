import React from 'react';
import { Box, LinearProgress, Typography, CircularProgress } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const sizeStyles: Record<'small' | 'medium' | 'large', {
  cardWidth: number;
  fontSize: string;
  spinnerSize: number;
  minHeight: number;
}> = {
  small: {
    cardWidth: 240,
    fontSize: '0.85rem',
    spinnerSize: 30,
    minHeight: 160
  },
  medium: {
    cardWidth: 280,
    fontSize: '0.95rem',
    spinnerSize: 36,
    minHeight: 220
  },
  large: {
    cardWidth: 320,
    fontSize: '1rem',
    spinnerSize: 44,
    minHeight: 260
  }
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '正在处理...',
  size = 'medium'
}) => {
  const styles = sizeStyles[size];

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: styles.minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, md: 4 },
        py: { xs: 4, md: 6 },
        position: 'relative',
        background: theme => `linear-gradient(135deg, ${theme.palette.background.default}, ${theme.palette.action.hover})`,
        borderRadius: 3
      }}
    >
      <Box
        sx={{
          width: styles.cardWidth,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 4 },
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)'
        }}
      >
        <CircularProgress size={styles.spinnerSize} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography
          sx={{
            fontSize: styles.fontSize,
            color: 'text.primary',
            fontWeight: 600,
            textAlign: 'center'
          }}
        >
          {message}
        </Typography>
        <LinearProgress
          sx={{
            width: '100%',
            height: 4,
            borderRadius: 999,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 999
            }
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            opacity: 0.8
          }}
        >
          正在读取并解析 Excel 数据，请稍候...
        </Typography>
      </Box>
    </Box>
  );
};

export default LoadingSpinner;
