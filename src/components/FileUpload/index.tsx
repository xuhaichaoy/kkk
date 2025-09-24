import React, { useCallback, useRef } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const UploadBox = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.primary.main}`,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  background: theme.palette.background.paper,
  '&:hover': {
    borderColor: theme.palette.primary.dark,
  },
  '&:before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.palette.background.paper,
    opacity: 0.97,
  },
}));

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   file.type === 'application/vnd.ms-excel')) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleClick = (e: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发两次点击
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <UploadBox
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
      sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="excel-file-input"
      />
      
      <UploadFileIcon 
        className="upload-icon"
        sx={{ 
          fontSize: 64, 
          color: 'primary.main',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          mb: 2,
          position: 'relative',
          cursor: 'pointer'
        }} 
      />
      
      <Box 
        sx={{ 
          position: 'relative', 
          cursor: 'pointer'
        }}
        onClick={handleClick}
      >
        <Typography 
          variant="h6" 
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          选择Excel文件
        </Typography>
        <Typography 
          color="text.secondary"
          sx={{
            fontSize: '0.95rem',
            maxWidth: '280px',
            mx: 'auto',
            lineHeight: 1.5
          }}
        >
          支持.xlsx和.xls格式
          <br />
          拖拽文件到这里或点击选择
        </Typography>
      </Box>

      <Button 
        variant="contained" 
        onClick={handleClick}
        sx={{ 
          mt: 3,
          px: 4,
          py: 1,
          position: 'relative',
          borderRadius: 2,
          fontWeight: 600,
          textTransform: 'none',
          fontSize: '1rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        选择文件
      </Button>
    </UploadBox>
  );
};

export default FileUpload;