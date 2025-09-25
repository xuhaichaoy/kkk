/**
 * Excel处理相关Hooks
 */
import { useState, useCallback, useEffect } from 'react';
import { SheetData, EditedRowData, getFileId, loadEditedData, saveEditedData } from '../utils/excelUtils';

/**
 * Excel数据管理Hook
 */
export const useExcelData = (file: File | null) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化编辑数据，从本地存储加载
  const [editedRows, setEditedRows] = useState<EditedRowData>(() => {
    return loadEditedData(getFileId(file));
  });

  // 更新编辑数据
  const updateEditedRows = useCallback((newData: EditedRowData) => {
    setEditedRows(newData);
    saveEditedData(getFileId(file), newData);
  }, [file]);

  // 重置数据
  const resetData = useCallback(() => {
    setSheets([]);
    setCurrentSheet(0);
    setLoading(false);
    setError(null);
    setEditedRows({});
  }, []);

  return {
    sheets,
    setSheets,
    currentSheet,
    setCurrentSheet,
    loading,
    setLoading,
    error,
    setError,
    editedRows,
    updateEditedRows,
    resetData
  };
};

/**
 * Excel操作Hook
 */
export const useExcelOperations = (
  sheets: SheetData[],
  currentSheet: number,
  editedRows: EditedRowData,
  setSheets: (sheets: SheetData[]) => void,
  updateEditedRows: (data: EditedRowData) => void,
  file: File | null
) => {
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
    const newEditedRows = { ...editedRows };
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
    
    updateEditedRows(newEditedRows);
  }, [sheets, currentSheet, editedRows, setSheets, updateEditedRows, file]);

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
  }, [sheets, currentSheet, setSheets]);

  // 处理行更新
  const handleRowUpdate = useCallback((updatedRow: any, originalRow: any, sheetIndex: number) => {
    const sheetId = `${sheetIndex}_${updatedRow.id}`;
    const changedField = Object.keys(updatedRow).find(
      key => updatedRow[key] !== originalRow[key]
    );
    
    if (changedField) {
      const newData = {
        ...editedRows,
        [sheetId]: {
          ...(editedRows[sheetId] || {}),
          [changedField]: updatedRow[changedField],
        },
      };
      updateEditedRows(newData);
    }
    return updatedRow;
  }, [editedRows, updateEditedRows]);

  return {
    handleDeleteRows,
    handleAddRow,
    handleRowUpdate
  };
};

/**
 * Excel对话框状态管理Hook
 */
export const useExcelDialogs = () => {
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const openSplitDialog = useCallback(() => setSplitDialogOpen(true), []);
  const closeSplitDialog = useCallback(() => setSplitDialogOpen(false), []);
  
  const openMergeDialog = useCallback(() => setMergeDialogOpen(true), []);
  const closeMergeDialog = useCallback(() => setMergeDialogOpen(false), []);
  
  const openCompareDialog = useCallback(() => setCompareDialogOpen(true), []);
  const closeCompareDialog = useCallback(() => setCompareDialogOpen(false), []);
  
  const openExportDialog = useCallback(() => setExportDialogOpen(true), []);
  const closeExportDialog = useCallback(() => setExportDialogOpen(false), []);

  return {
    splitDialogOpen,
    mergeDialogOpen,
    compareDialogOpen,
    exportDialogOpen,
    openSplitDialog,
    closeSplitDialog,
    openMergeDialog,
    closeMergeDialog,
    openCompareDialog,
    closeCompareDialog,
    openExportDialog,
    closeExportDialog
  };
};
