import * as ExcelJS from 'exceljs';

// 定义消息类型
interface WorkerMessage {
  type: 'PARSE_EXCEL' | 'SAVE_EXCEL';
  file?: ArrayBuffer;
  workbook?: any;
  filename?: string;
  fileId?: string;
}

interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
  headerRowIndex?: number;
  headerDetectionMode?: 'auto' | 'manual';
  styles?: any;
  formulas?: any;
  // 保存富文本 runs（按单元格地址，如 "1_1"）以便导出时能还原颜色/加粗等
  richTextRuns?: { [cellKey: string]: any[] };
  properties?: any; // 工作表级别的属性（列宽、行高、合并单元格等）
  originalWorkbook?: any; // 原始workbook对象引用
  sourceFileId?: string;
  originalName?: string;
}

interface ExcelWorkbook {
  sheets: SheetData[];
  workbook: any; // 完整的workbook对象，包含所有格式信息
}

const detectHeaderRowIndex = (rows: any[][]): number => {
  if (!Array.isArray(rows)) {
    return 0;
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
      if (typeof cell === 'number' || typeof cell === 'boolean') {
        return true;
      }
      if (cell instanceof Date) {
        return true;
      }
      const text = String(cell);
      return text.trim() !== '' && text !== '[object Object]';
    });

    if (hasValue) {
      return i;
    }
  }

  return 0;
};

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

const normalizeMergeRange = (merge: any): { top: number; left: number; bottom: number; right: number } | null => {
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

const collectWorksheetMerges = (worksheet: ExcelJS.Worksheet): Array<{ top: number; left: number; bottom: number; right: number }> => {
  const merges: Array<{ top: number; left: number; bottom: number; right: number }> = [];
  const seen = new Set<string>();

  const push = (merge: any) => {
    const normalized = normalizeMergeRange(merge);
    if (!normalized) {
      return;
    }
    const key = `${normalized.top}:${normalized.left}:${normalized.bottom}:${normalized.right}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merges.push(normalized);
  };

  const model: any = (worksheet as any).model || {};
  const collections = [model.mergeCells, model.merges, (worksheet as any)._merges];
  collections.forEach(collection => {
    if (!collection) {
      return;
    }
    if (Array.isArray(collection)) {
      collection.forEach(push);
    } else if (typeof collection === 'object') {
      Object.values(collection).forEach(push);
    }
  });

  return merges;
};

// 处理Excel文件 - 保留所有格式信息
async function parseExcel(file: ArrayBuffer): Promise<ExcelWorkbook> {
  
  try {
    // 创建新的工作簿实例
    const workbook = new ExcelJS.Workbook();
    
    // 从ArrayBuffer加载Excel文件
    await workbook.xlsx.load(file);
    
    const sheets: SheetData[] = [];

    // 调试日志：工作簿信息
    try {
      console.log('[excelWorker] workbook loaded:', {
        worksheetCount: workbook.worksheets?.length,
        creator: (workbook as any).creator,
      });
    } catch (_) {
      // ignore logging failures in worker
    }

    // 处理每个工作表
    for (const worksheet of workbook.worksheets) {
      
      // 获取工作表的基本信息
      const rowCount = worksheet.rowCount;
      const columnCount = worksheet.columnCount;
      
      // 提取数据
      const data: any[][] = [];
      const styles: any = {};
      const formulas: any = {};
      const properties: any = {};
      const richTextRuns: Record<string, any[]> = {};
      
      // 遍历所有行和列
      let styledCellCount = 0;
      let formulaCellCount = 0;
      for (let rowNumber = 1; rowNumber <= rowCount; rowNumber++) {
        const rowData: any[] = [];
        
        for (let colNumber = 1; colNumber <= columnCount; colNumber++) {
          const cell = worksheet.getCell(rowNumber, colNumber);
          // 获取单元格值
          let cellValue: any = '';
          
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && cell.value !== null && 'formula' in cell.value) {
              const formulaValue = cell.value as any;
              const hasResult = formulaValue.result !== undefined && formulaValue.result !== null;
              if (hasResult) {
                cellValue = formulaValue.result;
              } else if (typeof cell.text === 'string' && cell.text !== '') {
                cellValue = cell.text;
              } else if (formulaValue.result === null) {
                cellValue = '';
              } else {
                cellValue = '';
              }
              formulas[`${rowNumber}_${colNumber}`] = formulaValue.formula;
              if (hasResult) {
                formulaCellCount++;
              }
            } else if (typeof cell.value === 'object' && 'richText' in cell.value) {
              // 富文本单元格 - 提取纯文本内容
              const richTextValue = cell.value as any;
              if (Array.isArray(richTextValue.richText)) {
                cellValue = richTextValue.richText.map((item: any) => item.text || '').join('');
                // 保存富文本 runs 以便导出时还原（包含字体颜色等）
                try {
                  richTextRuns[`${rowNumber}_${colNumber}`] = richTextValue.richText.map((rt: any) => ({
                    text: rt.text,
                    font: rt.font ? {
                      name: rt.font.name,
                      size: rt.font.size,
                      bold: rt.font.bold,
                      italic: rt.font.italic,
                      underline: rt.font.underline,
                      strike: rt.font.strike,
                      color: rt.font.color
                    } : undefined
                  }));
                } catch (_) {}
              } else {
                cellValue = richTextValue.richText?.text || '';
              }
            } else {
              cellValue = cell.value;
            }
          }
          
          rowData[colNumber - 1] = cellValue;
          
          const cellAddress = `${rowNumber}_${colNumber}`;
          
          
          // 提取样式信息 - 无论单元格是否有值都要提取样式
          if (cell.style) {
            
            styles[cellAddress] = {
              font: cell.style.font ? {
                name: cell.style.font.name,
                size: cell.style.font.size,
                bold: cell.style.font.bold,
                italic: cell.style.font.italic,
                underline: cell.style.font.underline,
                strike: cell.style.font.strike,
                color: cell.style.font.color ? {
                  argb: cell.style.font.color.argb,
                  theme: cell.style.font.color.theme
                } : undefined
              } : undefined,
              fill: cell.style.fill ? {
                type: cell.style.fill.type,
                pattern: (cell.style.fill as any).pattern,
                fgColor: (cell.style.fill as any).fgColor ? {
                  argb: (cell.style.fill as any).fgColor.argb,
                  theme: (cell.style.fill as any).fgColor.theme
                } : undefined,
                bgColor: (cell.style.fill as any).bgColor ? {
                  argb: (cell.style.fill as any).bgColor.argb,
                  theme: (cell.style.fill as any).bgColor.theme
                } : undefined
              } : undefined,
              border: cell.style.border ? {
                top: cell.style.border.top ? {
                  style: cell.style.border.top.style,
                  color: cell.style.border.top.color ? {
                    argb: cell.style.border.top.color.argb,
                    theme: cell.style.border.top.color.theme
                  } : undefined
                } : undefined,
                left: cell.style.border.left ? {
                  style: cell.style.border.left.style,
                  color: cell.style.border.left.color ? {
                    argb: cell.style.border.left.color.argb,
                    theme: cell.style.border.left.color.theme
                  } : undefined
                } : undefined,
                bottom: cell.style.border.bottom ? {
                  style: cell.style.border.bottom.style,
                  color: cell.style.border.bottom.color ? {
                    argb: cell.style.border.bottom.color.argb,
                    theme: cell.style.border.bottom.color.theme
                  } : undefined
                } : undefined,
                right: cell.style.border.right ? {
                  style: cell.style.border.right.style,
                  color: cell.style.border.right.color ? {
                    argb: cell.style.border.right.color.argb,
                    theme: cell.style.border.right.color.theme
                  } : undefined
                } : undefined,
                diagonal: cell.style.border.diagonal ? {
                  style: cell.style.border.diagonal.style,
                  color: cell.style.border.diagonal.color ? {
                    argb: cell.style.border.diagonal.color.argb,
                    theme: cell.style.border.diagonal.color.theme
                  } : undefined
                } : undefined
              } : undefined,
              alignment: cell.style.alignment ? {
                horizontal: cell.style.alignment.horizontal,
                vertical: cell.style.alignment.vertical,
                wrapText: cell.style.alignment.wrapText,
                textRotation: cell.style.alignment.textRotation,
                indent: cell.style.alignment.indent,
                readingOrder: cell.style.alignment.readingOrder
              } : undefined,
              numFmt: cell.style.numFmt,
              protection: cell.style.protection ? {
                locked: cell.style.protection.locked,
                hidden: cell.style.protection.hidden
              } : undefined
            };
            // 统计具有实际样式的单元格
            if (
              styles[cellAddress].font ||
              styles[cellAddress].fill ||
              styles[cellAddress].border ||
              styles[cellAddress].alignment ||
              styles[cellAddress].numFmt ||
              styles[cellAddress].protection
            ) {
              styledCellCount++;
            }
            
          } else {
            // 即使没有样式，也要记录空单元格，这样导出时能正确处理
            styles[cellAddress] = {
              font: undefined,
              fill: undefined,
              border: undefined,
              alignment: undefined,
              numFmt: undefined,
              protection: undefined
            };
            
          }
        }
        
        data[rowNumber - 1] = rowData;
      }
      
      // 确保数据数组长度与行数一致
      while (data.length < rowCount) {
        data.push(new Array(columnCount).fill(''));
      }

      // 提取工作表级别的属性
      properties.columnCount = worksheet.columnCount;
      properties.rowCount = worksheet.rowCount;
      
      // 列宽
      if (worksheet.columns && worksheet.columns.length > 0) {
        properties.columns = worksheet.columns.map(col => ({
          width: col.width,
          hidden: col.hidden,
          style: col.style
        }));
      }
      
      // 行高
      properties.rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (row.height) {
          properties.rows[rowNumber - 1] = {
            height: row.height,
            hidden: row.hidden
          };
        }
      });
      
      // 自动筛选范围
      if ((worksheet as any).autoFilter) {
        const filter = (worksheet as any).autoFilter;
        if (typeof filter === 'string') {
          properties.autoFilter = filter;
        } else if (filter && typeof filter === 'object') {
          properties.autoFilter = {
            ...filter,
            from: filter.from ? { ...filter.from } : undefined,
            to: filter.to ? { ...filter.to } : undefined
          };
        }
      }

      // 合并单元格
      const merges = collectWorksheetMerges(worksheet);
      if (merges.length > 0) {
        properties.merges = merges;
      }
      
      // 保护设置 - 简化处理
      if ((worksheet as any).protection) {
        properties.protection = (worksheet as any).protection;
      }
      
      const headerRowIndex = detectHeaderRowIndex(data);
      const headerRow = Array.isArray(data[headerRowIndex]) ? data[headerRowIndex] : [];
      const totalRows = Math.max(data.length - headerRowIndex - 1, 0);
      const totalCols = data.reduce((max, row) => {
        if (Array.isArray(row)) {
          return Math.max(max, row.length);
        }
        return max;
      }, Array.isArray(headerRow) ? headerRow.length : 0);

      if (!properties.autoFilter && totalCols > 0) {
        const headerRowNumber = headerRowIndex + 1;
        const lastRowNumber = Math.max(headerRowNumber, headerRowNumber + totalRows);
        properties.autoFilter = {
          from: { row: headerRowNumber, column: 1 },
          to: { row: lastRowNumber, column: Math.max(totalCols, columnCount) }
        };
      }

      sheets.push({
        name: worksheet.name,
        originalName: worksheet.name,
        data,
        totalRows,
        totalCols,
        headerRowIndex,
        headerDetectionMode: 'auto',
        styles,
        formulas,
        richTextRuns,
        properties,
        // 注意：不要把 workbook 跨线程传回主线程（会导致结构化克隆失败/方法丢失）
        originalWorkbook: undefined,
        sourceFileId: undefined
      });

      // 调试日志：每个工作表的统计
      try {
        console.log('[excelWorker] sheet parsed:', {
          name: worksheet.name,
          rows: rowCount,
          cols: columnCount,
          formulaCells: Object.keys(formulas).length,
          styledCells: styledCellCount,
          merges: properties.merges?.length || 0,
        });
      } catch (_) {}
  }

  // 仅在 worker 内部保留完整 workbook 引用；
  // 发送到主线程的数据不包含 workbook，以避免 DataCloneError 和性能问题。
  return {
    sheets: sheets,
    workbook: workbook
  };
    
  } catch (error) {
    console.error('解析Excel文件失败:', error);
    throw new Error(`解析Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 保存Excel文件 - 保留所有格式信息
async function saveExcel(workbook: any, _filename: string): Promise<ArrayBuffer> {
  
  try {
    // 使用ExcelJS的writeBuffer方法
    const buffer = await workbook.xlsx.writeBuffer();
    
    return buffer;
    
  } catch (error) {
    console.error('保存Excel文件失败:', error);
    throw new Error(`保存Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 监听主线程消息
self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === 'PARSE_EXCEL') {
    try {
      const excelWorkbook = await parseExcel(e.data.file!);
      try {
        if (Array.isArray((excelWorkbook as any).sheets)) {
          (excelWorkbook as any).sheets.forEach((sheet: any) => {
            sheet.sourceFileId = e.data.fileId;
          });
        }
      } catch (_) {}
      // 仅发送可序列化的最小数据集（不包含 workbook 和任何函数/循环引用）
      const serializableSheets = (excelWorkbook as any).sheets.map((s: any) => ({
        ...s,
        originalWorkbook: undefined
      }));
      self.postMessage({ type: 'SUCCESS', data: { sheets: serializableSheets }, fileId: e.data.fileId });
    } catch (error) {
      self.postMessage({ type: 'ERROR', error: error instanceof Error ? error.message : 'Unknown error', fileId: e.data.fileId });
    }
  } else if (e.data.type === 'SAVE_EXCEL') {
    try {
      const fileBuffer = await saveExcel(e.data.workbook!, e.data.filename!);
      self.postMessage({ type: 'SAVE_SUCCESS', data: fileBuffer });
    } catch (error) {
      self.postMessage({ type: 'ERROR', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
});
