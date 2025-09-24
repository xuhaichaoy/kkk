import React, { useCallback, useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  IconButton,
  Tooltip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { LoadingSpinner, ErrorAlert, DataTable, CustomTabs, TabItem } from '../common';

interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
}

interface ExcelViewerProps {
  file: File | null;
}


const ExcelViewer: React.FC<ExcelViewerProps> = ({ file }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // 删除选中的行
  const handleDeleteRows = useCallback(() => {
    if (selectedRows.length === 0) return;

    const newData = [...sheets];
    const currentSheetData = [...newData[currentSheet].data];
    
    // 按照索引从大到小排序，这样删除时不会影响其他行的索引
    const sortedIndexes = selectedRows.sort((a, b) => b - a);
    
    // 删除选中的行（跳过表头）
    sortedIndexes.forEach(rowIndex => {
      currentSheetData.splice(rowIndex + 1, 1);
    });

    newData[currentSheet].data = currentSheetData;
    newData[currentSheet].totalRows = currentSheetData.length - 1; // 减去表头

    setSheets(newData);
    setSelectedRows([]);
  }, [selectedRows, sheets, currentSheet]);

  // 添加新行
  const handleAddRow = useCallback(() => {
    const newData = [...sheets];
    const currentSheetData = [...newData[currentSheet].data];
    const columnCount = currentSheetData[0].length;
    
    // 创建一个空行，列数与当前表格相同
    const newRow = new Array(columnCount).fill('');
    
    // 在表格数据中添加新行（在表头之后）
    currentSheetData.push(newRow);

    newData[currentSheet].data = currentSheetData;
    newData[currentSheet].totalRows = currentSheetData.length - 1; // 减去表头

    setSheets(newData);
  }, [sheets, currentSheet]);

  // 从本地存储加载编辑数据
  const loadEditedData = useCallback((fileId: string) => {
    try {
      const savedData = localStorage.getItem(`excel_edits_${fileId}`);
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (err) {
      console.error('加载编辑数据失败:', err);
    }
    return {};
  }, []);

  // 保存编辑数据到本地存储
  const saveEditedData = useCallback((fileId: string, data: any) => {
    try {
      localStorage.setItem(`excel_edits_${fileId}`, JSON.stringify(data));
    } catch (err) {
      console.error('保存编辑数据失败:', err);
    }
  }, []);

  // 生成文件唯一标识
  const getFileId = useCallback((file: File | null) => {
    if (!file) return '';
    return `${file.name}_${file.size}_${file.lastModified}`;
  }, []);

  // 初始化编辑数据，从本地存储加载
  const [editedRows, setEditedRows] = useState<{ [key: string]: { [key: string]: any } }>(() => {
    return loadEditedData(getFileId(file));
  });

  const processExcel = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), {
        type: 'module'
      });

      const buffer = await file.arrayBuffer();

      worker.postMessage({
        type: 'PARSE_EXCEL',
        file: buffer
      });

      worker.onmessage = (e) => {
        console.log('Worker message received:', e.data);
        if (e.data.type === 'SUCCESS') {
          console.log('Excel data parsed successfully:', e.data.data);
          // Worker返回的是 { sheets: [], workbook: {} } 结构
          setSheets(e.data.data.sheets || e.data.data);
        } else if (e.data.type === 'ERROR') {
          console.error('Excel parsing error:', e.data.error);
          setError(e.data.error);
        }
        setLoading(false);
        worker.terminate();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理Excel文件时出错');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (file) {
      processExcel(file);
    }
  }, [file, processExcel]);

  const handleSheetChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentSheet(newValue);
  };

  const formatCellValue = (value: any): string => {
    if (value instanceof Date) {
      return value.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
    return value?.toString() || '';
  };

  if (loading) {
    return <LoadingSpinner message="正在处理Excel文件..." />;
  }

  if (error) {
    return <ErrorAlert error={error} title="错误" />;
  }

  if (!sheets.length) {
    console.log('No sheets available, sheets:', sheets);
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          没有找到Excel数据
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          请检查文件格式是否正确
        </Typography>
      </Box>
    );
  }

  console.log('Rendering Excel viewer with sheets:', sheets);

  // 准备标签页数据
  const tabs: TabItem[] = sheets.map((sheet, index) => {
    console.log(`Processing sheet ${index}:`, sheet.name, 'data length:', sheet.data.length);
    
    // 确保有数据行
    const dataRows = sheet.data.length > 1 ? sheet.data.slice(1) : [];
    const headers = sheet.data[0] || [];
    
    console.log(`Sheet ${index} - Headers:`, headers, 'Data rows:', dataRows.length);
    
    return {
      label: sheet.name,
      badge: `${sheet.totalRows}行`,
      content: (
        <DataTable
          rows={dataRows.map((row: any[], rowIndex: number) => {
            const sheetId = `${index}_${rowIndex}`;
            const editedRowData = editedRows[sheetId] || {};
            
            return {
              id: rowIndex,
              ...row.reduce((acc, cell, i) => ({ 
                ...acc, 
                [String(i)]: editedRowData[String(i)] || formatCellValue(cell)
              }), {}),
            };
          })}
          columns={headers.map((header: string, colIndex: number) => ({
          field: String(colIndex),
          headerName: header || `列 ${colIndex + 1}`,
          minWidth: 120,
          maxWidth: 300,
          width: 180,
          sortable: true,
          filterable: true,
          editable: true,
          headerAlign: 'center',
          align: 'center',
          renderHeader: (params) => (
            <Tooltip title={params.colDef.headerName} arrow>
              <Box sx={{ 
                width: '100%', 
                textAlign: 'center',
                fontWeight: 600,
                whiteSpace: 'normal',
                lineHeight: 1.4,
                py: 1,
                maxHeight: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical'
              }}>
                {params.colDef.headerName}
              </Box>
            </Tooltip>
          ),
          renderCell: (params) => {
            const value = params.value?.toString() || '';
            return (
              <Tooltip 
                title={value} 
                arrow
                placement="top"
                enterDelay={100}
              >
                <Box sx={{ 
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: theme => value.length > 50 ? theme.palette.primary.main : 'inherit',
                  '&:hover': {
                    color: theme => value.length > 50 ? theme.palette.primary.dark : 'inherit',
                  }
                }}>
                  {value}
                </Box>
              </Tooltip>
            );
          },
          }))}
          enableSelection={true}
          enableAdd={true}
          enableDelete={true}
          enableExport={true}
          onAdd={handleAddRow}
          onDelete={handleDeleteRows}
          onExport={() => {/* TODO: 实现导出功能 */}}
          onRowUpdate={(updatedRow, originalRow) => {
            const sheetId = `${index}_${updatedRow.id}`;
                  const changedField = Object.keys(updatedRow).find(
                    key => updatedRow[key] !== originalRow[key]
                  );
                  
                  if (changedField) {
                    setEditedRows(prev => {
                      const newData = {
                        ...prev,
                        [sheetId]: {
                          ...(prev[sheetId] || {}),
                          [changedField]: updatedRow[changedField],
                        },
                      };
                      saveEditedData(getFileId(file), newData);
                      return newData;
                    });
                  }
                  return updatedRow;
                }}
          height="70vh"
        />
      )
    };
  });

  return (
    <Box sx={{ width: '100%', height: '100%', pt: 1 }}>
      <CustomTabs
        tabs={tabs}
        value={currentSheet}
        onChange={handleSheetChange}
        actions={
          <Tooltip 
            title="导出" 
            arrow
                sx={{
              '& .MuiTooltip-arrow': {
                color: 'grey.900',
              },
              '& .MuiTooltip-tooltip': {
                backgroundColor: 'grey.900',
                fontSize: '0.8rem',
                py: 0.5,
                px: 1,
                    borderRadius: 1,
              },
            }}
          >
            <IconButton
              sx={{
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        }
      />
    </Box>
  );
};

export default ExcelViewer;