import * as ExcelJS from 'exceljs';

// 定义消息类型
interface WorkerMessage {
  type: 'PARSE_EXCEL' | 'SAVE_EXCEL';
  file?: ArrayBuffer;
  workbook?: any;
  filename?: string;
}

interface SheetData {
  name: string;
  data: any[][];
  totalRows: number;
  totalCols: number;
  styles?: any;
  formulas?: any;
  // 保存富文本 runs（按单元格地址，如 "1_1"）以便导出时能还原颜色/加粗等
  richTextRuns?: { [cellKey: string]: any[] };
  properties?: any; // 工作表级别的属性（列宽、行高、合并单元格等）
  originalWorkbook?: any; // 原始workbook对象引用
}

interface ExcelWorkbook {
  sheets: SheetData[];
  workbook: any; // 完整的workbook对象，包含所有格式信息
}

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
            if (typeof cell.value === 'object' && 'result' in cell.value) {
              // 公式单元格
              cellValue = cell.value.result;
              formulas[`${rowNumber}_${colNumber}`] = cell.value.formula;
              formulaCellCount++;
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
      
      // 合并单元格
      if (worksheet.model && worksheet.model.merges) {
        properties.merges = worksheet.model.merges.map((merge: any) => ({
          top: merge.top,
          left: merge.left,
          bottom: merge.bottom,
          right: merge.right
        }));
      }
      
      // 保护设置 - 简化处理
      if ((worksheet as any).protection) {
        properties.protection = (worksheet as any).protection;
      }
      
    
    sheets.push({
        name: worksheet.name,
        data: data,
        totalRows: data.length,
        totalCols: data.length > 0 ? data[0].length : 0,
      styles: styles,
      formulas: formulas,
      richTextRuns,
        properties: properties,
        originalWorkbook: workbook // 保存原始workbook引用
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

  return {
    sheets: sheets,
    workbook: workbook // 保留完整的workbook对象
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
      self.postMessage({ type: 'SUCCESS', data: excelWorkbook });
    } catch (error) {
      self.postMessage({ type: 'ERROR', error: error instanceof Error ? error.message : 'Unknown error' });
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
