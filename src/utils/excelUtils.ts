/**
 * Excel数据处理工具函数
 */

import * as ExcelJS from 'exceljs';

export interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
  styles?: any; // 原始样式信息
  formulas?: any; // 原始公式信息
  // 富文本 runs（按单元格地址，如 "1_1"），用于保留局部颜色/加粗等
  richTextRuns?: { [cellKey: string]: any[] };
  properties?: any; // 工作表级别的属性（列宽、行高、合并单元格等）
  originalWorkbook?: any; // 原始workbook对象引用
  sourceFileId?: string; // 来源文件标识，用于多文件管理
  originalName?: string; // 原始sheet名称（用于去重）
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
  
  // 处理富文本对象
  if (value && typeof value === 'object') {
    if ('richText' in value) {
      // 提取富文本中的纯文本内容
      if (Array.isArray(value.richText)) {
        return value.richText.map((item: any) => item.text || '').join('');
      }
      return value.richText?.text || '';
    }
    
    // 处理其他对象类型
    if ('result' in value) {
      return value.result?.toString() || '';
    }
    
    // 如果是其他对象，尝试转换为字符串
    return JSON.stringify(value);
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
    // 首先找到所有匹配的行索引
    const matchingRowIndices: number[] = [];
    rowsWithEdits.forEach((row, index) => {
      if (row[columnIndex]?.toString() === value) {
        matchingRowIndices.push(index);
      }
    });
    
    const filteredRows = matchingRowIndices.map(index => rowsWithEdits[index]);
    const baseName = `${sheetData.name}_${value}`;
    const uniqueName = generateUniqueSheetName(baseName, existingSheets);
    
    // 行号映射：原始行(1-based) -> 新行(1-based)
    const rowMap: Record<number, number> = { 1: 1 };
    matchingRowIndices.forEach((dataRowIdx, i) => {
      const oldRow = dataRowIdx + 2; // 原始数据行的 1-based 行号（跳过表头）
      const newRow = i + 2; // 新表中的 1-based 行号
      rowMap[oldRow] = newRow;
    });

    // 1) 样式重映射（包含空单元格样式）
    const newStyles: any = {};
    if (sheetData.styles) {
      Object.keys(sheetData.styles).forEach(cellKey => {
        const [rowStr, colStr] = cellKey.split('_');
        const oldRow = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        const newRow = rowMap[oldRow];
        if (newRow) {
          const newKey = `${newRow}_${col}`;
          newStyles[newKey] = sheetData.styles![cellKey];
        }
      });
    }

    // 2) 公式重映射（按单元格地址重放到新行；公式字符串本身不改动）
    const newFormulas: any = {};
    if (sheetData.formulas) {
      Object.keys(sheetData.formulas).forEach(cellKey => {
        const [rowStr, colStr] = cellKey.split('_');
        const oldRow = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        const newRow = rowMap[oldRow];
        if (newRow) {
          const newKey = `${newRow}_${col}`;
          const rowOffset = newRow - oldRow;
          newFormulas[newKey] = adjustFormulaRowReferences(sheetData.formulas![cellKey], rowOffset);
        }
      });
    }

    // 3) 富文本 runs 重映射（保留文字局部颜色）
    const newRichTextRuns: any = {};
    if (sheetData.richTextRuns) {
      Object.keys(sheetData.richTextRuns).forEach(cellKey => {
        const [rowStr, colStr] = cellKey.split('_');
        const oldRow = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        const newRow = rowMap[oldRow];
        if (newRow) {
          const newKey = `${newRow}_${col}`;
          newRichTextRuns[newKey] = sheetData.richTextRuns![cellKey];
        }
      });
    }

    // 4) 工作表属性重映射
    const newProperties: any = { ...sheetData.properties };
    newProperties.rowCount = filteredRows.length + 1; // 含表头
    newProperties.columnCount = headers.length;
    // 列宽/隐藏保留
    if (sheetData.properties?.columns) {
      newProperties.columns = sheetData.properties.columns;
    }
    // 行高重映射
    newProperties.rows = [];
    if (Array.isArray(sheetData.properties?.rows)) {
      // 表头
      if (sheetData.properties.rows[0]) newProperties.rows[0] = sheetData.properties.rows[0];
      // 数据行
      matchingRowIndices.forEach((dataRowIdx, i) => {
        const oldIdx0 = dataRowIdx + 1; // 原数组是 0-based 对应行号-1
        const newIdx0 = i + 1; // 新数组 0-based（表头在 0）
        newProperties.rows[newIdx0] = sheetData.properties!.rows[oldIdx0];
      });
    }
    // 合并单元格重映射（仅当所有涉及的原始行都在映射中，且映射后仍连续）
    if (Array.isArray(sheetData.properties?.merges)) {
      const merges: any[] = [];
      const inMap = (r: number) => !!rowMap[r];
      const isContiguous = (t: number, b: number) => {
        const mapped: number[] = [];
        for (let r = t; r <= b; r++) {
          if (!inMap(r)) return false;
          mapped.push(rowMap[r]);
        }
        mapped.sort((a, b) => a - b);
        for (let i = 1; i < mapped.length; i++) {
          if (mapped[i] !== mapped[i - 1] + 1) return false;
        }
        return true;
      };
      sheetData.properties.merges.forEach((m: any) => {
        if (m.top === 1 && m.bottom === 1) {
          // 表头合并保持
          merges.push({ ...m });
        } else if (inMap(m.top) && inMap(m.bottom) && isContiguous(m.top, m.bottom)) {
          merges.push({ top: rowMap[m.top], bottom: rowMap[m.bottom], left: m.left, right: m.right });
        }
      });
      newProperties.merges = merges;
    }
    
    return {
      name: uniqueName,
      originalName: uniqueName,
      data: [headers, ...filteredRows],
      totalRows: filteredRows.length,
      totalCols: headers.length,
      styles: newStyles,
      formulas: newFormulas,
      richTextRuns: newRichTextRuns,
      properties: newProperties,
      originalWorkbook: sheetData.originalWorkbook, // 保留原始workbook引用
      sourceFileId: sheetData.sourceFileId
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
  
  // 创建合并后的样式/公式/富文本容器
  const mergedStyles: any = {};
  const mergedFormulas: any = {};
  const mergedRichText: any = {};
  let currentRowIndex = 1; // 从第2行开始（第1行是表头）
  const mergedRowProps: any[] = [];

  if (sheets[0].properties?.rows?.[0]) {
    mergedRowProps[0] = sheets[0].properties.rows[0];
  }

  // 合并每个sheet的数据
  sheets.forEach(sheet => {
    const sheetHeaders = sheet.data[0] || [];
    const sheetRows = sheet.data.slice(1);

    // 为每一行数据创建完整的行
    sheetRows.forEach((row, rowIdx) => {
      const mergedRow = new Array(allColumns.length).fill(null);
      
      // 根据列名映射数据
      sheetHeaders.forEach((header, index) => {
        const targetIndex = allColumns.indexOf(header);
        if (targetIndex !== -1 && row[index] !== undefined) {
          mergedRow[targetIndex] = row[index];
        }
      });

      mergedData.push(mergedRow);
      
      // 处理样式/公式/富文本信息（该行）
      const originalRowIndex = rowIdx + 2; // 原始行号（+2因为表头占第1行）

      const originalRowProps = sheet.properties?.rows?.[originalRowIndex - 1];
      if (originalRowProps) {
        mergedRowProps[currentRowIndex] = { ...originalRowProps };
      }

      // 样式
      if (sheet.styles) {
        Object.keys(sheet.styles).forEach(cellKey => {
          const [rowStr, colStr] = cellKey.split('_');
          const originalRow = parseInt(rowStr, 10);
          const originalCol = parseInt(colStr, 10);
          if (originalRow === originalRowIndex) {
            const header = sheetHeaders[originalCol - 1]; // 注意：样式key是1-based
            if (header) {
              const targetColIndex = allColumns.indexOf(header);
              if (targetColIndex !== -1) {
                const newCellKey = `${currentRowIndex + 1}_${targetColIndex + 1}`;
                mergedStyles[newCellKey] = sheet.styles![cellKey];
              }
            }
          }
        });
      }

      // 公式
      if (sheet.formulas) {
        Object.keys(sheet.formulas).forEach(cellKey => {
          const [rowStr, colStr] = cellKey.split('_');
          const originalRow = parseInt(rowStr, 10);
          const originalCol = parseInt(colStr, 10);
          if (originalRow === originalRowIndex) {
            const header = sheetHeaders[originalCol - 1];
            if (header) {
              const targetColIndex = allColumns.indexOf(header);
              if (targetColIndex !== -1) {
                const newRowNumber = currentRowIndex + 1;
                const newKey = `${newRowNumber}_${targetColIndex + 1}`;
                const rowOffset = newRowNumber - originalRow;
                mergedFormulas[newKey] = adjustFormulaRowReferences(sheet.formulas![cellKey], rowOffset);
              }
            }
          }
        });
      }

      // 富文本
      if (sheet.richTextRuns) {
        Object.keys(sheet.richTextRuns).forEach(cellKey => {
          const [rowStr, colStr] = cellKey.split('_');
          const originalRow = parseInt(rowStr, 10);
          const originalCol = parseInt(colStr, 10);
          if (originalRow === originalRowIndex) {
            const header = sheetHeaders[originalCol - 1];
            if (header) {
              const targetColIndex = allColumns.indexOf(header);
              if (targetColIndex !== -1) {
                const newKey = `${currentRowIndex + 1}_${targetColIndex + 1}`;
                mergedRichText[newKey] = sheet.richTextRuns![cellKey];
              }
            }
          }
        });
      }
      
      currentRowIndex++;
    });
  });

  // 处理表头样式：遍历所有 sheet，确保每个列头都能找到样式
  sheets.forEach(sheet => {
    if (!sheet.styles) return;
    Object.keys(sheet.styles).forEach(cellKey => {
      const [rowStr, colStr] = cellKey.split('_');
      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);
      if (rowIndex === 1) {
        const header = sheet.data[0]?.[colIndex - 1];
        if (!header) return;
        const targetColIndex = allColumns.indexOf(header);
        if (targetColIndex !== -1) {
          const newCellKey = `1_${targetColIndex + 1}`;
          if (!mergedStyles[newCellKey]) {
            mergedStyles[newCellKey] = sheet.styles![cellKey];
          }
        }
      }
    });
  });

  sheets.forEach(sheet => {
    if (!sheet.richTextRuns) return;
    Object.keys(sheet.richTextRuns).forEach(cellKey => {
      const [rowStr, colStr] = cellKey.split('_');
      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);
      if (rowIndex === 1) {
        const header = sheet.data[0]?.[colIndex - 1];
        if (!header) return;
        const targetColIndex = allColumns.indexOf(header);
        if (targetColIndex !== -1) {
          const newCellKey = `1_${targetColIndex + 1}`;
          if (!mergedRichText[newCellKey]) {
            mergedRichText[newCellKey] = sheet.richTextRuns![cellKey];
          }
        }
      }
    });
  });

  // 生成唯一的sheet名称
  const uniqueName = generateUniqueSheetName(mergedSheetName, existingSheets);
  const sourceIds = Array.from(new Set(sheets.map(sheet => sheet.sourceFileId).filter(Boolean)));
  const mergedSourceId = sourceIds.length === 1 ? sourceIds[0] : undefined;

  return {
    name: uniqueName,
    originalName: uniqueName,
    data: mergedData,
    totalRows: mergedData.length - 1,
    totalCols: allColumns.length,
    styles: mergedStyles,
    formulas: mergedFormulas,
    richTextRuns: mergedRichText,
    properties: buildMergedProperties(sheets, allColumns, mergedRowProps),
    originalWorkbook: sheets[0].originalWorkbook, // 保留第一个sheet的原始workbook引用
    sourceFileId: mergedSourceId
  };
};

/**
 * 根据合并后的表头，构建合并后工作表属性（列宽/表头合并）
 * 行高等与数据行绑定的属性在合并后意义不大，保留默认值即可
 */
const buildMergedProperties = (sheets: SheetData[], allColumns: string[], mergedRows: any[]) => {
  const first = sheets[0];
  const props: any = {};

  // 列宽/隐藏：按 allColumns 从可用的第一个来源拷贝
  const columns: any[] = new Array(allColumns.length).fill(null);
  allColumns.forEach((name, i) => {
    for (const s of sheets) {
      const headers = s.data[0] || [];
      const idx = headers.indexOf(name);
      if (idx !== -1 && s.properties?.columns?.[idx]) {
        const col = s.properties.columns[idx];
        columns[i] = { width: col.width, hidden: col.hidden, style: col.style };
        break;
      }
    }
  });
  props.columns = columns;

  // 表头合并单元格映射（只处理第1行）
  const headerMerges: any[] = [];
  const firstHeaders = first.data[0] || [];
  const firstMerges = first.properties?.merges || [];
  firstMerges.forEach((m: any) => {
    if (m.top === 1 && m.bottom === 1) {
      // 将 left..right 的原列索引映射到合并后索引
      const mappedCols: number[] = [];
      for (let c = m.left; c <= m.right; c++) {
        const h = firstHeaders[c - 1];
        const newIdx = allColumns.indexOf(h);
        if (newIdx !== -1) mappedCols.push(newIdx + 1); // 1-based
      }
      if (mappedCols.length) {
        mappedCols.sort((a, b) => a - b);
        // 仅当映射后仍连续时保留该合并
        let isContiguous = true;
        for (let i = 1; i < mappedCols.length; i++) {
          if (mappedCols[i] !== mappedCols[i - 1] + 1) { isContiguous = false; break; }
        }
        if (isContiguous) {
          headerMerges.push({ top: 1, bottom: 1, left: mappedCols[0], right: mappedCols[mappedCols.length - 1] });
        }
      }
    }
  });
  if (headerMerges.length) props.merges = headerMerges;

  if (mergedRows && mergedRows.length) {
    props.rows = mergedRows;
  }

  return props;
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

/**
 * 导出选项接口
 */
export interface ExportOptions {
  fileName: string;
  separateFiles: boolean;
  preserveFormulas: boolean;
  // 可选：导出时使用原始文件缓冲区重载workbook，最大化保留样式/公式
  originalBuffer?: ArrayBuffer;
}

// 简单判断originalWorkbook是否可用（跨worker传递后对象方法会丢失）
const canUseOriginalWorkbook = (wb: any): boolean => {
  try {
    return !!(wb && typeof wb.getWorksheet === 'function' && Array.isArray(wb.worksheets));
  } catch (_) {
    return false;
  }
};

// 调整公式中的相对行引用（无$的行号）以补偿行偏移
const adjustFormulaRowReferences = (formula: string, rowOffset: number): string => {
  if (!rowOffset || !formula || typeof formula !== 'string') {
    return formula;
  }

  const cellRefRegex = /((?:'[^']+'|[^!\s"']+)!\s*)?(\$?[A-Z]{1,3})(\$?)(\d+)/g;
  return formula.replace(cellRefRegex, (match, sheetPrefix = '', columnPart, rowAbsFlag, rowDigits) => {
    if (rowAbsFlag === '$') {
      return `${sheetPrefix || ''}${columnPart}${rowAbsFlag}${rowDigits}`;
    }
    const newRow = parseInt(rowDigits, 10) + rowOffset;
    if (Number.isNaN(newRow) || newRow <= 0) {
      return match;
    }
    return `${sheetPrefix || ''}${columnPart}${newRow}`;
  });
};

// 删除不再需要的旧函数

// 删除不再需要的旧函数

/**
 * 从原始workbook创建工作簿，保留所有格式信息
 */
const createWorkbookFromOriginal = (selectedSheets: SheetData[], options: ExportOptions): ExcelJS.Workbook => {
  // 使用第一个sheet的原始workbook作为基础
  const baseWorkbook = selectedSheets[0].originalWorkbook as ExcelJS.Workbook;
  
  // 创建新的workbook
  const newWorkbook = new ExcelJS.Workbook();
  
  // 复制工作簿级别的属性
  newWorkbook.creator = baseWorkbook.creator || 'Blink Excel Processor';
  newWorkbook.lastModifiedBy = baseWorkbook.lastModifiedBy || 'Blink Excel Processor';
  newWorkbook.created = baseWorkbook.created || new Date();
  newWorkbook.modified = baseWorkbook.modified || new Date();
  newWorkbook.company = baseWorkbook.company;
  newWorkbook.title = baseWorkbook.title;
  newWorkbook.subject = baseWorkbook.subject;
  newWorkbook.keywords = baseWorkbook.keywords;
  newWorkbook.description = baseWorkbook.description;
  newWorkbook.category = baseWorkbook.category;
  
  // 为每个选中的sheet添加工作表
  selectedSheets.forEach(sheetData => {
    // 检查 baseWorkbook 是否有 getWorksheet 方法
    let originalWorksheet;
    if (typeof baseWorkbook.getWorksheet === 'function') {
      originalWorksheet = baseWorkbook.getWorksheet(sheetData.name);
    } else if (baseWorkbook.worksheets) {
      // 如果 getWorksheet 方法不存在，尝试从 worksheets 数组中查找
      originalWorksheet = baseWorkbook.worksheets.find(ws => ws.name === sheetData.name);
    }
    
    if (originalWorksheet) {
      // 日志：原始工作表是否具备必要方法
      try {
        console.log('[excelExport] using original worksheet copy:', {
          name: sheetData.name,
          hasEachRow: typeof (originalWorksheet as any).eachRow === 'function',
          hasModel: !!(originalWorksheet as any).model,
          colCount: (originalWorksheet as any).columnCount,
          rowCount: (originalWorksheet as any).rowCount,
        });
      } catch (_) {}
      // 深度复制原始工作表，保留所有格式
      const copiedWorksheet = newWorkbook.addWorksheet(sheetData.name);
      
      // 复制工作表级别的属性
      if (originalWorksheet.properties) {
        copiedWorksheet.properties = { ...originalWorksheet.properties };
      }
      
      // 复制列设置
      if (originalWorksheet.columns && originalWorksheet.columns.length > 0) {
        copiedWorksheet.columns = originalWorksheet.columns.map(col => ({
          ...col,
          style: col.style ? { ...col.style } : undefined
        }));
      }
      
      // 复制合并单元格
      if (originalWorksheet.model && originalWorksheet.model.merges) {
        originalWorksheet.model.merges.forEach((merge: any) => {
          copiedWorksheet.mergeCells(merge.top, merge.left, merge.bottom, merge.right);
        });
      }
      
      // 复制保护设置
      if ((originalWorksheet as any).protection) {
        (copiedWorksheet as any).protection = { ...(originalWorksheet as any).protection };
      }
      
      // 复制单元格数据和样式
      // 注意：row.eachCell 可能跳过“仅有样式但无值”的单元格（如空格子仅设置边框），
      // 为了完整保留样式，这里按 sheetData 的行列范围做全矩阵遍历。
      const rowsToCopy = Math.max(originalWorksheet.rowCount || 0, sheetData.totalRows || 0);
      const colsToCopy = Math.max(originalWorksheet.columnCount || 0, sheetData.totalCols || 0);
      let copiedFormulaCells = 0;
      let copiedStyledCells = 0;
      for (let rowNumber = 1; rowNumber <= rowsToCopy; rowNumber++) {
        for (let colNumber = 1; colNumber <= colsToCopy; colNumber++) {
          const cell = originalWorksheet.getCell(rowNumber, colNumber);
          const newCell = copiedWorksheet.getCell(rowNumber, colNumber);

          // 复制值（含公式）
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && 'result' in cell.value) {
              newCell.value = {
                formula: (cell.value as any).formula,
                result: (cell.value as any).result,
                sharedFormula: undefined
              } as any;
              copiedFormulaCells++;
            } else {
              newCell.value = cell.value as any;
            }
          } else {
            // 强制“触发”空单元格的存在，方便应用样式
            newCell.value = newCell.value ?? null;
          }

          // 复制样式（包含仅样式的空单元格）
          if (cell.style && Object.keys(cell.style).length > 0) {
            // 边框颜色缺省时，Excel 默认是黑色；保持与原始一致：直接复制（exceljs会处理默认）
            newCell.style = { ...cell.style } as any;
            copiedStyledCells++;
          }
        }
      }
      
      // 复制行高
      originalWorksheet.eachRow((row, rowNumber) => {
        if (row.height) {
          copiedWorksheet.getRow(rowNumber).height = row.height;
        }
      });
      try {
        console.log('[excelExport] copied sheet stats:', {
          name: sheetData.name,
          copiedFormulaCells,
          copiedStyledCells,
          merges: (originalWorksheet as any).model?.merges?.length || 0,
        });
      } catch (_) {}
    } else {
      // 如果没有原始工作表，则使用createWorksheetFromSheetData创建
      try { console.warn(`[excelExport] original worksheet not found, fallback: ${sheetData.name}`); } catch (_) {}
      createWorksheetFromSheetData(sheetData, options, newWorkbook);
    }
  });
  
  return newWorkbook;
};

/**
 * 从SheetData创建工作表 - 保留原始样式和公式
 */
const createWorksheetFromSheetData = (sheetData: SheetData, _options: ExportOptions, targetWorkbook?: ExcelJS.Workbook): ExcelJS.Worksheet => {
  
  // 如果有原始workbook，直接使用原始工作表
  if (sheetData.originalWorkbook) {
    let originalWorksheet;
    if (typeof sheetData.originalWorkbook.getWorksheet === 'function') {
      originalWorksheet = sheetData.originalWorkbook.getWorksheet(sheetData.name);
    } else if (sheetData.originalWorkbook.worksheets) {
      originalWorksheet = sheetData.originalWorkbook.worksheets.find((ws: any) => ws.name === sheetData.name);
    }
    
    if (originalWorksheet) {
      return originalWorksheet;
    }
  }
  
  // 在目标工作簿中直接创建工作表
  const worksheet = targetWorkbook ? targetWorkbook.addWorksheet(sheetData.name) : new ExcelJS.Workbook().addWorksheet(sheetData.name);
  
  // 设置工作表属性
  worksheet.properties = {
    defaultRowHeight: 15,
    defaultColWidth: 10
  } as any;
  
        // 添加数据到工作表
        let createdFormulaCells = 0;
        sheetData.data.forEach((row, rowIndex) => {
          const worksheetRow = worksheet.getRow(rowIndex + 1);
          
          row.forEach((cell, colIndex) => {
            const cellAddress = worksheetRow.getCell(colIndex + 1);
            const normalizedValue = cell === '' ? null : cell;
            
            // 检查是否有公式
            const cellKey = `${rowIndex + 1}_${colIndex + 1}`;
            if (sheetData.richTextRuns && sheetData.richTextRuns[cellKey]) {
              // 优先还原富文本（保留局部颜色/样式）
              const runs = sheetData.richTextRuns[cellKey];
              cellAddress.value = {
                richText: runs.map((rt: any) => ({
                  text: rt.text,
                  font: rt.font ? { ...rt.font } : undefined
                }))
              } as any;
            } else if (sheetData.formulas && sheetData.formulas[cellKey]) {
              // 公式单元格
              cellAddress.value = {
                formula: sheetData.formulas[cellKey],
                result: normalizedValue === null ? undefined : normalizedValue,
                sharedFormula: undefined
              } as any;
              createdFormulaCells++;
            } else {
              cellAddress.value = normalizedValue;
            }
            
            // 样式将在数据添加完成后统一处理
          });
    
  });
  
  // 处理所有样式信息，包括空单元格的样式
  if (sheetData.styles) {
    let appliedStyledCells = 0;
    Object.keys(sheetData.styles).forEach(cellKey => {
      const [rowStr, colStr] = cellKey.split('_');
      const rowIndex = parseInt(rowStr) - 1;
      const colIndex = parseInt(colStr) - 1;
      
      // 获取单元格
      const cellAddress = worksheet.getCell(rowIndex + 1, colIndex + 1);
      const style = sheetData.styles[cellKey];
      
      // 应用样式 - 无论单元格是否有值都要应用样式
      if (style) {
        // 应用字体样式
        // 如果该单元格是富文本，不要覆盖其局部字体样式
        const isRichText = !!(sheetData.richTextRuns && sheetData.richTextRuns[cellKey]);
        if (style.font && !isRichText) {
          cellAddress.font = {
            name: style.font.name,
            size: style.font.size,
            bold: style.font.bold,
            italic: style.font.italic,
            underline: style.font.underline,
            strike: style.font.strike,
            color: style.font.color
          };
        }
        
        // 应用填充样式
        if (style.fill) {
          const fillStyle: any = {};
          if (style.fill.type) {
            fillStyle.type = style.fill.type;
          }
          if (style.fill.pattern) {
            fillStyle.pattern = style.fill.pattern;
          }
          if (style.fill.fgColor) {
            fillStyle.fgColor = {
              argb: style.fill.fgColor.argb,
              theme: style.fill.fgColor.theme
            };
          }
          if (style.fill.bgColor) {
            fillStyle.bgColor = {
              argb: style.fill.bgColor.argb,
              theme: style.fill.bgColor.theme
            };
          }
          cellAddress.fill = fillStyle;
        }
        
        // 应用边框样式
        if (style.border) {
          const borderStyle: any = {};
          // 设置时避免写入 undefined 的 color，部分表格软件（如 WPS）会将其解释为“无边框”
          if (style.border.top) {
            borderStyle.top = { style: style.border.top.style } as any;
            if (style.border.top.color) borderStyle.top.color = style.border.top.color;
          }
          if (style.border.left) {
            borderStyle.left = { style: style.border.left.style } as any;
            if (style.border.left.color) borderStyle.left.color = style.border.left.color;
          }
          if (style.border.bottom) {
            borderStyle.bottom = { style: style.border.bottom.style } as any;
            if (style.border.bottom.color) borderStyle.bottom.color = style.border.bottom.color;
          }
          if (style.border.right) {
            borderStyle.right = { style: style.border.right.style } as any;
            if (style.border.right.color) borderStyle.right.color = style.border.right.color;
          }
          if (style.border.diagonal) {
            borderStyle.diagonal = { style: style.border.diagonal.style } as any;
            if (style.border.diagonal.color) borderStyle.diagonal.color = style.border.diagonal.color;
          }
          cellAddress.border = borderStyle;
        }
        
        // 应用对齐样式
        if (style.alignment) {
          cellAddress.alignment = {
            horizontal: style.alignment.horizontal,
            vertical: style.alignment.vertical,
            wrapText: style.alignment.wrapText,
            textRotation: style.alignment.textRotation,
            indent: style.alignment.indent,
            readingOrder: style.alignment.readingOrder
          };
        }
        
        // 应用数字格式
        if (style.numFmt) {
          cellAddress.numFmt = style.numFmt;
        }
        
        // 应用保护样式
        if (style.protection) {
          cellAddress.protection = {
            locked: style.protection.locked,
            hidden: style.protection.hidden
          };
        }
        appliedStyledCells++;
      }
    });
    try {
      console.log('[excelExport] rebuilt sheet from data:', {
        name: sheetData.name,
        createdFormulaCells,
        appliedStyledCells,
        merges: sheetData.properties?.merges?.length || 0,
      });
    } catch (_) {}
  }
  
  // 设置列宽
  if (sheetData.properties && sheetData.properties.columns) {
    sheetData.properties.columns.forEach((col: any, index: number) => {
      if (col.width) {
        worksheet.getColumn(index + 1).width = col.width;
      }
      if (col.hidden) {
        worksheet.getColumn(index + 1).hidden = col.hidden;
      }
      // 若存在列级样式，应用之（alignment/numFmt/font 等），有助于保持与原始文件一致
      if (col.style && typeof col.style === 'object') {
        try {
          // 避免覆盖富文本单元格的局部字体，列级样式不包含 richText 概念，仅作默认设置
          (worksheet.getColumn(index + 1) as any).style = { ...(col.style as any) };
        } catch (_) {}
      }
    });
    } else {
    // 默认列宽设置
    const colWidths = sheetData.data[0]?.map((header, index) => {
      const maxLength = Math.max(
        String(header).length,
        ...sheetData.data.slice(1).map(row => String(row[index] || '').length)
      );
      return Math.min(Math.max(maxLength, 10), 50);
    }) || [];
    
    colWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
  }
  
  // 设置行高
  if (sheetData.properties && sheetData.properties.rows) {
    sheetData.properties.rows.forEach((row: any, index: number) => {
      if (row && row.height) {
        worksheet.getRow(index + 1).height = row.height;
      }
    });
  }
  
  // 设置合并单元格
  if (sheetData.properties && sheetData.properties.merges) {
    sheetData.properties.merges.forEach((merge: any) => {
      worksheet.mergeCells(merge.top, merge.left, merge.bottom, merge.right);
    });
  }
  
  return worksheet;
};

/**
 * 导出多个sheets为Excel文件（使用ExcelJS）
 */
export const exportToExcel = async (
  selectedSheets: SheetData[],
  options: ExportOptions
): Promise<void> => {
  try {
    let tauriDialog;
    let tauriFs;
    
    try {
      tauriDialog = await import('@tauri-apps/plugin-dialog');
      tauriFs = await import('@tauri-apps/plugin-fs');
    } catch (err) {
      console.warn('Tauri API不可用，回退到浏览器下载', err);
      return exportToExcelBrowser(selectedSheets, options);
    }
    
    // 如果选择分别导出每个sheet为单独文件
    if (options.separateFiles) {
      for (const sheet of selectedSheets) {
        await exportSingleSheetTauri(sheet, options, tauriDialog, tauriFs);
      }
      return;
    }
    
    // 检查是否所有sheet都有且可用的原始workbook信息
    const hasOriginalWorkbook = selectedSheets.every(sheet => sheet.originalWorkbook);
    const hasUsableOriginalWorkbook = selectedSheets.every(sheet => canUseOriginalWorkbook(sheet.originalWorkbook));
    
    // 如果提供了原始文件缓冲区，优先尝试重载（可最大化保留样式/公式，避免worker跨线程导致的方法丢失）
    let reloadedWorkbook: ExcelJS.Workbook | null = null;
    if (options.originalBuffer) {
      try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(options.originalBuffer);
        reloadedWorkbook = wb;
        console.log('[excelExport] strategy=reload-from-buffer', { sheetNames: selectedSheets.map(s => s.name), worksheets: wb.worksheets?.length });
      } catch (e) {
        console.warn('[excelExport] failed to reload from buffer, will fallback', e);
        reloadedWorkbook = null;
      }
    }
    
    let workbook: ExcelJS.Workbook;
    
    if (reloadedWorkbook) {
      // 用缓冲区重载的workbook进行复制
      const patched = selectedSheets.map(s => ({ ...s, originalWorkbook: reloadedWorkbook! }));
      workbook = createWorkbookFromOriginal(patched, options);
    } else if (hasOriginalWorkbook && hasUsableOriginalWorkbook) {
      // 使用原始workbook对象，保留所有格式信息
      try { console.log('[excelExport] strategy=copy-original', { sheetNames: selectedSheets.map(s => s.name) }); } catch (_) {}
      workbook = createWorkbookFromOriginal(selectedSheets, options);
    } else {
      // 创建新的工作簿
      try { console.log('[excelExport] strategy=rebuild-from-data', { hasOriginalWorkbook, hasUsableOriginalWorkbook }); } catch (_) {}
      workbook = new ExcelJS.Workbook();
      
      // 设置工作簿属性
      workbook.creator = 'Blink Excel Processor';
      workbook.lastModifiedBy = 'Blink Excel Processor';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // 为每个选中的sheet创建工作表
      selectedSheets.forEach(sheetData => {
        createWorksheetFromSheetData(sheetData, options, workbook);
      });
    }
    
    // 生成Excel文件
    const excelBuffer = await workbook.xlsx.writeBuffer();
    
    // 使用Tauri的对话框API保存文件
    const filePath = await tauriDialog.save({
      title: '保存Excel文件',
      filters: [{
        name: 'Excel文件',
        extensions: ['xlsx']
      }],
      defaultPath: `${options.fileName}.xlsx`
    });
    
    if (filePath) {
      const uint8Array = new Uint8Array(excelBuffer);
      await tauriFs.writeFile(filePath, uint8Array);
    }
    
  } catch (error) {
    // 提供更详细的错误信息
    if (error instanceof Error) {
      throw new Error(`导出Excel文件失败: ${error.message}`);
    } else {
      throw new Error('导出Excel文件失败，请检查文件格式和权限设置');
    }
  }
};

/**
 * 导出单个sheet为Excel文件（使用ExcelJS）
 */
const exportSingleSheetTauri = async (
  sheetData: SheetData,
  options: ExportOptions,
  tauriDialog: any,
  tauriFs: any
): Promise<void> => {
  // 创建新工作簿
  const workbook = new ExcelJS.Workbook();
  
  // 设置工作簿属性
  workbook.creator = 'Blink Excel Processor';
  workbook.lastModifiedBy = 'Blink Excel Processor';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // 创建工作表
  createWorksheetFromSheetData(sheetData, options, workbook);
  
  // 生成Excel文件
  const excelBuffer = await workbook.xlsx.writeBuffer();
  
  // 使用Tauri的对话框API保存文件
  const fileName = `${options.fileName}_${sheetData.name}`;
  const filePath = await tauriDialog.save({
    title: '保存Excel文件',
    filters: [{
      name: 'Excel文件',
      extensions: ['xlsx']
    }],
    defaultPath: `${fileName}.xlsx`
  });
  
  if (filePath) {
    // 使用Tauri的文件系统API写入文件
    const uint8Array = new Uint8Array(excelBuffer);
    await tauriFs.writeFile(filePath, uint8Array);
  }
};

/**
 * 浏览器中导出Excel文件（Tauri API不可用时的备选方案）
 */
const exportToExcelBrowser = async (
  selectedSheets: SheetData[],
  options: ExportOptions
): Promise<void> => {
  // 创建新工作簿
  const workbook = new ExcelJS.Workbook();
  
  // 设置工作簿属性
  workbook.creator = 'Blink Excel Processor';
  workbook.lastModifiedBy = 'Blink Excel Processor';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // 为每个选中的sheet创建工作表
  selectedSheets.forEach(sheetData => {
    createWorksheetFromSheetData(sheetData, options, workbook);
  });
  
  // 生成Excel文件
  const excelBuffer = await workbook.xlsx.writeBuffer();
  
  // 创建Blob对象
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${options.fileName}.xlsx`;
  link.style.display = 'none';
  
  // 添加到文档并触发下载
  document.body.appendChild(link);
  link.click();
  
  // 清理
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

// 删除不再需要的旧函数

/**
 * 验证导出的Excel文件样式是否正确保留
 */
export const validateExportedStyles = async (originalWorkbook: ExcelJS.Workbook, exportedWorkbook: ExcelJS.Workbook): Promise<boolean> => {
  
  let allStylesPreserved = true;
  
  // 检查每个工作表
  exportedWorkbook.worksheets.forEach(worksheet => {
    const originalWorksheet = originalWorkbook.getWorksheet(worksheet.name);
    
    if (!originalWorksheet) {
      console.warn(`工作表 ${worksheet.name} 在原始文件中不存在`);
      return;
    }
    
    // 检查列宽
    const originalCols = originalWorksheet.columns;
    const exportedCols = worksheet.columns;
    if (originalCols && exportedCols) {
      const colsMatch = JSON.stringify(originalCols) === JSON.stringify(exportedCols);
      if (!colsMatch) allStylesPreserved = false;
    }
    
    // 检查行高
    const originalRows = originalWorksheet.rowCount;
    const exportedRows = worksheet.rowCount;
    if (originalRows && exportedRows) {
      const rowsMatch = originalRows === exportedRows;
      if (!rowsMatch) allStylesPreserved = false;
    }
    
    // 检查合并单元格
    const originalMerges = originalWorksheet.model?.merges;
    const exportedMerges = worksheet.model?.merges;
    if (originalMerges && exportedMerges) {
      const mergesMatch = JSON.stringify(originalMerges) === JSON.stringify(exportedMerges);
      if (!mergesMatch) allStylesPreserved = false;
    }
    
    // 检查单元格样式
      let styledCellsMatch = 0;
      let totalCells = 0;
      
    originalWorksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
          totalCells++;
          
        const exportedCell = worksheet.getCell(rowNumber, colNumber);
          
        if (cell.style && exportedCell.style) {
          const stylesMatch = JSON.stringify(cell.style) === JSON.stringify(exportedCell.style);
            if (stylesMatch) styledCellsMatch++;
            else {
            console.warn(`  单元格 ${rowNumber},${colNumber} 样式不匹配`);
            }
          }
      });
    });
      
      if (styledCellsMatch < totalCells) allStylesPreserved = false;
  });
  
  return allStylesPreserved;
};
