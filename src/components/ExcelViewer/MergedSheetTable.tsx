import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography
} from '@mui/material';
import {
  type SheetData,
  type EditedRowData,
  formatCellValue,
  getHeaderRowIndex,
  normalizeMergeRange
} from '../../utils/excelUtils';

interface MergeMeta {
  rowSpan: number;
  colSpan: number;
  isTopLeft: boolean;
}

interface MergedSheetTableProps {
  sheet: SheetData;
  sheetIndex: number;
  editedRows: EditedRowData;
  height?: string | number;
}

const buildMergeMap = (
  sheet: SheetData,
  rowCount: number,
  columnCount: number
): Map<string, MergeMeta> => {
  const map = new Map<string, MergeMeta>();
  const merges = sheet.properties?.merges;

  if (!Array.isArray(merges) || merges.length === 0) {
    return map;
  }

  merges.forEach(merge => {
    const normalized = normalizeMergeRange(merge);
    if (!normalized) {
      return;
    }

    const top = Math.max(1, Math.min(normalized.top, rowCount));
    const bottom = Math.max(1, Math.min(normalized.bottom, rowCount));
    const left = Math.max(1, Math.min(normalized.left, columnCount));
    const right = Math.max(1, Math.min(normalized.right, columnCount));

    if (top > bottom || left > right) {
      return;
    }

    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const key = `${row}_${col}`;
        map.set(key, {
          rowSpan: bottom - top + 1,
          colSpan: right - left + 1,
          isTopLeft: row === top && col === left
        });
      }
    }
  });

  return map;
};

const DATA_CHUNK_SIZE = 200;

const MergedSheetTable: React.FC<MergedSheetTableProps> = ({
  sheet,
  sheetIndex,
  editedRows,
  height = '70vh'
}) => {
  const rows = Array.isArray(sheet.data) ? sheet.data : [];
  const rowCount = rows.length;

  const columnCount = useMemo(() => {
    const fromData = rows.reduce((max, row) => {
      if (Array.isArray(row)) {
        return Math.max(max, row.length);
      }
      return max;
    }, 0);

    const fromSheet = sheet.totalCols || 0;

    const fromColumns = Array.isArray(sheet.properties?.columns)
      ? sheet.properties!.columns.length
      : 0;

    const fromMerges = Array.isArray(sheet.properties?.merges)
      ? sheet.properties!.merges.reduce((max, merge) => {
          const normalized = normalizeMergeRange(merge);
          if (!normalized) {
            return max;
          }
          return Math.max(max, normalized.right);
        }, 0)
      : 0;

    return Math.max(fromData, fromSheet, fromColumns, fromMerges);
  }, [rows, sheet.totalCols, sheet.properties]);

  const mergeMap = useMemo(
    () => buildMergeMap(sheet, rowCount, columnCount || 0),
    [sheet, rowCount, columnCount]
  );

  const headerRowIndex = getHeaderRowIndex(sheet);
  const baseHeaderCount = Math.min(headerRowIndex + 1, rows.length);

  const headerRowCount = useMemo(() => {
    if (!Array.isArray(sheet.properties?.merges)) {
      return baseHeaderCount;
    }

    const headerRowNumber = headerRowIndex + 1; // 1-based
    let maxRequired = baseHeaderCount;

    sheet.properties!.merges.forEach(merge => {
      const normalized = normalizeMergeRange(merge);
      if (!normalized) {
        return;
      }

      if (normalized.top <= headerRowNumber && normalized.bottom >= headerRowNumber) {
        const candidate = Math.min(rows.length, normalized.bottom);
        if (candidate > maxRequired) {
          maxRequired = candidate;
        }
      }
    });

    return maxRequired;
  }, [sheet.properties?.merges, baseHeaderCount, headerRowIndex, rows.length]);

  const headerRows = rows.slice(0, headerRowCount);
  const dataRows = rows.slice(headerRowCount);

  const [visibleDataRowsCount, setVisibleDataRowsCount] = useState(() => Math.min(DATA_CHUNK_SIZE, dataRows.length));

  useEffect(() => {
    setVisibleDataRowsCount(Math.min(DATA_CHUNK_SIZE, dataRows.length));
  }, [dataRows.length, sheet, sheetIndex]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 120) {
      setVisibleDataRowsCount(prev => {
        if (prev >= dataRows.length) {
          return prev;
        }
        return Math.min(dataRows.length, prev + DATA_CHUNK_SIZE);
      });
    }
  }, [dataRows.length]);

  const dataRowsToRender = useMemo(
    () => dataRows.slice(0, visibleDataRowsCount),
    [dataRows, visibleDataRowsCount]
  );

  const totalRenderedRows = headerRowCount + dataRowsToRender.length;
  const hasMoreRows = visibleDataRowsCount < dataRows.length;

  const resolveCellValue = (rowIndex: number, colIndex: number): any => {
    const row = rows[rowIndex];
    const rawValue = Array.isArray(row) ? row[colIndex] : undefined;

    if (rowIndex >= headerRowCount) {
      const dataRowIndex = rowIndex - headerRowCount;
      if (dataRowIndex >= 0) {
        const sheetId = `${sheetIndex}_${dataRowIndex}`;
        const edits = editedRows[sheetId];
        if (edits && Object.prototype.hasOwnProperty.call(edits, String(colIndex))) {
          return edits[String(colIndex)];
        }
      }
    }

    return rawValue;
  };

  const renderRowCells = (
    rowIndex: number,
    isHeader: boolean
  ): React.ReactNode[] => {
    const cells: React.ReactNode[] = [];
    const rowNumber = rowIndex + 1; // 1-based to match merge map keys
    const totalColumns = columnCount || 0;

    for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
      const columnNumber = colIndex + 1;
      const key = `${rowNumber}_${columnNumber}`;
      const mergeInfo = mergeMap.get(key);

      if (mergeInfo && !mergeInfo.isTopLeft) {
        continue;
      }

      const value = resolveCellValue(rowIndex, colIndex);
      const display = formatCellValue(value);

      let effectiveRowSpan: number | undefined;
      if (mergeInfo) {
        const remainingRows = Math.max(1, totalRenderedRows - rowIndex);
        effectiveRowSpan = Math.min(mergeInfo.rowSpan, remainingRows);
      }

      cells.push(
        <TableCell
          key={`cell-${rowNumber}-${columnNumber}`}
          align={isHeader ? 'center' : 'left'}
          rowSpan={effectiveRowSpan && effectiveRowSpan > 1 ? effectiveRowSpan : undefined}
          colSpan={mergeInfo && mergeInfo.colSpan > 1 ? mergeInfo.colSpan : undefined}
          sx={{
            minWidth: 120,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            fontWeight: isHeader ? 600 : 400,
            border: '1px solid',
            borderColor: 'divider',
            px: 1.5,
            py: 1,
            backgroundColor: isHeader ? 'background.default' : 'inherit'
          }}
        >
          {display}
        </TableCell>
      );
    }

    return cells;
  };

  if (!rowCount || !columnCount) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">暂无数据</Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer component={Paper} sx={{ maxHeight: height }} onScroll={handleScroll}>
        <Table stickyHeader size="small">
        {headerRows.length > 0 && (
          <TableHead>
            {headerRows.map((_, headerIndex) => (
              <TableRow key={`header-${headerIndex}`}>
                {renderRowCells(headerIndex, true)}
              </TableRow>
            ))}
          </TableHead>
        )}
        <TableBody>
          {dataRowsToRender.map((_, dataIndex) => {
            const absoluteRowIndex = headerRowCount + dataIndex;
            return (
              <TableRow key={`data-${dataIndex}`}>
                {renderRowCells(absoluteRowIndex, false)}
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          已显示 {headerRowCount + dataRowsToRender.length} / {rows.length} 行
          {hasMoreRows ? '，继续向下滚动以加载更多' : ''}
        </Typography>
      </Box>
    </>
  );
};

export default MergedSheetTable;
