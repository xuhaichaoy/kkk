import React from 'react';
import { Paper, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

interface CardContainerProps {
  children: React.ReactNode;
  elevation?: number;
  padding?: number;
  minHeight?: string | number;
  maxWidth?: string | number;
  fullWidth?: boolean;
  variant?: 'default' | 'outlined' | 'elevated';
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(2),
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4],
  },
}));

const CardContainer: React.FC<CardContainerProps> = ({
  children,
  elevation = 2,
  padding = 3,
  minHeight,
  maxWidth,
  fullWidth = false,
  variant = 'default'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return { 
          elevation: 0,
          border: theme => `1px solid ${theme.palette.divider}`,
          '&:hover': {
            borderColor: theme => theme.palette.primary.main,
          }
        };
      case 'elevated':
        return { 
          elevation: 4,
          '&:hover': {
            elevation: 8,
          }
        };
      default:
        return { elevation };
    }
  };

  return (
    <StyledPaper
      elevation={variant === 'outlined' ? 0 : elevation}
      sx={{
        p: padding,
        minHeight,
        maxWidth: fullWidth ? '100%' : maxWidth,
        width: fullWidth ? '100%' : 'auto',
        ...getVariantStyles(),
      }}
    >
      <Box sx={{ height: '100%' }}>
        {children}
      </Box>
    </StyledPaper>
  );
};

export default CardContainer;
