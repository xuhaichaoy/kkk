import React, { useCallback, useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Tooltip
} from '@mui/material';
import { LoadingSpinner, ErrorAlert, DataTable, CustomTabs, TabItem, SplitTableDialog, MergeSheetsDialog, CompareSheetsDialog, ExportSheetsDialog } from '../common';
import { 
  SheetData, 
  EditedRowData,
  getFileId,
  loadEditedData,
  saveEditedData,
  formatCellValue,
  splitTableByColumn,
  exportToCSV,
  mergeSheets,
  exportToExcel,
  ExportOptions
} from '../../utils/excelUtils';

interface ExcelViewerProps {
  file: File | null;
}


const ExcelViewer: React.FC<ExcelViewerProps> = ({ file }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // 初始化编辑数据，从本地存储加载
  const [editedRows, setEditedRows] = useState<EditedRowData>(() => {
    return loadEditedData(getFileId(file));
  });

  // 删除选中的行
  const handleDeleteRows = useCallback((selectedRowIndexes: number[]) => {
    if (selectedRowIndexes.length === 0) return;

    const newData = [...sheets];
    const currentSheetData = [...newData[currentSheet].data];
    
    // 按照索引从大到小排序，这样删除时不会影响其他行的索引
    const sortedIndexes = selectedRowIndexes.sort((a, b) => b - a);
    
    // 删除选中的行（跳过表头）
    sortedIndexes.forEach(rowIndex => {
      currentSheetData.splice(rowIndex + 1, 1);
    });

    newData[currentSheet].data = currentSheetData;
    newData[currentSheet].totalRows = currentSheetData.length - 1; // 减去表头

    setSheets(newData);

    // 更新编辑数据，删除被删除行的编辑记录
    setEditedRows(prev => {
      const newEditedRows = { ...prev };
      const fileId = getFileId(file);
      
      // 删除被删除行的编辑数据
      sortedIndexes.forEach(rowIndex => {
        const sheetId = `${currentSheet}_${rowIndex}`;
        delete newEditedRows[sheetId];
      });
      
      // 重新调整后续行的编辑数据索引
      Object.keys(newEditedRows).forEach(sheetId => {
        const [sheetIndex, rowIndex] = sheetId.split('_').map(Number);
        if (sheetIndex === currentSheet) {
          // 计算删除后该行的新索引
          let newRowIndex = rowIndex;
          sortedIndexes.forEach(deletedIndex => {
            if (rowIndex > deletedIndex) {
              newRowIndex--;
            }
          });
          
          // 如果索引发生变化，更新编辑数据
          if (newRowIndex !== rowIndex) {
            const newSheetId = `${currentSheet}_${newRowIndex}`;
            newEditedRows[newSheetId] = newEditedRows[sheetId];
            delete newEditedRows[sheetId];
          }
        }
      });
      
      // 保存更新后的编辑数据到本地存储
      saveEditedData(fileId, newEditedRows);
      return newEditedRows;
    });
  }, [sheets, currentSheet, file, getFileId, saveEditedData]);

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

  // 拆分表格功能
  const handleSplitTable = useCallback(() => {
    setSplitDialogOpen(true);
  }, []);

  const handleCloseSplitDialog = useCallback(() => {
    setSplitDialogOpen(false);
  }, []);

  const handleConfirmSplit = useCallback((columnField: string) => {
    const currentSheetData = sheets[currentSheet];
    if (!currentSheetData) return;

    const columnIndex = parseInt(columnField);
    const newSheets = splitTableByColumn(currentSheetData, columnIndex, currentSheet, editedRows, sheets);
    
    if (newSheets.length === 0) {
      setError('该列没有有效数据用于拆分');
      setSplitDialogOpen(false);
      return;
    }

    setSheets(prev => [...prev, ...newSheets]);
    setSplitDialogOpen(false);
  }, [sheets, currentSheet, editedRows]);

  // 合并表格功能
  const handleMergeSheets = useCallback(() => {
    setMergeDialogOpen(true);
  }, []);

  const handleCloseMergeDialog = useCallback(() => {
    setMergeDialogOpen(false);
  }, []);

  const handleConfirmMerge = useCallback((selectedSheets: SheetData[], mergedSheetName: string) => {
    try {
      const mergedSheet = mergeSheets(selectedSheets, mergedSheetName, sheets);
      setSheets(prev => [...prev, mergedSheet]);
      setMergeDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '合并失败');
    }
  }, [sheets]);

  // 差异对比功能
  const handleCompareSheets = useCallback(() => {
    setCompareDialogOpen(true);
  }, []);

  const handleCloseCompareDialog = useCallback(() => {
    setCompareDialogOpen(false);
  }, []);

  // Excel导出功能
  const handleExportExcel = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleCloseExportDialog = useCallback(() => {
    setExportDialogOpen(false);
  }, []);

  const handleConfirmExport = useCallback(async (selectedSheets: SheetData[], options: ExportOptions) => {
    try {
      await exportToExcel(selectedSheets, options);
      setExportDialogOpen(false);
    } catch (err) {
      console.error('导出Excel失败:', err);
      setError(err instanceof Error ? err.message : '导出失败');
    }
  }, []);

  // 导出功能
  const handleExport = useCallback(() => {
    if (!sheets.length) return;
    const currentSheetData = sheets[currentSheet];
    exportToCSV(currentSheetData);
  }, [sheets, currentSheet]);

  const processExcel = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      // 检查文件格式
      const fileName = file.name.toLowerCase();
      const isNumbersFile = fileName.endsWith('.numbers');
      
      if (isNumbersFile) {
        setError('不支持.numbers文件格式。请将文件导出为Excel格式(.xlsx或.xls)后再上传。');
        setLoading(false);
        return;
      }

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
          const sheets = e.data.data.sheets || e.data.data;
          const workbook = e.data.data.workbook;
          
          // 检查是否有工作表
          if (!sheets || sheets.length === 0) {
            setError('文件解析成功但没有找到工作表数据。请检查文件是否为有效的Excel文件。');
            setLoading(false);
            worker.terminate();
            return;
          }
          
          // 为每个sheet添加原始workbook引用
          const sheetsWithWorkbook = sheets.map((sheet: any) => ({
            ...sheet,
            originalWorkbook: workbook
          }));
          
          setSheets(sheetsWithWorkbook);
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
          可能的原因：
        </Typography>
        <Box component="ul" sx={{ textAlign: 'left', mt: 2, pl: 3 }}>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            文件格式不支持（如.numbers文件）
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            文件损坏或为空
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            文件被密码保护
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          请确保文件是有效的.xlsx或.xls格式
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
          enableSplit={true}
          enableMerge={sheets.length >= 2}
          enableCompare={sheets.length >= 2}
          enableExportExcel={sheets.length > 0}
          onAdd={handleAddRow}
          onDelete={handleDeleteRows}
          onExport={handleExport}
          onSplit={handleSplitTable}
          onMerge={handleMergeSheets}
          onCompare={handleCompareSheets}
          onExportExcel={handleExportExcel}
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
      />
      
      <SplitTableDialog
        open={splitDialogOpen}
        onClose={handleCloseSplitDialog}
        onConfirm={handleConfirmSplit}
        sheetData={sheets[currentSheet] || null}
        currentSheet={currentSheet}
        editedRows={editedRows}
      />
      
      <MergeSheetsDialog
        open={mergeDialogOpen}
        onClose={handleCloseMergeDialog}
        onConfirm={handleConfirmMerge}
        sheets={sheets}
      />
      
      <CompareSheetsDialog
        open={compareDialogOpen}
        onClose={handleCloseCompareDialog}
        sheets={sheets}
        editedRows={editedRows}
      />
      
      <ExportSheetsDialog
        open={exportDialogOpen}
        onClose={handleCloseExportDialog}
        onConfirm={handleConfirmExport}
        sheets={sheets}
      />
    </Box>
  );
};

export default ExcelViewer;