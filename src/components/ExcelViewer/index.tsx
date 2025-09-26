import React, { useCallback, useState } from 'react';
import { 
  Box, 
  Typography
} from '@mui/material';
import { DataTable, CustomTabs, TabItem, SplitTableDialog, MergeSheetsDialog, CompareSheetsDialog, ExportSheetsDialog } from '../common';
import { 
  GlobalSheetData,
  EditedRowData,
  exportToExcel,
  ExportOptions,
  splitTableByColumn
} from '../../utils/excelUtils';
import { GridColDef } from '@mui/x-data-grid';

interface ExcelViewerProps {
  allSheets: GlobalSheetData[];
  currentSheetIndex: number;
  onSheetChange: (index: number) => void;
  editedRows: EditedRowData;
  onUpdateEditedRows: (fileId: string, sheetIndex: number, rowId: number, field: string, value: any) => void;
  onUpdateSheets?: (newSheets: GlobalSheetData[]) => void;
}

const ExcelViewer: React.FC<ExcelViewerProps> = ({ 
  allSheets, 
  currentSheetIndex, 
  onSheetChange, 
  editedRows, 
  onUpdateEditedRows,
  onUpdateSheets
}) => {
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const currentSheet = allSheets[currentSheetIndex];

  if (!currentSheet) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        color: 'text.secondary'
      }}>
        <Typography variant="h6">请选择要查看的Sheet</Typography>
      </Box>
    );
  }

  // 处理行更新
  const handleRowUpdate = useCallback((updatedRow: any, originalRow: any) => {
    const changedField = Object.keys(updatedRow).find(
      key => updatedRow[key] !== originalRow[key]
    );
    
    if (changedField) {
      onUpdateEditedRows(
        currentSheet.fileId, 
        currentSheet.originalSheetIndex, 
        updatedRow.id, 
        changedField, 
        updatedRow[changedField]
      );
    }
    return updatedRow;
  }, [currentSheet, onUpdateEditedRows]);

  // 处理Sheet切换
  const handleSheetChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    onSheetChange(newValue);
  }, [onSheetChange]);

  // 对话框处理函数
  const handleCloseSplitDialog = useCallback(() => setSplitDialogOpen(false), []);
  const handleCloseMergeDialog = useCallback(() => setMergeDialogOpen(false), []);
  const handleCloseCompareDialog = useCallback(() => setCompareDialogOpen(false), []);
  const handleCloseExportDialog = useCallback(() => setExportDialogOpen(false), []);

  const handleConfirmSplit = useCallback((splitOptions: any) => {
    if (!currentSheet || !onUpdateSheets) {
      console.error('分割功能需要当前sheet和更新函数');
      return;
    }

    try {
      const { columnIndex } = splitOptions;
      
      // 调用分割函数
      const splitResults = splitTableByColumn(
        currentSheet,
        columnIndex,
        currentSheetIndex,
        editedRows,
        allSheets
      );

      if (splitResults.length > 0) {
        // 创建新的全局sheet数据
        const newGlobalSheets: GlobalSheetData[] = splitResults.map((result, index) => ({
          ...result,
          fileId: currentSheet.fileId,
          fileName: currentSheet.fileName,
          originalSheetIndex: currentSheet.originalSheetIndex + index + 1
        }));

        // 更新sheets列表
        const updatedSheets = [...allSheets, ...newGlobalSheets];
        onUpdateSheets(updatedSheets);

        // 切换到第一个分割结果
        const firstSplitIndex = allSheets.length;
        onSheetChange(firstSplitIndex);
      }

      setSplitDialogOpen(false);
    } catch (error) {
      console.error('分割表格失败:', error);
      alert('分割失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }, [currentSheet, currentSheetIndex, editedRows, allSheets, onUpdateSheets, onSheetChange]);

  // 导出当前sheet为Excel
  const handleExportCurrentSheet = useCallback(async () => {
    if (!currentSheet) return;
    
    try {
      const exportOptions: ExportOptions = {
        fileName: `${currentSheet.fileName}_${currentSheet.name}`,
        separateFiles: false,
        preserveFormulas: true
      };
      
      await exportToExcel([currentSheet], exportOptions);
    } catch (error) {
      console.error('导出当前sheet失败:', error);
      alert('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }, [currentSheet]);


  // 转换sheet数据为DataTable格式
  const convertSheetToDataTable = useCallback((sheet: GlobalSheetData) => {
    if (!sheet.data || sheet.data.length === 0) {
      return { rows: [], columns: [] };
    }

    const headers = sheet.data[0] || [];
    const rows = sheet.data.slice(1).map((row, index) => {
      const rowData: any = { id: index };
      headers.forEach((header, colIndex) => {
        rowData[header] = row[colIndex] || '';
      });
      return rowData;
    });

    const columns: GridColDef[] = headers.map((header) => ({
      field: header,
      headerName: header,
      width: 150,
      editable: true,
    }));

    return { rows, columns };
  }, []);

  // 准备标签页数据
  const tabs: TabItem[] = allSheets.map((sheet) => {
    const { rows, columns } = convertSheetToDataTable(sheet);
    
    return {
      label: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography component="span" sx={{ fontWeight: 'inherit' }}>
            {sheet.name}
          </Typography>
          <Typography 
            component="span" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.75rem',
              bgcolor: 'action.hover',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontWeight: 500
            }}
          >
            {sheet.fileName}
          </Typography>
          <Typography 
            component="span" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.7rem',
              bgcolor: 'action.hover',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontWeight: 400
            }}
          >
            {sheet.totalRows}行
          </Typography>
        </Box>
      ),
      content: (
        <DataTable
          rows={rows}
          columns={columns}
          enableAdd={true}
          enableDelete={true}
          enableSplit={true}
          enableMerge={true}
          enableCompare={true}
          enableExport={true}
          enableExportExcel={true}
          onAdd={() => {
            console.log('添加行功能待实现');
          }}
          onDelete={(selectedRowIndexes: number[]) => {
            console.log('删除行功能待实现', selectedRowIndexes);
          }}
          onSplit={() => setSplitDialogOpen(true)}
          onMerge={() => setMergeDialogOpen(true)}
          onCompare={() => setCompareDialogOpen(true)}
          onExport={() => setExportDialogOpen(true)}
          onExportExcel={handleExportCurrentSheet}
          onRowUpdate={handleRowUpdate}
          height="70vh"
        />
      )
    };
  });

  return (
    <Box sx={{ width: '100%', height: '100%', pt: 1 }}>
      <CustomTabs
        tabs={tabs}
        value={currentSheetIndex}
        onChange={handleSheetChange}
      />
      
      <SplitTableDialog
        open={splitDialogOpen}
        onClose={handleCloseSplitDialog}
        onConfirm={handleConfirmSplit}
        sheetData={currentSheet}
        currentSheet={currentSheetIndex}
        editedRows={editedRows}
      />
      
      <MergeSheetsDialog
        open={mergeDialogOpen}
        onClose={handleCloseMergeDialog}
        onConfirm={(selectedSheets: any[], options: any) => {
          console.log('合并表格功能待实现', { selectedSheets, options });
          setMergeDialogOpen(false);
        }}
        sheets={allSheets}
      />
      
      <CompareSheetsDialog
        open={compareDialogOpen}
        onClose={handleCloseCompareDialog}
        sheets={allSheets}
        editedRows={editedRows}
      />
      
      <ExportSheetsDialog
        open={exportDialogOpen}
        onClose={handleCloseExportDialog}
        onConfirm={async (selectedSheets: any[], options: any) => {
          try {
            await exportToExcel(selectedSheets, options);
            setExportDialogOpen(false);
          } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
          }
        }}
        sheets={allSheets}
      />
    </Box>
  );
};

export default ExcelViewer;