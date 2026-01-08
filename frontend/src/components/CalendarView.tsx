import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Paper,
  CircularProgress,
  Tooltip,
  Chip,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import PanoramaFishEyeIcon from "@mui/icons-material/PanoramaFishEye";

interface DayProgress {
  date: string;
  is_complete: boolean;
  completion_percentage: number;
  chapters_assigned_count: number;
  chapters_completed_count: number;
}

interface CalendarViewProps {
  onDateSelect?: (date: string) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({ onDateSelect }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [progressData, setProgressData] = useState<Map<string, DayProgress>>(new Map());
  const [loading, setLoading] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  useEffect(() => {
    fetchMonthProgress();
  }, [currentMonth, currentYear]);

  const fetchMonthProgress = async () => {
    setLoading(true);
    try {
      // Get first and last day of month
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);

      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);

      const res = await fetch(`/api/progress/range?start=${startStr}&end=${endStr}`);
      if (!res.ok) throw new Error("Failed to fetch progress");

      const data = await res.json();
      const progressMap = new Map<string, DayProgress>();
      data.days.forEach((day: DayProgress) => {
        progressMap.set(day.date, day);
      });

      setProgressData(progressMap);
    } catch (error) {
      console.error("Failed to fetch month progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getDaysInMonth = () => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    return new Date(currentYear, currentMonth, 1).getDay();
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(new Date(currentYear, currentMonth, day));
    onDateSelect?.(dateStr);
  };

  const getDayStatus = (day: number) => {
    const dateStr = formatDate(new Date(currentYear, currentMonth, day));
    const today = formatDate(new Date());
    const isToday = dateStr === today;
    const isFuture = dateStr > today;
    const progress = progressData.get(dateStr);

    return { isToday, isFuture, progress };
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<Box key={`empty-${i}`} />);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const { isToday, isFuture, progress } = getDayStatus(day);

      let bgColor = "background.paper";
      let icon = <RadioButtonUncheckedIcon fontSize="small" color="disabled" />;
      let tooltipText = "No progress yet";

      if (progress) {
        if (progress.is_complete) {
          bgColor = "success.light";
          icon = <CheckCircleIcon fontSize="small" color="success" />;
          tooltipText = `Complete! ${progress.chapters_completed_count} chapters`;
        } else if (progress.completion_percentage > 0) {
          bgColor = "warning.light";
          icon = <PanoramaFishEyeIcon fontSize="small" color="warning" />;
          tooltipText = `${progress.chapters_completed_count}/${progress.chapters_assigned_count} chapters`;
        }
      } else if (isFuture) {
        bgColor = "action.hover";
        tooltipText = "Future date";
      }

      days.push(
        <Tooltip key={day} title={tooltipText} arrow>
          <Paper
            elevation={isToday ? 4 : 1}
            onClick={() => !isFuture && handleDayClick(day)}
            sx={{
              aspectRatio: "1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              bgcolor: bgColor,
              cursor: isFuture ? "not-allowed" : "pointer",
              border: isToday ? 2 : 0,
              borderColor: "primary.main",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                transform: isFuture ? "none" : "scale(1.05)",
                boxShadow: isFuture ? 1 : 3,
              },
              opacity: isFuture ? 0.5 : 1,
            }}
          >
            <Typography variant="body2" fontWeight={isToday ? 700 : 400}>
              {day}
            </Typography>
            {icon}
          </Paper>
        </Tooltip>
      );
    }

    return days;
  };

  const getMonthStats = () => {
    let completed = 0;
    let partial = 0;
    let total = 0;

    progressData.forEach((progress) => {
      total++;
      if (progress.is_complete) {
        completed++;
      } else if (progress.completion_percentage > 0) {
        partial++;
      }
    });

    return { completed, partial, total };
  };

  const stats = getMonthStats();

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <IconButton onClick={handlePreviousMonth}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={600}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Typography>
        <IconButton onClick={handleNextMonth}>
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      {stats.total > 0 && (
        <Stack direction="row" spacing={2} mb={2} justifyContent="center">
          <Chip
            icon={<CheckCircleIcon />}
            label={`${stats.completed} complete`}
            size="small"
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<PanoramaFishEyeIcon />}
            label={`${stats.partial} partial`}
            size="small"
            color="warning"
            variant="outlined"
          />
        </Stack>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {/* Day names header */}
          <Box
            display="grid"
            gridTemplateColumns="repeat(7, 1fr)"
            gap={1}
            mb={1}
          >
            {DAY_NAMES.map((day) => (
              <Typography
                key={day}
                variant="caption"
                fontWeight={600}
                textAlign="center"
                color="text.secondary"
              >
                {day}
              </Typography>
            ))}
          </Box>

          {/* Calendar grid */}
          <Box
            display="grid"
            gridTemplateColumns="repeat(7, 1fr)"
            gap={1}
          >
            {renderCalendarDays()}
          </Box>
        </Box>
      )}
    </Box>
  );
}
