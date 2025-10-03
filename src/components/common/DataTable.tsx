import React, { useCallback, useEffect, useState } from 'react';
import { 
  Box, 
  IconButton, 
  Tooltip,
  Toolbar as MuiToolbar,
  Typography,
  TextField,
  Button
} from '@mui/material';
import { 
  DataGrid, 
  GridColDef,
  GridRowSelectionModel,
  GridRowModel,
  GridPagination,
  gridPageCountSelector,
  gridPageSelector,
  GridCellParams,
  useGridApiContext,
  useGridSelector
} from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import SplitIcon from '@mui/icons-material/AccountTree';
import MergeIcon from '@mui/icons-material/CallMerge';
import CompareIcon from '@mui/icons-material/Compare';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

interface DataTableProps {
  rows: any[];
  columns: GridColDef[];
  loading?: boolean;
  height?: string | number;
  enableSelection?: boolean;
  enableAdd?: boolean;
  enableDelete?: boolean;
  enableExport?: boolean;
  enableSplit?: boolean;
  enableMerge?: boolean;
  enableCompare?: boolean;
  enableExportExcel?: boolean;
  onAdd?: () => void;
  onDelete?: (selectedRows: number[]) => void;
  onSplit?: () => void;
  onMerge?: () => void;
  onCompare?: () => void;
  onExportExcel?: () => void;
  onRowUpdate?: (updatedRow: GridRowModel, originalRow: GridRowModel) => GridRowModel;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  getCellClassName?: (params: GridCellParams) => string;
  isCellEditable?: (params: GridCellParams) => boolean;
}

const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
  height: '100%',
  width: '100%',
  '& .MuiDataGrid-root': {
    border: 'none',
    backgroundColor: theme.palette.background.paper,
    '& .MuiDataGrid-cell': {
      borderColor: theme.palette.divider,
      padding: '8px 16px',
      fontSize: '0.875rem',
      '&:focus': { outline: 'none' },
      '&:focus-within': { outline: 'none' }
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      fontWeight: 600,
      fontSize: '0.875rem',
      padding: '12px 16px',
      '&:focus': { outline: 'none' },
      '&:focus-within': { outline: 'none' },
      '& .MuiDataGrid-columnSeparator': {
        color: theme.palette.primary.light
      },
      '& .MuiDataGrid-menuIcon': {
        color: theme.palette.primary.contrastText
      },
      '& .MuiDataGrid-sortIcon': {
        color: theme.palette.primary.contrastText
      }
    },
    '& .MuiDataGrid-row': {
      '&:nth-of-type(even)': {
        backgroundColor: theme.palette.action.hover
      },
      '&:hover': {
        backgroundColor: theme.palette.action.selected
      }
    },
    '& .excel-merged-cell': {
      backgroundColor: theme.palette.action.hover
    },
    '& .excel-merged-covered': {
      color: 'transparent',
      pointerEvents: 'none',
      '&:hover': {
        color: 'transparent'
      }
    },
    '& .excel-merged-no-top': {
      borderTopColor: 'transparent'
    },
    '& .excel-merged-no-left': {
      borderLeftColor: 'transparent'
    },
    '& .MuiDataGrid-footerContainer': {
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.default
    }
  }
}));

const PaginationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1, 2),
  width: '100%',
}));

const PaginationControls = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  flexWrap: 'wrap'
}));

const CustomPagination = (props: any) => {
  const apiRef = useGridApiContext();
  const page = useGridSelector(apiRef, gridPageSelector);
  const pageCount = useGridSelector(apiRef, gridPageCountSelector);
  const [inputValue, setInputValue] = useState('1');

  useEffect(() => {
    setInputValue((page + 1).toString());
  }, [page]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value.replace(/[^0-9]/g, ''));
  }, []);

  const handleJump = useCallback(() => {
    if (!pageCount || pageCount < 1) {
      return;
    }
    const parsed = Number(inputValue);
    if (Number.isNaN(parsed)) {
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), pageCount);
    apiRef.current.setPage(clamped - 1);
  }, [apiRef, inputValue, pageCount]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleJump();
    }
  }, [handleJump]);

  return (
    <PaginationContainer>
      <GridPagination
        {...props}
        showFirstButton
        showLastButton
        labelRowsPerPage="每页行数"
      />
      <PaginationControls>
        <Typography variant="body2" color="text.secondary">
          跳转至
        </Typography>
        <TextField
          size="small"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          sx={{ width: 80 }}
          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          / 共 {Math.max(pageCount, 1)} 页
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={handleJump}
          disabled={!pageCount || pageCount < 1}
        >
          跳转
        </Button>
      </PaginationControls>
    </PaginationContainer>
  );
};

const DataTable: React.FC<DataTableProps> = ({
  rows,
  columns,
  loading = false,
  height = '70vh',
  enableSelection = true,
  enableAdd = false,
  enableDelete = false,
  enableExport = false,
  enableSplit = false,
  enableMerge = false,
  enableCompare = false,
  enableExportExcel = false,
  onAdd,
  onDelete,
  onSplit,
  onMerge,
  onCompare,
  onExportExcel,
  onRowUpdate,
  pageSizeOptions = [10, 25, 50, 100],
  initialPageSize = 10,
  getCellClassName,
  isCellEditable
}) => {
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: initialPageSize });

  useEffect(() => {
    setPaginationModel(prev => ({ ...prev, pageSize: initialPageSize, page: 0 }));
  }, [initialPageSize]);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(rows.length / paginationModel.pageSize));
    if (paginationModel.page > pageCount - 1) {
      setPaginationModel(prev => ({ ...prev, page: Math.max(pageCount - 1, 0) }));
    }
  }, [rows.length, paginationModel.page, paginationModel.pageSize]);

  const handleSelectionChange = useCallback((newSelection: GridRowSelectionModel) => {
    if (newSelection.type === 'include') {
      const selectedIds = Array.from(newSelection.ids || []);
      setSelectedRows(selectedIds);
    } else if (newSelection.type === 'exclude') {
      const allRowIds = rows.map(row => row.id);
      const excludeIds = new Set(newSelection.ids || []);
      const selectedIds = allRowIds.filter(id => !excludeIds.has(id));
      setSelectedRows(selectedIds);
    } else {
      setSelectedRows([]);
    }
  }, [rows]);

  const handleDeleteRows = useCallback(() => {
    const selectedIds = Array.isArray(selectedRows) ? selectedRows : [];
    if (selectedIds.length === 0 || !onDelete) return;
    onDelete(selectedIds);
    setSelectedRows([]);
  }, [selectedRows, onDelete]);



  return (
    <Box
      sx={{
        height,
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}
    >
      {(enableAdd || enableDelete || enableExport || enableSplit || enableMerge || enableCompare || enableExportExcel) && (
        <MuiToolbar 
          sx={[
            {
              pl: { sm: 2 },
              pr: { xs: 1, sm: 1 },
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              minHeight: '48px',
              backgroundColor: 'background.default',
              borderBottom: 1,
              borderColor: 'divider'
            },
            (Array.isArray(selectedRows) && selectedRows.length > 0) && {
              bgcolor: (theme) => theme.palette.action.selected,
            },
          ]}
        >
          {(Array.isArray(selectedRows) && selectedRows.length > 0) ? (
            <>
              <Typography
                sx={{ flex: '1 1 100%' }}
                color="inherit"
                variant="subtitle1"
                component="div"
              >
                {selectedRows.length} 行已选中
              </Typography>
              
              {enableDelete && onDelete && (
                <Tooltip title="删除选中行" arrow>
                  <IconButton
                    onClick={handleDeleteRows}
                    sx={{
                      color: 'error.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              <Typography
                sx={{ flex: '1 1 100%' }}
                variant="h6"
                component="div"
              >
                数据表格
              </Typography>
              
              {enableAdd && onAdd && (
                <Tooltip title="添加行" arrow>
                  <IconButton
                    onClick={onAdd}
                    sx={{
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableSplit && onSplit && (
                <Tooltip title="拆分表格" arrow>
                  <IconButton
                    onClick={onSplit}
                    sx={{
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <SplitIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableMerge && onMerge && (
                <Tooltip title="合并表格" arrow>
                  <IconButton
                    onClick={onMerge}
                    sx={{
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <MergeIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableCompare && onCompare && (
                <Tooltip title="差异对比" arrow>
                  <IconButton
                    onClick={onCompare}
                    sx={{
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <CompareIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableExportExcel && onExportExcel && (
                <Tooltip title="导出Excel" arrow>
                  <IconButton
                    onClick={onExportExcel}
                    sx={{
                      color: 'success.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <FileDownloadIcon />
                  </IconButton>
                </Tooltip>
              )}
              
            </>
          )}
        </MuiToolbar>
      )}
      
      <StyledDataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        pagination
        pageSizeOptions={pageSizeOptions}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        slots={{ pagination: CustomPagination }}
        checkboxSelection={enableSelection}
        disableRowSelectionOnClick={enableSelection}
        rowSelectionModel={{ type: 'include', ids: new Set(selectedRows) }}
        onRowSelectionModelChange={handleSelectionChange}
        autoHeight={false}
        density="compact"
        rowHeight={52}
        columnHeaderHeight={160}
        showCellVerticalBorder
        showColumnVerticalBorder
        disableColumnFilter={false}
        disableColumnSelector={false}
        disableDensitySelector={false}
        disableColumnMenu={false}
        editMode="cell"
        processRowUpdate={onRowUpdate}
        getCellClassName={getCellClassName}
        isCellEditable={isCellEditable}
        sx={{
          '& .MuiDataGrid-toolbarContainer': {
            padding: 2,
            gap: 2,
            backgroundColor: theme => theme.palette.background.default,
            borderBottom: theme => `1px solid ${theme.palette.divider}`,
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: theme => `1px solid ${theme.palette.divider}`,
            backgroundColor: theme => theme.palette.background.default,
          },
          '& .MuiDataGrid-toolbarContainer .MuiButton-root': {
            color: 'primary.main',
            fontSize: '0.875rem',
            fontWeight: 500,
          },
          '& .MuiDataGrid-toolbarContainer .MuiInputBase-root': {
            borderRadius: 1,
            backgroundColor: 'background.paper',
          },
          '& .MuiDataGrid-cell': {
            whiteSpace: 'normal',
            lineHeight: 'normal',
            py: 1,
            display: 'flex',
            alignItems: 'center',
          },
        }}
      />
    </Box>
  );
};

export default DataTable;
