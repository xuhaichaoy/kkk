/**
 * Excel数据管理器Hook - 统一管理所有文件的sheet数据
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { SheetData, EditedRowData, getFileId, loadEditedData, saveEditedData } from '../utils/excelUtils';

export interface FileSheetData {
  fileId: string;
  fileName: string;
  file: File;
  sheets: SheetData[];
  loading: boolean;
  error: string | null;
  timestamp: number;
}

export interface GlobalSheetData extends SheetData {
  fileId: string;
  fileName: string;
  originalSheetIndex: number;
}

export interface ExcelManagerState {
  files: FileSheetData[];
  allSheets: GlobalSheetData[];
  currentSheetIndex: number;
  editedRows: EditedRowData;
}

export const useExcelManager = () => {
  const [state, setState] = useState<ExcelManagerState>({
    files: [],
    allSheets: [],
    currentSheetIndex: 0,
    editedRows: {}
  });

  const workerRef = useRef<Worker | null>(null);
  const processingFiles = useRef<Set<string>>(new Set());

  // 添加文件
  const addFile = useCallback(async (file: File) => {
    const fileId = getFileId(file);
    
    // 检查文件是否已存在
    if (state.files.some(f => f.fileId === fileId)) {
      console.warn('文件已存在:', file.name);
      return;
    }

    // 检查是否正在处理
    if (processingFiles.current.has(fileId)) {
      console.warn('文件正在处理中:', file.name);
      return;
    }

    const newFileData: FileSheetData = {
      fileId,
      fileName: file.name,
      file,
      sheets: [],
      loading: true,
      error: null,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      files: [...prev.files, newFileData]
    }));

    // 开始处理文件
    await processFile(file, fileId);
  }, [state.files]);

  // 处理文件
  const processFile = useCallback(async (file: File, fileId: string) => {
    processingFiles.current.add(fileId);

    try {
      // 创建Worker处理Excel文件
      const worker = new Worker(new URL('../workers/excelWorker.ts', import.meta.url));
      workerRef.current = worker;

      worker.postMessage({
        type: 'PARSE_EXCEL',
        file: file
      });

      worker.onmessage = (e) => {
        if (e.data.type === 'SUCCESS') {
          const sheets = e.data.data.sheets || e.data.data;
          const workbook = e.data.data.workbook;

          if (!sheets || sheets.length === 0) {
            setState(prev => ({
              ...prev,
              files: prev.files.map(f => 
                f.fileId === fileId 
                  ? { ...f, loading: false, error: '文件解析成功但没有找到工作表数据' }
                  : f
              )
            }));
            return;
          }

          // 为每个sheet添加原始workbook引用
          const sheetsWithWorkbook = sheets.map((sheet: any) => ({
            ...sheet,
            originalWorkbook: workbook
          }));

          // 创建全局sheet数据
          const globalSheets: GlobalSheetData[] = sheetsWithWorkbook.map((sheet: any, index: number) => ({
            ...sheet,
            fileId,
            fileName: file.name,
            originalSheetIndex: index
          }));

          setState(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.fileId === fileId 
                ? { ...f, sheets: sheetsWithWorkbook, loading: false, error: null }
                : f
            ),
            allSheets: [...prev.allSheets, ...globalSheets],
            // 如果是第一个文件，设置为当前sheet
            currentSheetIndex: prev.allSheets.length === 0 ? 0 : prev.currentSheetIndex
          }));

          // 加载编辑数据
          const editedData = loadEditedData(fileId);
          if (Object.keys(editedData).length > 0) {
            setState(prev => ({
              ...prev,
              editedRows: { ...prev.editedRows, ...editedData }
            }));
          }

        } else if (e.data.type === 'ERROR') {
          setState(prev => ({
            ...prev,
            files: prev.files.map(f => 
              f.fileId === fileId 
                ? { ...f, loading: false, error: e.data.error }
                : f
            )
          }));
        }

        worker.terminate();
        processingFiles.current.delete(fileId);
      };

    } catch (err) {
      setState(prev => ({
        ...prev,
        files: prev.files.map(f => 
          f.fileId === fileId 
            ? { ...f, loading: false, error: err instanceof Error ? err.message : '处理Excel文件时出错' }
            : f
        )
      }));
      processingFiles.current.delete(fileId);
    }
  }, []);

  // 移除文件
  const removeFile = useCallback((fileId: string) => {
    setState(prev => {
      const fileToRemove = prev.files.find(f => f.fileId === fileId);
      if (!fileToRemove) return prev;

      // 移除该文件的所有sheets
      const remainingSheets = prev.allSheets.filter(sheet => sheet.fileId !== fileId);
      
      // 调整当前sheet索引
      let newCurrentIndex = prev.currentSheetIndex;
      const removedSheetsCount = fileToRemove.sheets.length;
      const removedSheetsBeforeCurrent = prev.allSheets
        .slice(0, prev.currentSheetIndex)
        .filter(sheet => sheet.fileId === fileId).length;
      
      if (removedSheetsBeforeCurrent > 0) {
        newCurrentIndex = Math.max(0, prev.currentSheetIndex - removedSheetsBeforeCurrent);
      } else if (prev.currentSheetIndex >= remainingSheets.length) {
        newCurrentIndex = Math.max(0, remainingSheets.length - 1);
      }

      // 清理编辑数据
      const newEditedRows = { ...prev.editedRows };
      Object.keys(newEditedRows).forEach(key => {
        if (key.startsWith(fileId + '_')) {
          delete newEditedRows[key];
        }
      });

      return {
        ...prev,
        files: prev.files.filter(f => f.fileId !== fileId),
        allSheets: remainingSheets,
        currentSheetIndex: newCurrentIndex,
        editedRows: newEditedRows
      };
    });
  }, []);

  // 切换当前sheet
  const setCurrentSheet = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      currentSheetIndex: index
    }));
  }, []);

  // 更新编辑数据
  const updateEditedRows = useCallback((fileId: string, sheetIndex: number, rowId: number, field: string, value: any) => {
    const sheetId = `${fileId}_${sheetIndex}_${rowId}`;
    
    setState(prev => {
      const newEditedRows = {
        ...prev.editedRows,
        [sheetId]: {
          ...(prev.editedRows[sheetId] || {}),
          [field]: value
        }
      };
      
      // 保存到本地存储
      saveEditedData(fileId, newEditedRows);
      
      return {
        ...prev,
        editedRows: newEditedRows
      };
    });
  }, []);

  // 更新所有sheets
  const updateAllSheets = useCallback((newSheets: GlobalSheetData[]) => {
    setState(prev => ({
      ...prev,
      allSheets: newSheets
    }));
  }, []);

  // 获取当前sheet
  const getCurrentSheet = useCallback(() => {
    return state.allSheets[state.currentSheetIndex] || null;
  }, [state.allSheets, state.currentSheetIndex]);

  // 获取指定文件的sheets
  const getSheetsByFile = useCallback((fileId: string) => {
    return state.allSheets.filter(sheet => sheet.fileId === fileId);
  }, [state.allSheets]);

  // 获取所有sheets（用于合并、比较等操作）
  const getAllSheets = useCallback(() => {
    return state.allSheets;
  }, [state.allSheets]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  return {
    // 状态
    files: state.files,
    allSheets: state.allSheets,
    currentSheetIndex: state.currentSheetIndex,
    currentSheet: getCurrentSheet(),
    editedRows: state.editedRows,
    
    // 操作方法
    addFile,
    removeFile,
    setCurrentSheet,
    updateEditedRows,
    updateAllSheets,
    getSheetsByFile,
    getAllSheets,
    
    // 计算属性
    hasFiles: state.files.length > 0,
    isLoading: state.files.some(f => f.loading),
    hasError: state.files.some(f => f.error)
  };
};
