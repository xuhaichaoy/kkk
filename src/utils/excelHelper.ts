// Excel处理辅助工具类
export class ExcelHelper {
  private worker: Worker;
  private messageId = 0;

  constructor() {
    this.worker = new Worker(new URL('../workers/excelWorker.ts', import.meta.url));
  }

  // 解析Excel文件，保留所有格式信息
  async parseExcel(file: File): Promise<{
    sheets: Array<{
      name: string;
      data: any[][];
      totalRows: number;
      totalCols: number;
      styles?: any;
      formulas?: any;
    }>;
    workbook: any; // 完整的workbook对象
  }> {
    return new Promise((resolve, reject) => {
      ++this.messageId;
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'SUCCESS') {
          this.worker.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };

      this.worker.addEventListener('message', handleMessage);

      // 将文件转换为ArrayBuffer
      const reader = new FileReader();
      reader.onload = () => {
        this.worker.postMessage({
          type: 'PARSE_EXCEL',
          file: reader.result as ArrayBuffer
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // 保存Excel文件，保留所有格式信息
  async saveExcel(workbook: any, filename: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      ++this.messageId;
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'SAVE_SUCCESS') {
          this.worker.removeEventListener('message', handleMessage);
          resolve(e.data.data);
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(e.data.error));
        }
      };

      this.worker.addEventListener('message', handleMessage);

      this.worker.postMessage({
        type: 'SAVE_EXCEL',
        workbook: workbook,
        filename: filename
      });
    });
  }

  // 下载Excel文件
  downloadExcel(arrayBuffer: ArrayBuffer, filename: string) {
    const blob = new Blob([arrayBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 处理Excel数据（示例：拆表操作）
  processExcelData(excelData: any, operation: 'split' | 'merge' | 'filter', options?: any) {
    const { sheets, workbook } = excelData;
    
    switch (operation) {
      case 'split':
        return this.splitSheets(sheets, workbook, options);
      case 'merge':
        return this.mergeSheets(sheets, workbook, options);
      case 'filter':
        return this.filterData(sheets, workbook, options);
      default:
        throw new Error('不支持的操作类型');
    }
  }

  // 拆表操作
  private splitSheets(sheets: any[], workbook: any, _options: any) {
    // 这里实现拆表逻辑
    // 保持原有的workbook对象，只修改数据
    const processedSheets = sheets.map(sheet => {
      // 根据options进行拆表操作
      // 例如：按行数拆分、按列拆分等
      return {
        ...sheet,
        // 修改后的数据
      };
    });

    return {
      sheets: processedSheets,
      workbook: workbook // 保持原始workbook对象
    };
  }

  // 合并操作
  private mergeSheets(sheets: any[], workbook: any, _options: any) {
    // 实现合并逻辑
    return {
      sheets: sheets,
      workbook: workbook
    };
  }

  // 过滤操作
  private filterData(sheets: any[], workbook: any, _options: any) {
    // 实现过滤逻辑
    return {
      sheets: sheets,
      workbook: workbook
    };
  }

  // 销毁Worker
  destroy() {
    this.worker.terminate();
  }
}

// 使用示例
export async function processExcelFile(file: File) {
  const excelHelper = new ExcelHelper();
  
  try {
    // 1. 读取Excel文件，保留所有格式
    const excelData = await excelHelper.parseExcel(file);
    console.log('Excel文件解析完成，包含样式和公式信息');
    
    // 2. 处理数据（例如拆表）
    const processedData = excelHelper.processExcelData(excelData, 'split', {
      // 拆表选项
    });
    
    // 3. 保存处理后的Excel文件
    const fileBuffer = await excelHelper.saveExcel(processedData.workbook, 'processed.xlsx');
    
    // 4. 下载文件
    excelHelper.downloadExcel(fileBuffer, 'processed.xlsx');
    
    console.log('Excel文件处理完成，所有格式已保留');
    
  } catch (error) {
    console.error('处理Excel文件时出错:', error);
  } finally {
    excelHelper.destroy();
  }
}
