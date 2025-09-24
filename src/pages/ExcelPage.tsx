import React, { useState } from 'react';
import { Box } from '@mui/material';
import FileUpload from '../components/FileUpload';
import ExcelViewer from '../components/ExcelViewer';
import { PageHeader, CardContainer, FileInfo } from '../components/common';

const ExcelPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  return (
    <Box sx={{ 
      maxWidth: '100%',
      margin: '0 auto',
      p: { xs: 2, sm: 3 },
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      <PageHeader
        title="Excel 数据处理"
        subtitle="支持大文件处理，多sheet页面，自动识别表头，支持排序和筛选"
        gradient={true}
      />

      <Box sx={{ position: 'relative' }}>
        <CardContainer>
          <FileUpload onFileSelect={handleFileSelect} />
          {selectedFile && (
            <Box sx={{ mt: 3 }}>
              <FileInfo file={selectedFile} />
            </Box>
          )}
        </CardContainer>

        {selectedFile && (
          <Box 
            sx={{
              mt: 3,
              opacity: selectedFile ? 1 : 0
            }}
          >
            <CardContainer minHeight="500px">
              <ExcelViewer file={selectedFile} />
            </CardContainer>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ExcelPage;