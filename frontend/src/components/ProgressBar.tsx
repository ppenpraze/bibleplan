import React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({
  value,
  label,
  showPercentage = true,
}: ProgressBarProps) {
  return (
    <Box sx={{ width: "100%" }}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LinearProgress
          variant="determinate"
          value={value}
          sx={{
            flexGrow: 1,
            height: 8,
            borderRadius: 1,
            bgcolor: "action.hover",
            "& .MuiLinearProgress-bar": {
              borderRadius: 1,
              transition: "transform 0.4s ease-in-out",
            },
          }}
        />
        {showPercentage && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40, textAlign: "right" }}>
            {Math.round(value)}%
          </Typography>
        )}
      </Box>
    </Box>
  );
}
