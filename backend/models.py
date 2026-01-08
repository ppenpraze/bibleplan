from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ===== Shared Models =====

class Chapter(BaseModel):
    """Represents a Bible chapter."""
    book: str
    chapter: int


class CompletedChapter(BaseModel):
    """Represents a completed chapter with timestamp."""
    book: str
    chapter: int
    completed_at: datetime = Field(default_factory=datetime.utcnow)


# ===== Database Models =====

class UserSettings(BaseModel):
    """User preferences and settings."""
    bible_version: str = "NIV"
    notifications_enabled: bool = False
    daily_reminder_time: Optional[str] = None  # Format: "HH:MM"


class UserDocument(BaseModel):
    """User document stored in MongoDB."""
    email: Optional[str] = None
    name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    settings: UserSettings = Field(default_factory=UserSettings)


class ReadingProgressDocument(BaseModel):
    """Reading progress document stored in MongoDB."""
    date: str  # YYYY-MM-DD format
    year: int
    chapters_assigned: List[Chapter]
    completed_chapters: List[CompletedChapter] = Field(default_factory=list)
    is_fully_complete: bool = False
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReadingHistoryDocument(BaseModel):
    """Aggregate reading statistics document stored in MongoDB."""
    year: int
    total_days_read: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    total_chapters_read: int = 0
    last_read_date: Optional[str] = None  # YYYY-MM-DD format
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ===== API Request Models =====

class MarkCompleteRequest(BaseModel):
    """Request to mark reading as complete."""
    date: str  # YYYY-MM-DD
    chapters: Optional[List[Chapter]] = None  # If None, mark all chapters for the day


class UndoChapterRequest(BaseModel):
    """Request to undo a chapter completion."""
    date: str  # YYYY-MM-DD
    book: str
    chapter: int


# ===== API Response Models =====

class ProgressData(BaseModel):
    """Progress data for a specific date."""
    date: str
    year: int
    chapters_assigned: List[Chapter]
    completed_chapters: List[CompletedChapter]
    is_fully_complete: bool
    completion_percentage: float  # 0-100
    completed_at: Optional[datetime] = None


class ProgressResponse(BaseModel):
    """Response for progress-related operations."""
    success: bool
    progress: ProgressData
    current_streak: int = 0
    message: Optional[str] = None


class DayProgress(BaseModel):
    """Summary of progress for a single day (for calendar view)."""
    date: str
    is_complete: bool
    completion_percentage: float  # 0-100
    chapters_assigned_count: int
    chapters_completed_count: int


class ProgressRangeResponse(BaseModel):
    """Response for progress range query."""
    days: List[DayProgress]


class CurrentStatsResponse(BaseModel):
    """Current reading statistics."""
    current_streak: int
    longest_streak: int
    total_days_read: int
    total_chapters_read: int
    year_progress_percentage: float  # 0-100


class YearStatsResponse(BaseModel):
    """Year-specific statistics."""
    year: int
    total_days: int  # Days in the year
    days_completed: int
    days_partial: int  # Days with some but not all chapters complete
    completion_rate: float  # Percentage of days fully completed
    total_chapters_assigned: int
    total_chapters_completed: int
    chapter_completion_rate: float  # Percentage of chapters completed
