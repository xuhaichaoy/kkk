import React, { useCallback, useEffect, useState, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Tooltip,
  IconButton,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { LoadingSpinner, ErrorAlert, DataTable, CustomTabs, TabItem, SplitTableDialog, MergeSheetsDialog, CompareSheetsDialog, ExportSheetsDialog, RenameSheetDialog, type CreateMergedSheetPayload } from '../common';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  ExportContext,
  createComparisonMergeSheet,
  getHeaderRow,
  getHeaderRowIndex,
  getDataRows,
  getDataRowCount,
  detectHeaderRowIndex,
  DEFAULT_HEADER_ROW_INDEX
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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetIndex, setRenameTargetIndex] = useState<number | null>(null);
  const [fileBuffers, setFileBuffers] = useState<Record<string, ArrayBuffer>>({});
  const processedFileIdsRef = useRef<Set<string>>(new Set());
  const processingFileIds = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  // 初始化编辑数据，从本地存储加载
  const [editedRows, setEditedRows] = useState<EditedRowData>(() => {
    return loadEditedData(STORAGE_KEY);
  });
  const [manualHeaderInputs, setManualHeaderInputs] = useState<Record<number, string>>({});

  const syncManualHeaderInput = useCallback((sheetIndex: number, headerIndex: number) => {
    const display = String(headerIndex + 1);
    setManualHeaderInputs(prev => {
      if (prev[sheetIndex] === display) {
        return prev;
      }
      return { ...prev, [sheetIndex]: display };
    });
  }, []);

  const removeManualHeaderInput = useCallback((sheetIndex: number) => {
    setManualHeaderInputs(prev => {
      if (!(sheetIndex in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[sheetIndex];
      return next;
    });
  }, []);

  const clearEditsForSheet = useCallback((sheetIndex: number) => {
    setEditedRows(prev => {
      let changed = false;
      const next: EditedRowData = {};
      Object.entries(prev).forEach(([key, value]) => {
        const [sheetIdxStr] = key.split('_');
        if (Number(sheetIdxStr) === sheetIndex) {
          changed = true;
          return;
        }
        next[key] = value;
      });
      if (changed) {
        saveEditedData(STORAGE_KEY, next);
        return next;
      }
      return prev;
    });
  }, [saveEditedData]);

  const applyHeaderRowUpdate = useCallback((sheetIndex: number, targetRowIndex: number, mode: 'auto' | 'manual') => {
    const sheet = sheets[sheetIndex];
    if (!sheet) {
      return;
    }

    const rowCount = Array.isArray(sheet.data) ? sheet.data.length : 0;
    const boundedIndex = rowCount > 0 ? Math.min(Math.max(targetRowIndex, 0), rowCount - 1) : DEFAULT_HEADER_ROW_INDEX;
    const currentIndex = getHeaderRowIndex(sheet);
    const indexChanged = boundedIndex !== currentIndex || sheet.headerRowIndex !== boundedIndex;
    const modeChanged = sheet.headerDetectionMode !== mode;

    if (!indexChanged && !modeChanged) {
      if (mode === 'manual') {
        syncManualHeaderInput(sheetIndex, boundedIndex);
      } else {
        removeManualHeaderInput(sheetIndex);
      }
      return;
    }

    const headerRow = rowCount > 0 ? (Array.isArray(sheet.data[boundedIndex]) ? sheet.data[boundedIndex] : []) : [];
    const dataRows = rowCount > 0 ? sheet.data.slice(boundedIndex + 1) : [];
    const maxCols = dataRows.reduce((max, row) => {
      if (Array.isArray(row)) {
        return Math.max(max, row.length);
      }
      return max;
    }, Array.isArray(headerRow) ? headerRow.length : 0);

    setSheets(prev => {
      const next = [...prev];
      const target = next[sheetIndex];
      if (!target) {
        return prev;
      }

      const updatedSheet: SheetData = {
        ...target,
        headerRowIndex: boundedIndex,
        headerDetectionMode: mode,
        totalCols: maxCols,
        totalRows: rowCount > 0 ? Math.max(rowCount - boundedIndex - 1, 0) : 0
      };

      if (target.properties) {
        const updatedProperties: any = { ...target.properties };
        if (updatedProperties.autoFilter && typeof updatedProperties.autoFilter !== 'string') {
          const nextFilter = { ...updatedProperties.autoFilter };
          const headerRowNumber = boundedIndex + 1;
          const lastRowNumber = Math.max(headerRowNumber, headerRowNumber + (updatedSheet.totalRows || 0));
          const from = { ...(nextFilter.from || {}) };
          const to = { ...(nextFilter.to || {}) };
          from.row = headerRowNumber;
          to.row = lastRowNumber;
          nextFilter.from = from;
          nextFilter.to = to;
          updatedProperties.autoFilter = nextFilter;
        }
        updatedSheet.properties = updatedProperties;
      }

      next[sheetIndex] = updatedSheet;
      return next;
    });

    if (mode === 'manual') {
      syncManualHeaderInput(sheetIndex, boundedIndex);
    } else {
      removeManualHeaderInput(sheetIndex);
    }

    if (indexChanged) {
      clearEditsForSheet(sheetIndex);
    }
  }, [sheets, setSheets, clearEditsForSheet, syncManualHeaderInput, removeManualHeaderInput]);

  const handleHeaderModeChange = useCallback((sheetIndex: number, mode: 'auto' | 'manual') => {
    const sheet = sheets[sheetIndex];
    if (!sheet) {
      return;
    }

    if (mode === 'auto') {
      const autoIndex = detectHeaderRowIndex(sheet.data || []);
      applyHeaderRowUpdate(sheetIndex, autoIndex, 'auto');
    } else {
      const currentIndex = getHeaderRowIndex(sheet);
      applyHeaderRowUpdate(sheetIndex, currentIndex, 'manual');
    }
  }, [sheets, applyHeaderRowUpdate]);

  const handleManualHeaderRowChange = useCallback((sheetIndex: number, inputValue: number) => {
    const sheet = sheets[sheetIndex];
    if (!sheet) {
      return;
    }

    const rowCount = Array.isArray(sheet.data) ? sheet.data.length : 0;
    if (rowCount === 0) {
      return;
    }

    const rounded = Math.floor(inputValue);
    if (Number.isNaN(rounded)) {
      return;
    }

    const clamped = Math.min(Math.max(rounded, 1), rowCount);
    applyHeaderRowUpdate(sheetIndex, clamped - 1, 'manual');
  }, [sheets, applyHeaderRowUpdate]);

  const handleManualHeaderInputChange = useCallback((sheetIndex: number, value: string) => {
    setManualHeaderInputs(prev => ({ ...prev, [sheetIndex]: value }));
  }, []);

  const commitManualHeaderInput = useCallback((sheetIndex: number) => {
    const sheet = sheets[sheetIndex];
    if (!sheet || sheet.headerDetectionMode !== 'manual') {
      return;
    }

    const rawValue = (manualHeaderInputs[sheetIndex] ?? '').trim();
    if (rawValue === '') {
      syncManualHeaderInput(sheetIndex, getHeaderRowIndex(sheet));
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      syncManualHeaderInput(sheetIndex, getHeaderRowIndex(sheet));
      return;
    }

    handleManualHeaderRowChange(sheetIndex, parsed);
  }, [sheets, manualHeaderInputs, handleManualHeaderRowChange, syncManualHeaderInput]);

  useEffect(() => {
    setManualHeaderInputs(prev => {
      const next = { ...prev };
      let changed = false;

      sheets.forEach((sheet, index) => {
        if (sheet.headerDetectionMode === 'manual') {
          const desired = String(getHeaderRowIndex(sheet) + 1);
          if (next[index] !== desired) {
            next[index] = desired;
            changed = true;
          }
        } else if (next[index] !== undefined) {
          delete next[index];
          changed = true;
        }
      });

      Object.keys(next).forEach(key => {
        const index = Number(key);
        if (Number.isNaN(index) || index >= sheets.length) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [sheets]);

  // 删除选中的行
  const handleDeleteRows = useCallback((selectedRowIndexes: number[]) => {
    if (selectedRowIndexes.length === 0) return;

    const newData = [...sheets];
    const currentSheetData = [...newData[currentSheet].data];
    const headerIndex = getHeaderRowIndex(newData[currentSheet]);
    
    // 按照索引从大到小排序，这样删除时不会影响其他行的索引
    const sortedIndexes = selectedRowIndexes.sort((a, b) => b - a);
    
    // 删除选中的行（跳过表头）
    sortedIndexes.forEach(rowIndex => {
      currentSheetData.splice(headerIndex + 1 + rowIndex, 1);
    });

    newData[currentSheet].data = currentSheetData;
    newData[currentSheet].totalRows = Math.max(currentSheetData.length - headerIndex - 1, 0);

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
  }, [sheets, currentSheet, saveEditedData]);

  // 添加新行
  const handleAddRow = useCallback(() => {
    const newData = [...sheets];
    const currentSheetData = [...newData[currentSheet].data];
    const headerIndex = getHeaderRowIndex(newData[currentSheet]);
    const headerRow = currentSheetData[headerIndex] || currentSheetData[0] || [];
    const columnCount = Array.isArray(headerRow) ? headerRow.length : 0;
    
    // 创建一个空行，列数与当前表格相同
    const newRow = new Array(columnCount).fill('');
    
    // 在表格数据中添加新行（在表头之后）
    currentSheetData.push(newRow);

    newData[currentSheet].data = currentSheetData;
    newData[currentSheet].totalRows = Math.max(currentSheetData.length - headerIndex - 1, 0);

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

  const handleOpenRenameDialog = useCallback(() => {
    if (!sheets.length) return;
    const safeIndex = Math.min(currentSheet, sheets.length - 1);
    if (!sheets[safeIndex]) return;
    setRenameTargetIndex(safeIndex);
    setRenameDialogOpen(true);
  }, [sheets, currentSheet]);

  const handleCloseRenameDialog = useCallback(() => {
    setRenameDialogOpen(false);
    setRenameTargetIndex(null);
  }, []);

  const handleRenameSheet = useCallback((newName: string) => {
    setSheets(prev => {
      if (renameTargetIndex === null || !prev[renameTargetIndex]) {
        return prev;
      }
      const updated = [...prev];
      updated[renameTargetIndex] = {
        ...prev[renameTargetIndex],
        name: newName
      };
      return updated;
    });
    setRenameDialogOpen(false);
    setRenameTargetIndex(null);
  }, [renameTargetIndex]);

  const handleDeleteCurrentSheet = useCallback(() => {
    if (sheets.length === 0) {
      return;
    }
    const targetIndex = Math.min(currentSheet, sheets.length - 1);
    const targetSheet = sheets[targetIndex];
    const confirmed = window.confirm(`确认删除工作表 "${targetSheet?.name ?? ''}" 吗？此操作不可撤销。`);
    if (!confirmed) {
      return;
    }

    setSheets(prev => prev.filter((_, index) => index !== targetIndex));

    setEditedRows(prev => {
      const next: EditedRowData = {};
      Object.entries(prev).forEach(([key, value]) => {
        const [sheetIndexStr, rowIndexStr] = key.split('_');
        const sheetIndex = Number(sheetIndexStr);
        if (Number.isNaN(sheetIndex)) {
          return;
        }
        if (sheetIndex === targetIndex) {
          return;
        }
        const newSheetIndex = sheetIndex > targetIndex ? sheetIndex - 1 : sheetIndex;
        next[`${newSheetIndex}_${rowIndexStr}`] = value;
      });
      saveEditedData(STORAGE_KEY, next);
      return next;
    });

    setCurrentSheet(prevIndex => {
      if (prevIndex > targetIndex) {
        return prevIndex - 1;
      }
      if (prevIndex === targetIndex) {
        return Math.max(0, prevIndex - 1);
      }
      return prevIndex;
    });

    if (renameDialogOpen) {
      setRenameDialogOpen(false);
      setRenameTargetIndex(null);
    }
  }, [sheets, currentSheet, renameDialogOpen]);

  const handleCreateMergedSheetFromComparison = useCallback((payload: CreateMergedSheetPayload) => {
    let createdIndex = -1;
    setSheets(prev => {
      const firstSheet = prev[payload.firstSheetIndex];
      const secondSheet = prev[payload.secondSheetIndex];
      if (!firstSheet || !secondSheet) {
        return prev;
      }
      const uniqueName = generateUniqueSheetName(payload.options.sheetName, prev);
      const mergedSheet = createComparisonMergeSheet(firstSheet, secondSheet, payload.comparisonResult, {
        ...payload.options,
        sheetName: uniqueName,
        firstSourceLabel: firstSheet.name,
        secondSourceLabel: secondSheet.name
      });
      const sheetToAdd: SheetData = {
        ...mergedSheet,
        name: uniqueName,
        originalName: mergedSheet.originalName ?? uniqueName
      };
      const next = [...prev, sheetToAdd];
      createdIndex = next.length - 1;
      return next;
    });

    if (createdIndex >= 0) {
      setCurrentSheet(createdIndex);
      setCompareDialogOpen(false);
    }
  }, [generateUniqueSheetName, createComparisonMergeSheet]);

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
    const headerIndex = getHeaderRowIndex(sheet);
    const headers = getHeaderRow(sheet);
    const dataRows = getDataRows(sheet);
    const totalDataRows = getDataRowCount(sheet);

    return {
      label: sheet.name,
      badge: `${totalDataRows}行`,
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1.5,
              justifyContent: 'space-between',
              px: { xs: 1, sm: 0 }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" color="text.secondary">
                表头起始行
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={sheet.headerDetectionMode || 'auto'}
                onChange={(_, value: 'auto' | 'manual' | null) => {
                  if (value) {
                    handleHeaderModeChange(index, value);
                  }
                }}
              >
                <ToggleButton value="auto">自动</ToggleButton>
                <ToggleButton value="manual">手动</ToggleButton>
              </ToggleButtonGroup>
              {sheet.headerDetectionMode === 'manual' ? (
                <TextField
                  size="small"
                  label="表头行号"
                  value={manualHeaderInputs[index] ?? String(headerIndex + 1)}
                  onChange={(event) => handleManualHeaderInputChange(index, event.target.value)}
                  onBlur={() => commitManualHeaderInput(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitManualHeaderInput(index);
                    }
                  }}
                  inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    min: 1,
                    max: Math.max(sheet.data?.length || 1, 1)
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  自动检测：第 {headerIndex + 1} 行
                </Typography>
              )}
            </Box>
            {sheet.headerDetectionMode === 'manual' && (
              <Button
                size="small"
                variant="text"
                onClick={() => handleHeaderModeChange(index, 'auto')}
              >
                重新自动检测
              </Button>
            )}
          </Box>

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
        </Box>
      )
    };
  });

  return (
    <Box sx={{ width: '100%', height: '100%', pt: 1 }}>
      <CustomTabs
        tabs={tabs}
        value={currentSheet}
        onChange={handleSheetChange}
        actions={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="重命名当前工作表" arrow>
              <span style={{ display: 'inline-flex' }}>
                <IconButton
                  size="small"
                  onClick={handleOpenRenameDialog}
                  disabled={sheets.length === 0}
                  sx={{
                    color: (theme) => sheets.length === 0 ? theme.palette.action.disabled : theme.palette.text.primary
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="删除当前工作表" arrow>
              <span style={{ display: 'inline-flex' }}>
                <IconButton
                  size="small"
                  onClick={handleDeleteCurrentSheet}
                  disabled={sheets.length === 0}
                  sx={{
                    color: (theme) => sheets.length === 0 ? theme.palette.action.disabled : theme.palette.error.main
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
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
        onCreateMergedSheet={handleCreateMergedSheetFromComparison}
      />
      
      <ExportSheetsDialog
        open={exportDialogOpen}
        onClose={handleCloseExportDialog}
        onConfirm={handleConfirmExport}
        sheets={sheets}
      />

      <RenameSheetDialog
        open={renameDialogOpen}
        onClose={handleCloseRenameDialog}
        onConfirm={handleRenameSheet}
        currentName={renameTargetIndex !== null && sheets[renameTargetIndex] ? sheets[renameTargetIndex].name : ''}
        existingNames={sheets.map(sheet => sheet.name)}
      />
    </Box>
  );
};

export default ExcelViewer;
