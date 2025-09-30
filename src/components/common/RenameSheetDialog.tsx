import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography
} from '@mui/material';

interface RenameSheetDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => void;
  currentName: string;
  existingNames: string[];
}

const RenameSheetDialog: React.FC<RenameSheetDialogProps> = ({
  open,
  onClose,
  onConfirm,
  currentName,
  existingNames
}) => {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  const normalizedExistingNames = useMemo(() => {
    return new Set(existingNames.map(name => name.trim().toLowerCase()));
  }, [existingNames]);

  const validate = useCallback((name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) {
      return '工作表名称不能为空';
    }
    if (trimmed.length > 50) {
      return '工作表名称长度不能超过50个字符';
    }
    const normalized = trimmed.toLowerCase();
    const currentNormalized = currentName.trim().toLowerCase();
    if (normalizedExistingNames.has(normalized) && normalized !== currentNormalized) {
      return '已存在同名工作表，请选择其他名称';
    }
    return '';
  }, [currentName, normalizedExistingNames]);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError('');
    }
  }, [open, currentName]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (error) {
      setError(validate(nextValue));
    }
  }, [error, validate]);

  const handleConfirm = useCallback(() => {
    const validationError = validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm(value.trim());
  }, [validate, value, onConfirm]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>重命名工作表</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          输入新的工作表名称，名称需保持唯一。
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="工作表名称"
          value={value}
          onChange={handleChange}
          error={Boolean(error)}
          helperText={error || ' '}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleConfirm();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={Boolean(validate(value))}
        >
          确认
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RenameSheetDialog;
