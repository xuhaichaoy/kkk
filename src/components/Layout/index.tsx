import React from 'react';
import { AppBar, Box, Container, Tabs, Tab, Toolbar, Typography, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Link, useRouterState } from '@tanstack/react-router';

interface LayoutProps {
  children: React.ReactNode;
}

const StyledMain = styled('main')(({ theme }) => ({
  flexGrow: 1,
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(4),
}));

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const routerState = useRouterState();

  const tabs = React.useMemo(
    () => [
      { label: 'Excel 工具', value: '/' as const },
      { label: '语音识别', value: '/speech' as const },
      { label: '任务面板', value: '/todo' as const },
    ],
    [],
  );

  const currentPath = routerState.location.pathname;
  const currentTab = React.useMemo(() => {
    const exact = tabs.find(tab => tab.value === currentPath);
    if (exact) {
      return exact.value;
    }
    const partial = tabs
      .filter(tab => tab.value !== '/' && currentPath.startsWith(tab.value))
      .sort((a, b) => b.value.length - a.value.length)[0];
    return partial?.value ?? '/';
  }, [currentPath, tabs]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <AppBar 
        position="static" 
        color="default" 
        elevation={0}
        sx={{ 
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: 'background.paper',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ alignItems: 'flex-end', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                  textDecoration: 'none',
                }}
              >
                Blink 助手
              </Typography>
            </Box>
            <Tabs value={currentTab} indicatorColor="primary" textColor="primary" sx={{ alignSelf: 'flex-start' }}>
              {tabs.map(tab => (
                <Tab key={tab.value} label={tab.label} value={tab.value} component={Link} to={tab.value} />
              ))}
            </Tabs>
          </Toolbar>
        </Container>
      </AppBar>
      <StyledMain>
        <Container maxWidth="xl">
          {children}
        </Container>
      </StyledMain>
    </Box>
  );
};

export default Layout;
