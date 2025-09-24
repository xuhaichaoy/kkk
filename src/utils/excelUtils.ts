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
 * 生成唯一的sheet名称
 */
export const generateUniqueSheetName = (baseName: string, existingSheets: SheetData[]): string => {
  const existingNames = new Set(existingSheets.map(sheet => sheet.name));
  
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  
  let counter = 1;
  let uniqueName = `${baseName}_${counter}`;
  
  while (existingNames.has(uniqueName)) {
    counter++;
    uniqueName = `${baseName}_${counter}`;
  }
  
  return uniqueName;
};

/**
 * 根据列值拆分表格数据
 */
export const splitTableByColumn = (
  sheetData: SheetData,
  columnIndex: number,
  currentSheet: number,
  editedRows: EditedRowData,
  existingSheets: SheetData[]
): SheetData[] => {
  const headers = sheetData.data[0];
  const dataRows = sheetData.data.slice(1);
  const rowsWithEdits = getRowsWithEdits(dataRows, currentSheet, editedRows);
  
  const uniqueValues = getColumnUniqueValues(dataRows, columnIndex, currentSheet, editedRows);
  
  return uniqueValues.map(value => {
    const filteredRows = rowsWithEdits.filter(row => row[columnIndex]?.toString() === value);
    const baseName = `${sheetData.name}_${value}`;
    const uniqueName = generateUniqueSheetName(baseName, existingSheets);
    
    return {
      name: uniqueName,
      data: [headers, ...filteredRows],
      totalRows: filteredRows.length,
      totalCols: headers.length
    };
  });
};

/**
 * 分析要合并的sheets，返回列差异信息
 */
export interface MergeAnalysis {
  allColumns: string[];
  newColumns: string[];
  existingColumns: string[];
  sheetColumnMapping: { [sheetName: string]: string[] };
}

export const analyzeSheetsForMerge = (sheets: SheetData[]): MergeAnalysis => {
  if (sheets.length === 0) {
    return {
      allColumns: [],
      newColumns: [],
      existingColumns: [],
      sheetColumnMapping: {}
    };
  }

  // 获取第一个sheet的列作为基准
  const baseColumns = sheets[0].data[0] || [];
  const baseColumnSet = new Set(baseColumns);
  const allColumnsSet = new Set(baseColumns);
  const sheetColumnMapping: { [sheetName: string]: string[] } = {};

  // 收集所有sheet的列信息
  sheets.forEach(sheet => {
    const sheetColumns = sheet.data[0] || [];
    sheetColumnMapping[sheet.name] = sheetColumns;
    sheetColumns.forEach(col => allColumnsSet.add(col));
  });

  const allColumns = Array.from(allColumnsSet);
  const newColumns = allColumns.filter(col => !baseColumnSet.has(col));

  return {
    allColumns,
    newColumns,
    existingColumns: baseColumns,
    sheetColumnMapping
  };
};

/**
 * 合并多个sheets
 */
export const mergeSheets = (
  sheets: SheetData[],
  mergedSheetName: string,
  existingSheets: SheetData[]
): SheetData => {
  if (sheets.length === 0) {
    throw new Error('没有选择要合并的sheet');
  }

  const analysis = analyzeSheetsForMerge(sheets);
  const { allColumns } = analysis;

  // 创建合并后的数据
  const mergedData: any[][] = [allColumns]; // 表头

  // 合并每个sheet的数据
  sheets.forEach(sheet => {
    const sheetHeaders = sheet.data[0] || [];
    const sheetRows = sheet.data.slice(1);

    // 为每一行数据创建完整的行
    sheetRows.forEach(row => {
      const mergedRow = new Array(allColumns.length).fill('');
      
      // 根据列名映射数据
      sheetHeaders.forEach((header, index) => {
        const targetIndex = allColumns.indexOf(header);
        if (targetIndex !== -1 && row[index] !== undefined) {
          mergedRow[targetIndex] = row[index];
        }
      });

      mergedData.push(mergedRow);
    });
  });

  // 生成唯一的sheet名称
  const uniqueName = generateUniqueSheetName(mergedSheetName, existingSheets);

  return {
    name: uniqueName,
    data: mergedData,
    totalRows: mergedData.length - 1,
    totalCols: allColumns.length
  };
};

/**
 * 差异对比结果接口
 */
export interface ComparisonResult {
  headerDifferences: {
    commonColumns: string[];
    uniqueToFirst: string[];
    uniqueToSecond: string[];
  };
  dataDifferences: {
    commonRows: any[][];
    uniqueToFirst: any[][];
    uniqueToSecond: any[][];
    modifiedRows: {
      firstRow: any[];
      secondRow: any[];
      differences: { column: string; firstValue: any; secondValue: any }[];
    }[];
  };
  summary: {
    firstSheetRows: number;
    secondSheetRows: number;
    commonRowsCount: number;
    uniqueToFirstCount: number;
    uniqueToSecondCount: number;
    modifiedRowsCount: number;
  };
}

/**
 * 比较两个sheet的差异
 */
export const compareSheets = (
  firstSheet: SheetData,
  secondSheet: SheetData,
  firstSheetIndex: number,
  secondSheetIndex: number,
  editedRows: EditedRowData
): ComparisonResult => {
  const firstHeaders = firstSheet.data[0] || [];
  const secondHeaders = secondSheet.data[0] || [];
  
  // 获取包含编辑数据的行
  const firstRows = getRowsWithEdits(firstSheet.data.slice(1), firstSheetIndex, editedRows);
  const secondRows = getRowsWithEdits(secondSheet.data.slice(1), secondSheetIndex, editedRows);

  // 分析表头差异
  const firstHeaderSet = new Set(firstHeaders);
  const secondHeaderSet = new Set(secondHeaders);
  
  const commonColumns = firstHeaders.filter(col => secondHeaderSet.has(col));
  const uniqueToFirst = firstHeaders.filter(col => !secondHeaderSet.has(col));
  const uniqueToSecond = secondHeaders.filter(col => !firstHeaderSet.has(col));

  // 分析数据差异
  const dataDifferences = compareDataRows(firstRows, secondRows, firstHeaders, secondHeaders);

  return {
    headerDifferences: {
      commonColumns,
      uniqueToFirst,
      uniqueToSecond
    },
    dataDifferences,
    summary: {
      firstSheetRows: firstRows.length,
      secondSheetRows: secondRows.length,
      commonRowsCount: dataDifferences.commonRows.length,
      uniqueToFirstCount: dataDifferences.uniqueToFirst.length,
      uniqueToSecondCount: dataDifferences.uniqueToSecond.length,
      modifiedRowsCount: dataDifferences.modifiedRows.length
    }
  };
};

/**
 * 比较数据行
 */
const compareDataRows = (
  firstRows: any[][],
  secondRows: any[][],
  firstHeaders: string[],
  secondHeaders: string[]
) => {
  const commonRows: any[][] = [];
  const uniqueToFirst: any[][] = [];
  const uniqueToSecond: any[][] = [];
  const modifiedRows: {
    firstRow: any[];
    secondRow: any[];
    differences: { column: string; firstValue: any; secondValue: any }[];
  }[] = [];

  // 创建行的哈希映射，用于快速查找
  const createRowHash = (row: any[], headers: string[]) => {
    return row.map((cell, index) => `${headers[index]}:${cell}`).join('|');
  };

  const firstRowHashes = new Map<string, { row: any[]; index: number }>();
  const secondRowHashes = new Map<string, { row: any[]; index: number }>();

  // 为第一个sheet创建哈希映射
  firstRows.forEach((row, index) => {
    const hash = createRowHash(row, firstHeaders);
    firstRowHashes.set(hash, { row, index });
  });

  // 为第二个sheet创建哈希映射
  secondRows.forEach((row, index) => {
    const hash = createRowHash(row, secondHeaders);
    secondRowHashes.set(hash, { row, index });
  });

  // 找出完全相同的行
  firstRowHashes.forEach((firstData, hash) => {
    if (secondRowHashes.has(hash)) {
      commonRows.push(firstData.row);
      secondRowHashes.delete(hash); // 避免重复处理
    } else {
      uniqueToFirst.push(firstData.row);
    }
  });

  // 剩余的第二sheet行都是独有的
  secondRowHashes.forEach((secondData) => {
    uniqueToSecond.push(secondData.row);
  });

  // 找出部分匹配的行（相同主键但内容不同）
  findModifiedRows(firstRows, secondRows, firstHeaders, secondHeaders, modifiedRows);

  return {
    commonRows,
    uniqueToFirst,
    uniqueToSecond,
    modifiedRows
  };
};

/**
 * 找出修改过的行（假设第一列是主键）
 */
const findModifiedRows = (
  firstRows: any[][],
  secondRows: any[][],
  firstHeaders: string[],
  secondHeaders: string[],
  modifiedRows: {
    firstRow: any[];
    secondRow: any[];
    differences: { column: string; firstValue: any; secondValue: any }[];
  }[]
) => {
  // 创建基于第一列（主键）的映射
  const firstRowsByKey = new Map<string, any[]>();
  const secondRowsByKey = new Map<string, any[]>();

  firstRows.forEach(row => {
    if (row.length > 0) {
      const key = String(row[0]);
      firstRowsByKey.set(key, row);
    }
  });

  secondRows.forEach(row => {
    if (row.length > 0) {
      const key = String(row[0]);
      secondRowsByKey.set(key, row);
    }
  });

  // 找出有相同主键但内容不同的行
  firstRowsByKey.forEach((firstRow, key) => {
    if (secondRowsByKey.has(key)) {
      const secondRow = secondRowsByKey.get(key)!;
      
      // 比较行内容
      const differences: { column: string; firstValue: any; secondValue: any }[] = [];
      
      // 比较公共列
      const commonColumns = firstHeaders.filter(col => secondHeaders.includes(col));
      commonColumns.forEach(column => {
        const firstIndex = firstHeaders.indexOf(column);
        const secondIndex = secondHeaders.indexOf(column);
        
        if (firstIndex !== -1 && secondIndex !== -1) {
          const firstValue = firstRow[firstIndex];
          const secondValue = secondRow[secondIndex];
          
          if (String(firstValue) !== String(secondValue)) {
            differences.push({
              column,
              firstValue,
              secondValue
            });
          }
        }
      });

      if (differences.length > 0) {
        modifiedRows.push({
          firstRow,
          secondRow,
          differences
        });
      }
    }
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
