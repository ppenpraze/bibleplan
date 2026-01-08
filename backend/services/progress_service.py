from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple

from database import get_reading_progress_collection, get_reading_history_collection
from models import (
    Chapter,
    CompletedChapter,
    ReadingProgressDocument,
    ReadingHistoryDocument,
    ProgressData,
    DayProgress,
)


async def get_or_create_progress(date_str: str, year: int, assigned_chapters: List[Chapter]) -> ReadingProgressDocument:
    """
    Get existing progress document or create a new one for the given date.

    Args:
        date_str: Date in YYYY-MM-DD format
        year: Year number
        assigned_chapters: List of chapters assigned for this date

    Returns:
        ReadingProgressDocument
    """
    collection = get_reading_progress_collection()

    # Try to find existing document
    doc = await collection.find_one({"date": date_str})

    if doc:
        # Remove MongoDB _id field
        doc.pop("_id", None)
        return ReadingProgressDocument(**doc)

    # Create new document
    new_doc = ReadingProgressDocument(
        date=date_str,
        year=year,
        chapters_assigned=[Chapter(**ch.dict()) for ch in assigned_chapters],
        completed_chapters=[],
        is_fully_complete=False,
    )

    # Insert into database
    await collection.insert_one(new_doc.dict())

    return new_doc


async def mark_chapters_complete(
    date_str: str,
    year: int,
    assigned_chapters: List[Chapter],
    chapters_to_mark: Optional[List[Chapter]] = None
) -> Tuple[ReadingProgressDocument, int]:
    """
    Mark chapters as complete for a given date.

    Args:
        date_str: Date in YYYY-MM-DD format
        year: Year number
        assigned_chapters: All chapters assigned for this date
        chapters_to_mark: Specific chapters to mark (None = mark all)

    Returns:
        Tuple of (updated progress document, current streak)
    """
    collection = get_reading_progress_collection()

    # Get or create progress document
    progress = await get_or_create_progress(date_str, year, assigned_chapters)

    # Determine which chapters to mark
    if chapters_to_mark is None:
        # Mark all assigned chapters
        chapters_to_mark = assigned_chapters

    # Get currently completed chapter keys for deduplication
    completed_keys = {(ch.book, ch.chapter) for ch in progress.completed_chapters}

    # Add new completions
    now = datetime.utcnow()
    for chapter in chapters_to_mark:
        key = (chapter.book, chapter.chapter)
        if key not in completed_keys:
            progress.completed_chapters.append(
                CompletedChapter(book=chapter.book, chapter=chapter.chapter, completed_at=now)
            )
            completed_keys.add(key)

    # Check if all chapters are now complete
    assigned_keys = {(ch.book, ch.chapter) for ch in progress.chapters_assigned}
    progress.is_fully_complete = completed_keys >= assigned_keys

    if progress.is_fully_complete and not progress.completed_at:
        progress.completed_at = now

    progress.updated_at = now

    # Update database
    await collection.update_one(
        {"date": date_str},
        {"$set": progress.dict()},
        upsert=True
    )

    # Update reading history and get current streak
    current_streak = await update_reading_history(date_str, year)

    return progress, current_streak


async def undo_chapter_completion(
    date_str: str,
    book: str,
    chapter: int
) -> Optional[ReadingProgressDocument]:
    """
    Remove a chapter from the completed list.

    Args:
        date_str: Date in YYYY-MM-DD format
        book: Book name
        chapter: Chapter number

    Returns:
        Updated progress document or None if not found
    """
    collection = get_reading_progress_collection()

    # Find the progress document
    doc = await collection.find_one({"date": date_str})
    if not doc:
        return None

    doc.pop("_id", None)
    progress = ReadingProgressDocument(**doc)

    # Remove the chapter from completed list
    progress.completed_chapters = [
        ch for ch in progress.completed_chapters
        if not (ch.book == book and ch.chapter == chapter)
    ]

    # Update completion status
    completed_keys = {(ch.book, ch.chapter) for ch in progress.completed_chapters}
    assigned_keys = {(ch.book, ch.chapter) for ch in progress.chapters_assigned}
    progress.is_fully_complete = completed_keys >= assigned_keys

    if not progress.is_fully_complete:
        progress.completed_at = None

    progress.updated_at = datetime.utcnow()

    # Update database
    await collection.update_one(
        {"date": date_str},
        {"$set": progress.dict()}
    )

    # Recalculate streak
    await update_reading_history(date_str, progress.year)

    return progress


async def get_progress_for_date(date_str: str) -> Optional[ReadingProgressDocument]:
    """
    Get progress for a specific date.

    Args:
        date_str: Date in YYYY-MM-DD format

    Returns:
        ReadingProgressDocument or None if not found
    """
    collection = get_reading_progress_collection()
    doc = await collection.find_one({"date": date_str})

    if not doc:
        return None

    doc.pop("_id", None)
    return ReadingProgressDocument(**doc)


async def get_progress_range(start_date: str, end_date: str) -> List[DayProgress]:
    """
    Get progress summary for a date range.

    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format

    Returns:
        List of DayProgress objects
    """
    collection = get_reading_progress_collection()

    # Query all documents in range
    cursor = collection.find({
        "date": {
            "$gte": start_date,
            "$lte": end_date
        }
    }).sort("date", 1)

    results = []
    async for doc in cursor:
        doc.pop("_id", None)
        progress = ReadingProgressDocument(**doc)

        chapters_assigned_count = len(progress.chapters_assigned)
        chapters_completed_count = len(progress.completed_chapters)
        completion_pct = (
            (chapters_completed_count / chapters_assigned_count * 100)
            if chapters_assigned_count > 0
            else 0.0
        )

        results.append(DayProgress(
            date=progress.date,
            is_complete=progress.is_fully_complete,
            completion_percentage=completion_pct,
            chapters_assigned_count=chapters_assigned_count,
            chapters_completed_count=chapters_completed_count,
        ))

    return results


async def update_reading_history(date_str: str, year: int) -> int:
    """
    Update reading history and calculate current streak.

    Args:
        date_str: Date in YYYY-MM-DD format
        year: Year number

    Returns:
        Current streak count
    """
    history_collection = get_reading_history_collection()
    progress_collection = get_reading_progress_collection()

    # Get or create history document
    history_doc = await history_collection.find_one({"year": year})
    if history_doc:
        history_doc.pop("_id", None)
        history = ReadingHistoryDocument(**history_doc)
    else:
        history = ReadingHistoryDocument(year=year)

    # Get all completed days for the year (sorted by date)
    cursor = progress_collection.find({
        "year": year,
        "is_fully_complete": True
    }).sort("date", 1)

    completed_dates = []
    total_chapters = 0
    async for doc in cursor:
        completed_dates.append(doc["date"])
        total_chapters += len(doc.get("completed_chapters", []))

    # Update totals
    history.total_days_read = len(completed_dates)
    history.total_chapters_read = total_chapters
    history.last_read_date = completed_dates[-1] if completed_dates else None

    # Calculate current streak (from today backwards)
    history.current_streak = calculate_streak(completed_dates, reverse=True)

    # Calculate longest streak (scan all dates)
    history.longest_streak = calculate_longest_streak(completed_dates)

    history.updated_at = datetime.utcnow()

    # Update database
    await history_collection.update_one(
        {"year": year},
        {"$set": history.dict()},
        upsert=True
    )

    return history.current_streak


def calculate_streak(completed_dates: List[str], reverse: bool = True) -> int:
    """
    Calculate streak of consecutive days.

    Args:
        completed_dates: List of date strings in YYYY-MM-DD format (sorted)
        reverse: If True, calculate from most recent backwards

    Returns:
        Streak count
    """
    if not completed_dates:
        return 0

    dates = [date.fromisoformat(d) for d in completed_dates]

    if reverse:
        dates.reverse()

    # Start from the first date in the list
    streak = 1
    for i in range(1, len(dates)):
        expected_date = dates[i - 1] + timedelta(days=1)
        if dates[i] == expected_date:
            streak += 1
        else:
            break

    return streak


def calculate_longest_streak(completed_dates: List[str]) -> int:
    """
    Calculate the longest streak of consecutive days.

    Args:
        completed_dates: List of date strings in YYYY-MM-DD format (sorted)

    Returns:
        Longest streak count
    """
    if not completed_dates:
        return 0

    dates = [date.fromisoformat(d) for d in completed_dates]

    max_streak = 1
    current_streak = 1

    for i in range(1, len(dates)):
        if dates[i] == dates[i - 1] + timedelta(days=1):
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 1

    return max_streak


def progress_to_data(progress: ReadingProgressDocument) -> ProgressData:
    """
    Convert ReadingProgressDocument to ProgressData response model.

    Args:
        progress: Progress document

    Returns:
        ProgressData model
    """
    chapters_assigned_count = len(progress.chapters_assigned)
    chapters_completed_count = len(progress.completed_chapters)
    completion_pct = (
        (chapters_completed_count / chapters_assigned_count * 100)
        if chapters_assigned_count > 0
        else 0.0
    )

    return ProgressData(
        date=progress.date,
        year=progress.year,
        chapters_assigned=progress.chapters_assigned,
        completed_chapters=progress.completed_chapters,
        is_fully_complete=progress.is_fully_complete,
        completion_percentage=completion_pct,
        completed_at=progress.completed_at,
    )
