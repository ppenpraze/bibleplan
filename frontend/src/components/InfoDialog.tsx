import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Divider,
  Box,
  Chip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";

interface InfoDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function InfoDialog({ open, onClose }: InfoDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h5" fontWeight={700}>
          About Daily Bible Reading
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} py={1}>
          {/* How It Works */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              How It Works
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              This app creates a dynamic reading plan to help you read through the entire Bible (1,189
              chapters) in one year.
            </Typography>
            <Stack spacing={1}>
              <Box display="flex" gap={1} alignItems="flex-start">
                <CalendarTodayIcon fontSize="small" color="primary" sx={{ mt: 0.5 }} />
                <Typography variant="body2">
                  <strong>3 chapters on weekdays</strong>, 4 on weekends
                </Typography>
              </Box>
              <Box display="flex" gap={1} alignItems="flex-start">
                <CheckCircleIcon fontSize="small" color="success" sx={{ mt: 0.5 }} />
                <Typography variant="body2">
                  Plan automatically adjusts later in the year to finish exactly on Dec 31
                </Typography>
              </Box>
              <Box display="flex" gap={1} alignItems="flex-start">
                <LocalFireDepartmentIcon fontSize="small" color="warning" sx={{ mt: 0.5 }} />
                <Typography variant="body2">
                  Track your progress and build reading streaks
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Divider />

          {/* Features */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Features
            </Typography>
            <Stack spacing={1}>
              <Chip label="✓ Individual chapter tracking" variant="outlined" size="small" />
              <Chip label="✓ Year-round calendar view" variant="outlined" size="small" />
              <Chip label="✓ Reading streak counter" variant="outlined" size="small" />
              <Chip label="✓ Progress statistics" variant="outlined" size="small" />
              <Chip label="✓ Persistent data storage" variant="outlined" size="small" />
            </Stack>
          </Box>

          <Divider />

          {/* Tips */}
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Reading Tips
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                • Set a consistent daily reading time
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Check off chapters as you complete them
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Use the calendar to catch up on missed days
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • Build your streak for extra motivation!
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Version Info */}
          <Box>
            <Typography variant="caption" color="text.secondary">
              Bible Version: New International Version (NIV)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Protestant Canon: 66 books, 1,189 chapters
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" fullWidth>
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
}
