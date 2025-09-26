import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useFileUpload } from '../../hooks/useCommon';
interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
}

const UploadBox = styled(Box)(({ theme }) => ({
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
}));

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const {
    isDragOver,
    fileInputRef,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileSelect,
    handleClick
  } = useFileUpload(onFileSelect);

  return (
    <UploadBox
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        opacity: isDragOver ? 0.8 : 1,
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s ease'
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="excel-file-input"
      />
      
      <UploadFileIcon 
        sx={{ 
          fontSize: 64,
          color: 'primary.main',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          marginBottom: 2,
          position: 'relative',
          cursor: 'pointer',
          transform: isDragOver ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.2s ease'
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
            maxWidth: '320px',
            mx: 'auto',
            lineHeight: 1.5
          }}
        >
          支持.xlsx和.xls格式
          <br />
          不支持.numbers格式
          <br />
          拖拽文件到这里或点击选择
          <br />
          可多次上传，新的工作表会追加
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
