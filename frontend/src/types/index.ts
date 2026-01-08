export interface Chapter {
  book: string;
  chapter: number;
}

export interface CompletedChapter extends Chapter {
  completed_at: string;
}

export interface Progress {
  completed_chapters: CompletedChapter[];
  is_complete: boolean;
  completion_percentage: number;
}

export interface Stats {
  current_streak: number;
}

export interface ApiResponse {
  date: string;
  year: number;
  version: "NIV";
  chapters_count: number;
  chapters: Chapter[];
  label: string;
  meta: {
    total_chapters: number;
    chapter_index_start: number;
    chapter_index_end: number;
    remaining_chapters_after_today: number;
    days_left_after_today: number;
  };
  progress?: Progress;
  stats?: Stats;
  error?: string;
}

export interface ProgressData {
  date: string;
  year: number;
  chapters_assigned: Chapter[];
  completed_chapters: CompletedChapter[];
  is_fully_complete: boolean;
  completion_percentage: number;
  completed_at?: string;
}

export interface ProgressResponse {
  success: boolean;
  progress: ProgressData;
  current_streak: number;
  message?: string;
}

export interface CurrentStatsResponse {
  current_streak: number;
  longest_streak: number;
  total_days_read: number;
  total_chapters_read: number;
  year_progress_percentage: number;
}
