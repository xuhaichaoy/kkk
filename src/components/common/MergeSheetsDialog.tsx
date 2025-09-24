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
  Chip,
  Divider
} from '@mui/material';
import { SheetData, analyzeSheetsForMerge, MergeAnalysis } from '../../utils/excelUtils';

interface MergeSheetsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedSheets: SheetData[], mergedSheetName: string) => void;
  sheets: SheetData[];
}

const MergeSheetsDialog: React.FC<MergeSheetsDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sheets
}) => {
  const [selectedSheets, setSelectedSheets] = useState<SheetData[]>([]);
  const [mergedSheetName, setMergedSheetName] = useState('合并表格');
  const [mergeAnalysis, setMergeAnalysis] = useState<MergeAnalysis | null>(null);

  // 处理sheet选择
  const handleSheetToggle = useCallback((sheet: SheetData) => {
    setSelectedSheets(prev => {
      const isSelected = prev.some(s => s.name === sheet.name);
      if (isSelected) {
        return prev.filter(s => s.name !== sheet.name);
      } else {
        return [...prev, sheet];
      }
    });
  }, []);

  // 分析选中的sheets
  useEffect(() => {
    if (selectedSheets.length >= 2) {
      const analysis = analyzeSheetsForMerge(selectedSheets);
      setMergeAnalysis(analysis);
    } else {
      setMergeAnalysis(null);
    }
  }, [selectedSheets]);

  // 确认合并
  const handleConfirm = useCallback(() => {
    if (selectedSheets.length >= 2 && mergedSheetName.trim()) {
      onConfirm(selectedSheets, mergedSheetName.trim());
    }
  }, [selectedSheets, mergedSheetName, onConfirm]);

  // 关闭对话框时重置状态
  const handleClose = useCallback(() => {
    setSelectedSheets([]);
    setMergedSheetName('合并表格');
    setMergeAnalysis(null);
    onClose();
  }, [onClose]);

  // 当对话框打开时重置状态
  useEffect(() => {
    if (open) {
      setSelectedSheets([]);
      setMergedSheetName('合并表格');
      setMergeAnalysis(null);
    }
  }, [open]);

  const canMerge = selectedSheets.length >= 2 && mergedSheetName.trim();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>合并工作表</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          选择要合并的工作表（至少选择2个）
        </Alert>

        {/* 工作表选择 */}
        <Typography variant="h6" sx={{ mb: 1 }}>
          选择工作表：
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1, 
          mb: 3,
          maxHeight: 200,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1
        }}>
          {sheets.map((sheet, index) => (
            <FormControlLabel
              key={index}
              control={
                <Checkbox
                  checked={selectedSheets.some(s => s.name === sheet.name)}
                  onChange={() => handleSheetToggle(sheet)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {sheet.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sheet.totalRows}行 × {sheet.totalCols}列
                  </Typography>
                </Box>
              }
            />
          ))}
        </Box>

        {/* 合并后的工作表名称 */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>合并后的工作表名称</InputLabel>
          <OutlinedInput
            value={mergedSheetName}
            onChange={(e) => setMergedSheetName(e.target.value)}
            label="合并后的工作表名称"
          />
        </FormControl>

        {/* 合并分析结果 */}
        {mergeAnalysis && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>
              合并预览：
            </Typography>
            
            <Alert severity="success" sx={{ mb: 2 }}>
              将合并 {selectedSheets.length} 个工作表，共 {mergeAnalysis.allColumns.length} 列
            </Alert>

            {mergeAnalysis.newColumns.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  新增列（{mergeAnalysis.newColumns.length}个）：
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {mergeAnalysis.newColumns.map((column, index) => (
                    <Chip
                      key={index}
                      label={column}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                现有列（{mergeAnalysis.existingColumns.length}个）：
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {mergeAnalysis.existingColumns.map((column, index) => (
                  <Chip
                    key={index}
                    label={column}
                    size="small"
                    color="default"
                  />
                ))}
              </Box>
            </Box>

            {/* 每个sheet的列信息 */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                各工作表列信息：
              </Typography>
              {selectedSheets.map((sheet, index) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={500}>
                    {sheet.name}: {mergeAnalysis.sheetColumnMapping[sheet.name]?.join(', ')}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          合并规则：相同列名的数据会合并在一起，不同列名会作为新列添加。
          合并后原工作表仍会保留。
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
          disabled={!canMerge}
        >
          确认合并
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MergeSheetsDialog;
