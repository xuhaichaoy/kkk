/**
 * 公共样式工具
 */
import { Theme } from '@mui/material/styles';

/**
 * 获取响应式样式
 */
export const getResponsiveStyles = (theme: Theme) => ({
  container: {
    maxWidth: '100%',
    margin: '0 auto',
    padding: { xs: 2, sm: 3 },
    minHeight: '100vh',
    backgroundColor: 'background.default'
  },
  card: {
    borderRadius: 2,
    padding: 3,
    backgroundColor: 'background.paper',
    boxShadow: theme.shadows[2],
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: theme.shadows[4]
    }
  },
  button: {
    borderRadius: 2,
    fontWeight: 600,
    textTransform: 'none',
    fontSize: '1rem',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  input: {
    borderRadius: 1,
    backgroundColor: 'background.paper'
  }
});

/**
 * 获取渐变样式
 */
export const getGradientStyles = (theme: Theme) => ({
  primary: {
    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  secondary: {
    background: 'linear-gradient(45deg, #FF6B6B 30%, #FFE66D 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  success: {
    background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  }
});

/**
 * 获取动画样式
 */
export const getAnimationStyles = () => ({
  fadeIn: {
    animation: 'fadeIn 0.3s ease-in-out',
    '@keyframes fadeIn': {
      from: { opacity: 0 },
      to: { opacity: 1 }
    }
  },
  slideUp: {
    animation: 'slideUp 0.3s ease-out',
    '@keyframes slideUp': {
      from: { transform: 'translateY(20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 }
    }
  },
  slideDown: {
    animation: 'slideDown 0.3s ease-out',
    '@keyframes slideDown': {
      from: { transform: 'translateY(-20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 }
    }
  },
  scaleIn: {
    animation: 'scaleIn 0.2s ease-out',
    '@keyframes scaleIn': {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 }
    }
  }
});

/**
 * 获取加载状态样式
 */
export const getLoadingStyles = (theme: Theme) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: theme.spacing(2, 3),
    backgroundColor: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(4px)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  progress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'action.hover',
    '& .MuiLinearProgress-bar': {
      borderRadius: 3
    }
  }
});

/**
 * 获取表格样式
 */
export const getTableStyles = (theme: Theme) => ({
  dataGrid: {
    height: '100%',
    width: '100%',
    '& .MuiDataGrid-root': {
      border: 'none',
      backgroundColor: theme.palette.background.paper,
      '& .MuiDataGrid-cell': {
        borderColor: theme.palette.divider,
        padding: '8px 16px',
        fontSize: '0.875rem',
        '&:focus': { outline: 'none' },
        '&:focus-within': { outline: 'none' }
      },
      '& .MuiDataGrid-columnHeader': {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontWeight: 600,
        fontSize: '0.875rem',
        padding: '12px 16px',
        '&:focus': { outline: 'none' },
        '&:focus-within': { outline: 'none' },
        '& .MuiDataGrid-columnSeparator': {
          color: theme.palette.primary.light
        },
        '& .MuiDataGrid-menuIcon': {
          color: theme.palette.primary.contrastText
        },
        '& .MuiDataGrid-sortIcon': {
          color: theme.palette.primary.contrastText
        }
      },
      '& .MuiDataGrid-row': {
        '&:nth-of-type(even)': {
          backgroundColor: theme.palette.action.hover
        },
        '&:hover': {
          backgroundColor: theme.palette.action.selected
        }
      },
      '& .MuiDataGrid-footerContainer': {
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.default
      }
    }
  },
  toolbar: {
    padding: { sm: 2 },
    display: 'flex',
    gap: 1,
    alignItems: 'center',
    minHeight: '48px',
    backgroundColor: 'background.default',
    borderBottom: 1,
    borderColor: 'divider'
  }
});

/**
 * 获取上传区域样式
 */
export const getUploadStyles = (theme: Theme) => ({
  uploadBox: {
    border: `2px dashed ${theme.palette.primary.main}`,
    padding: theme.spacing(4),
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    background: theme.palette.background.paper,
    borderRadius: 2,
    '&:hover': {
      borderColor: theme.palette.primary.dark
    },
    '&:before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: theme.palette.background.paper,
      opacity: 0.97
    }
  },
  uploadIcon: {
    fontSize: 64,
    color: 'primary.main',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
    marginBottom: 2,
    position: 'relative',
    cursor: 'pointer'
  }
});
