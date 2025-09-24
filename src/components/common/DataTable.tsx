import React, { useCallback, useState } from 'react';
import { 
  Box, 
  IconButton, 
  Tooltip,
  Toolbar as MuiToolbar,
  Typography
} from '@mui/material';
import { 
  DataGrid, 
  GridColDef,
  GridRowSelectionModel,
  GridRowModel
} from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';

interface DataTableProps {
  rows: any[];
  columns: GridColDef[];
  loading?: boolean;
  height?: string | number;
  enableSelection?: boolean;
  enableAdd?: boolean;
  enableDelete?: boolean;
  enableExport?: boolean;
  onAdd?: () => void;
  onDelete?: (selectedRows: number[]) => void;
  onExport?: () => void;
  onRowUpdate?: (updatedRow: GridRowModel, originalRow: GridRowModel) => GridRowModel;
  pageSizeOptions?: number[];
  initialPageSize?: number;
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
      '&:focus': {
        outline: 'none',
      },
      '&:focus-within': {
        outline: 'none',
      },
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      fontWeight: 600,
      fontSize: '0.875rem',
      padding: '12px 16px',
      '&:focus': {
        outline: 'none',
      },
      '&:focus-within': {
        outline: 'none',
      },
      '& .MuiDataGrid-columnSeparator': {
        color: theme.palette.primary.light,
      },
      '& .MuiDataGrid-menuIcon': {
        color: theme.palette.primary.contrastText,
      },
      '& .MuiDataGrid-sortIcon': {
        color: theme.palette.primary.contrastText,
      },
    },
    '& .MuiDataGrid-row': {
      '&:nth-of-type(even)': {
        backgroundColor: theme.palette.action.hover,
      },
      '&:hover': {
        backgroundColor: theme.palette.action.selected,
      },
    },
    '& .MuiDataGrid-footerContainer': {
      borderTop: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.default,
    },
  },
}));

const DataTable: React.FC<DataTableProps> = ({
  rows,
  columns,
  loading = false,
  height = '70vh',
  enableSelection = true,
  enableAdd = false,
  enableDelete = false,
  enableExport = false,
  onAdd,
  onDelete,
  onExport,
  onRowUpdate,
  pageSizeOptions = [10, 25, 50, 100],
  initialPageSize = 10
}) => {
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

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
    <Box sx={{ height, width: '100%', position: 'relative' }}>
      {(enableAdd || enableDelete || enableExport) && (
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
              
              {enableExport && onExport && (
                <Tooltip title="导出" arrow>
                  <IconButton
                    onClick={onExport}
                    sx={{
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                  >
                    <DownloadIcon />
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
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: initialPageSize,
            },
          },
        }}
        checkboxSelection={enableSelection}
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
        sx={{
          '& .MuiDataGrid-toolbarContainer': {
            padding: 2,
            gap: 2,
            backgroundColor: theme => theme.palette.background.default,
            borderBottom: theme => `1px solid ${theme.palette.divider}`,
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
