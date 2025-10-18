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
  title?: string;
  description?: string;
  editable?: boolean;
  copyButtonLabel?: string;
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

const TodoWeeklyReportDialog = ({
  open,
  report,
  onClose,
  title = '周报工作汇总',
  description = '以下内容根据最近任务动态自动生成，可直接复制到工作周报中。',
  editable = true,
  copyButtonLabel = '复制到剪贴板',
}: TodoWeeklyReportDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState(report);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setContent(report);
    }
  }, [open, report]);

  const handleCopy = async () => {
    try {
      const success = await copyToClipboard(content);
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
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          <TextField
            multiline
            fullWidth
            minRows={14}
            value={content}
            onChange={(event) => {
              if (!editable) return;
              setContent(event.target.value);
            }}
            InputProps={{ readOnly: !editable }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
        <Button variant="contained" onClick={handleCopy} disabled={!content.trim()}>
          {copied ? '已复制' : copyButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TodoWeeklyReportDialog;
