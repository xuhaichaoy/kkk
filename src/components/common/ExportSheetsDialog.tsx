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
  OutlinedInput,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  CircularProgress
} from '@mui/material';
import { SheetData, ExportOptions } from '../../utils/excelUtils';
import FileIcon from '@mui/icons-material/InsertDriveFile';

interface ExportSheetsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedSheets: SheetData[], options: ExportOptions) => void;
  sheets: SheetData[];
}

const ExportSheetsDialog: React.FC<ExportSheetsDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sheets
}) => {
  const [selectedSheets, setSelectedSheets] = useState<SheetData[]>([]);
  const [fileName, setFileName] = useState('导出数据');
  const [separateFiles, setSeparateFiles] = useState(false);
  const [preserveFormulas, setPreserveFormulas] = useState(true);
  const [exporting, setExporting] = useState(false);

  // 全选/取消全选
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedSheets([...sheets]);
    } else {
      setSelectedSheets([]);
    }
  }, [sheets]);

  // 切换单个sheet的选择状态
  const handleToggleSheet = useCallback((sheet: SheetData) => {
    setSelectedSheets(prev => {
      const isSelected = prev.some(s => s.name === sheet.name);
      if (isSelected) {
        return prev.filter(s => s.name !== sheet.name);
      } else {
        return [...prev, sheet];
      }
    });
  }, []);

  // 确认导出
  const handleConfirm = useCallback(async () => {
    if (selectedSheets.length === 0 || !fileName.trim()) return;
    
    setExporting(true);
    try {
      await onConfirm(selectedSheets, {
        fileName: fileName.trim(),
        separateFiles,
        preserveFormulas
      });
    } finally {
      setExporting(false);
    }
  }, [selectedSheets, fileName, separateFiles, preserveFormulas, onConfirm]);

  // 关闭对话框时重置状态
  const handleClose = useCallback(() => {
    if (exporting) return; // 导出中不允许关闭
    onClose();
  }, [onClose, exporting]);

  // 当对话框打开时重置状态
  useEffect(() => {
    if (open) {
      setSelectedSheets(sheets);
      setFileName('导出数据');
      setSeparateFiles(false);
      setPreserveFormulas(true);
      setExporting(false);
    }
  }, [open, sheets]);

  const isAllSelected = selectedSheets.length === sheets.length;
  const canExport = selectedSheets.length > 0 && fileName.trim();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={exporting}
    >
      <DialogTitle>导出Excel</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          选择要导出的工作表和导出选项
        </Alert>

        {/* 文件名 */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>文件名</InputLabel>
          <OutlinedInput
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            label="文件名"
            disabled={exporting}
          />
        </FormControl>

        {/* 导出选项 */}
        <Typography variant="h6" sx={{ mb: 1 }}>
          导出选项：
        </Typography>
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={separateFiles}
                onChange={(e) => setSeparateFiles(e.target.checked)}
                disabled={exporting}
              />
            }
            label="每个工作表导出为单独的Excel文件"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preserveFormulas}
                onChange={(e) => setPreserveFormulas(e.target.checked)}
                disabled={exporting}
              />
            }
            label="保留公式"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 工作表选择 */}
        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            选择工作表：
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                disabled={exporting}
              />
            }
            label="全选"
          />
        </Box>

        <List sx={{ 
          maxHeight: 300, 
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1
        }}>
          {sheets.map((sheet, index) => (
            <ListItem 
              key={index} 
              dense
              onClick={() => !exporting && handleToggleSheet(sheet)}
              sx={{ 
                cursor: exporting ? 'default' : 'pointer',
                opacity: exporting ? 0.5 : 1
              }}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selectedSheets.some(s => s.name === sheet.name)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemIcon>
                <FileIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary={sheet.name}
                secondary={`${sheet.totalRows}行 × ${sheet.totalCols}列`}
              />
            </ListItem>
          ))}
        </List>

        {exporting && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            <Typography>正在导出...</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={handleClose}
          disabled={exporting}
        >
          取消
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="primary"
          disabled={!canExport || exporting}
        >
          导出
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportSheetsDialog;
