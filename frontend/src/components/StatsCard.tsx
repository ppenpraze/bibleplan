import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  CircularProgress,
  Divider,
  Chip,
} from "@mui/material";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import type { CurrentStatsResponse } from "../types";
import { getCurrentStats } from "../api/client";

export default function StatsCard() {
  const [stats, setStats] = useState<CurrentStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getCurrentStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography color="error">Failed to load statistics</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Current Streak - Highlight */}
      <Card
        elevation={3}
        sx={{
          borderRadius: 3,
          background: "linear-gradient(135deg, #ff9800 0%, #ff5722 100%)",
          color: "white",
        }}
      >
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <LocalFireDepartmentIcon sx={{ fontSize: 48 }} />
            <Box>
              <Typography variant="h3" fontWeight={700}>
                {stats.current_streak}
              </Typography>
              <Typography variant="body1">
                Day{stats.current_streak !== 1 ? "s" : ""} Streak
              </Typography>
            </Box>
          </Stack>
          {stats.longest_streak > stats.current_streak && (
            <Typography variant="caption" sx={{ mt: 1, display: "block", opacity: 0.9 }}>
              Best: {stats.longest_streak} days
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(2, 1fr)"
        gap={2}
      >
        {/* Total Days Read */}
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1} alignItems="center">
              <CalendarTodayIcon color="primary" sx={{ fontSize: 36 }} />
              <Typography variant="h4" fontWeight={600}>
                {stats.total_days_read}
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Days Read
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Total Chapters */}
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1} alignItems="center">
              <AutoStoriesIcon color="secondary" sx={{ fontSize: 36 }} />
              <Typography variant="h4" fontWeight={600}>
                {stats.total_chapters_read}
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Chapters Read
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Year Progress */}
      <Card elevation={2} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TrendingUpIcon color="success" />
              <Typography variant="h6" fontWeight={600}>
                Year Progress
              </Typography>
            </Stack>
            <Divider />
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  {new Date().getFullYear()} Complete
                </Typography>
                <Chip
                  label={`${Math.round(stats.year_progress_percentage)}%`}
                  size="small"
                  color="success"
                  variant="filled"
                />
              </Stack>
              <Box
                sx={{
                  width: "100%",
                  height: 12,
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: `${stats.year_progress_percentage}%`,
                    height: "100%",
                    bgcolor: "success.main",
                    transition: "width 0.5s ease-in-out",
                  }}
                />
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Longest Streak Card */}
      {stats.longest_streak > 0 && (
        <Card elevation={2} sx={{ borderRadius: 3, bgcolor: "primary.light" }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Longest Streak
                </Typography>
                <Typography variant="h5" fontWeight={700}>
                  {stats.longest_streak} days
                </Typography>
              </Box>
              {stats.longest_streak === stats.current_streak && (
                <Chip label="Active!" color="success" size="small" />
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
