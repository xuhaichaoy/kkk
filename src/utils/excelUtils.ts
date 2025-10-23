/**
 * Excel数据处理工具函数
 */

import * as ExcelJS from 'exceljs';

export interface WorksheetAdvancedProperties {
  views?: Array<Record<string, any>>;
  freezePanes?: {
    state?: 'frozen' | 'split';
    xSplit?: number;
    ySplit?: number;
    topLeftCell?: string;
    activeCell?: string;
  };
  dataValidations?: Record<string, any>;
  conditionalFormattings?: any[];
  comments?: Record<string, { text: string; author?: string }>;
  tables?: Array<{
    name: string;
    displayName?: string;
    ref: string;
    headerRow?: boolean;
    totalsRow?: boolean;
    style?: {
      theme?: string;
      showRowStripes?: boolean;
      showColumnStripes?: boolean;
      showFirstColumn?: boolean;
      showLastColumn?: boolean;
    };
    columns?: Array<{ name: string; totalsRowFunction?: string; totalsRowLabel?: string }>;
  }>;
  images?: Array<{
    name?: string;
    range?: Record<string, any>;
    imageId?: number;
    hyperlink?: string;
    altText?: string;
  }>;
}

export interface WorksheetProperties extends WorksheetAdvancedProperties {
  columnCount?: number;
  rowCount?: number;
  columns?: Array<{ width?: number; hidden?: boolean; style?: any }>;
  rows?: Array<{ height?: number; hidden?: boolean } | undefined>;
  autoFilter?: any;
  merges?: Array<{ top: number; left: number; bottom: number; right: number }>;
  protection?: any;
}

export interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
  headerRowIndex?: number; // 表头所在的行（0-based）
  headerDetectionMode?: 'auto' | 'manual';
  styles?: any; // 原始样式信息
  formulas?: any; // 原始公式信息
  // 富文本 runs（按单元格地址，如 "1_1"），用于保留局部颜色/加粗等
  richTextRuns?: { [cellKey: string]: any[] };
  properties?: WorksheetProperties; // 工作表级别的属性（列宽、行高、合并单元格等）
  originalWorkbook?: any; // 原始workbook对象引用
  sourceFileId?: string; // 来源文件标识，用于多文件管理
  originalName?: string; // 原始sheet名称（用于去重）
  internalId?: string; // 内部唯一标识（用于流式解析组装）
}

export interface EditedRowData {
  [key: string]: { [key: string]: any };
}

export const DEFAULT_HEADER_ROW_INDEX = 0;

const columnLettersToNumber = (letters: string): number => {
  let result = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i);
    if (code < 65 || code > 90) {
      return NaN;
    }
    result = result * 26 + (code - 64);
  }
  return result;
};

const parseCellAddress = (address: string | undefined | null): { row: number; column: number } | null => {
  if (!address) {
    return null;
  }
  const match = String(address).match(/^([A-Za-z]+)(\d+)$/);
  if (!match) {
    return null;
  }
  const column = columnLettersToNumber(match[1]);
  const row = parseInt(match[2], 10);
  if (!Number.isFinite(column) || Number.isNaN(row)) {
    return null;
  }
  return { row, column };
};

export const normalizeMergeRange = (merge: any): { top: number; left: number; bottom: number; right: number } | null => {
  if (!merge) {
    return null;
  }

  if (typeof merge === 'string') {
    const [start, end] = merge.split(':');
    const startCell = parseCellAddress(start);
    const endCell = parseCellAddress(end || start);
    if (!startCell || !endCell) {
      return null;
    }
    return {
      top: Math.min(startCell.row, endCell.row),
      bottom: Math.max(startCell.row, endCell.row),
      left: Math.min(startCell.column, endCell.column),
      right: Math.max(startCell.column, endCell.column)
    };
  }

  if (typeof merge === 'object') {
    if (
      typeof merge.top === 'number' &&
      typeof merge.left === 'number' &&
      typeof merge.bottom === 'number' &&
      typeof merge.right === 'number'
    ) {
      return {
        top: merge.top,
        left: merge.left,
        bottom: merge.bottom,
        right: merge.right
      };
    }

    const topLeft = parseCellAddress(merge.tl || merge.topLeft);
    const bottomRight = parseCellAddress(merge.br || merge.bottomRight);
    if (topLeft && bottomRight) {
      return {
        top: Math.min(topLeft.row, bottomRight.row),
        bottom: Math.max(topLeft.row, bottomRight.row),
        left: Math.min(topLeft.column, bottomRight.column),
        right: Math.max(topLeft.column, bottomRight.column)
      };
    }
  }

  return null;
};

export const detectHeaderRowIndex = (rows: any[][]): number => {
  if (!Array.isArray(rows)) {
    return DEFAULT_HEADER_ROW_INDEX;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) {
      continue;
    }

    const hasValue = row.some(cell => {
      if (cell === null || cell === undefined) {
        return false;
      }
      if (typeof cell === 'string') {
        return cell.trim() !== '';
      }
      if (typeof cell === 'number') {
        return true;
      }
      if (typeof cell === 'boolean') {
        return true;
      }
      if (cell instanceof Date) {
        return true;
      }
      if (typeof cell === 'object') {
        try {
          if ('richText' in cell && Array.isArray((cell as any).richText)) {
            return (cell as any).richText.some((rt: any) => {
              if (!rt) return false;
              if (typeof rt.text === 'string') {
                return rt.text.trim() !== '';
              }
              if (rt.text !== null && rt.text !== undefined) {
                return String(rt.text).trim() !== '';
              }
              return false;
            });
          }
          if ('text' in cell && typeof (cell as any).text === 'string') {
            return (cell as any).text.trim() !== '';
          }
          if ('result' in cell) {
            const result = (cell as any).result;
            if (result === null || result === undefined) {
              return false;
            }
            return typeof result === 'string' ? result.trim() !== '' : true;
          }
        } catch (_) {
          // ignore structured detection errors
        }
        const text = String(cell);
        return text.trim() !== '' && text !== '[object Object]';
      }
      const text = String(cell);
      return text.trim() !== '';
    });

    if (hasValue) {
      return i;
    }
  }

  return DEFAULT_HEADER_ROW_INDEX;
};

export const getHeaderRowIndex = (sheet: SheetData): number => {
  const candidate = typeof sheet.headerRowIndex === 'number' ? sheet.headerRowIndex : DEFAULT_HEADER_ROW_INDEX;
  if (!Array.isArray(sheet.data) || sheet.data.length === 0) {
    return DEFAULT_HEADER_ROW_INDEX;
  }
  if (candidate < 0) {
    return DEFAULT_HEADER_ROW_INDEX;
  }
  if (candidate >= sheet.data.length) {
    return Math.max(sheet.data.length - 1, DEFAULT_HEADER_ROW_INDEX);
  }
  return candidate;
};

export const getHeaderRow = (sheet: SheetData): any[] => {
  const headerIndex = getHeaderRowIndex(sheet);
  const row = sheet.data?.[headerIndex];
  return Array.isArray(row) ? row : [];
};

export const getDataRows = (sheet: SheetData): any[][] => {
  const headerIndex = getHeaderRowIndex(sheet);
  if (!Array.isArray(sheet.data)) {
    return [];
  }
  return sheet.data.slice(headerIndex + 1);
};

export const getDataRowCount = (sheet: SheetData): number => {
  if (!Array.isArray(sheet.data) || sheet.data.length === 0) {
    return 0;
  }
  const headerIndex = getHeaderRowIndex(sheet);
  if (headerIndex >= sheet.data.length - 1) {
    return 0;
  }
  return sheet.data.length - headerIndex - 1;
};

export const getExcelRowNumberForDataIndex = (sheet: SheetData, dataRowIndex: number): number => {
  const headerIndex = getHeaderRowIndex(sheet);
  return headerIndex + dataRowIndex + 2;
};

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
      const result = (value as any).result;
      if (result === null || result === undefined) {
        return '';
      }
      return typeof result === 'string' ? result : String(result);
    }

    if ('formula' in value) {
      const formulaValue: any = value;
      if (formulaValue.result !== undefined && formulaValue.result !== null) {
        return typeof formulaValue.result === 'string' ? formulaValue.result : String(formulaValue.result);
      }
      if (typeof formulaValue.text === 'string') {
        return formulaValue.text;
      }
      return '';
    }

    if ('text' in value && typeof (value as any).text === 'string') {
      return (value as any).text;
    }

    if ('value' in value && (value as any).value !== undefined && (value as any).value !== null) {
      return String((value as any).value);
    }
    
    // 如果是其他对象，尝试转换为字符串
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
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

export interface ExportContext {
  editedCellMap?: Map<string, Set<string>>;
}

export interface PreparedSheetResult {
  sheet: SheetData;
  editedCells?: Set<string>;
}

export const prepareSheetForExport = (
  sheet: SheetData,
  sheetIndex: number,
  editedRows: EditedRowData | undefined
): PreparedSheetResult => {
  if (!editedRows || sheetIndex < 0) {
    return { sheet };
  }

  const headerIndex = getHeaderRowIndex(sheet);
  const dataRows = Array.isArray(sheet.data) ? sheet.data.slice(headerIndex + 1) : [];
  let hasEdits = false;
  const editedCells = new Set<string>();

  const rowsWithEdits = getRowsWithEdits(dataRows, sheetIndex, editedRows);
  const updatedRows = rowsWithEdits.map((row, rowIdx) => {
    const edits = editedRows[`${sheetIndex}_${rowIdx}`];
    if (edits && Object.keys(edits).length > 0) {
      hasEdits = true;
      Object.keys(edits).forEach(colKey => {
        const colIndex = Number(colKey);
        if (!Number.isNaN(colIndex)) {
          const excelRowNumber = getExcelRowNumberForDataIndex(sheet, rowIdx);
          editedCells.add(`${excelRowNumber}_${colIndex + 1}`);
        }
      });
    }
    return [...row];
  });

  if (!hasEdits) {
    return { sheet };
  }

  const sourceData = Array.isArray(sheet.data) ? sheet.data : [];
  const prefixRows = headerIndex > 0
    ? sourceData.slice(0, headerIndex).map(row => (Array.isArray(row) ? [...row] : []))
    : [];
  const headerSourceRow = sourceData[headerIndex];
  const headerRow = Array.isArray(headerSourceRow) ? [...headerSourceRow] : [];
  const updatedData = [...prefixRows, headerRow, ...updatedRows];
  const maxCols = updatedData.reduce((max, row) => (Array.isArray(row) ? Math.max(max, row.length) : max), 0);

  const updatedSheet: SheetData = {
    ...sheet,
    data: updatedData,
    totalRows: updatedRows.length,
    totalCols: maxCols,
    headerRowIndex: headerIndex
  };

  return {
    sheet: updatedSheet,
    editedCells: editedCells.size > 0 ? editedCells : undefined
  };
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
  const headers = getHeaderRow(sheetData);
  const dataRows = getDataRows(sheetData);
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
      const oldRow = getExcelRowNumberForDataIndex(sheetData, dataRowIdx);
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
        if (sheetData.properties?.rows?.[oldIdx0]) {
          newProperties.rows[newIdx0] = sheetData.properties.rows[oldIdx0];
        }
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

    // 重新应用表头筛选范围
    newProperties.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: filteredRows.length + 1, column: headers.length }
    };

    return {
      name: uniqueName,
      originalName: uniqueName,
      data: [headers, ...filteredRows],
      totalRows: filteredRows.length,
      totalCols: headers.length,
      headerRowIndex: 0,
      headerDetectionMode: 'manual',
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
  const baseColumns = getHeaderRow(sheets[0]);
  const baseColumnSet = new Set(baseColumns);
  const allColumnsSet = new Set(baseColumns);
  const sheetColumnMapping: { [sheetName: string]: string[] } = {};

  // 收集所有sheet的列信息
  sheets.forEach(sheet => {
    const sheetColumns = getHeaderRow(sheet);
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
  const mergedMerges: any[] = [];

  if (sheets[0].properties?.rows?.[0]) {
    mergedRowProps[0] = sheets[0].properties.rows[0];
  }

  // 合并每个sheet的数据
  sheets.forEach(sheet => {
    const sheetHeaders = getHeaderRow(sheet);
    const sheetRows = getDataRows(sheet);
    const headerRowNumber = getHeaderRowIndex(sheet) + 1;
    const sheetRowIndexMap: Record<number, number> = {
      [headerRowNumber]: 1
    };

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
      const originalRowIndex = getExcelRowNumberForDataIndex(sheet, rowIdx);
      const newRowNumber = currentRowIndex + 1;
      sheetRowIndexMap[originalRowIndex] = newRowNumber;

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
                const newCellKey = `${newRowNumber}_${targetColIndex + 1}`;
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
                const newKey = `${newRowNumber}_${targetColIndex + 1}`;
                mergedRichText[newKey] = sheet.richTextRuns![cellKey];
              }
            }
          }
        });
      }
      
      currentRowIndex++;
    });

    const sheetMerges = sheet.properties?.merges;
    if (Array.isArray(sheetMerges)) {
      sheetMerges.forEach(merge => {
        if (!merge || typeof merge !== 'object') {
          return;
        }
        if (merge.bottom <= headerRowNumber) {
          // 表头合并在后续统一处理
          return;
        }

        const mappedRows: number[] = [];
        for (let r = merge.top; r <= merge.bottom; r++) {
          const mapped = sheetRowIndexMap[r];
          if (!mapped) {
            mappedRows.length = 0;
            break;
          }
          mappedRows.push(mapped);
        }
        if (mappedRows.length === 0) {
          return;
        }
        mappedRows.sort((a, b) => a - b);
        let rowsContiguous = true;
        for (let i = 1; i < mappedRows.length; i++) {
          if (mappedRows[i] !== mappedRows[i - 1] + 1) {
            rowsContiguous = false;
            break;
          }
        }
        if (!rowsContiguous) {
          return;
        }

        const mappedCols: number[] = [];
        for (let c = merge.left; c <= merge.right; c++) {
          const header = sheetHeaders[c - 1];
          if (!header) {
            mappedCols.length = 0;
            break;
          }
          const targetColIndex = allColumns.indexOf(header);
          if (targetColIndex === -1) {
            mappedCols.length = 0;
            break;
          }
          mappedCols.push(targetColIndex + 1);
        }

        if (mappedCols.length === 0) {
          return;
        }
        mappedCols.sort((a, b) => a - b);
        let colsContiguous = true;
        for (let i = 1; i < mappedCols.length; i++) {
          if (mappedCols[i] !== mappedCols[i - 1] + 1) {
            colsContiguous = false;
            break;
          }
        }
        if (!colsContiguous) {
          return;
        }

        const newMerge = {
          top: mappedRows[0],
          bottom: mappedRows[mappedRows.length - 1],
          left: mappedCols[0],
          right: mappedCols[mappedCols.length - 1]
        };

        const exists = mergedMerges.some(item =>
          item.top === newMerge.top &&
          item.bottom === newMerge.bottom &&
          item.left === newMerge.left &&
          item.right === newMerge.right
        );

        if (!exists) {
          mergedMerges.push(newMerge);
        }
      });
    }
  });

  // 处理表头样式：遍历所有 sheet，确保每个列头都能找到样式
  sheets.forEach(sheet => {
    if (!sheet.styles) return;
    const headerRowNumber = getHeaderRowIndex(sheet) + 1;
    const headerRow = getHeaderRow(sheet);
    Object.keys(sheet.styles).forEach(cellKey => {
      const [rowStr, colStr] = cellKey.split('_');
      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);
      if (rowIndex === headerRowNumber) {
        const header = headerRow[colIndex - 1];
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
    const headerRowNumber = getHeaderRowIndex(sheet) + 1;
    const headerRow = getHeaderRow(sheet);
    Object.keys(sheet.richTextRuns).forEach(cellKey => {
      const [rowStr, colStr] = cellKey.split('_');
      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);
      if (rowIndex === headerRowNumber) {
        const header = headerRow[colIndex - 1];
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
    headerRowIndex: 0,
    headerDetectionMode: 'manual',
    styles: mergedStyles,
    formulas: mergedFormulas,
    richTextRuns: mergedRichText,
    properties: (() => {
      const props = buildMergedProperties(sheets, allColumns, mergedRowProps, mergedMerges) || {};
      props.rowCount = mergedData.length;
      props.columnCount = allColumns.length;
      if (!props.autoFilter) {
        props.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: mergedData.length, column: allColumns.length }
        };
      }
      return props;
    })(),
    originalWorkbook: sheets[0].originalWorkbook, // 保留第一个sheet的原始workbook引用
    sourceFileId: mergedSourceId
  };
};

/**
 * 根据合并后的表头，构建合并后工作表属性（列宽/表头合并）
 * 行高等与数据行绑定的属性在合并后意义不大，保留默认值即可
 */
const buildMergedProperties = (sheets: SheetData[], allColumns: string[], mergedRows: any[], baseMerges: any[] = []) => {
  const first = sheets[0];
  const props: any = {};

  // 列宽/隐藏：按 allColumns 从可用的第一个来源拷贝
  const columns: any[] = new Array(allColumns.length).fill(null);
  allColumns.forEach((name, i) => {
    for (const s of sheets) {
      const headers = getHeaderRow(s);
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
  const firstHeaders = getHeaderRow(first);
  const headerRowNumber = getHeaderRowIndex(first) + 1;
  const firstMerges = first.properties?.merges || [];
  firstMerges.forEach((m: any) => {
    if (m.top === headerRowNumber && m.bottom === headerRowNumber) {
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
  const combinedMerges = [...baseMerges];
  if (headerMerges.length) {
    combinedMerges.push(...headerMerges);
  }
  if (combinedMerges.length) props.merges = combinedMerges;

  if (mergedRows && mergedRows.length) {
    props.rows = mergedRows;
  }

  return props;
};

/**
 * 差异对比结果接口
 */
export interface ColumnMapping {
  firstColumnIndex: number;
  secondColumnIndex: number;
  label?: string;
}

export interface ResolvedColumnMapping extends ColumnMapping {
  label: string;
  firstColumnName: string;
  secondColumnName: string;
}

export interface ComparisonOptions {
  alignmentMode?: 'auto' | 'manual';
  manualColumnMappings?: ColumnMapping[];
  keyColumns?: string[];
}

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
      keyValues?: Record<string, string>;
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
  metadata: {
    alignmentMode: 'auto' | 'manual';
    keyColumns: string[];
    manualColumnMappings: ResolvedColumnMapping[];
  };
}

export interface ComparisonMergeSheetOptions {
  sheetName: string;
  includeUniqueFromFirst: boolean;
  includeUniqueFromSecond: boolean;
  includeModifiedRows: boolean;
  highlightChanges: boolean;
  firstSourceLabel?: string;
  secondSourceLabel?: string;
}

/**
 * 比较两个sheet的差异
 */
export const compareSheets = (
  firstSheet: SheetData,
  secondSheet: SheetData,
  firstSheetIndex: number,
  secondSheetIndex: number,
  editedRows: EditedRowData,
  options: ComparisonOptions = {}
): ComparisonResult => {
  const firstHeaders = getHeaderRow(firstSheet);
  const secondHeaders = getHeaderRow(secondSheet);

  const alignmentMode = options.alignmentMode ?? 'auto';
  const manualMappingsInput = Array.isArray(options.manualColumnMappings) ? options.manualColumnMappings : [];
  const resolvedMappings = alignmentMode === 'manual'
    ? resolveManualMappings(manualMappingsInput, firstHeaders, secondHeaders)
    : [];

  const { normalizedFirstHeaders, normalizedSecondHeaders } = normalizeHeadersWithMappings(
    firstHeaders,
    secondHeaders,
    resolvedMappings
  );

  const firstRows = getRowsWithEdits(getDataRows(firstSheet), firstSheetIndex, editedRows);
  const secondRows = getRowsWithEdits(getDataRows(secondSheet), secondSheetIndex, editedRows);

  const firstHeaderSet = new Set(normalizedFirstHeaders);
  const secondHeaderSet = new Set(normalizedSecondHeaders);

  const commonColumns = Array.from(
    new Set(normalizedFirstHeaders.filter(column => secondHeaderSet.has(column)))
  );
  const uniqueToFirst = Array.from(
    new Set(normalizedFirstHeaders.filter(column => !secondHeaderSet.has(column)))
  );
  const uniqueToSecond = Array.from(
    new Set(normalizedSecondHeaders.filter(column => !firstHeaderSet.has(column)))
  );

  const requestedKeyColumns = Array.isArray(options.keyColumns) ? options.keyColumns.filter(Boolean) : [];
  let effectiveKeyColumns = requestedKeyColumns.filter(column => firstHeaderSet.has(column) && secondHeaderSet.has(column));
  if (effectiveKeyColumns.length === 0 && commonColumns.length > 0) {
    effectiveKeyColumns = [commonColumns[0]];
  }

  const dataDifferences = compareDataRows(
    firstRows,
    secondRows,
    normalizedFirstHeaders,
    normalizedSecondHeaders,
    commonColumns,
    effectiveKeyColumns
  );

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
    },
    metadata: {
      alignmentMode,
      keyColumns: effectiveKeyColumns,
      manualColumnMappings: resolvedMappings
    }
  };
};

const resolveManualMappings = (
  mappings: ColumnMapping[],
  firstHeaders: string[],
  secondHeaders: string[]
): ResolvedColumnMapping[] => {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return [];
  }

  const normalized: Map<string, ResolvedColumnMapping> = new Map();

  mappings.forEach(mapping => {
    if (
      typeof mapping.firstColumnIndex !== 'number' ||
      typeof mapping.secondColumnIndex !== 'number'
    ) {
      return;
    }

    const firstIndex = mapping.firstColumnIndex;
    const secondIndex = mapping.secondColumnIndex;

    if (
      firstIndex < 0 ||
      secondIndex < 0 ||
      firstIndex >= firstHeaders.length ||
      secondIndex >= secondHeaders.length
    ) {
      return;
    }

    const firstName = firstHeaders[firstIndex] ?? `列${firstIndex + 1}`;
    const secondName = secondHeaders[secondIndex] ?? `列${secondIndex + 1}`;
    const baseLabel = (mapping.label ?? firstName ?? secondName)?.toString().trim();
    const label = baseLabel && baseLabel.length > 0 ? baseLabel : `列${firstIndex + 1}`;

    const key = `${firstIndex}-${secondIndex}`;
    normalized.set(key, {
      firstColumnIndex: firstIndex,
      secondColumnIndex: secondIndex,
      label,
      firstColumnName: firstName,
      secondColumnName: secondName
    });
  });

  return Array.from(normalized.values());
};

const normalizeHeadersWithMappings = (
  firstHeaders: string[],
  secondHeaders: string[],
  mappings: ResolvedColumnMapping[]
): { normalizedFirstHeaders: string[]; normalizedSecondHeaders: string[] } => {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return {
      normalizedFirstHeaders: firstHeaders.map((header, index) => header ?? `列${index + 1}`),
      normalizedSecondHeaders: secondHeaders.map((header, index) => header ?? `列${index + 1}`)
    };
  }

  const firstLookup = new Map<number, string>();
  const secondLookup = new Map<number, string>();

  mappings.forEach(mapping => {
    firstLookup.set(mapping.firstColumnIndex, mapping.label);
    secondLookup.set(mapping.secondColumnIndex, mapping.label);
  });

  const normalizedFirstHeaders = firstHeaders.map((header, index) => {
    if (firstLookup.has(index)) {
      return firstLookup.get(index)!;
    }
    const value = header ?? `列${index + 1}`;
    return value;
  });

  const normalizedSecondHeaders = secondHeaders.map((header, index) => {
    if (secondLookup.has(index)) {
      return secondLookup.get(index)!;
    }
    const value = header ?? `列${index + 1}`;
    return value;
  });

  return { normalizedFirstHeaders, normalizedSecondHeaders };
};

/**
 * 比较数据行
 */
const compareDataRows = (
  firstRows: any[][],
  secondRows: any[][],
  firstHeaders: string[],
  secondHeaders: string[],
  commonColumns: string[],
  keyColumns: string[]
) => {
  const commonRows: any[][] = [];
  const uniqueToFirst: any[][] = [];
  const uniqueToSecond: any[][] = [];
  const modifiedRows: {
    firstRow: any[];
    secondRow: any[];
    differences: { column: string; firstValue: any; secondValue: any }[];
  }[] = [];

  const useKeyMatching = keyColumns.length > 0;

  if (!useKeyMatching) {
    const createRowHash = (row: any[], headers: string[]) =>
      row.map((cell, index) => `${headers[index] ?? `列${index + 1}`}:${cell ?? ''}`).join('|');

    const firstRowHashes = new Map<string, { row: any[]; index: number }>();
    const secondRowHashes = new Map<string, { row: any[]; index: number }>();

    firstRows.forEach((row, index) => {
      const hash = createRowHash(row, firstHeaders);
      firstRowHashes.set(hash, { row, index });
    });

    secondRows.forEach((row, index) => {
      const hash = createRowHash(row, secondHeaders);
      secondRowHashes.set(hash, { row, index });
    });

    firstRowHashes.forEach((firstData, hash) => {
      if (secondRowHashes.has(hash)) {
        commonRows.push(firstData.row);
        secondRowHashes.delete(hash);
      } else {
        uniqueToFirst.push(firstData.row);
      }
    });

    secondRowHashes.forEach(secondData => {
      uniqueToSecond.push(secondData.row);
    });

    return {
      commonRows,
      uniqueToFirst,
      uniqueToSecond,
      modifiedRows
    };
  }

  const firstIndexMap = createHeaderIndexMap(firstHeaders);
  const secondIndexMap = createHeaderIndexMap(secondHeaders);

  const secondEntries = secondRows.map((row, index) => {
    const key = buildKey(row, secondIndexMap, keyColumns);
    const commonHash = buildCommonHash(row, secondIndexMap, commonColumns);
    return { row, index, key, commonHash };
  });

  const rowsByKey = new Map<string, number[]>();
  const rowsByCommonHash = new Map<string, number[]>();

  secondEntries.forEach(entry => {
    if (entry.key) {
      const list = rowsByKey.get(entry.key) ?? [];
      list.push(entry.index);
      rowsByKey.set(entry.key, list);
    }
    if (entry.commonHash) {
      const list = rowsByCommonHash.get(entry.commonHash) ?? [];
      list.push(entry.index);
      rowsByCommonHash.set(entry.commonHash, list);
    }
  });

  const usedSecondIndexes = new Set<number>();

  const takeFromMap = (map: Map<string, number[]>, value: string | null) => {
    if (!value) {
      return null;
    }
    const list = map.get(value);
    if (!list || list.length === 0) {
      return null;
    }
    while (list.length > 0) {
      const candidateIndex = list.shift()!;
      if (usedSecondIndexes.has(candidateIndex)) {
        continue;
      }
      usedSecondIndexes.add(candidateIndex);
      return secondEntries[candidateIndex];
    }
    map.delete(value);
    return null;
  };

  firstRows.forEach(row => {
    const key = buildKey(row, firstIndexMap, keyColumns);
    let matchedEntry = takeFromMap(rowsByKey, key);

    if (!matchedEntry) {
      const commonHash = buildCommonHash(row, firstIndexMap, commonColumns);
      matchedEntry = takeFromMap(rowsByCommonHash, commonHash);
    }

    if (matchedEntry) {
      const secondRow = matchedEntry.row;
      if (rowsMatchOnColumns(row, secondRow, firstIndexMap, secondIndexMap, commonColumns)) {
        commonRows.push(row);
      } else {
        const differences = collectDifferences(row, secondRow, firstIndexMap, secondIndexMap, commonColumns);
        if (differences.length === 0) {
          commonRows.push(row);
        } else {
          const keyValues: Record<string, string> = {};
          keyColumns.forEach(column => {
            const firstValue = getColumnValue(row, firstIndexMap.get(column));
            keyValues[column] = formatCellValue(firstValue);
          });
          modifiedRows.push({
            firstRow: row,
            secondRow,
            differences,
            keyValues: Object.keys(keyValues).length > 0 ? keyValues : undefined
          });
        }
      }
    } else {
      uniqueToFirst.push(row);
    }
  });

  secondEntries.forEach(entry => {
    if (!usedSecondIndexes.has(entry.index)) {
      uniqueToSecond.push(entry.row);
    }
  });

  return {
    commonRows,
    uniqueToFirst,
    uniqueToSecond,
    modifiedRows
  };
};

const createHeaderIndexMap = (headers: string[]): Map<string, number[]> => {
  const map = new Map<string, number[]>();
  headers.forEach((header, index) => {
    const key = header ?? `列${index + 1}`;
    const list = map.get(key) ?? [];
    list.push(index);
    map.set(key, list);
  });
  return map;
};

const getColumnValue = (row: any[], indexes?: number[]): any => {
  if (!indexes || indexes.length === 0) {
    return '';
  }
  for (const idx of indexes) {
    if (idx >= 0 && idx < row.length) {
      return row[idx];
    }
  }
  return '';
};

const buildKey = (
  row: any[],
  indexMap: Map<string, number[]>,
  keyColumns: string[]
): string | null => {
  const parts: string[] = [];
  for (const column of keyColumns) {
    const indexes = indexMap.get(column);
    if (!indexes) {
      return null;
    }
    const value = getColumnValue(row, indexes);
    const text = formatCellValue(value).trim();
    if (text === '') {
      return null;
    }
    parts.push(text);
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join('||');
};

const buildCommonHash = (
  row: any[],
  indexMap: Map<string, number[]>,
  columns: string[]
): string | null => {
  if (!columns || columns.length === 0) {
    return null;
  }
  return columns
    .map(column => {
      const indexes = indexMap.get(column);
      const value = getColumnValue(row, indexes);
      return formatCellValue(value);
    })
    .join('|');
};

const rowsMatchOnColumns = (
  firstRow: any[],
  secondRow: any[],
  firstIndexMap: Map<string, number[]>,
  secondIndexMap: Map<string, number[]>,
  columns: string[]
): boolean => {
  if (!columns || columns.length === 0) {
    return JSON.stringify(firstRow) === JSON.stringify(secondRow);
  }

  return columns.every(column => {
    const firstValue = getColumnValue(firstRow, firstIndexMap.get(column));
    const secondValue = getColumnValue(secondRow, secondIndexMap.get(column));
    return formatCellValue(firstValue) === formatCellValue(secondValue);
  });
};

const collectDifferences = (
  firstRow: any[],
  secondRow: any[],
  firstIndexMap: Map<string, number[]>,
  secondIndexMap: Map<string, number[]>,
  columns: string[]
) => {
  const diffs: { column: string; firstValue: any; secondValue: any }[] = [];
  columns.forEach(column => {
    const firstValue = getColumnValue(firstRow, firstIndexMap.get(column));
    const secondValue = getColumnValue(secondRow, secondIndexMap.get(column));
    if (formatCellValue(firstValue) !== formatCellValue(secondValue)) {
      diffs.push({
        column,
        firstValue,
        secondValue
      });
    }
  });
  return diffs;
};

export const createComparisonMergeSheet = (
  firstSheet: SheetData,
  secondSheet: SheetData,
  comparisonResult: ComparisonResult,
  options: ComparisonMergeSheetOptions
): SheetData => {
  const {
    sheetName,
    includeUniqueFromFirst,
    includeUniqueFromSecond,
    includeModifiedRows,
    highlightChanges,
    firstSourceLabel,
    secondSourceLabel
  } = options;

  const normalizeHeaders = (headers: any[]): string[] => {
    return headers.map((header, index) => {
      if (typeof header === 'string' && header.trim() !== '') {
        return header;
      }
      if (header !== null && header !== undefined) {
        const text = header.toString();
        if (text.trim() !== '') {
          return text;
        }
      }
      return `列${index + 1}`;
    });
  };

  const firstHeadersRaw = getHeaderRow(firstSheet);
  const secondHeadersRaw = getHeaderRow(secondSheet);

  const firstHeaders = normalizeHeaders(firstHeadersRaw);
  const secondHeaders = normalizeHeaders(secondHeadersRaw);

  const allColumns: string[] = [];
  firstHeaders.forEach(header => {
    if (!allColumns.includes(header)) {
      allColumns.push(header);
    }
  });
  secondHeaders.forEach(header => {
    if (!allColumns.includes(header)) {
      allColumns.push(header);
    }
  });

  const headerRow = ['来源', ...allColumns];
  const data: any[][] = [headerRow];
  const styles: Record<string, any> = {};

  const applyFill = (rowNumber: number, columnNumber: number, color: string) => {
    const key = `${rowNumber}_${columnNumber}`;
    styles[key] = {
      ...(styles[key] || {}),
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color }
      }
    };
  };

  const uniqueFirstColor = 'FFE3F2FD';
  const uniqueSecondColor = 'FFF1F8E9';
  const modifiedRowColor = 'FFFFFDE7';
  const modifiedCellColor = 'FFFFF59D';

  const firstLabel = firstSourceLabel || firstSheet.name || '工作表1';
  const secondLabel = secondSourceLabel || secondSheet.name || '工作表2';
  const modifiedLabel = `${firstLabel}→${secondLabel}`;

  let currentRowNumber = 2;

  const pushRow = (
    sourceLabel: string,
    valueMap: Record<string, any>,
    fillColor?: string,
    highlightedColumns?: Set<string>
  ) => {
    const rowValues = allColumns.map(column => valueMap[column] ?? '');
    data.push([sourceLabel, ...rowValues]);

    if (highlightChanges && fillColor) {
      for (let col = 1; col <= headerRow.length; col++) {
        applyFill(currentRowNumber, col, fillColor);
      }
    }

    if (highlightChanges && highlightedColumns && highlightedColumns.size > 0) {
      highlightedColumns.forEach(column => {
        const columnIndex = allColumns.indexOf(column);
        if (columnIndex !== -1) {
          applyFill(currentRowNumber, columnIndex + 2, modifiedCellColor);
        }
      });
    }

    currentRowNumber += 1;
  };

  if (includeUniqueFromFirst && comparisonResult.dataDifferences.uniqueToFirst.length > 0) {
    comparisonResult.dataDifferences.uniqueToFirst.forEach(row => {
      const valueMap: Record<string, any> = {};
      firstHeaders.forEach((header, index) => {
        valueMap[header] = row[index] ?? '';
      });
      pushRow(firstLabel, valueMap, highlightChanges ? uniqueFirstColor : undefined);
    });
  }

  if (includeUniqueFromSecond && comparisonResult.dataDifferences.uniqueToSecond.length > 0) {
    comparisonResult.dataDifferences.uniqueToSecond.forEach(row => {
      const valueMap: Record<string, any> = {};
      secondHeaders.forEach((header, index) => {
        valueMap[header] = row[index] ?? '';
      });
      pushRow(secondLabel, valueMap, highlightChanges ? uniqueSecondColor : undefined);
    });
  }

  if (includeModifiedRows && comparisonResult.dataDifferences.modifiedRows.length > 0) {
    comparisonResult.dataDifferences.modifiedRows.forEach(rowDiff => {
      const valueMap: Record<string, any> = {};
      const highlightedColumns = new Set<string>();

      allColumns.forEach(column => {
        const firstIndex = firstHeaders.indexOf(column);
        const secondIndex = secondHeaders.indexOf(column);
        const firstValue = firstIndex !== -1 ? rowDiff.firstRow[firstIndex] : undefined;
        const secondValue = secondIndex !== -1 ? rowDiff.secondRow[secondIndex] : undefined;

        if (firstIndex !== -1 && secondIndex !== -1) {
          const firstText = formatCellValue(firstValue);
          const secondText = formatCellValue(secondValue);
          if (String(firstValue ?? '') === String(secondValue ?? '')) {
            valueMap[column] = firstValue ?? secondValue ?? '';
          } else {
            valueMap[column] = `${firstText} → ${secondText}`;
            highlightedColumns.add(column);
          }
        } else if (firstIndex !== -1) {
          valueMap[column] = firstValue ?? '';
        } else if (secondIndex !== -1) {
          valueMap[column] = secondValue ?? '';
        } else {
          valueMap[column] = '';
        }
      });

      pushRow(modifiedLabel, valueMap, highlightChanges ? modifiedRowColor : undefined, highlightedColumns);
    });
  }

  const totalRows = Math.max(data.length - 1, 0);
  const totalCols = headerRow.length;

  const properties: any = {
    rowCount: data.length,
    columnCount: totalCols,
    autoFilter: {
      from: { row: 1, column: 1 },
      to: { row: data.length, column: totalCols }
    }
  };

  return {
    name: sheetName,
    originalName: sheetName,
    data,
    totalRows,
    totalCols,
    headerRowIndex: 0,
    headerDetectionMode: 'manual',
    styles: Object.keys(styles).length > 0 ? styles : undefined,
    properties
  };
};

/**
 * 导出表格数据为CSV
 */
export const exportToCSV = (sheetData: SheetData): void => {
  const headerRow = getHeaderRow(sheetData);
  const dataRows = getDataRows(sheetData);
  const csvContent = [
    headerRow.join(','),
    ...dataRows.map(row =>
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
  sourceBuffers?: Record<string, ArrayBuffer>;
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

const parseRangeRef = (ref: string | undefined | null): { startRow: number; endRow: number; startColumn: number; endColumn: number } | null => {
  if (!ref || typeof ref !== 'string') {
    return null;
  }
  const [startRef, endRef = startRef] = ref.split(':');
  const start = parseCellAddress(startRef);
  const end = parseCellAddress(endRef);
  if (!start || !end) {
    return null;
  }
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endColumn: Math.max(start.column, end.column)
  };
};

const applyWorksheetViews = (worksheet: ExcelJS.Worksheet, properties: WorksheetProperties): void => {
  if (properties.views && Array.isArray(properties.views) && properties.views.length > 0) {
    try {
      (worksheet as any).views = properties.views.map(view => ({ ...view }));
      return;
    } catch (_) {
      // ignore view assignment failure
    }
  }

  if (properties.freezePanes) {
    (worksheet as any).views = [
      {
        state: properties.freezePanes.state || 'frozen',
        xSplit: properties.freezePanes.xSplit,
        ySplit: properties.freezePanes.ySplit,
        topLeftCell: properties.freezePanes.topLeftCell,
        activeCell: properties.freezePanes.activeCell
      }
    ];
  }
};

const applyDataValidations = (worksheet: ExcelJS.Worksheet, validations: Record<string, any>): void => {
  if (!validations || typeof validations !== 'object') {
    return;
  }

  try {
    const dv = (worksheet as any).dataValidations;
    if (dv && typeof dv.removeAll === 'function') {
      dv.removeAll();
    } else if (dv && dv.model && Array.isArray(dv.model.dataValidations)) {
      dv.model.dataValidations = [];
    }
  } catch (_) {
    // ignore inability to reset validations
  }

  Object.entries(validations).forEach(([addressKey, validation]) => {
    if (!validation) {
      return;
    }
    const { address, ...rules } = validation as Record<string, any>;
    const targetAddress = address || addressKey;
    try {
      const dv = (worksheet as any).dataValidations;
      if (dv && typeof dv.add === 'function') {
        dv.add(targetAddress, { ...rules });
      }
    } catch (err) {
      try {
        console.warn('[excelExport] failed to restore data validation', err);
      } catch (_) {}
    }
  });
};

const applyConditionalFormatting = (worksheet: ExcelJS.Worksheet, conditionalFormattings: any[]): void => {
  if (!Array.isArray(conditionalFormattings) || conditionalFormattings.length === 0) {
    return;
  }

  conditionalFormattings.forEach((config: any) => {
    if (!config || !config.ref || !config.rules) {
      return;
    }
    try {
      const addConditionalFormatting = (worksheet as any).addConditionalFormatting;
      if (typeof addConditionalFormatting === 'function') {
        addConditionalFormatting.call(worksheet, {
        ref: config.ref,
        rules: Array.isArray(config.rules) ? config.rules.map((rule: any) => ({ ...rule })) : config.rules
        });
      }
    } catch (err) {
      try {
        console.warn('[excelExport] failed to restore conditional formatting', err);
      } catch (_) {}
    }
  });
};

const applyComments = (worksheet: ExcelJS.Worksheet, comments: Record<string, { text: string; author?: string }>): void => {
  if (!comments || typeof comments !== 'object') {
    return;
  }

  Object.entries(comments).forEach(([cellKey, comment]) => {
    const [rowStr, colStr] = cellKey.split('_');
    const row = parseInt(rowStr, 10);
    const column = parseInt(colStr, 10);
    if (Number.isNaN(row) || Number.isNaN(column)) {
      return;
    }
    const cell = worksheet.getCell(row, column);
    if (!comment || typeof comment.text === 'undefined') {
      delete (cell as any).note;
      return;
    }
    const notePayload: any = {
      texts: [
        {
          text: typeof comment.text === 'string' ? comment.text : String(comment.text ?? '')
        }
      ]
    };
    if (comment.author) {
      notePayload.author = comment.author;
    }
    cell.note = notePayload;
  });
};

const extractRangeMatrix = (sheetData: SheetData, range: { startRow: number; endRow: number; startColumn: number; endColumn: number }): any[][] => {
  const matrix: any[][] = [];
  const rows = Array.isArray(sheetData.data) ? sheetData.data : [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    const sourceRow = rows[row - 1] || [];
    const rowValues: any[] = [];
    for (let column = range.startColumn; column <= range.endColumn; column++) {
      rowValues.push(sourceRow[column - 1] ?? null);
    }
    matrix.push(rowValues);
  }
  return matrix;
};

const applyTables = (worksheet: ExcelJS.Worksheet, sheetData: SheetData): void => {
  const tables = sheetData.properties?.tables;
  if (!Array.isArray(tables) || tables.length === 0) {
    return;
  }

  tables.forEach((table, index) => {
    if (!table || !table.ref) {
      return;
    }
    const range = parseRangeRef(table.ref);
    if (!range) {
      return;
    }

    const headerRowIncluded = table.headerRow !== false;
    const totalsRowIncluded = !!table.totalsRow;

    const matrix = extractRangeMatrix(sheetData, range);
    if (matrix.length === 0 && !headerRowIncluded) {
      return;
    }

    let headerRow: any[] = [];
    if (headerRowIncluded && matrix.length > 0) {
      headerRow = matrix.shift() ?? [];
    }

    if (totalsRowIncluded && matrix.length > 0) {
      matrix.pop();
    }

    const columns = table.columns?.length
      ? table.columns.map((col, idx) => ({
          name: col?.name ?? (headerRow[idx] ?? `列${idx + 1}`),
          totalsRowFunction: col?.totalsRowFunction,
          totalsRowLabel: col?.totalsRowLabel
        }))
      : (() => {
          const columnCount = range.endColumn - range.startColumn + 1;
          return Array.from({ length: columnCount }, (_, idx) => ({
            name: headerRow[idx] ?? `列${idx + 1}`
          }));
        })();

    const rows = matrix.map(row =>
      row.map(value => (value === undefined ? null : value))
    );

    try {
      const addTable = (worksheet as any).addTable;
      if (typeof addTable === 'function') {
        addTable.call(worksheet, {
        name: table.name || `Table_${index + 1}`,
        displayName: table.displayName || table.name || `Table_${index + 1}`,
        ref: table.ref,
        headerRow: headerRowIncluded,
        totalsRow: totalsRowIncluded,
        style: table.style ? { ...table.style } : undefined,
        columns,
        rows
        });
      }
    } catch (err) {
      try {
        console.warn('[excelExport] failed to recreate table', err);
      } catch (_) {}
    }
  });
};

const applyAdvancedWorksheetProps = (worksheet: ExcelJS.Worksheet, sheetData: SheetData): void => {
  if (!sheetData.properties) {
    return;
  }
  const props = sheetData.properties;
  applyWorksheetViews(worksheet, props);
  if (props.comments) {
    applyComments(worksheet, props.comments);
  }
  if (props.dataValidations) {
    applyDataValidations(worksheet, props.dataValidations);
  }
  if (props.conditionalFormattings) {
    applyConditionalFormatting(worksheet, props.conditionalFormattings);
  }
  applyTables(worksheet, sheetData);
};

// 删除不再需要的旧函数

// 删除不再需要的旧函数

/**
 * 从原始workbook创建工作簿，保留所有格式信息
 */
const populateWorksheetData = (
  worksheet: ExcelJS.Worksheet,
  sheetData: SheetData,
  options: ExportOptions,
  editedCells?: Set<string>
) => {
  const rows = Array.isArray(sheetData.data) ? sheetData.data : [];
  if (rows.length === 0) {
    const existingRowCount = worksheet.rowCount;
    for (let rowNumber = 1; rowNumber <= existingRowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      row.eachCell(cell => {
        if (cell.value !== null && cell.value !== undefined) {
          cell.value = null;
        }
      });
    }
    return;
  }

  const resolvedTotalCols = rows.reduce((max, row) => {
    if (Array.isArray(row)) {
      return Math.max(max, row.length);
    }
    return max;
  }, 0);

  const maxColumnIndex = Math.max(worksheet.columnCount, resolvedTotalCols);

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.getRow(rowIndex + 1);
    const isHeader = rowIndex === 0;
    const rowArray = Array.isArray(row) ? row : [];
    const rowLength = rowArray.length;

    for (let colIndex = 0; colIndex < resolvedTotalCols; colIndex++) {
      const cell = worksheetRow.getCell(colIndex + 1);
      const cellKey = `${rowIndex + 1}_${colIndex + 1}`;
      const value = colIndex < rowLength ? rowArray[colIndex] : undefined;
      const isEdited = editedCells?.has(cellKey);

      if (!isEdited && !isHeader && options.preserveFormulas && sheetData.formulas && sheetData.formulas[cellKey]) {
        cell.value = {
          formula: sheetData.formulas[cellKey],
          result: value ?? null,
          sharedFormula: undefined
        } as any;
      } else if (!isEdited && sheetData.richTextRuns && sheetData.richTextRuns[cellKey]) {
        const runs = sheetData.richTextRuns[cellKey];
        cell.value = {
          richText: runs.map((rt: any) => ({
            text: rt.text,
            font: rt.font ? { ...rt.font } : undefined
          }))
        } as any;
      } else {
        cell.value = value === '' || value === undefined ? null : value;
      }
    }

    for (let colIndex = rowLength + 1; colIndex <= resolvedTotalCols; colIndex++) {
      const cell = worksheetRow.getCell(colIndex);
      if (cell.value !== null && cell.value !== undefined) {
        cell.value = null;
      }
    }

    for (let colIndex = resolvedTotalCols + 1; colIndex <= maxColumnIndex; colIndex++) {
      const cell = worksheetRow.getCell(colIndex);
      if (cell.value !== null && cell.value !== undefined) {
        cell.value = null;
      }
    }
  });

  const currentRowCount = worksheet.rowCount;
  for (let rowNumber = rows.length + 1; rowNumber <= currentRowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell(cell => {
      if (cell.value !== null && cell.value !== undefined) {
        cell.value = null;
      }
    });
  }
};

const copyWorksheetFromOriginal = (
  targetWorkbook: ExcelJS.Workbook,
  sheetData: SheetData,
  originalWorkbook: ExcelJS.Workbook,
  options: ExportOptions,
  editedCells?: Set<string>
): boolean => {
  const lookupNames = Array.from(new Set([sheetData.originalName, sheetData.name].filter(Boolean) as string[]));
  let originalWorksheet: ExcelJS.Worksheet | undefined;
  for (const name of lookupNames) {
    const worksheet = originalWorkbook.getWorksheet(name);
    if (worksheet) {
      originalWorksheet = worksheet;
      break;
    }
  }

  if (!originalWorksheet) {
    return false;
  }

  const copiedWorksheet = targetWorkbook.addWorksheet(sheetData.name);

  if (originalWorksheet.properties) {
    copiedWorksheet.properties = { ...originalWorksheet.properties };
  }

  if (originalWorksheet.columns && originalWorksheet.columns.length > 0) {
    copiedWorksheet.columns = originalWorksheet.columns.map(col => ({
      ...col,
      style: col.style ? { ...col.style } : undefined
    }));
  }

  const mergeRanges = new Set<string>();
  const applyMerge = (merge: any) => {
    const normalized = normalizeMergeRange(merge);
    if (!normalized) {
      return;
    }
    const key = `${normalized.top}:${normalized.left}:${normalized.bottom}:${normalized.right}`;
    if (mergeRanges.has(key)) {
      return;
    }
    mergeRanges.add(key);
    copiedWorksheet.mergeCells(normalized.top, normalized.left, normalized.bottom, normalized.right);
  };

  const mergeCollections: any[] = [];
  const model: any = originalWorksheet.model || {};
  if (model.mergeCells) {
    mergeCollections.push(model.mergeCells);
  }
  if (model.merges) {
    mergeCollections.push(model.merges);
  }
  if ((originalWorksheet as any)._merges) {
    mergeCollections.push((originalWorksheet as any)._merges);
  }

  mergeCollections.forEach(collection => {
    if (!collection) {
      return;
    }
    if (Array.isArray(collection)) {
      collection.forEach(applyMerge);
    } else if (typeof collection === 'object') {
      Object.values(collection).forEach(applyMerge);
    } else {
      applyMerge(collection);
    }
  });

  const originalFilter = (originalWorksheet as any).autoFilter;
  const fallbackFilter = sheetData.properties?.autoFilter;
  if (originalFilter || fallbackFilter) {
    const sourceFilter = originalFilter || fallbackFilter;
    copiedWorksheet.autoFilter = typeof sourceFilter === 'string'
      ? sourceFilter
      : {
          ...sourceFilter,
          from: sourceFilter.from ? { ...sourceFilter.from } : undefined,
          to: sourceFilter.to ? { ...sourceFilter.to } : undefined
        };
  }

  if ((originalWorksheet as any).protection) {
    (copiedWorksheet as any).protection = { ...(originalWorksheet as any).protection };
  }

  const rowsToCopy = Math.max(originalWorksheet.rowCount || 0, sheetData.totalRows || 0);
  const colsToCopy = Math.max(originalWorksheet.columnCount || 0, sheetData.totalCols || 0);

  for (let rowNumber = 1; rowNumber <= rowsToCopy; rowNumber++) {
    for (let colNumber = 1; colNumber <= colsToCopy; colNumber++) {
      const sourceCell = originalWorksheet.getCell(rowNumber, colNumber);
      const targetCell = copiedWorksheet.getCell(rowNumber, colNumber);

      if (sourceCell.value !== null && sourceCell.value !== undefined) {
        if (typeof sourceCell.value === 'object' && 'result' in sourceCell.value) {
          targetCell.value = {
            formula: (sourceCell.value as any).formula,
            result: (sourceCell.value as any).result,
            sharedFormula: undefined
          } as any;
        } else if (typeof sourceCell.value === 'object' && 'richText' in sourceCell.value) {
          const richTextValue = sourceCell.value as any;
          targetCell.value = {
            richText: Array.isArray(richTextValue.richText)
              ? richTextValue.richText.map((rt: any) => ({
                  text: rt.text,
                  font: rt.font ? { ...rt.font } : undefined
                }))
              : richTextValue.richText
          } as any;
        } else {
          targetCell.value = sourceCell.value as any;
        }
      } else {
        targetCell.value = targetCell.value ?? null;
      }

      if (sourceCell.style && Object.keys(sourceCell.style).length > 0) {
        targetCell.style = { ...(sourceCell.style as any) };
      }
    }
  }

  originalWorksheet.eachRow((row, rowNumber) => {
    if (row.height) {
      copiedWorksheet.getRow(rowNumber).height = row.height;
    }
  });

  populateWorksheetData(copiedWorksheet, sheetData, options, editedCells);
  applyAdvancedWorksheetProps(copiedWorksheet, sheetData);

  return true;
};

const createWorkbookFromOriginal = (
  selectedSheets: SheetData[],
  options: ExportOptions,
  context: ExportContext = {}
): ExcelJS.Workbook => {
  const newWorkbook = new ExcelJS.Workbook();

  const firstWithOriginal = selectedSheets.find(sheet => sheet.originalWorkbook && canUseOriginalWorkbook(sheet.originalWorkbook));
  if (firstWithOriginal && firstWithOriginal.originalWorkbook) {
    const baseWorkbook = firstWithOriginal.originalWorkbook as ExcelJS.Workbook;
    newWorkbook.creator = baseWorkbook.creator || 'Kk Excel Processor';
    newWorkbook.lastModifiedBy = baseWorkbook.lastModifiedBy || 'Kk Excel Processor';
    newWorkbook.created = baseWorkbook.created || new Date();
    newWorkbook.modified = baseWorkbook.modified || new Date();
    newWorkbook.company = baseWorkbook.company;
    newWorkbook.title = baseWorkbook.title;
    newWorkbook.subject = baseWorkbook.subject;
    newWorkbook.keywords = baseWorkbook.keywords;
    newWorkbook.description = baseWorkbook.description;
    newWorkbook.category = baseWorkbook.category;
  } else {
    newWorkbook.creator = 'Kk Excel Processor';
    newWorkbook.lastModifiedBy = 'Kk Excel Processor';
    newWorkbook.created = new Date();
    newWorkbook.modified = new Date();
  }

  selectedSheets.forEach(sheetData => {
    const editedCells = context.editedCellMap?.get(sheetData.name);
    const canUseOriginal = sheetData.originalWorkbook && canUseOriginalWorkbook(sheetData.originalWorkbook);
    if (canUseOriginal && copyWorksheetFromOriginal(newWorkbook, sheetData, sheetData.originalWorkbook as ExcelJS.Workbook, options, editedCells)) {
      return;
    }

    createWorksheetFromSheetData(sheetData, options, newWorkbook, editedCells);
  });

  return newWorkbook;
};

/**
 * 从SheetData创建工作表 - 保留原始样式和公式
 */
const createWorksheetFromSheetData = (
  sheetData: SheetData,
  options: ExportOptions,
  targetWorkbook?: ExcelJS.Workbook,
  editedCells?: Set<string>
): ExcelJS.Worksheet => {
  
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
  
  populateWorksheetData(worksheet, sheetData, options, editedCells);

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
    const headerRow = getHeaderRow(sheetData);
    const dataRows = getDataRows(sheetData);
    const columnCount = Math.max(
      headerRow.length,
      ...dataRows.map(row => (Array.isArray(row) ? row.length : 0))
    );
    const colWidths = Array.from({ length: columnCount }, (_, index) => {
      const header = headerRow[index] ?? '';
      const maxLength = Math.max(
        String(header).length,
        ...dataRows.map(row => String(row[index] ?? '').length)
      );
      return Math.min(Math.max(maxLength, 10), 50);
    });

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
    const mergeKeys = new Set<string>();
    sheetData.properties.merges.forEach((merge: any) => {
      const normalized = normalizeMergeRange(merge);
      if (!normalized) {
        return;
      }
      const key = `${normalized.top}:${normalized.left}:${normalized.bottom}:${normalized.right}`;
      if (mergeKeys.has(key)) {
        return;
      }
      mergeKeys.add(key);
      worksheet.mergeCells(normalized.top, normalized.left, normalized.bottom, normalized.right);
    });
  }

  // 设置表头筛选
  const headerIndex = getHeaderRowIndex(sheetData);
  const headerRowNumber = headerIndex + 1;
  const totalCols = getHeaderRow(sheetData).length || sheetData.totalCols || 0;
  const dataRowCount = getDataRowCount(sheetData);
  const applyAutoFilter = sheetData.properties?.autoFilter;
  if (totalCols > 0) {
    if (applyAutoFilter) {
      worksheet.autoFilter = typeof applyAutoFilter === 'string'
        ? applyAutoFilter
        : {
            ...applyAutoFilter,
            from: applyAutoFilter.from ? { ...applyAutoFilter.from } : undefined,
            to: applyAutoFilter.to ? { ...applyAutoFilter.to } : undefined
          };
    } else {
      const lastRowNumber = Math.max(headerRowNumber, headerRowNumber + dataRowCount);
      worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: lastRowNumber, column: totalCols }
      } as any;
    }
  }

  applyAdvancedWorksheetProps(worksheet, sheetData);

  return worksheet;
};

/**
 * 导出多个sheets为Excel文件（使用ExcelJS）
 */
export const exportToExcel = async (
  selectedSheets: SheetData[],
  options: ExportOptions,
  context: ExportContext = {}
): Promise<void> => {
  try {
    let tauriDialog;
    let tauriFs;
    
    try {
      tauriDialog = await import('@tauri-apps/plugin-dialog');
      tauriFs = await import('@tauri-apps/plugin-fs');
    } catch (err) {
      console.warn('Tauri API不可用，回退到浏览器下载', err);
      return exportToExcelBrowser(selectedSheets, options, context);
    }
    
    // 如果选择分别导出每个sheet为单独文件
    if (options.separateFiles) {
      for (const sheet of selectedSheets) {
        await exportSingleSheetTauri(sheet, options, tauriDialog, tauriFs, context);
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
      workbook = createWorkbookFromOriginal(patched, options, context);
    } else if (hasOriginalWorkbook && hasUsableOriginalWorkbook) {
      // 使用原始workbook对象，保留所有格式信息
      try { console.log('[excelExport] strategy=copy-original', { sheetNames: selectedSheets.map(s => s.name) }); } catch (_) {}
      workbook = createWorkbookFromOriginal(selectedSheets, options, context);
    } else {
      // 创建新的工作簿
      try { console.log('[excelExport] strategy=rebuild-from-data', { hasOriginalWorkbook, hasUsableOriginalWorkbook }); } catch (_) {}
      workbook = new ExcelJS.Workbook();
      
      // 设置工作簿属性
      workbook.creator = 'Kk Excel Processor';
      workbook.lastModifiedBy = 'Kk Excel Processor';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // 为每个选中的sheet创建工作表
      selectedSheets.forEach(sheetData => {
        createWorksheetFromSheetData(sheetData, options, workbook, context.editedCellMap?.get(sheetData.name));
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
  tauriFs: any,
  context: ExportContext
): Promise<void> => {
  // 创建新工作簿
  const workbook = new ExcelJS.Workbook();
  
  // 设置工作簿属性
  workbook.creator = 'Kk Excel Processor';
  workbook.lastModifiedBy = 'Kk Excel Processor';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // 创建工作表
  createWorksheetFromSheetData(sheetData, options, workbook, context.editedCellMap?.get(sheetData.name));
  
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
  options: ExportOptions,
  context: ExportContext
): Promise<void> => {
  // 创建新工作簿
  const workbook = new ExcelJS.Workbook();
  
  // 设置工作簿属性
  workbook.creator = 'Kk Excel Processor';
  workbook.lastModifiedBy = 'Kk Excel Processor';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // 为每个选中的sheet创建工作表
  selectedSheets.forEach(sheetData => {
    createWorksheetFromSheetData(sheetData, options, workbook, context.editedCellMap?.get(sheetData.name));
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
