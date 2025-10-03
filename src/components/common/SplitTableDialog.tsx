import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography
} from '@mui/material';
import { SheetData, getColumnUniqueValues, getDataRows, getHeaderRow } from '../../utils/excelUtils';

interface SplitTableDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (columnField: string) => void;
  sheetData: SheetData | null;
  currentSheet: number;
  editedRows: { [key: string]: { [key: string]: any } };
}

const SplitTableDialog: React.FC<SplitTableDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sheetData,
  currentSheet,
  editedRows
}) => {
  const [selectedColumnField, setSelectedColumnField] = useState<string>('');
  const [columnUniqueValues, setColumnUniqueValues] = useState<string[]>([]);

  // 处理列选择变化
  const handleColumnChange = useCallback((columnField: string) => {
    setSelectedColumnField(columnField);
    
    if (columnField && sheetData) {
      const columnIndex = parseInt(columnField);
      const dataRows = getDataRows(sheetData);
      if (Number.isInteger(columnIndex) && dataRows.length > 0) {
        const uniqueValues = getColumnUniqueValues(dataRows, columnIndex, currentSheet, editedRows);
        setColumnUniqueValues(uniqueValues);
      } else {
        setColumnUniqueValues([]);
      }
    } else {
      setColumnUniqueValues([]);
    }
  }, [sheetData, currentSheet, editedRows]);

  // 确认拆分
  const handleConfirm = useCallback(() => {
    if (selectedColumnField) {
      onConfirm(selectedColumnField);
    }
  }, [selectedColumnField, onConfirm]);

  // 关闭对话框时重置状态
  const handleClose = useCallback(() => {
    setSelectedColumnField('');
    setColumnUniqueValues([]);
    onClose();
  }, [onClose]);

  // 当对话框打开时重置状态
  useEffect(() => {
    if (open) {
      setSelectedColumnField('');
      setColumnUniqueValues([]);
    }
  }, [open]);

  const headers = sheetData ? getHeaderRow(sheetData) : [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>拆分表格</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          请选择要用于拆分的列
        </Alert>
        
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>选择列</InputLabel>
          <Select
            value={selectedColumnField}
            onChange={(e) => handleColumnChange(e.target.value)}
            label="选择列"
          >
            {headers.map((header: string, index: number) => (
              <MenuItem key={index} value={String(index)}>
                {header || `列 ${index + 1}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {columnUniqueValues.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success" sx={{ mb: 1 }}>
              检测到 {columnUniqueValues.length} 个唯一值
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              将创建以下工作表：
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 1,
              maxHeight: 120,
              overflow: 'auto',
              p: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'background.default'
            }}>
              {columnUniqueValues.map((value, index) => (
                <Box
                  key={index}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  {value}
                </Box>
              ))}
            </Box>
          </Box>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          系统将自动检测该列的所有唯一值，并为每个值创建一个新的工作表。
          拆分后的表格将保持原有的表头、样式和公式。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          取消
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="primary"
          disabled={!selectedColumnField}
        >
          确认拆分
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SplitTableDialog;
