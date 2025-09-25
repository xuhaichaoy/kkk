/**
 * Excel数据处理工具函数
 */

export interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
  styles?: any; // 原始样式信息
  formulas?: any; // 原始公式信息
  properties?: any; // 工作表级别的属性（列宽、行高、合并单元格等）
  originalWorkbook?: any; // 原始workbook对象引用
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

/**
 * 导出选项接口
 */
export interface ExportOptions {
  fileName: string;
  separateFiles: boolean;
  preserveFormulas: boolean;
}

/**
 * 验证Excel文件格式
 */
const validateExcelBuffer = (buffer: ArrayBuffer): boolean => {
  try {
    // 检查文件头，Excel文件应该以PK开头（ZIP格式）
    const uint8Array = new Uint8Array(buffer);
    if (uint8Array.length < 4) {
      console.error('Excel文件太小，长度:', uint8Array.length);
      return false;
    }
    
    // Excel文件是ZIP格式，应该以PK开头
    const header = String.fromCharCode(uint8Array[0], uint8Array[1]);
    const isValid = header === 'PK';
    
    if (!isValid) {
      console.error('Excel文件头不正确，期望PK，实际:', header);
      console.log('文件前16字节:', Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
    
    return isValid;
  } catch (error) {
    console.error('验证Excel文件格式失败:', error);
    return false;
  }
};

/**
 * 对比两个工作表的样式信息
 */
const compareSheetStyles = async (originalSheet: any, exportedSheet: any, sheetName: string): Promise<void> => {
  const XLSX = await import('xlsx-js-style');
  
  console.log(`\n=== 对比工作表 ${sheetName} 的样式 ===`);
  
  // 对比工作表级别属性
  const originalProps = Object.keys(originalSheet).filter(key => key.startsWith('!'));
  const exportedProps = Object.keys(exportedSheet).filter(key => key.startsWith('!'));
  
  console.log(`原始工作表属性: ${originalProps.join(', ')}`);
  console.log(`导出工作表属性: ${exportedProps.join(', ')}`);
  
  // 检查缺失的属性
  const missingProps = originalProps.filter(prop => !exportedProps.includes(prop));
  if (missingProps.length > 0) {
    console.warn(`⚠️ 缺失的工作表属性: ${missingProps.join(', ')}`);
  }
  
  // 对比列宽
  if (originalSheet['!cols'] && exportedSheet['!cols']) {
    const originalCols = JSON.stringify(originalSheet['!cols']);
    const exportedCols = JSON.stringify(exportedSheet['!cols']);
    if (originalCols !== exportedCols) {
      console.warn(`⚠️ 列宽不匹配`);
      console.log(`  原始: ${originalCols}`);
      console.log(`  导出: ${exportedCols}`);
    } else {
      console.log(`✅ 列宽匹配`);
    }
  }
  
  // 对比行高
  if (originalSheet['!rows'] && exportedSheet['!rows']) {
    const originalRows = JSON.stringify(originalSheet['!rows']);
    const exportedRows = JSON.stringify(exportedSheet['!rows']);
    if (originalRows !== exportedRows) {
      console.warn(`⚠️ 行高不匹配`);
      console.log(`  原始: ${originalRows}`);
      console.log(`  导出: ${exportedRows}`);
    } else {
      console.log(`✅ 行高匹配`);
    }
  }
  
  // 对比合并单元格
  if (originalSheet['!merges'] && exportedSheet['!merges']) {
    const originalMerges = JSON.stringify(originalSheet['!merges']);
    const exportedMerges = JSON.stringify(exportedSheet['!merges']);
    if (originalMerges !== exportedMerges) {
      console.warn(`⚠️ 合并单元格不匹配`);
      console.log(`  原始: ${originalMerges}`);
      console.log(`  导出: ${exportedMerges}`);
    } else {
      console.log(`✅ 合并单元格匹配`);
    }
  }
  
  // 对比单元格样式
  if (originalSheet['!ref'] && exportedSheet['!ref']) {
    const originalRange = XLSX.utils.decode_range(originalSheet['!ref']);
    let styledCellsMatch = 0;
    let totalStyledCells = 0;
    let styleMismatches: string[] = [];
    
    for (let row = originalRange.s.r; row <= originalRange.e.r; row++) {
      for (let col = originalRange.s.c; col <= originalRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const originalCell = originalSheet[cellAddress];
        const exportedCell = exportedSheet[cellAddress];
        
        if (originalCell && originalCell.s) {
          totalStyledCells++;
          if (exportedCell && exportedCell.s) {
            const originalStyle = JSON.stringify(originalCell.s);
            const exportedStyle = JSON.stringify(exportedCell.s);
            if (originalStyle === exportedStyle) {
              styledCellsMatch++;
            } else {
              styleMismatches.push(cellAddress);
              if (styleMismatches.length <= 3) { // 只显示前3个不匹配的
                console.warn(`⚠️ 单元格 ${cellAddress} 样式不匹配`);
                console.log(`  原始:`, originalCell.s);
                console.log(`  导出:`, exportedCell.s);
              }
            }
          } else {
            styleMismatches.push(cellAddress);
            if (styleMismatches.length <= 3) {
              console.warn(`⚠️ 单元格 ${cellAddress} 导出时丢失样式`);
            }
          }
        }
      }
    }
    
    console.log(`单元格样式对比: ${styledCellsMatch}/${totalStyledCells} 匹配`);
    if (styleMismatches.length > 3) {
      console.warn(`⚠️ 还有 ${styleMismatches.length - 3} 个单元格样式不匹配`);
    }
  }
  
  console.log(`=== 工作表 ${sheetName} 样式对比完成 ===\n`);
};

/**
 * 调试Excel导出过程
 */
const debugExcelExport = async (workbook: any, options: ExportOptions, XLSX: any, originalWorkbook?: any): Promise<void> => {
  console.log('=== Excel导出调试信息 ===');
  console.log('工作簿信息:', {
    sheetNames: workbook.SheetNames,
    sheetCount: workbook.SheetNames?.length || 0,
    hasProps: !!workbook.Props,
    hasCustprops: !!workbook.Custprops
  });
  
  console.log('导出选项:', options);
  
  // 检查每个工作表
  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
      const range = sheet['!ref'];
      const hasCols = !!sheet['!cols'];
      const hasRows = !!sheet['!rows'];
      const hasMerges = !!sheet['!merges'];
      
      console.log(`工作表 ${sheetName}:`, {
        range,
        hasData: !!range,
        hasCols,
        hasRows,
        hasMerges,
        cellCount: range ? XLSX.utils.decode_range(range).e.r * XLSX.utils.decode_range(range).e.c : 0
      });
      
      // 检查样式信息
      if (range) {
        const decodedRange = XLSX.utils.decode_range(range);
        let styledCells = 0;
        for (let row = decodedRange.s.r; row <= decodedRange.e.r; row++) {
          for (let col = decodedRange.s.c; col <= decodedRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (sheet[cellAddress] && sheet[cellAddress].s) {
              styledCells++;
            }
          }
        }
        console.log(`  - 有样式的单元格数量: ${styledCells}`);
      }
      
      // 如果有原始workbook，进行样式对比
      if (originalWorkbook && originalWorkbook.Sheets[sheetName]) {
        await compareSheetStyles(originalWorkbook.Sheets[sheetName], sheet, sheetName);
      }
    }
  }
  console.log('=== 调试信息结束 ===');
};

/**
 * 从原始workbook创建工作簿，保留所有格式信息
 */
const createWorkbookFromOriginal = (selectedSheets: SheetData[], options: ExportOptions, XLSX: any) => {
  // 使用第一个sheet的原始workbook作为基础
  const baseWorkbook = selectedSheets[0].originalWorkbook;
  
  // 创建新的workbook，复制所有workbook级别的属性
  const newWorkbook: any = {};
  
  // 复制所有workbook级别的属性
  Object.keys(baseWorkbook).forEach(key => {
    if (key === 'SheetNames') {
      // 只包含选中的工作表名称
      newWorkbook[key] = selectedSheets.map(sheet => sheet.name);
    } else if (key === 'Sheets') {
      // 创建新的Sheets对象
      newWorkbook[key] = {};
    } else {
      // 复制其他workbook级别的属性
      newWorkbook[key] = baseWorkbook[key];
    }
  });
  
  // 为每个选中的sheet添加工作表
  selectedSheets.forEach(sheetData => {
    const originalSheet = baseWorkbook.Sheets[sheetData.name];
    
    if (originalSheet) {
      // 深度复制原始工作表，保留所有格式
      const copiedSheet: any = {};
      Object.keys(originalSheet).forEach(key => {
        if (key.startsWith('!')) {
          // 复制工作表级别的属性（列宽、行高、范围等）
          copiedSheet[key] = originalSheet[key];
        } else {
          // 复制单元格数据
          copiedSheet[key] = { ...originalSheet[key] };
        }
      });
      
      newWorkbook.Sheets[sheetData.name] = copiedSheet;
    } else {
      // 如果没有原始工作表，则使用createWorksheet创建
      const worksheet = createWorksheet(sheetData, options, XLSX);
      newWorkbook.Sheets[sheetData.name] = worksheet;
    }
  });
  
  return newWorkbook;
};

/**
 * 导出多个sheets为Excel文件（使用Tauri插件API）
 */
export const exportToExcel = async (
  selectedSheets: SheetData[],
  options: ExportOptions
): Promise<void> => {
  try {
    // 动态导入xlsx-js-style
    const XLSX = await import('xlsx-js-style');
    
    // 动态导入Tauri插件API
    let tauriDialog;
    let tauriFs;
    
    try {
      tauriDialog = await import('@tauri-apps/plugin-dialog');
      tauriFs = await import('@tauri-apps/plugin-fs');
    } catch (err) {
      console.warn('Tauri API不可用，回退到浏览器下载', err);
      return exportToExcelBrowser(selectedSheets, options, XLSX);
    }
    
    // 如果选择分别导出每个sheet为单独文件
    if (options.separateFiles) {
      for (const sheet of selectedSheets) {
        await exportSingleSheetTauri(sheet, options, XLSX, tauriDialog, tauriFs);
      }
      return;
    }
    
    // 检查是否所有sheet都有原始workbook信息
    const hasOriginalWorkbook = selectedSheets.every(sheet => sheet.originalWorkbook);
    
    let workbook: any;
    
    if (hasOriginalWorkbook) {
      // 使用原始workbook对象，保留所有格式信息
      workbook = createWorkbookFromOriginal(selectedSheets, options, XLSX);
    } else {
      // 使用默认方式创建工作簿
      workbook = XLSX.utils.book_new();
      
      // 为每个选中的sheet创建工作表
      selectedSheets.forEach(sheetData => {
        // 创建工作表
        const worksheet = createWorksheet(sheetData, options, XLSX);
        
        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetData.name);
      });
    }
    
    // 调试信息
    const originalWorkbook = hasOriginalWorkbook ? selectedSheets[0].originalWorkbook : undefined;
    await debugExcelExport(workbook, options, XLSX, originalWorkbook);
    
    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: true,
      cellStyles: true,
      cellDates: true
    });
    
    // 验证生成的Excel文件格式
    if (!validateExcelBuffer(excelBuffer)) {
      throw new Error('生成的Excel文件格式不正确');
    }
    
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
      // 使用Tauri的文件系统API写入文件
      // 确保excelBuffer是正确的Uint8Array格式
      const uint8Array = new Uint8Array(excelBuffer);
      await tauriFs.writeFile(filePath, uint8Array);
    }
    
  } catch (error) {
    console.error('导出Excel文件失败:', error);
    // 提供更详细的错误信息
    if (error instanceof Error) {
      throw new Error(`导出Excel文件失败: ${error.message}`);
    } else {
      throw new Error('导出Excel文件失败，请检查文件格式和权限设置');
    }
  }
};

/**
 * 导出单个sheet为Excel文件（使用Tauri插件API）
 */
const exportSingleSheetTauri = async (
  sheetData: SheetData,
  options: ExportOptions,
  XLSX: any,
  tauriDialog: any,
  tauriFs: any
): Promise<void> => {
  // 创建新工作簿
  const workbook = XLSX.utils.book_new();
  
  // 创建工作表
  const worksheet = createWorksheet(sheetData, options, XLSX);
  
  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetData.name);
  
  // 生成Excel文件
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    compression: true,
    cellStyles: true,
    cellFormula: true,
    cellDates: true,
    cellNF: true,
    cellText: false,
    cellHTML: false,
    sheetStubs: false,
    bookDeps: false,
    bookFiles: false,
    bookProps: true,
    bookSheets: true,
    bookVBA: false,
    password: '',
    WTF: false
  });
  
  // 验证生成的Excel文件格式
  if (!validateExcelBuffer(excelBuffer)) {
    throw new Error('生成的Excel文件格式不正确');
  }
  
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
    // 确保excelBuffer是正确的Uint8Array格式
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
  XLSX: any
): Promise<void> => {
  // 导出为单个Excel文件
  const workbook = XLSX.utils.book_new();
  
  // 为每个选中的sheet创建工作表
  selectedSheets.forEach(sheetData => {
    // 创建工作表
    const worksheet = createWorksheet(sheetData, options, XLSX);
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetData.name);
  });
  
  // 生成Excel文件
  const excelBuffer = XLSX.write(workbook, { 
    bookType: 'xlsx', 
    type: 'array',
    compression: true,
    cellStyles: true,
    cellFormula: true,
    cellDates: true,
    cellNF: true,
    cellText: false,
    cellHTML: false,
    sheetStubs: false,
    bookDeps: false,
    bookFiles: false,
    bookProps: true,
    bookSheets: true,
    bookVBA: false,
    password: '',
    WTF: false
  });
  
  // 验证生成的Excel文件格式
  if (!validateExcelBuffer(excelBuffer)) {
    throw new Error('生成的Excel文件格式不正确');
  }
  
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

/**
 * 创建工作表 - 保留原始样式和公式
 */
const createWorksheet = (sheetData: SheetData, options: ExportOptions, XLSX: any) => {
  // 如果sheetData包含原始样式和公式信息，则使用原始数据重建工作表
  if (sheetData.styles || sheetData.formulas) {
    return createWorksheetFromOriginal(sheetData, options, XLSX);
  }
  
  // 否则使用默认方式创建工作表
  return createWorksheetDefault(sheetData, options, XLSX);
};

/**
 * 从原始数据创建工作表，保留所有样式和公式
 */
const createWorksheetFromOriginal = (sheetData: SheetData, options: ExportOptions, XLSX: any) => {
  console.log(`\n--- 从原始数据创建工作表: ${sheetData.name} ---`);
  
  // 如果有原始workbook，直接使用原始工作表
  if (sheetData.originalWorkbook && sheetData.originalWorkbook.Sheets[sheetData.name]) {
    console.log(`使用原始工作表: ${sheetData.name}`);
    const originalWorksheet = sheetData.originalWorkbook.Sheets[sheetData.name];
    
    // 创建新的工作表，复制所有属性
    const newWorksheet: any = {};
    
    // 复制所有单元格数据
    Object.keys(originalWorksheet).forEach(key => {
      if (key.startsWith('!')) {
        // 复制工作表级别的属性
        newWorksheet[key] = JSON.parse(JSON.stringify(originalWorksheet[key]));
      } else {
        // 复制单元格数据
        newWorksheet[key] = JSON.parse(JSON.stringify(originalWorksheet[key]));
      }
    });
    
    console.log(`原始工作表属性数量: ${Object.keys(originalWorksheet).filter(k => k.startsWith('!')).length}`);
    console.log(`新工作表属性数量: ${Object.keys(newWorksheet).filter(k => k.startsWith('!')).length}`);
    
    return newWorksheet;
  }
  
  console.log(`使用样式信息重建工作表: ${sheetData.name}`);
  
  // 如果没有原始工作表，使用样式信息重建
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData.data);
  
  // 恢复原始样式
  if (sheetData.styles) {
    console.log(`恢复 ${Object.keys(sheetData.styles).length} 个单元格的样式`);
    Object.keys(sheetData.styles).forEach(cellAddress => {
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = sheetData.styles[cellAddress];
      }
    });
  }
  
  // 恢复原始公式
  if (sheetData.formulas && options.preserveFormulas) {
    console.log(`恢复 ${Object.keys(sheetData.formulas).length} 个单元格的公式`);
    Object.keys(sheetData.formulas).forEach(cellAddress => {
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].f = sheetData.formulas[cellAddress];
        // 清除计算值，让Excel重新计算公式
        delete worksheet[cellAddress].v;
      }
    });
  }
  
  // 恢复工作表级别的属性（列宽、行高、合并单元格等）
  if (sheetData.properties) {
    console.log(`恢复工作表级别属性: ${Object.keys(sheetData.properties).join(', ')}`);
    Object.keys(sheetData.properties).forEach(key => {
      worksheet[key] = JSON.parse(JSON.stringify(sheetData.properties[key]));
    });
  }
  
  console.log(`--- 工作表 ${sheetData.name} 创建完成 ---\n`);
  return worksheet;
};

/**
 * 使用默认样式创建工作表（向后兼容）
 */
const createWorksheetDefault = (sheetData: SheetData, options: ExportOptions, XLSX: any) => {
  // 创建工作表数据
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData.data);
  
  // 设置列宽
  const colWidths = sheetData.data[0]?.map((header, index) => {
    const maxLength = Math.max(
      String(header).length,
      ...sheetData.data.slice(1).map(row => String(row[index] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength, 10), 50) };
  }) || [];
  
  worksheet['!cols'] = colWidths;
  
  // 设置表头样式
  if (sheetData.data.length > 0) {
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };
    }
  }
  
  // 设置数据行样式
  if (sheetData.data.length > 1) {
    const dataRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let row = dataRange.s.r + 1; row <= dataRange.e.r; row++) {
      for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) continue;
        
        // 检查是否是公式
        const cellValue = worksheet[cellAddress].v;
        if (options.preserveFormulas && typeof cellValue === 'string' && cellValue.startsWith('=')) {
          worksheet[cellAddress].f = cellValue.substring(1);
        }
        
        worksheet[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
        };
        
        // 偶数行设置背景色
        if (row % 2 === 0) {
          worksheet[cellAddress].s.fill = { fgColor: { rgb: "F8F9FA" } };
        }
      }
    }
  }
  
  return worksheet;
};

/**
 * 验证导出的Excel文件样式是否正确保留
 */
export const validateExportedStyles = async (originalWorkbook: any, exportedWorkbook: any): Promise<boolean> => {
  const XLSX = await import('xlsx-js-style');
  
  console.log('=== 验证导出样式 ===');
  
  let allStylesPreserved = true;
  
  // 检查每个工作表
  exportedWorkbook.SheetNames?.forEach((sheetName: string) => {
    const originalSheet = originalWorkbook.Sheets[sheetName];
    const exportedSheet = exportedWorkbook.Sheets[sheetName];
    
    if (!originalSheet || !exportedSheet) {
      console.warn(`工作表 ${sheetName} 在原始或导出文件中不存在`);
      return;
    }
    
    console.log(`检查工作表: ${sheetName}`);
    
    // 检查列宽
    const originalCols = originalSheet['!cols'];
    const exportedCols = exportedSheet['!cols'];
    if (originalCols && exportedCols) {
      const colsMatch = JSON.stringify(originalCols) === JSON.stringify(exportedCols);
      console.log(`  列宽匹配: ${colsMatch}`);
      if (!colsMatch) allStylesPreserved = false;
    }
    
    // 检查行高
    const originalRows = originalSheet['!rows'];
    const exportedRows = exportedSheet['!rows'];
    if (originalRows && exportedRows) {
      const rowsMatch = JSON.stringify(originalRows) === JSON.stringify(exportedRows);
      console.log(`  行高匹配: ${rowsMatch}`);
      if (!rowsMatch) allStylesPreserved = false;
    }
    
    // 检查合并单元格
    const originalMerges = originalSheet['!merges'];
    const exportedMerges = exportedSheet['!merges'];
    if (originalMerges && exportedMerges) {
      const mergesMatch = JSON.stringify(originalMerges) === JSON.stringify(exportedMerges);
      console.log(`  合并单元格匹配: ${mergesMatch}`);
      if (!mergesMatch) allStylesPreserved = false;
    }
    
    // 检查单元格样式
    if (originalSheet['!ref'] && exportedSheet['!ref']) {
      const originalRange = XLSX.utils.decode_range(originalSheet['!ref']);
      
      let styledCellsMatch = 0;
      let totalCells = 0;
      
      for (let row = originalRange.s.r; row <= originalRange.e.r; row++) {
        for (let col = originalRange.s.c; col <= originalRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          totalCells++;
          
          const originalCell = originalSheet[cellAddress];
          const exportedCell = exportedSheet[cellAddress];
          
          if (originalCell && originalCell.s && exportedCell && exportedCell.s) {
            const stylesMatch = JSON.stringify(originalCell.s) === JSON.stringify(exportedCell.s);
            if (stylesMatch) styledCellsMatch++;
            else {
              console.warn(`  单元格 ${cellAddress} 样式不匹配`);
              console.warn(`    原始:`, originalCell.s);
              console.warn(`    导出:`, exportedCell.s);
            }
          }
        }
      }
      
      console.log(`  单元格样式匹配: ${styledCellsMatch}/${totalCells}`);
      if (styledCellsMatch < totalCells) allStylesPreserved = false;
    }
  });
  
  console.log(`=== 样式保留验证结果: ${allStylesPreserved ? '通过' : '失败'} ===`);
  return allStylesPreserved;
};
