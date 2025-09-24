import React from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface TabItem {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      sx={{ width: '100%', height: '100%' }}
      {...other}
    >
      {value === index && children}
    </Box>
  );
};

const StyledTabs = styled(Tabs)(() => ({
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
  },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontSize: '0.95rem',
    fontWeight: 500,
    minHeight: 48,
    color: 'text.secondary',
    '&.Mui-selected': {
      color: 'primary.main',
      fontWeight: 600,
    },
    '&:hover': {
      color: 'primary.main',
      opacity: 0.8,
    },
  },
}));

interface CustomTabsProps {
  tabs: TabItem[];
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
  variant?: 'standard' | 'scrollable' | 'fullWidth';
  scrollButtons?: 'auto' | false;
  orientation?: 'horizontal' | 'vertical';
  actions?: React.ReactNode;
}

const CustomTabs: React.FC<CustomTabsProps> = ({
  tabs,
  value,
  onChange,
  variant = 'scrollable',
  scrollButtons = 'auto',
  orientation = 'horizontal',
  actions
}) => {
  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2,
        mt: 1,
        pb: 1,
        pt: 1
      }}>
        <StyledTabs 
          value={value} 
          onChange={onChange}
          variant={variant}
          scrollButtons={scrollButtons}
          orientation={orientation}
        >
          {tabs.map((tab, index) => (
            <Tab 
              key={index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography component="span" sx={{ fontWeight: 'inherit' }}>
                    {tab.label}
                  </Typography>
                  {tab.badge && (
                    <Typography 
                      component="span" 
                      sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.8rem',
                        bgcolor: 'action.hover',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontWeight: 500
                      }}
                    >
                      {tab.badge}
                    </Typography>
                  )}
                </Box>
              }
              disabled={tab.disabled}
              id={`tab-${index}`}
            />
          ))}
        </StyledTabs>
        {actions && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {actions}
          </Box>
        )}
      </Box>

      {tabs.map((tab, index) => (
        <TabPanel key={index} value={value} index={index}>
          {tab.content}
        </TabPanel>
      ))}
    </Box>
  );
};

export default CustomTabs;
