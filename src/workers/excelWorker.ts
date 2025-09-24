import * as XLSX from 'xlsx-js-style';

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
}

interface ExcelWorkbook {
  sheets: SheetData[];
  workbook: any; // 完整的workbook对象，包含所有格式信息
}

// 处理Excel文件 - 保留所有格式信息
async function parseExcel(file: ArrayBuffer): Promise<ExcelWorkbook> {
  // 使用cellStyles选项来保留样式信息
  const workbook = XLSX.read(file, { 
    type: 'array',
    cellStyles: true,
    cellFormula: true,
    cellHTML: false,
    cellNF: false,
    cellText: false,
    cellDates: true,
    dateNF: 'yyyy-mm-dd',
    sheetStubs: false,
    bookDeps: false,
    bookFiles: false,
    bookProps: false,
    bookSheets: false,
    bookVBA: false,
    password: '',
    WTF: false
  });
  
  const sheets: SheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    
    // 获取原始数据，保留公式
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false // 保留公式
    }) as any[][];
    
    // 提取样式信息
    const styles = extractStyles(worksheet);
    
    // 提取公式信息
    const formulas = extractFormulas(worksheet);
    
    sheets.push({
      name: sheetName,
      data: jsonData,
      totalRows: jsonData.length,
      totalCols: Array.isArray(jsonData[0]) ? jsonData[0].length : 0,
      styles: styles,
      formulas: formulas
    });
  }

  return {
    sheets: sheets,
    workbook: workbook // 保留完整的workbook对象
  };
}

// 提取单元格样式信息
function extractStyles(worksheet: any): any {
  const styles: any = {};
  
  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.s) {
          styles[cellAddress] = {
            font: cell.s.font,
            fill: cell.s.fill,
            border: cell.s.border,
            alignment: cell.s.alignment,
            numberFormat: cell.s.numFmt
          };
        }
      }
    }
  }
  
  return styles;
}

// 提取公式信息
function extractFormulas(worksheet: any): any {
  const formulas: any = {};
  
  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.f) {
          formulas[cellAddress] = cell.f;
        }
      }
    }
  }
  
  return formulas;
}

// 保存Excel文件 - 保留所有格式信息
async function saveExcel(workbook: any, _filename: string): Promise<ArrayBuffer> {
  // 使用xlsx-js-style的write函数来保留样式
  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
    compression: true
  });
  
  return wbout;
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
