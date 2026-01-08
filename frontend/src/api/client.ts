import type { ApiResponse, ProgressResponse, CurrentStatsResponse, Chapter } from "../types";

const API_BASE = "/api";

export async function getReading(dateStr: string): Promise<ApiResponse> {
  const res = await fetch(`${API_BASE}/reading?date_str=${encodeURIComponent(dateStr)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch reading: ${res.statusText}`);
  }
  return res.json();
}

export async function getTodayReading(): Promise<ApiResponse> {
  const res = await fetch(`${API_BASE}/today`);
  if (!res.ok) {
    throw new Error(`Failed to fetch today's reading: ${res.statusText}`);
  }
  return res.json();
}

export async function markDayComplete(date: string): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/progress/mark-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    throw new Error(`Failed to mark complete: ${res.statusText}`);
  }
  return res.json();
}

export async function markChaptersComplete(
  date: string,
  chapters: Chapter[]
): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/progress/mark-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, chapters }),
  });
  if (!res.ok) {
    throw new Error(`Failed to mark chapters complete: ${res.statusText}`);
  }
  return res.json();
}

export async function undoChapter(
  date: string,
  book: string,
  chapter: number
): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/progress/undo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, book, chapter }),
  });
  if (!res.ok) {
    throw new Error(`Failed to undo chapter: ${res.statusText}`);
  }
  return res.json();
}

export async function getCurrentStats(): Promise<CurrentStatsResponse> {
  const res = await fetch(`${API_BASE}/stats/current`);
  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.statusText}`);
  }
  return res.json();
}
