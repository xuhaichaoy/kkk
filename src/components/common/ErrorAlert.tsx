import React from 'react';
import { Alert, AlertTitle, Collapse, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface ErrorAlertProps {
  error: string | null;
  onClose?: () => void;
  severity?: 'error' | 'warning' | 'info';
  title?: string;
  closable?: boolean;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ 
  error, 
  onClose, 
  severity = 'error',
  title,
  closable = true 
}) => {
  if (!error) return null;

  return (
    <Collapse in={!!error}>
      <Alert 
        severity={severity}
        action={
          closable && onClose ? (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={onClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          ) : undefined
        }
        sx={{ mb: 2 }}
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {error}
      </Alert>
    </Collapse>
  );
};

export default ErrorAlert;
