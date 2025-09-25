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
  properties?: any; // 工作表级别的属性（列宽、行高、合并单元格等）
}

interface ExcelWorkbook {
  sheets: SheetData[];
  workbook: any; // 完整的workbook对象，包含所有格式信息
}

// 处理Excel文件 - 保留所有格式信息
async function parseExcel(file: ArrayBuffer): Promise<ExcelWorkbook> {
  console.log('=== 开始解析Excel文件 ===');
  console.log('文件大小:', file.byteLength, 'bytes');
  
  // 尝试不同的配置选项
  console.log('尝试配置1: 完整配置');
  let workbook = XLSX.read(file, { 
    type: 'array',
    cellStyles: true,
    cellFormula: true,
    cellHTML: false,
    cellNF: true,
    cellText: false,
    cellDates: true,
    dateNF: 'yyyy-mm-dd',
    sheetStubs: false,
    bookDeps: true,
    bookFiles: true,
    bookProps: true,
    bookSheets: true,
    bookVBA: false,
    password: '',
    WTF: false
  });
  
  // 如果第一个配置没有样式，尝试更简单的配置
  if (!(workbook as any).SSF && !(workbook as any).Styles) {
    console.log('配置1没有样式信息，尝试配置2: 简化配置');
    workbook = XLSX.read(file, { 
      type: 'array',
      cellStyles: true,
      cellFormula: true,
      cellDates: true
    });
  }
  
  // 如果还是没有样式，尝试最基础的配置
  if (!(workbook as any).SSF && !(workbook as any).Styles) {
    console.log('配置2没有样式信息，尝试配置3: 最基础配置');
    workbook = XLSX.read(file, { 
      type: 'array',
      cellStyles: true
    });
  }
  
  // 如果还是没有样式，尝试使用原生xlsx库
  if (!(workbook as any).SSF && !(workbook as any).Styles) {
    console.log('配置3没有样式信息，尝试原生xlsx库');
    try {
      const XLSX_NATIVE = await import('xlsx');
      workbook = XLSX_NATIVE.read(file, { 
        type: 'array',
        cellStyles: true,
        cellFormula: true,
        cellDates: true
      });
      console.log('原生xlsx库结果:', {
        hasSSF: !!(workbook as any).SSF,
        hasStyles: !!(workbook as any).Styles,
        workbookKeys: Object.keys(workbook)
      });
    } catch (error) {
      console.error('原生xlsx库导入失败:', error);
    }
  }
  
  console.log('Excel文件解析完成，工作表数量:', workbook.SheetNames.length);
  console.log('workbook属性:', Object.keys(workbook));
  
  // 详细检查workbook的所有属性
  console.log('workbook详细属性检查:');
  Object.keys(workbook).forEach(key => {
    const value = (workbook as any)[key];
    if (typeof value === 'object' && value !== null) {
      console.log(`  - ${key}:`, {
        type: typeof value,
        isArray: Array.isArray(value),
        keys: Object.keys(value).slice(0, 10), // 只显示前10个键
        length: Array.isArray(value) ? value.length : Object.keys(value).length
      });
    } else {
      console.log(`  - ${key}:`, value);
    }
  });
  
  // 检查第一个工作表的详细信息
  if (workbook.SheetNames.length > 0) {
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    console.log(`第一个工作表 ${firstSheetName} 的详细信息:`);
    console.log('  - 工作表属性:', Object.keys(firstSheet).filter(k => k.startsWith('!')));
    console.log('  - 单元格数量:', Object.keys(firstSheet).filter(k => !k.startsWith('!')).length);
    
    // 检查前几个单元格的样式
    const cellKeys = Object.keys(firstSheet).filter(k => !k.startsWith('!')).slice(0, 5);
    cellKeys.forEach(cellKey => {
      const cell = firstSheet[cellKey];
      console.log(`  - 单元格 ${cellKey}:`, {
        hasValue: !!cell.v,
        hasFormula: !!cell.f,
        hasStyle: !!cell.s,
        styleContent: cell.s,
        allKeys: Object.keys(cell)
      });
    });
    
    // 检查是否有样式表信息
    console.log('  - workbook.SSF (样式表):', !!(workbook as any).SSF);
    console.log('  - workbook.Styles (样式):', !!(workbook as any).Styles);
    if ((workbook as any).SSF) {
      console.log('  - SSF键数量:', Object.keys((workbook as any).SSF).length);
    }
    if ((workbook as any).Styles) {
      console.log('  - Styles键数量:', Object.keys((workbook as any).Styles).length);
    }
  }
  
  const sheets: SheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- 处理工作表: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    
    // 获取原始数据，保留公式
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false // 保留公式
    }) as any[][];
    
    console.log(`工作表 ${sheetName} 数据行数: ${jsonData.length}`);
    
    // 提取样式信息
    const styles = extractStyles(worksheet);
    console.log(`工作表 ${sheetName} 有样式的单元格数量: ${Object.keys(styles).length}`);
    
    // 输出部分样式信息用于调试
    const styleKeys = Object.keys(styles).slice(0, 3);
    styleKeys.forEach(cellAddr => {
      console.log(`  单元格 ${cellAddr} 样式:`, styles[cellAddr]);
    });
    
    // 提取公式信息
    const formulas = extractFormulas(worksheet);
    console.log(`工作表 ${sheetName} 有公式的单元格数量: ${Object.keys(formulas).length}`);
    
    // 提取工作表级别的属性
    const properties = extractSheetProperties(worksheet);
    console.log(`工作表 ${sheetName} 工作表级别属性:`, Object.keys(properties));
    
    // 输出列宽和行高信息
    if (properties['!cols']) {
      console.log(`  列宽设置: ${properties['!cols'].length} 列`);
    }
    if (properties['!rows']) {
      console.log(`  行高设置: ${properties['!rows'].length} 行`);
    }
    if (properties['!merges']) {
      console.log(`  合并单元格: ${properties['!merges'].length} 个`);
    }
    
    sheets.push({
      name: sheetName,
      data: jsonData,
      totalRows: jsonData.length,
      totalCols: Array.isArray(jsonData[0]) ? jsonData[0].length : 0,
      styles: styles,
      formulas: formulas,
      properties: properties
    });
  }

  console.log('\n=== Excel文件解析完成 ===');
  return {
    sheets: sheets,
    workbook: workbook // 保留完整的workbook对象
  };
}

// 提取单元格样式信息
function extractStyles(worksheet: any): any {
  const styles: any = {};
  
  console.log(`  - 开始提取样式信息`);
  console.log(`  - 工作表范围: ${worksheet['!ref']}`);
  console.log(`  - 工作表所有属性:`, Object.keys(worksheet).filter(k => k.startsWith('!')));
  
  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    console.log(`  - 解析范围: ${range.s.r}-${range.e.r}, ${range.s.c}-${range.e.c}`);
    
    let totalCells = 0;
    let cellsWithStyle = 0;
    
    // 先计算总数
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        totalCells++;
      }
    }
    
    // 然后处理样式，只打印前5行
    let printedRows = 0;
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          // 只打印前5行的单元格信息
          if (printedRows < 5) {
            console.log(`  - 单元格 ${cellAddress}:`, {
              hasValue: !!cell.v,
              hasFormula: !!cell.f,
              hasStyle: !!cell.s,
              styleKeys: cell.s ? Object.keys(cell.s) : []
            });
          }
          
          if (cell && cell.s) {
            cellsWithStyle++;
            // 直接复制整个样式对象，确保不丢失任何样式属性
            styles[cellAddress] = JSON.parse(JSON.stringify(cell.s));
            
            // 确保常见的样式属性都被保留
            if (!styles[cellAddress].font && cell.s.font) {
              styles[cellAddress].font = cell.s.font;
            }
            if (!styles[cellAddress].fill && cell.s.fill) {
              styles[cellAddress].fill = cell.s.fill;
            }
            if (!styles[cellAddress].border && cell.s.border) {
              styles[cellAddress].border = cell.s.border;
            }
            if (!styles[cellAddress].alignment && cell.s.alignment) {
              styles[cellAddress].alignment = cell.s.alignment;
            }
            if (!styles[cellAddress].numFmt && cell.s.numFmt) {
              styles[cellAddress].numFmt = cell.s.numFmt;
            }
          }
        }
      }
      printedRows++;
    }
    
    console.log(`  - 总单元格数: ${totalCells}, 有样式的单元格数: ${cellsWithStyle}`);
  } else {
    console.log(`  - 工作表没有!ref属性，无法提取样式`);
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

// 提取工作表级别的属性
function extractSheetProperties(worksheet: any): any {
  const properties: any = {};
  
  console.log(`  - 开始提取工作表级别属性`);
  console.log(`  - 工作表所有键:`, Object.keys(worksheet));
  
  // 提取所有以!开头的工作表级别属性
  Object.keys(worksheet).forEach(key => {
    if (key.startsWith('!') && key !== '!ref') {
      console.log(`  - 提取属性 ${key}:`, worksheet[key]);
      // 深度复制属性值，避免引用问题
      properties[key] = JSON.parse(JSON.stringify(worksheet[key]));
    }
  });
  
  // 确保常见的工作表属性都被保留
  const commonProps = ['!cols', '!rows', '!merges', '!protect', '!autofilter'];
  commonProps.forEach(prop => {
    if (worksheet[prop] && !properties[prop]) {
      console.log(`  - 补充属性 ${prop}:`, worksheet[prop]);
      properties[prop] = JSON.parse(JSON.stringify(worksheet[prop]));
    }
  });
  
  console.log(`  - 提取到的属性:`, Object.keys(properties));
  
  return properties;
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
