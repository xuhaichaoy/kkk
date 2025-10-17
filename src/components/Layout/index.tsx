import React from 'react';
import { Avatar, Box, Container, IconButton, Stack, Tooltip, useTheme } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { Link, useRouterState } from '@tanstack/react-router';
import ChecklistRtlOutlinedIcon from '@mui/icons-material/ChecklistRtlOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';

interface LayoutProps {
  children: React.ReactNode;
}

const StyledMain = styled('main')(({ theme }) => ({
  flexGrow: 1,
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const Sidebar = styled(Box)(({ theme }) => ({
  width: 72,
  minHeight: '100vh',
  paddingLeft: theme.spacing(1.5),
  paddingRight: theme.spacing(1.5),
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(4),
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const NavIconButton = styled(IconButton, {
  shouldForwardProp: prop => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  width: 44,
  height: 44,
  borderRadius: 14,
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  backgroundColor: active
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  transition: theme.transitions.create(['background-color', 'color'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    backgroundColor: active
      ? alpha(theme.palette.primary.main, 0.2)
      : alpha(theme.palette.primary.main, 0.08),
  },
}));

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const routerState = useRouterState();

  const tabs = React.useMemo(
    () => [
      { label: '任务面板', value: '/' as const, icon: ChecklistRtlOutlinedIcon },
      { label: '任务日历', value: '/calendar' as const, icon: CalendarMonthOutlinedIcon },
      { label: '时间投入概览', value: '/timeinvest' as const, icon: AccessTimeIcon },
      { label: 'Excel 工具', value: '/excel' as const, icon: GridOnOutlinedIcon },
      { label: '语音识别', value: '/speech' as const, icon: GraphicEqOutlinedIcon },
    ],
    [],
  );

  const currentPath = routerState.location.pathname;
  const currentTab = React.useMemo(() => {
    const normalizedPath = currentPath.startsWith('/todo') ? '/' : currentPath;
    const exact = tabs.find(tab => tab.value === normalizedPath);
    if (exact) {
      return exact.value;
    }
    const partial = tabs
      .filter(tab => tab.value !== '/' && normalizedPath.startsWith(tab.value))
      .sort((a, b) => b.value.length - a.value.length)[0];
    return partial?.value ?? '/';
  }, [currentPath, tabs]);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Sidebar component="nav">
        <Avatar
          sx={{
            width: 48,
            height: 48,
            borderRadius: '22%',
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
            color: theme.palette.primary.main,
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          B
        </Avatar>
        <Stack spacing={1.5} sx={{ flexGrow: 1, alignItems: 'center' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = currentTab === tab.value;
            return (
              <Tooltip key={tab.value} title={tab.label} placement="right">
                <NavIconButton
                  active={active}
                  component={Link}
                  to={tab.value}
                  size="large"
                >
                  <Icon sx={{ fontSize: 26 }} />
                </NavIconButton>
              </Tooltip>
            );
          })}
        </Stack>
      </Sidebar>
      <StyledMain sx={{ width: 'calc(100% - 67px)' }}>
        <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          {children}
        </Box>
      </StyledMain>
    </Box>
  );
};

export default Layout;
