/**
 * Excel数据处理工具函数
 */

export interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
}

export interface EditedRowData {
  [key: string]: { [key: string]: any };
}

/**
 * 生成文件唯一标识
 */
export const getFileId = (file: File | null): string => {
  if (!file) return '';
  return `${file.name}_${file.size}_${file.lastModified}`;
};

/**
 * 从本地存储加载编辑数据
 */
export const loadEditedData = (fileId: string): EditedRowData => {
  try {
    const savedData = localStorage.getItem(`excel_edits_${fileId}`);
    if (savedData) {
      return JSON.parse(savedData);
    }
  } catch (err) {
    console.error('加载编辑数据失败:', err);
  }
  return {};
};

/**
 * 保存编辑数据到本地存储
 */
export const saveEditedData = (fileId: string, data: EditedRowData): void => {
  try {
    localStorage.setItem(`excel_edits_${fileId}`, JSON.stringify(data));
  } catch (err) {
    console.error('保存编辑数据失败:', err);
  }
};

/**
 * 格式化单元格值
 */
export const formatCellValue = (value: any): string => {
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

/**
 * 获取包含编辑数据的行数据
 */
export const getRowsWithEdits = (
  dataRows: any[][],
  currentSheet: number,
  editedRows: EditedRowData
): any[][] => {
  return dataRows.map((row, rowIndex) => {
    const sheetId = `${currentSheet}_${rowIndex}`;
    const editedRowData = editedRows[sheetId] || {};
    return row.map((cell, cellIndex) => editedRowData[String(cellIndex)] || cell);
  });
};

/**
 * 获取列的唯一值
 */
export const getColumnUniqueValues = (
  dataRows: any[][],
  columnIndex: number,
  currentSheet: number,
  editedRows: EditedRowData
): string[] => {
  const rowsWithEdits = getRowsWithEdits(dataRows, currentSheet, editedRows);
  return [...new Set(rowsWithEdits.map(row => row[columnIndex]?.toString() || ''))].filter(val => val !== '');
};

/**
 * 根据列值拆分表格数据
 */
export const splitTableByColumn = (
  sheetData: SheetData,
  columnIndex: number,
  currentSheet: number,
  editedRows: EditedRowData
): SheetData[] => {
  const headers = sheetData.data[0];
  const dataRows = sheetData.data.slice(1);
  const rowsWithEdits = getRowsWithEdits(dataRows, currentSheet, editedRows);
  
  const uniqueValues = getColumnUniqueValues(dataRows, columnIndex, currentSheet, editedRows);
  
  return uniqueValues.map(value => {
    const filteredRows = rowsWithEdits.filter(row => row[columnIndex]?.toString() === value);
    return {
      name: `${sheetData.name}_${value}`,
      data: [headers, ...filteredRows],
      totalRows: filteredRows.length,
      totalCols: headers.length
    };
  });
};

/**
 * 导出表格数据为CSV
 */
export const exportToCSV = (sheetData: SheetData): void => {
  const csvContent = [
    sheetData.data[0].join(','), // 表头
    ...sheetData.data.slice(1).map(row => 
      row.map(cell => {
        const value = cell?.toString() || '';
        // 如果包含逗号、引号或换行符，需要用引号包围并转义
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${sheetData.name || 'sheet'}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
