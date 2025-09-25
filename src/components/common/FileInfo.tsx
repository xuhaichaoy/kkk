import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { formatFileSize, formatFileType, formatLastModified } from '../../utils/commonUtils';

interface FileInfoProps {
  file: File;
  showSize?: boolean;
  showType?: boolean;
  showLastModified?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

const FileInfoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.action.hover,
  transition: 'all 0.2s ease',
  maxWidth: '100%',
}));

const FileInfo: React.FC<FileInfoProps> = ({
  file,
  showSize = true,
  showType = false,
  showLastModified = false,
  variant = 'default'
}) => {

  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography 
          variant="subtitle2" 
          color="primary"
          sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          文件：
        </Typography>
        <Typography 
          noWrap 
          title={file.name}
          sx={{ 
            fontWeight: 500,
            fontSize: '0.95rem',
            flex: 1,
            minWidth: 0
          }}
        >
          {file.name}
        </Typography>
        {showSize && (
          <Chip 
            label={formatFileSize(file.size)}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        )}
      </Box>
    );
  }

  if (variant === 'detailed') {
    return (
      <FileInfoContainer>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontWeight: 600,
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {file.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {showSize && (
              <Chip 
                label={`大小: ${formatFileSize(file.size)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            )}
            {showType && (
              <Chip 
                label={`类型: ${formatFileType(file.name)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            )}
            {showLastModified && (
              <Chip 
                label={`修改: ${formatLastModified(file.lastModified)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            )}
          </Box>
        </Box>
      </FileInfoContainer>
    );
  }

  // default variant
  return (
    <FileInfoContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        <Typography 
          variant="subtitle2" 
          color="primary"
          sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          当前文件：
        </Typography>
        <Typography 
          noWrap 
          title={file.name}
          sx={{ 
            fontWeight: 500,
            fontSize: '0.95rem',
            flex: 1,
            minWidth: 0
          }}
        >
          {file.name}
        </Typography>
        {showSize && (
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              whiteSpace: 'nowrap',
              bgcolor: 'background.paper',
              px: 1,
              py: 0.5,
              borderRadius: 0.5,
              fontSize: '0.75rem'
            }}
          >
            {formatFileSize(file.size)}
          </Typography>
        )}
      </Box>
    </FileInfoContainer>
  );
};

export default FileInfo;
