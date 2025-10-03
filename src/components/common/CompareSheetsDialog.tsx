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
  Typography,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { SheetData, compareSheets, ComparisonResult, formatCellValue, ComparisonMergeSheetOptions, getHeaderRow } from '../../utils/excelUtils';

export interface CreateMergedSheetPayload {
  firstSheetIndex: number;
  secondSheetIndex: number;
  comparisonResult: ComparisonResult;
  options: ComparisonMergeSheetOptions;
}

interface CompareSheetsDialogProps {
  open: boolean;
  onClose: () => void;
  sheets: SheetData[];
  editedRows: { [key: string]: { [key: string]: any } };
  onCreateMergedSheet?: (payload: CreateMergedSheetPayload) => void;
}

const CompareSheetsDialog: React.FC<CompareSheetsDialogProps> = ({
  open,
  onClose,
  sheets,
  editedRows,
  onCreateMergedSheet
}) => {
  const [firstSheetIndex, setFirstSheetIndex] = useState<number>(0);
  const [secondSheetIndex, setSecondSheetIndex] = useState<number>(1);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [mergeSheetName, setMergeSheetName] = useState<string>('差异合并结果');
  const [mergeSheetNameError, setMergeSheetNameError] = useState<string>('');
  const [mergeOptionsError, setMergeOptionsError] = useState<string>('');
  const [includeUniqueFromFirst, setIncludeUniqueFromFirst] = useState<boolean>(true);
  const [includeUniqueFromSecond, setIncludeUniqueFromSecond] = useState<boolean>(true);
  const [includeModifiedRows, setIncludeModifiedRows] = useState<boolean>(true);
  const [highlightChanges, setHighlightChanges] = useState<boolean>(true);

  // 执行对比
  const performComparison = useCallback(() => {
    if (firstSheetIndex === secondSheetIndex) {
      setComparisonResult(null);
      return;
    }

    const firstSheet = sheets[firstSheetIndex];
    const secondSheet = sheets[secondSheetIndex];

    if (!firstSheet || !secondSheet) {
      setComparisonResult(null);
      return;
    }

    const result = compareSheets(firstSheet, secondSheet, firstSheetIndex, secondSheetIndex, editedRows);
    setComparisonResult(result);
  }, [firstSheetIndex, secondSheetIndex, sheets, editedRows]);

  // 当选择改变时重新对比
  useEffect(() => {
    if (open && sheets.length >= 2) {
      performComparison();
    }
  }, [firstSheetIndex, secondSheetIndex, open, performComparison]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const firstName = sheets[firstSheetIndex]?.name || 'Sheet1';
    const secondName = sheets[secondSheetIndex]?.name || 'Sheet2';
    setMergeSheetName(`${firstName}_${secondName}_差异合并`);
    setMergeSheetNameError('');
    setMergeOptionsError('');
    setIncludeUniqueFromFirst(true);
    setIncludeUniqueFromSecond(true);
    setIncludeModifiedRows(true);
    setHighlightChanges(true);
  }, [open, sheets, firstSheetIndex, secondSheetIndex]);

  // 关闭对话框时重置状态
  const handleClose = useCallback(() => {
    setFirstSheetIndex(0);
    setSecondSheetIndex(1);
    setComparisonResult(null);
    setMergeSheetName('差异合并结果');
    setMergeSheetNameError('');
    setMergeOptionsError('');
    setIncludeUniqueFromFirst(true);
    setIncludeUniqueFromSecond(true);
    setIncludeModifiedRows(true);
    setHighlightChanges(true);
    onClose();
  }, [onClose]);

  const mergeOptionsSelected = includeUniqueFromFirst || includeUniqueFromSecond || includeModifiedRows;

  const handleMergeSheetNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setMergeSheetName(value);
    if (mergeSheetNameError && value.trim()) {
      setMergeSheetNameError('');
    } else if (!value.trim()) {
      setMergeSheetNameError('名称不能为空');
    }
  }, [mergeSheetNameError]);

  const handleToggleIncludeUniqueFromFirst = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIncludeUniqueFromFirst(checked);
    const nextSelected = checked || includeUniqueFromSecond || includeModifiedRows;
    setMergeOptionsError(nextSelected ? '' : '请至少选择一种差异数据参与合并');
  }, [includeUniqueFromSecond, includeModifiedRows]);

  const handleToggleIncludeUniqueFromSecond = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIncludeUniqueFromSecond(checked);
    const nextSelected = includeUniqueFromFirst || checked || includeModifiedRows;
    setMergeOptionsError(nextSelected ? '' : '请至少选择一种差异数据参与合并');
  }, [includeUniqueFromFirst, includeModifiedRows]);

  const handleToggleIncludeModifiedRows = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setIncludeModifiedRows(checked);
    const nextSelected = includeUniqueFromFirst || includeUniqueFromSecond || checked;
    setMergeOptionsError(nextSelected ? '' : '请至少选择一种差异数据参与合并');
  }, [includeUniqueFromFirst, includeUniqueFromSecond]);

  const handleToggleHighlightChanges = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setHighlightChanges(event.target.checked);
  }, []);

  const handleCreateMergedSheet = useCallback(() => {
    if (!comparisonResult || !onCreateMergedSheet) {
      return;
    }
    const trimmedName = mergeSheetName.trim();
    if (!trimmedName) {
      setMergeSheetNameError('名称不能为空');
      return;
    }
    if (!mergeOptionsSelected) {
      setMergeOptionsError('请至少选择一种差异数据参与合并');
      return;
    }

    onCreateMergedSheet({
      firstSheetIndex,
      secondSheetIndex,
      comparisonResult,
      options: {
        sheetName: trimmedName,
        includeUniqueFromFirst,
        includeUniqueFromSecond,
        includeModifiedRows,
        highlightChanges
      }
    });
  }, [comparisonResult, onCreateMergedSheet, mergeSheetName, mergeOptionsSelected, firstSheetIndex, secondSheetIndex, includeUniqueFromFirst, includeUniqueFromSecond, includeModifiedRows, highlightChanges]);

  const canCompare = sheets.length >= 2 && firstSheetIndex !== secondSheetIndex;
  const firstHeaderSheet = sheets[firstSheetIndex];
  const secondHeaderSheet = sheets[secondSheetIndex];
  const firstHeaders = firstHeaderSheet ? getHeaderRow(firstHeaderSheet) : [];
  const secondHeaders = secondHeaderSheet ? getHeaderRow(secondHeaderSheet) : [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>工作表差异对比</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          选择两个工作表进行差异对比
        </Alert>

        {/* 工作表选择 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>第一个工作表</InputLabel>
            <Select
              value={firstSheetIndex}
              onChange={(e) => setFirstSheetIndex(Number(e.target.value))}
              label="第一个工作表"
            >
              {sheets.map((sheet, index) => (
                <MenuItem key={index} value={index}>
                  {sheet.name} ({sheet.totalRows}行)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ flex: 1 }}>
            <InputLabel>第二个工作表</InputLabel>
            <Select
              value={secondSheetIndex}
              onChange={(e) => setSecondSheetIndex(Number(e.target.value))}
              label="第二个工作表"
            >
              {sheets.map((sheet, index) => (
                <MenuItem key={index} value={index}>
                  {sheet.name} ({sheet.totalRows}行)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* 对比结果 */}
        {comparisonResult && (
          <Box>
            <Divider sx={{ my: 2 }} />
            
            {/* 概览信息 */}
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                对比概览
              </Typography>
              <Typography variant="body2">
                {sheets[firstSheetIndex]?.name}: {comparisonResult.summary.firstSheetRows}行 | 
                {sheets[secondSheetIndex]?.name}: {comparisonResult.summary.secondSheetRows}行
              </Typography>
              <Typography variant="body2">
                相同行: {comparisonResult.summary.commonRowsCount} | 
                第一个独有: {comparisonResult.summary.uniqueToFirstCount} | 
                第二个独有: {comparisonResult.summary.uniqueToSecondCount} | 
                修改行: {comparisonResult.summary.modifiedRowsCount}
              </Typography>
            </Alert>

            {/* 表头差异 */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">表头差异</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    公共列 ({comparisonResult.headerDifferences.commonColumns.length}个):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {comparisonResult.headerDifferences.commonColumns.map((column, index) => (
                      <Chip key={index} label={column} size="small" color="default" />
                    ))}
                  </Box>
                </Box>

                {comparisonResult.headerDifferences.uniqueToFirst.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {sheets[firstSheetIndex]?.name} 独有列 ({comparisonResult.headerDifferences.uniqueToFirst.length}个):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {comparisonResult.headerDifferences.uniqueToFirst.map((column, index) => (
                        <Chip key={index} label={column} size="small" color="primary" />
                      ))}
                    </Box>
                  </Box>
                )}

                {comparisonResult.headerDifferences.uniqueToSecond.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {sheets[secondSheetIndex]?.name} 独有列 ({comparisonResult.headerDifferences.uniqueToSecond.length}个):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {comparisonResult.headerDifferences.uniqueToSecond.map((column, index) => (
                        <Chip key={index} label={column} size="small" color="secondary" />
                      ))}
                    </Box>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* 数据差异 - 第一个表独有的行 */}
            {comparisonResult.dataDifferences.uniqueToFirst.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    {sheets[firstSheetIndex]?.name} 独有的行 ({comparisonResult.dataDifferences.uniqueToFirst.length}行)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {firstHeaders.map((header, index) => (
                            <TableCell
                              key={index}
                              sx={{
                                minWidth: 140,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                fontWeight: 600
                              }}
                            >
                              {header || `列${index + 1}`}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparisonResult.dataDifferences.uniqueToFirst.slice(0, 10).map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <TableCell
                                key={cellIndex}
                                sx={{ minWidth: 140, whiteSpace: 'normal', wordBreak: 'break-word' }}
                              >
                                {formatCellValue(cell)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {comparisonResult.dataDifferences.uniqueToFirst.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      仅显示前10行，共{comparisonResult.dataDifferences.uniqueToFirst.length}行
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* 数据差异 - 第二个表独有的行 */}
            {comparisonResult.dataDifferences.uniqueToSecond.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    {sheets[secondSheetIndex]?.name} 独有的行 ({comparisonResult.dataDifferences.uniqueToSecond.length}行)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {secondHeaders.map((header, index) => (
                            <TableCell
                              key={index}
                              sx={{
                                minWidth: 140,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                fontWeight: 600
                              }}
                            >
                              {header || `列${index + 1}`}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparisonResult.dataDifferences.uniqueToSecond.slice(0, 10).map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <TableCell
                                key={cellIndex}
                                sx={{ minWidth: 140, whiteSpace: 'normal', wordBreak: 'break-word' }}
                              >
                                {formatCellValue(cell)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {comparisonResult.dataDifferences.uniqueToSecond.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      仅显示前10行，共{comparisonResult.dataDifferences.uniqueToSecond.length}行
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {/* 修改过的行 */}
            {comparisonResult.dataDifferences.modifiedRows.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    修改过的行 ({comparisonResult.dataDifferences.modifiedRows.length}行)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {comparisonResult.dataDifferences.modifiedRows.slice(0, 5).map((modifiedRow, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        主键: {String(modifiedRow.firstRow[0])}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {modifiedRow.differences.map((diff, diffIndex) => (
                          <Chip
                            key={diffIndex}
                            label={`${diff.column}: "${formatCellValue(diff.firstValue)}" → "${formatCellValue(diff.secondValue)}"`}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                  {comparisonResult.dataDifferences.modifiedRows.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      仅显示前5行，共{comparisonResult.dataDifferences.modifiedRows.length}行
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            )}

            {onCreateMergedSheet && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="h6">
                    高级合并
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    选择要合并的差异数据并生成新的对比结果工作表，可在导出前继续编辑。
                  </Typography>
                  <TextField
                    label="新工作表名称"
                    value={mergeSheetName}
                    onChange={handleMergeSheetNameChange}
                    fullWidth
                    error={Boolean(mergeSheetNameError)}
                    helperText={mergeSheetNameError || ' '}
                  />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeUniqueFromFirst}
                          onChange={handleToggleIncludeUniqueFromFirst}
                        />
                      }
                      label={`${sheets[firstSheetIndex]?.name || '工作表1'} 独有的行`}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeUniqueFromSecond}
                          onChange={handleToggleIncludeUniqueFromSecond}
                        />
                      }
                      label={`${sheets[secondSheetIndex]?.name || '工作表2'} 独有的行`}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={includeModifiedRows}
                          onChange={handleToggleIncludeModifiedRows}
                        />
                      }
                      label="包含修改过的行"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={highlightChanges}
                          onChange={handleToggleHighlightChanges}
                        />
                      }
                      label="高亮差异单元格"
                    />
                  </Box>
                  {mergeOptionsError && (
                    <Typography variant="body2" color="error">
                      {mergeOptionsError}
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}

        {!canCompare && sheets.length >= 2 && (
          <Alert severity="warning">
            请选择两个不同的工作表进行对比
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {onCreateMergedSheet && comparisonResult && (
          <Button
            variant="contained"
            onClick={handleCreateMergedSheet}
            disabled={!canCompare || !mergeSheetName.trim() || !mergeOptionsSelected}
          >
            生成差异合并工作表
          </Button>
        )}
        <Button onClick={handleClose}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CompareSheetsDialog;
