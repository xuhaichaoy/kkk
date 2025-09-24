import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  gradient?: boolean;
  align?: 'left' | 'center' | 'right';
}

const HeaderContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  transition: 'all 0.3s ease',
}));

const GradientTitle = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}));

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
  gradient = false,
  align = 'left'
}) => {
  const getAlignmentStyles = () => {
    switch (align) {
      case 'center':
        return { textAlign: 'center' as const };
      case 'right':
        return { textAlign: 'right' as const };
      default:
        return { textAlign: { xs: 'center', md: 'left' } as const };
    }
  };

  const TitleComponent = gradient ? GradientTitle : Typography;

  return (
    <HeaderContainer sx={getAlignmentStyles()}>
      <Box sx={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'space-between',
        flexDirection: { xs: 'column', md: align === 'center' ? 'column' : 'row' },
        gap: 2
      }}>
        <Box sx={{ flex: 1, ...getAlignmentStyles() }}>
          <TitleComponent 
            variant="h4" 
            sx={{ 
              mb: subtitle ? 1 : 0,
              fontWeight: 600,
              fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' }
            }}
          >
            {title}
          </TitleComponent>
          {subtitle && (
            <Typography 
              color="text.secondary"
              sx={{
                maxWidth: '600px',
                mx: align === 'center' ? 'auto' : align === 'right' ? 'auto' : { xs: 'auto', md: 0 },
                fontSize: '1.1rem',
                lineHeight: 1.5
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && (
          <Box sx={{ 
            flexShrink: 0,
            width: { xs: '100%', md: 'auto' },
            display: 'flex',
            justifyContent: { xs: 'center', md: 'flex-end' }
          }}>
            {action}
          </Box>
        )}
      </Box>
    </HeaderContainer>
  );
};

export default PageHeader;
