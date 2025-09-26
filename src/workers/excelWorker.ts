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
  properties?: any; // 工作表级别的属性（列宽、行高、合并单元格等）
  originalWorkbook?: any; // 原始workbook对象引用
}

interface ExcelWorkbook {
  sheets: SheetData[];
  workbook: any; // 完整的workbook对象，包含所有格式信息
}

// 处理Excel文件 - 保留所有格式信息
async function parseExcel(file: ArrayBuffer): Promise<ExcelWorkbook> {
  // 动态导入ExcelJS
  const ExcelJS = await import('exceljs');
  
  try {
    // 创建新的工作簿实例
    const workbook = new ExcelJS.Workbook();
    
    // 从ArrayBuffer加载Excel文件
    await workbook.xlsx.load(file);
    
    const sheets: SheetData[] = [];

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
      
      // 遍历所有行和列
      for (let rowNumber = 1; rowNumber <= rowCount; rowNumber++) {
        const rowData: any[] = [];
        
        for (let colNumber = 1; colNumber <= columnCount; colNumber++) {
          const cell = worksheet.getCell(rowNumber, colNumber);
          
          // 获取单元格值
          let cellValue = cell.value;
          
          // 处理不同类型的值
          if (cellValue === null || cellValue === undefined) {
            cellValue = '';
          } else if (typeof cellValue === 'object') {
            // 处理公式、日期等复杂类型
            if (cellValue && typeof cellValue === 'object' && 'formula' in cellValue) {
              cellValue = (cellValue as any).result || '';
              // 保存公式信息
              const cellKey = `${rowNumber}_${colNumber}`;
              formulas[cellKey] = (cellValue as any).formula;
            } else if (cellValue instanceof Date) {
              cellValue = cellValue.toISOString();
            } else if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
              cellValue = (cellValue as any).text;
            } else {
              cellValue = String(cellValue);
            }
          }
          
          rowData.push(cellValue);
          
          // 保存样式信息
          if (cell.style && Object.keys(cell.style).length > 0) {
            const cellKey = `${rowNumber}_${colNumber}`;
            styles[cellKey] = cell.style;
          }
        }
        
        data.push(rowData);
      }
      
      // 保存工作表属性
      properties.rowCount = rowCount;
      properties.columnCount = columnCount;
      properties.defaultRowHeight = worksheet.properties.defaultRowHeight;
      properties.defaultColWidth = worksheet.properties.defaultColWidth;
      
      // 保存合并单元格信息
      if (worksheet.model && worksheet.model.merges) {
        properties.merges = worksheet.model.merges;
      }
      
      sheets.push({
        name: worksheet.name,
        data: data,
        totalRows: rowCount,
        totalCols: columnCount,
        styles: styles,
        formulas: formulas,
        properties: properties
      });
    }

    return {
      sheets: sheets,
      workbook: workbook
    };
    
  } catch (error) {
    console.error('Excel解析错误:', error);
    throw new Error(`Excel文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// Worker消息处理
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  try {
    const { type, file } = event.data;
    
    if (type === 'PARSE_EXCEL' && file) {
      const result = await parseExcel(file);
      
      self.postMessage({
        type: 'SUCCESS',
        data: result
      });
    } else {
      self.postMessage({
        type: 'ERROR',
        error: '无效的消息类型或缺少文件数据'
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};