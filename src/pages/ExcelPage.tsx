import React, { useState } from 'react';
import { Box } from '@mui/material';
import FileUpload from '../components/FileUpload';
import ExcelViewer from '../components/ExcelViewer';
import { PageHeader, CardContainer, FileInfo } from '../components/common';
import { getFileId } from '../utils/excelUtils';

const ExcelPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(prev => {
      const existingIds = new Set(prev.map(file => getFileId(file)));
      const deduped = files.filter(file => !existingIds.has(getFileId(file)));
      if (deduped.length === 0) {
        return prev;
      }
      return [...prev, ...deduped];
    });
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
          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {selectedFiles.map((file, index) => (
                <FileInfo key={getFileId(file) || index} file={file} variant="detailed" showLastModified showType />
              ))}
            </Box>
          )}
        </CardContainer>

        {selectedFiles.length > 0 && (
          <Box 
            sx={{
              mt: 3,
              opacity: selectedFiles.length > 0 ? 1 : 0,
            }}
          >
            <CardContainer minHeight="500px">
              <ExcelViewer files={selectedFiles} />
            </CardContainer>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ExcelPage;
