import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Checkbox,
  FormHelperText,
  ListItemText,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  FormGroup
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  SheetData,
  compareSheets,
  ComparisonResult,
  formatCellValue,
  ComparisonMergeSheetOptions,
  getHeaderRow,
  ComparisonOptions,
  ColumnMapping,
  ResolvedColumnMapping,
  createComparisonMergeSheet,
  exportToExcel,
  exportToCSV,
  ExportOptions
} from '../../utils/excelUtils';

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
  const [alignmentMode, setAlignmentMode] = useState<'auto' | 'manual'>('auto');
  const [manualMappings, setManualMappings] = useState<ColumnMapping[]>([]);
  const [selectedKeyColumns, setSelectedKeyColumns] = useState<string[]>([]);
  const [visibleDiffTypes, setVisibleDiffTypes] = useState({
    uniqueToFirst: true,
    uniqueToSecond: true,
    modified: true
  });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const currentFirstSheet = sheets[firstSheetIndex] ?? null;
  const currentSecondSheet = sheets[secondSheetIndex] ?? null;

  const originalFirstHeaders = useMemo(
    () => (currentFirstSheet ? getHeaderRow(currentFirstSheet) : []),
    [currentFirstSheet]
  );
  const originalSecondHeaders = useMemo(
    () => (currentSecondSheet ? getHeaderRow(currentSecondSheet) : []),
    [currentSecondSheet]
  );
  const firstHeadersLength = originalFirstHeaders.length;
  const secondHeadersLength = originalSecondHeaders.length;

  const resolvedMappings: ResolvedColumnMapping[] = useMemo(
    () => comparisonResult?.metadata.manualColumnMappings ?? [],
    [comparisonResult]
  );

  const displayFirstHeaders = useMemo(() => {
    if (!resolvedMappings.length) {
      return originalFirstHeaders.map((header, index) => header ?? `列${index + 1}`);
    }
    const lookup = new Map<number, string>();
    resolvedMappings.forEach(mapping => {
      lookup.set(mapping.firstColumnIndex, mapping.label);
    });
    return originalFirstHeaders.map((header, index) => lookup.get(index) ?? (header ?? `列${index + 1}`));
  }, [originalFirstHeaders, resolvedMappings]);

  const displaySecondHeaders = useMemo(() => {
    if (!resolvedMappings.length) {
      return originalSecondHeaders.map((header, index) => header ?? `列${index + 1}`);
    }
    const lookup = new Map<number, string>();
    resolvedMappings.forEach(mapping => {
      lookup.set(mapping.secondColumnIndex, mapping.label);
    });
    return originalSecondHeaders.map((header, index) => lookup.get(index) ?? (header ?? `列${index + 1}`));
  }, [originalSecondHeaders, resolvedMappings]);

  const availableKeyColumns = useMemo(
    () => comparisonResult?.headerDifferences.commonColumns ?? [],
    [comparisonResult]
  );

  const mergeOptionsSelected = includeUniqueFromFirst || includeUniqueFromSecond || includeModifiedRows;
  const canCompare = sheets.length >= 2 && firstSheetIndex !== secondSheetIndex;

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

    const sanitizedMappings: ColumnMapping[] = manualMappings
      .filter(mapping =>
        typeof mapping.firstColumnIndex === 'number' &&
        typeof mapping.secondColumnIndex === 'number' &&
        Number.isFinite(mapping.firstColumnIndex) &&
        Number.isFinite(mapping.secondColumnIndex)
      )
      .map(mapping => ({
        firstColumnIndex: Math.max(0, Math.trunc(mapping.firstColumnIndex)),
        secondColumnIndex: Math.max(0, Math.trunc(mapping.secondColumnIndex)),
        label: mapping.label
      }));

    const uniqueKeyColumns = Array.from(new Set(selectedKeyColumns.filter(Boolean)));

    const comparisonOptions: ComparisonOptions = {
      alignmentMode,
      manualColumnMappings: alignmentMode === 'manual' ? sanitizedMappings : [],
      keyColumns: uniqueKeyColumns
    };

    const result = compareSheets(
      firstSheet,
      secondSheet,
      firstSheetIndex,
      secondSheetIndex,
      editedRows,
      comparisonOptions
    );
    setComparisonResult(result);
    setExportError('');
  }, [
    firstSheetIndex,
    secondSheetIndex,
    sheets,
    editedRows,
    manualMappings,
    alignmentMode,
    selectedKeyColumns
  ]);

  // 当选择改变时重新对比
  useEffect(() => {
    if (open && sheets.length >= 2) {
      performComparison();
    }
  }, [firstSheetIndex, secondSheetIndex, open, performComparison]);

  useEffect(() => {
    setManualMappings([]);
  }, [firstSheetIndex, secondSheetIndex]);

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
    setAlignmentMode('auto');
    setManualMappings([]);
    setSelectedKeyColumns([]);
    setVisibleDiffTypes({
      uniqueToFirst: true,
      uniqueToSecond: true,
      modified: true
    });
    setExportError('');
    setExporting(false);
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
    setAlignmentMode('auto');
    setManualMappings([]);
    setSelectedKeyColumns([]);
    setVisibleDiffTypes({
      uniqueToFirst: true,
      uniqueToSecond: true,
      modified: true
    });
    setExportError('');
    setExporting(false);
    onClose();
  }, [onClose]);


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

  const handleAlignmentModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, value: 'auto' | 'manual' | null) => {
      if (!value) {
        return;
      }
      setAlignmentMode(value);
      if (value === 'auto') {
        setManualMappings([]);
      }
    },
    []
  );

  const handleAddManualMapping = useCallback(() => {
    if (firstHeadersLength === 0 || secondHeadersLength === 0) {
      return;
    }
    setManualMappings(prev => {
      const nextFirstRaw = Math.min(prev.length, firstHeadersLength - 1);
      const nextSecondRaw = Math.min(prev.length, secondHeadersLength - 1);
      const nextFirst = Number.isFinite(nextFirstRaw) && nextFirstRaw >= 0 ? nextFirstRaw : 0;
      const nextSecond = Number.isFinite(nextSecondRaw) && nextSecondRaw >= 0 ? nextSecondRaw : 0;
      return [
        ...prev,
        {
          firstColumnIndex: nextFirst,
          secondColumnIndex: nextSecond,
          label: ''
        }
      ];
    });
  }, [firstHeadersLength, secondHeadersLength]);

  const handleManualMappingIndexChange = useCallback(
    (mappingIndex: number, field: 'firstColumnIndex' | 'secondColumnIndex', value: string | number) => {
      const parsed = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const maxIndex = field === 'firstColumnIndex' ? firstHeadersLength - 1 : secondHeadersLength - 1;
      const clamped = Math.min(Math.max(parsed, 0), Math.max(maxIndex, 0));
      setManualMappings(prev =>
        prev.map((mapping, index) =>
          index === mappingIndex ? { ...mapping, [field]: clamped } : mapping
        )
      );
    },
    [firstHeadersLength, secondHeadersLength]
  );

  const handleManualMappingLabelChange = useCallback((mappingIndex: number, value: string) => {
    setManualMappings(prev =>
      prev.map((mapping, index) =>
        index === mappingIndex ? { ...mapping, label: value } : mapping
      )
    );
  }, []);

  const handleRemoveManualMapping = useCallback((mappingIndex: number) => {
    setManualMappings(prev => prev.filter((_, index) => index !== mappingIndex));
  }, []);

  const handleKeyColumnsChange = useCallback(
    (event: SelectChangeEvent<typeof selectedKeyColumns>) => {
      const value = event.target.value;
      setSelectedKeyColumns(typeof value === 'string' ? value.split(',').filter(Boolean) : value);
    },
    []
  );

  const handleToggleDiffVisibility = useCallback((field: 'uniqueToFirst' | 'uniqueToSecond' | 'modified') => {
    setVisibleDiffTypes(prev => {
      const next = { ...prev, [field]: !prev[field] };
      if (!next.uniqueToFirst && !next.uniqueToSecond && !next.modified) {
        return prev;
      }
      return next;
    });
  }, []);

  const handleShowOnlyModified = useCallback(() => {
    setVisibleDiffTypes({
      uniqueToFirst: false,
      uniqueToSecond: false,
      modified: true
    });
  }, []);

  const handleShowAllDiffs = useCallback(() => {
    setVisibleDiffTypes({
      uniqueToFirst: true,
      uniqueToSecond: true,
      modified: true
    });
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

  const handleExportComparisonExcel = useCallback(async () => {
    if (!comparisonResult || !currentFirstSheet || !currentSecondSheet || !mergeOptionsSelected) {
      return;
    }
    const trimmedName = mergeSheetName.trim();
    const sheetName = trimmedName || `${currentFirstSheet.name}_${currentSecondSheet.name}_差异报告`;

    try {
      setExporting(true);
      const sheetData = createComparisonMergeSheet(currentFirstSheet, currentSecondSheet, comparisonResult, {
        sheetName,
        includeUniqueFromFirst,
        includeUniqueFromSecond,
        includeModifiedRows,
        highlightChanges,
        firstSourceLabel: currentFirstSheet.name,
        secondSourceLabel: currentSecondSheet.name
      });
      const exportOptions: ExportOptions = {
        fileName: sheetName,
        separateFiles: false,
        preserveFormulas: false
      };
      await exportToExcel([sheetData], exportOptions);
      setExportError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请重试';
      setExportError(message);
    } finally {
      setExporting(false);
    }
  }, [
    comparisonResult,
    currentFirstSheet,
    currentSecondSheet,
    includeUniqueFromFirst,
    includeUniqueFromSecond,
    includeModifiedRows,
    highlightChanges,
    mergeSheetName,
    mergeOptionsSelected
  ]);

  const handleExportComparisonCSV = useCallback(() => {
    if (!comparisonResult || !currentFirstSheet || !currentSecondSheet || !mergeOptionsSelected) {
      return;
    }
    try {
      const trimmedName = mergeSheetName.trim();
      const sheetName = trimmedName || `${currentFirstSheet.name}_${currentSecondSheet.name}_差异报告`;
      const sheetData = createComparisonMergeSheet(currentFirstSheet, currentSecondSheet, comparisonResult, {
        sheetName,
        includeUniqueFromFirst,
        includeUniqueFromSecond,
        includeModifiedRows,
        highlightChanges,
        firstSourceLabel: currentFirstSheet.name,
        secondSourceLabel: currentSecondSheet.name
      });
      exportToCSV(sheetData);
      setExportError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请重试';
      setExportError(message);
    }
  }, [
    comparisonResult,
    currentFirstSheet,
    currentSecondSheet,
    includeUniqueFromFirst,
    includeUniqueFromSecond,
    includeModifiedRows,
    highlightChanges,
    mergeSheetName,
    mergeOptionsSelected
  ]);

  useEffect(() => {
    if (!comparisonResult) {
      return;
    }
    const available = comparisonResult.headerDifferences.commonColumns;
    const availableSet = new Set(available);
    const filtered = selectedKeyColumns.filter(column => availableSet.has(column));
    if (filtered.length !== selectedKeyColumns.length) {
      setSelectedKeyColumns(filtered);
      return;
    }
    if (filtered.length === 0 && comparisonResult.metadata.keyColumns.length > 0) {
      setSelectedKeyColumns(comparisonResult.metadata.keyColumns);
    }
  }, [comparisonResult, selectedKeyColumns]);

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

        {canCompare && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <Typography variant="h6">对齐与主键设置</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={alignmentMode}
              onChange={handleAlignmentModeChange}
            >
              <ToggleButton value="auto">按列名匹配</ToggleButton>
              <ToggleButton value="manual">手动映射</ToggleButton>
            </ToggleButtonGroup>

            {alignmentMode === 'manual' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    映射不同名称但含义相同的列
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddManualMapping}
                    disabled={firstHeadersLength === 0 || secondHeadersLength === 0}
                  >
                    添加映射
                  </Button>
                </Box>
                {manualMappings.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    暂无手动映射，将继续按表头名称自动匹配。
                  </Typography>
                ) : (
                  manualMappings.map((mapping, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        alignItems: 'center'
                      }}
                    >
                      <FormControl sx={{ flex: 1, minWidth: 200 }} size="small">
                        <InputLabel>第一个工作表列</InputLabel>
                        <Select
                          value={mapping.firstColumnIndex}
                          label="第一个工作表列"
                          onChange={(event) =>
                            handleManualMappingIndexChange(index, 'firstColumnIndex', event.target.value)
                          }
                        >
                          {originalFirstHeaders.map((header, headerIndex) => (
                            <MenuItem key={headerIndex} value={headerIndex}>
                              {`${header ?? `列${headerIndex + 1}`} (索引${headerIndex + 1})`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl sx={{ flex: 1, minWidth: 200 }} size="small">
                        <InputLabel>第二个工作表列</InputLabel>
                        <Select
                          value={mapping.secondColumnIndex}
                          label="第二个工作表列"
                          onChange={(event) =>
                            handleManualMappingIndexChange(index, 'secondColumnIndex', event.target.value)
                          }
                        >
                          {originalSecondHeaders.map((header, headerIndex) => (
                            <MenuItem key={headerIndex} value={headerIndex}>
                              {`${header ?? `列${headerIndex + 1}`} (索引${headerIndex + 1})`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        label="统一列名"
                        value={mapping.label ?? ''}
                        onChange={(event) => handleManualMappingLabelChange(index, event.target.value)}
                        sx={{ minWidth: 200, flex: 1 }}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveManualMapping(index)}
                        aria-label="删除映射"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))
                )}
              </Box>
            )}

            <FormControl
              size="small"
              sx={{ maxWidth: 360 }}
              disabled={availableKeyColumns.length === 0}
            >
              <InputLabel>对比主键列</InputLabel>
              <Select
                multiple
                value={selectedKeyColumns}
                onChange={handleKeyColumnsChange}
                label="对比主键列"
                renderValue={(selected) =>
                  selected.length > 0 ? selected.join('，') : '自动使用首个公共列'
                }
              >
                {availableKeyColumns.map(column => (
                  <MenuItem key={column} value={column}>
                    <Checkbox checked={selectedKeyColumns.indexOf(column) > -1} />
                    <ListItemText primary={column} />
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {availableKeyColumns.length === 0
                  ? '没有公共列，将按行对比。'
                  : '支持选择多个列作为组合主键。'}
              </FormHelperText>
            </FormControl>
          </Box>
        )}

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

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Typography variant="subtitle2">差异筛选</Typography>
              <FormGroup row sx={{ alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={visibleDiffTypes.uniqueToFirst}
                      onChange={() => handleToggleDiffVisibility('uniqueToFirst')}
                    />
                  }
                  label={`${sheets[firstSheetIndex]?.name || '工作表1'} 独有`}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={visibleDiffTypes.uniqueToSecond}
                      onChange={() => handleToggleDiffVisibility('uniqueToSecond')}
                    />
                  }
                  label={`${sheets[secondSheetIndex]?.name || '工作表2'} 独有`}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={visibleDiffTypes.modified}
                      onChange={() => handleToggleDiffVisibility('modified')}
                    />
                  }
                  label="修改行"
                />
              </FormGroup>
              <Button size="small" variant="text" onClick={handleShowOnlyModified}>
                仅显示修改
              </Button>
              <Button size="small" variant="text" onClick={handleShowAllDiffs}>
                显示全部
              </Button>
            </Box>

            {/* 数据差异 - 第一个表独有的行 */}
            {visibleDiffTypes.uniqueToFirst && comparisonResult.dataDifferences.uniqueToFirst.length > 0 && (
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
                          {displayFirstHeaders.map((header, index) => (
                            <TableCell
                              key={index}
                              sx={{
                                minWidth: 140,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                fontWeight: 600
                              }}
                            >
                              {header}
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
            {visibleDiffTypes.uniqueToSecond && comparisonResult.dataDifferences.uniqueToSecond.length > 0 && (
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
                          {displaySecondHeaders.map((header, index) => (
                            <TableCell
                              key={index}
                              sx={{
                                minWidth: 140,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                fontWeight: 600
                              }}
                            >
                              {header}
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
            {visibleDiffTypes.modified && comparisonResult.dataDifferences.modifiedRows.length > 0 && (
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
                        主键:{' '}
                        {comparisonResult.metadata.keyColumns.length > 0
                          ? comparisonResult.metadata.keyColumns
                              .map(column => `${column}=${modifiedRow.keyValues?.[column] ?? '-'}`)
                              .join('，')
                          : formatCellValue(modifiedRow.firstRow[0])}
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

            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">差异报告导出</Typography>
              <Typography variant="body2" color="text.secondary">
                导出当前筛选与合并配置对应的差异清单，便于离线查看或分享。
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleExportComparisonExcel}
                  disabled={!mergeOptionsSelected || exporting}
                >
                  导出Excel报告
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleExportComparisonCSV}
                  disabled={!mergeOptionsSelected || exporting}
                >
                  导出CSV报告
                </Button>
              </Box>
              {exportError && (
                <Alert severity="error" onClose={() => setExportError('')}>
                  {exportError}
                </Alert>
              )}
            </Box>

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
