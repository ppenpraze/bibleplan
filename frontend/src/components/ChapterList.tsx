import React from "react";
import {
  Stack,
  Typography,
  Checkbox,
  FormControlLabel,
  IconButton,
  Box,
  Collapse,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import type { Chapter, CompletedChapter } from "../types";

interface ChapterListProps {
  chapters: Chapter[];
  completedChapters: CompletedChapter[];
  onToggleChapter: (chapter: Chapter, isCompleted: boolean) => void;
  disabled?: boolean;
}

export default function ChapterList({
  chapters,
  completedChapters,
  onToggleChapter,
  disabled = false,
}: ChapterListProps) {
  const isChapterCompleted = (chapter: Chapter): boolean => {
    return completedChapters.some(
      (c) => c.book === chapter.book && c.chapter === chapter.chapter
    );
  };

  const handleToggle = (chapter: Chapter) => {
    const isCompleted = isChapterCompleted(chapter);
    onToggleChapter(chapter, isCompleted);
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" color="text.secondary">
        Chapters
      </Typography>
      <Stack spacing={0.5}>
        {chapters.map((chapter, idx) => {
          const completed = isChapterCompleted(chapter);
          return (
            <Box
              key={`${chapter.book}-${chapter.chapter}-${idx}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderRadius: 1,
                },
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={completed}
                    onChange={() => handleToggle(chapter)}
                    disabled={disabled}
                    icon={<RadioButtonUncheckedIcon />}
                    checkedIcon={<CheckCircleIcon />}
                    sx={{
                      transition: "transform 0.2s ease-in-out",
                      "&.Mui-checked": {
                        transform: "scale(1.1)",
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    variant="body1"
                    sx={{
                      textDecoration: completed ? "line-through" : "none",
                      color: completed ? "text.secondary" : "text.primary",
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    {chapter.book} {chapter.chapter}
                  </Typography>
                }
                sx={{ flexGrow: 1, m: 0, py: 0.5, px: 1 }}
              />
              <Collapse in={completed} orientation="horizontal">
                <IconButton
                  size="small"
                  onClick={() => handleToggle(chapter)}
                  disabled={disabled}
                  aria-label="undo"
                  sx={{ mr: 1 }}
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
