import React from 'react';
import { Box, Typography } from '@mui/material';
import FileUpload from '../components/FileUpload';
import ExcelViewer from '../components/ExcelViewer';
import { PageHeader, CardContainer } from '../components/common';
import { useExcelManager } from '../hooks/useExcelManager';

const ExcelPage: React.FC = () => {
  const {
    files,
    allSheets,
    currentSheetIndex,
    currentSheet,
    editedRows,
    addFile,
    removeFile,
    setCurrentSheet,
    updateEditedRows,
    updateAllSheets,
    hasFiles
  } = useExcelManager();

  const handleFileSelect = async (file: File) => {
    await addFile(file);
  };

  const handleCloseFile = (fileId: string) => {
    removeFile(fileId);
  };

  // 获取当前活动文件
  const activeFile = currentSheet ? files.find(f => f.fileId === currentSheet.fileId) : null;

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
        </CardContainer>

        {/* 文件列表 */}
        {hasFiles && (
          <Box sx={{ mt: 3 }}>
            <CardContainer>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  已上传文件 ({files.length})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  点击文件切换查看，点击 ✕ 关闭文件
                </Typography>
              </Box>
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 2,
                alignItems: 'center'
              }}>
                {files.map((fileData) => (
                  <Box
                    key={fileData.fileId}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 2,
                      borderRadius: 2,
                      border: activeFile?.fileId === fileData.fileId ? 2 : 1,
                      borderColor: activeFile?.fileId === fileData.fileId ? 'primary.main' : 'divider',
                      bgcolor: activeFile?.fileId === fileData.fileId ? 'primary.50' : 'background.paper',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: 200,
                      maxWidth: 300,
                      opacity: fileData.loading ? 0.7 : 1,
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50',
                        transform: 'translateY(-2px)',
                        boxShadow: 2
                      }
                    }}
                    onClick={() => {
                      if (!fileData.loading && !fileData.error) {
                        // 切换到该文件的第一个sheet
                        const firstSheetIndex = allSheets.findIndex(sheet => sheet.fileId === fileData.fileId);
                        if (firstSheetIndex !== -1) {
                          setCurrentSheet(firstSheetIndex);
                        }
                      }
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          fontWeight: 600,
                          color: activeFile?.fileId === fileData.fileId ? 'primary.main' : 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {fileData.fileName}
                        {fileData.loading && ' (处理中...)'}
                        {fileData.error && ' (错误)'}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                        {fileData.sheets.length > 0 && ` • ${fileData.sheets.length} 个Sheet`}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        ml: 1,
                        cursor: 'pointer',
                        color: 'text.secondary',
                        p: 0.5,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        '&:hover': {
                          color: 'error.main',
                          bgcolor: 'error.50'
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseFile(fileData.fileId);
                      }}
                    >
                      ✕
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContainer>
          </Box>
        )}

        {/* Excel查看器 */}
        {currentSheet && (
          <Box 
            sx={{
              mt: 3,
              opacity: currentSheet ? 1 : 0
            }}
          >
            <CardContainer minHeight="500px">
              <ExcelViewer 
                allSheets={allSheets}
                currentSheetIndex={currentSheetIndex}
                onSheetChange={setCurrentSheet}
                editedRows={editedRows}
                onUpdateEditedRows={updateEditedRows}
                onUpdateSheets={updateAllSheets}
              />
            </CardContainer>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ExcelPage;