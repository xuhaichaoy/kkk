import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

interface TodoWeeklyReportDialogProps {
  open: boolean;
  report: string;
  onClose: () => void;
}

const copyToClipboard = async (text: string) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const selected = selection?.rangeCount ? selection.getRangeAt(0) : null;
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (selected) {
    selection?.removeAllRanges();
    selection?.addRange(selected);
  }
  return success;
};

const TodoWeeklyReportDialog = ({ open, report, onClose }: TodoWeeklyReportDialogProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      const success = await copyToClipboard(report);
      setCopied(success);
      if (success) {
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy weekly report:', error);
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>周报工作汇总</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            以下内容根据最近任务动态自动生成，可直接复制到工作周报中。
          </Typography>
          <TextField
            multiline
            fullWidth
            minRows={14}
            value={report}
            InputProps={{ readOnly: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
        <Button variant="contained" onClick={handleCopy} disabled={!report.trim()}>
          {copied ? '已复制' : '复制到剪贴板'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TodoWeeklyReportDialog;
