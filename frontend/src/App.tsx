import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Box,
  IconButton,
  Divider,
  Snackbar,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TodayIcon from "@mui/icons-material/Today";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import BarChartIcon from "@mui/icons-material/BarChart";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";

import type { ApiResponse, Chapter } from "./types";
import { getTodayReading, markDayComplete, markChaptersComplete, undoChapter, getReading } from "./api/client";
import ProgressBar from "./components/ProgressBar";
import ChapterList from "./components/ChapterList";
import CalendarView from "./components/CalendarView";
import StatsCard from "./components/StatsCard";
import InfoDialog from "./components/InfoDialog";

function formatHumanDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const todayIso = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayIso);

  const fetchData = async (dateStr: string) => {
    setLoading(true);
    try {
      const json = await getReading(dateStr);
      setData(json);
    } catch (error) {
      console.error("Failed to fetch reading:", error);
      setSnackbar({
        open: true,
        message: "Failed to load reading data",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  const handleMarkComplete = async () => {
    if (!data || marking) return;

    setMarking(true);
    try {
      const response = await markDayComplete(selectedDate);

      // Update local data optimistically
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: {
            completed_chapters: response.progress.completed_chapters,
            is_complete: response.progress.is_fully_complete,
            completion_percentage: response.progress.completion_percentage,
          },
          stats: {
            current_streak: response.current_streak,
          },
        };
      });

      // Show success message with celebration
      const streakMessage =
        response.current_streak > 1 ? ` 🔥 ${response.current_streak}-day streak!` : "";
      setSnackbar({
        open: true,
        message: `🎉 ${response.message}${streakMessage}`,
        severity: "success",
      });
    } catch (error) {
      console.error("Failed to mark complete:", error);
      setSnackbar({
        open: true,
        message: "Failed to mark as complete. Please try again.",
        severity: "error",
      });
    } finally {
      setMarking(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleToggleChapter = async (chapter: Chapter, isCurrentlyCompleted: boolean) => {
    if (!data || marking) return;

    setMarking(true);
    try {
      let response;
      if (isCurrentlyCompleted) {
        // Undo the chapter
        response = await undoChapter(selectedDate, chapter.book, chapter.chapter);
      } else {
        // Mark chapter as complete
        response = await markChaptersComplete(selectedDate, [chapter]);
      }

      // Update local data
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: {
            completed_chapters: response.progress.completed_chapters,
            is_complete: response.progress.is_fully_complete,
            completion_percentage: response.progress.completion_percentage,
          },
          stats: {
            current_streak: response.current_streak,
          },
        };
      });

      // Show success message for full completion
      if (response.progress.is_fully_complete && !isCurrentlyCompleted) {
        const streakMessage =
          response.current_streak > 1 ? ` 🔥 ${response.current_streak}-day streak!` : "";
        setSnackbar({
          open: true,
          message: `🎉 All chapters complete!${streakMessage}`,
          severity: "success",
        });
      }
    } catch (error) {
      console.error("Failed to toggle chapter:", error);
      setSnackbar({
        open: true,
        message: "Failed to update chapter. Please try again.",
        severity: "error",
      });
    } finally {
      setMarking(false);
    }
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentTab(0); // Switch to Today tab
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    // When clicking Today tab, reset to today's date
    if (newValue === 0) {
      setSelectedDate(todayIso);
    }
  };

  const isToday = selectedDate === todayIso;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <TodayIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Daily Bible Reading
          </Typography>
          <IconButton color="inherit" aria-label="info" onClick={() => setInfoDialogOpen(true)}>
            <InfoOutlinedIcon />
          </IconButton>
        </Toolbar>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="inherit"
          indicatorColor="secondary"
        >
          <Tab icon={<TodayIcon />} label="Today" />
          <Tab icon={<CalendarMonthIcon />} label="Calendar" />
          <Tab icon={<BarChartIcon />} label="Stats" />
        </Tabs>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        {/* Today Tab */}
        {currentTab === 0 && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                {isToday ? "Today's Reading" : "Reading for"}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {formatHumanDate(selectedDate)}
              </Typography>
              {!isToday && (
                <Button size="small" onClick={() => setSelectedDate(todayIso)} sx={{ mt: 1 }}>
                  Back to Today
                </Button>
              )}
            </Box>

            <Card elevation={2} sx={{ borderRadius: 3 }}>
              <CardContent>
                {loading ? (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CircularProgress size={22} />
                    <Typography color="text.secondary">Loading…</Typography>
                  </Stack>
                ) : data?.error ? (
                  <Typography color="error">{data.error}</Typography>
                ) : data ? (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip label={`NIV`} variant="outlined" />
                      <Chip
                        label={`${data.chapters_count} chapter${data.chapters_count === 1 ? "" : "s"}`}
                        color="primary"
                        variant="filled"
                      />
                      {data.stats && data.stats.current_streak > 0 && (
                        <Chip
                          icon={<LocalFireDepartmentIcon />}
                          label={`${data.stats.current_streak} day${data.stats.current_streak === 1 ? "" : "s"}`}
                          color="warning"
                          variant="filled"
                        />
                      )}
                    </Stack>

                    {data.progress && (
                      <ProgressBar
                        value={data.progress.completion_percentage}
                        label="Progress"
                      />
                    )}

                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                      {data.label}
                    </Typography>

                    <Divider />

                    <ChapterList
                      chapters={data.chapters}
                      completedChapters={data.progress?.completed_chapters || []}
                      onToggleChapter={handleToggleChapter}
                      disabled={marking}
                    />

                    <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                      <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        onClick={handleMarkComplete}
                        disabled={marking || data.progress?.is_complete}
                      >
                        {marking
                          ? "Marking..."
                          : data.progress?.is_complete
                          ? "Completed ✓"
                          : "Mark all as read"}
                      </Button>
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      Progress: chapters {data.meta.chapter_index_start}–{data.meta.chapter_index_end} of{" "}
                      {data.meta.total_chapters}. Remaining: {data.meta.remaining_chapters_after_today} chapters,
                      {` `}
                      {data.meta.days_left_after_today} days left in {data.year}.
                    </Typography>
                  </Stack>
                ) : null}
              </CardContent>
            </Card>

            <Typography variant="body2" color="text.secondary">
              This plan automatically adjusts throughout the year to help you finish on Dec 31 while reading
              every day (minimum 1 chapter/day).
            </Typography>
          </Stack>
        )}

        {/* Calendar Tab */}
        {currentTab === 1 && (
          <CalendarView onDateSelect={handleDateSelect} />
        )}

        {/* Stats Tab */}
        {currentTab === 2 && (
          <StatsCard />
        )}
      </Container>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Info Dialog */}
      <InfoDialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} />
    </Box>
  );
}
