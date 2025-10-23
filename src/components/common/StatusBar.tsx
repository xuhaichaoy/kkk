import React from 'react';
import {
  Box,
  IconButton,
 LinearProgress,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';

export type StatusSeverity = 'info' | 'success' | 'warning' | 'error';

export interface StatusPayload {
  message: string;
  detail?: string;
  severity?: StatusSeverity;
  progress?: number | null;
}

interface StatusBarContextValue {
  status: StatusPayload | null;
  setStatus: React.Dispatch<React.SetStateAction<StatusPayload | null>>;
  resetStatus: () => void;
}

const StatusBarContext = React.createContext<StatusBarContextValue | undefined>(undefined);

export const StatusBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = React.useState<StatusPayload | null>(null);

  const resetStatus = React.useCallback(() => {
    setStatus(null);
  }, []);

  const value = React.useMemo<StatusBarContextValue>(
    () => ({
      status,
      setStatus,
      resetStatus,
    }),
    [status, resetStatus],
  );

  return (
    <StatusBarContext.Provider value={value}>
      {children}
      <StatusBarOverlay />
    </StatusBarContext.Provider>
  );
};

export const useStatusBar = (): StatusBarContextValue => {
  const context = React.useContext(StatusBarContext);
  if (!context) {
    throw new Error('useStatusBar must be used within a StatusBarProvider');
  }
  return context;
};

const severityIconMap: Record<StatusSeverity, React.ReactNode> = {
  info: <InfoOutlinedIcon fontSize="small" />,
  success: <CheckCircleOutlineIcon fontSize="small" />,
  warning: <WarningAmberOutlinedIcon fontSize="small" />,
  error: <ErrorOutlineOutlinedIcon fontSize="small" />,
};

const StatusBarOverlay: React.FC = () => {
  const context = React.useContext(StatusBarContext);
  const theme = useTheme();

  if (!context || !context.status) {
    return null;
  }

  const { status, setStatus, resetStatus } = context;
  const severity = status.severity ?? 'info';
  const icon = severityIconMap[severity];

  const borderColor = {
    info: theme.palette.info.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  }[severity];

  const progress =
    typeof status.progress === 'number' && Number.isFinite(status.progress)
      ? Math.min(100, Math.max(0, status.progress))
      : null;

  const handleClose = () => {
    setStatus(null);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: theme.zIndex.tooltip + 1,
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={6}
        sx={{
          minWidth: 260,
          maxWidth: 340,
          borderRadius: 3,
          overflow: 'hidden',
          pointerEvents: 'auto',
          borderLeft: `4px solid ${borderColor}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ p: 2 }}>
          <Box sx={{ color: borderColor, display: 'flex', alignItems: 'center', mt: 0.3 }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              color="text.primary"
              sx={{ lineHeight: 1.5 }}
            >
              {status.message}
            </Typography>
            {status.detail ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                {status.detail}
              </Typography>
            ) : null}
          </Box>
          <IconButton
            size="small"
            edge="end"
            onClick={handleClose}
            sx={{ color: theme.palette.text.secondary }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        {progress !== null ? (
          <LinearProgress variant="determinate" value={progress} sx={{ height: 4 }} />
        ) : null}
      </Paper>
    </Box>
  );
};
