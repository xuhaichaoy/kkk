import React, { useCallback, useEffect, useState, useRef } from 'react';
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
  ExportOptions,
  generateUniqueSheetName,
  prepareSheetForExport,
  ExportContext
} from '../../utils/excelUtils';

interface ExcelViewerProps {
  files: File[];
}

const STORAGE_KEY = 'excel_multi_upload';

const ExcelViewer: React.FC<ExcelViewerProps> = ({ files }) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [fileBuffers, setFileBuffers] = useState<Record<string, ArrayBuffer>>({});
  const processedFileIdsRef = useRef<Set<string>>(new Set());
  const processingFileIds = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  // 初始化编辑数据，从本地存储加载
  const [editedRows, setEditedRows] = useState<EditedRowData>(() => {
    return loadEditedData(STORAGE_KEY);
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
      saveEditedData(STORAGE_KEY, newEditedRows);
      return newEditedRows;
    });
  }, [sheets, currentSheet]);

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
      const sheetIndexMap = new Map<string, number>();
      sheets.forEach((sheet, index) => {
        sheetIndexMap.set(sheet.name, index);
      });

      const preparedResults = selectedSheets.map(sheet => {
        const sheetIndex = sheetIndexMap.get(sheet.name) ?? -1;
        return prepareSheetForExport(sheet, sheetIndex, editedRows);
      });

      const preparedSheets = preparedResults.map(result => result.sheet);
      const editedCellMap = new Map<string, Set<string>>();
      preparedResults.forEach(result => {
        if (result.editedCells && result.editedCells.size > 0) {
          editedCellMap.set(result.sheet.name, result.editedCells);
        }
      });

      const context: ExportContext = {};
      if (editedCellMap.size > 0) {
        context.editedCellMap = editedCellMap;
      }

      const sourceIds = Array.from(new Set(preparedSheets.map(sheet => sheet.sourceFileId).filter(Boolean))) as string[];
      const singleSourceId = sourceIds.length === 1 ? sourceIds[0] : undefined;
      const originalBuffer = singleSourceId ? fileBuffers[singleSourceId] : undefined;

      await exportToExcel(preparedSheets, { ...options, originalBuffer }, context);
      setExportDialogOpen(false);
    } catch (err) {
      console.error('导出Excel失败:', err);
      setError(err instanceof Error ? err.message : '导出失败');
    }
  }, [sheets, editedRows, fileBuffers]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processExcel = useCallback((file: File): Promise<void> => {
    const fileId = getFileId(file);
    return new Promise(async (resolve, reject) => {
      try {
        const buffer = await file.arrayBuffer();
        setFileBuffers(prev => ({ ...prev, [fileId]: buffer }));

        const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), {
          type: 'module'
        });

        worker.postMessage({
          type: 'PARSE_EXCEL',
          file: buffer,
          fileId
        });

        worker.onmessage = (e) => {
          const { type, data, error, fileId: responseFileId } = e.data;
          if (type === 'SUCCESS') {
            const parsedSheets = data.sheets || data;
            if (!parsedSheets || parsedSheets.length === 0) {
              if (isMountedRef.current) {
                setError('文件解析成功但没有找到工作表数据。请检查文件是否为有效的Excel文件。');
              }
            } else {
              if (isMountedRef.current) {
                setError(null);
              }
              setSheets(prev => {
                const accumulated: SheetData[] = [];
                const nextSheets = parsedSheets.map((sheet: any, index: number) => {
                  const baseName = sheet.name || `Sheet${index + 1}`;
                  const uniqueName = generateUniqueSheetName(baseName, [...prev, ...accumulated]);
                  const originalName = sheet.originalName || sheet.name || baseName;
                  const normalizedSheet: SheetData = {
                    ...sheet,
                    name: uniqueName,
                    originalName,
                    originalWorkbook: null,
                    sourceFileId: responseFileId || fileId
                  };
                  accumulated.push(normalizedSheet);
                  return normalizedSheet;
                });
                const merged = [...prev];
                nextSheets.forEach(sheet => {
                  if (
                    sheet.sourceFileId && sheet.originalName &&
                    merged.some(existing => existing.sourceFileId === sheet.sourceFileId && existing.originalName === sheet.originalName)
                  ) {
                    return;
                  }
                  merged.push(sheet);
                });
                return merged;
              });
              const idToStore = responseFileId || fileId;
              processedFileIdsRef.current.add(idToStore);
            }
          } else if (type === 'ERROR') {
            console.error('Excel parsing error:', error);
            if (isMountedRef.current) {
              setError(error);
            }
          }
          worker.terminate();
          resolve();
        };

        worker.onerror = (event) => {
          console.error('Excel worker error:', event.message);
          worker.terminate();
          if (isMountedRef.current) {
            setError(event.message || '解析Excel时出错');
          }
          reject(new Error(event.message));
        };
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : '处理Excel文件时出错');
        }
        reject(err as Error);
      }
    });
  }, []);

  useEffect(() => {
    if (!files || files.length === 0) {
      setSheets([]);
      processedFileIdsRef.current.clear();
      setFileBuffers({});
      setEditedRows(loadEditedData(STORAGE_KEY));
      setCurrentSheet(0);
      if (isMountedRef.current) {
        setError(null);
        setLoading(false);
      }
      return;
    }

    const pendingFiles = files.filter(file => {
      const id = getFileId(file);
      return !processedFileIdsRef.current.has(id) && !processingFileIds.current.has(id);
    });

    if (pendingFiles.length === 0) {
      if (isMountedRef.current && processingFileIds.current.size === 0) {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;

    (async () => {
      if (isMountedRef.current) {
        setError(null);
        setLoading(true);
      }
      try {
        for (const file of pendingFiles) {
          if (cancelled) break;
          const fileId = getFileId(file);
          processingFileIds.current.add(fileId);
          try {
            await processExcel(file);
          } catch (err) {
            if (!cancelled) {
              throw err;
            }
          } finally {
            processingFileIds.current.delete(fileId);
            if (isMountedRef.current && processingFileIds.current.size === 0) {
              setLoading(false);
            }
          }
        }
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
          setError(err instanceof Error ? err.message : '处理Excel文件时出错');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, processExcel]);

  const handleSheetChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentSheet(newValue);
  };

  // 优先显示错误，避免被加载态遮挡
  if (error) {
    return <ErrorAlert error={error} title="错误" />;
  }
  
  if (loading) {
    return <LoadingSpinner message="正在处理Excel文件..." />;
  }

  if (!sheets.length) {
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

  // 准备标签页数据
  const tabs: TabItem[] = sheets.map((sheet, index) => {
    
    // 确保有数据行
    const dataRows = sheet.data.length > 1 ? sheet.data.slice(1) : [];
    const headers = sheet.data[0] || [];
    
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
                      saveEditedData(STORAGE_KEY, newData);
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
