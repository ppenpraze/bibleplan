from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from bible_niv_chapters import CHAPTER_INDEX, TOTAL_CHAPTERS
from database import connect_to_mongodb, close_mongodb_connection, get_reading_history_collection
from models import (
    Chapter,
    MarkCompleteRequest,
    UndoChapterRequest,
    ProgressResponse,
    CurrentStatsResponse,
)
from services.progress_service import (
    mark_chapters_complete,
    undo_chapter_completion,
    get_progress_for_date,
    get_progress_range,
    progress_to_data,
)


def serialize_progress_response(response: ProgressResponse) -> Dict[str, Any]:
    """Helper to serialize ProgressResponse with datetime fields."""
    result = response.dict()

    # Serialize completed_chapters datetime fields
    for ch in result["progress"]["completed_chapters"]:
        if ch.get("completed_at"):
            ch["completed_at"] = ch["completed_at"].isoformat()

    # Serialize progress completed_at
    if result["progress"].get("completed_at"):
        result["progress"]["completed_at"] = result["progress"]["completed_at"].isoformat()

    return result

app = FastAPI(title="Daily Bible Reading (NIV)")

# Add CORS middleware for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# MongoDB lifecycle events
@app.on_event("startup")
async def startup_event():
    """Initialize MongoDB connection on application startup."""
    await connect_to_mongodb()


@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on application shutdown."""
    await close_mongodb_connection()

# -----------------------------
# Scheduling logic
# -----------------------------

def is_weekend(d: date) -> bool:
    # Python: Monday=0 ... Sunday=6
    return d.weekday() >= 5  # Sat, Sun

def max_chapters_for_day(d: date) -> int:
    return 4 if is_weekend(d) else 3

def year_start_end(year: int) -> Tuple[date, date]:
    return date(year, 1, 1), date(year, 12, 31)

def daterange(d0: date, d1: date):
    cur = d0
    while cur <= d1:
        yield cur
        cur += timedelta(days=1)

async def get_total_chapters_read_before_date(target_date: date, year: int) -> int:
    """
    Count total chapters actually read before (not including) target_date.
    Used to calculate dynamic reading plan based on progress.
    """
    from database import get_reading_progress_collection

    collection = get_reading_progress_collection()

    # Query all progress records before target date
    start_of_year = date(year, 1, 1)
    target_str = target_date.isoformat()

    total_chapters = 0
    cursor = collection.find({
        "year": year,
        "date": {"$lt": target_str}  # Before target date
    })

    async for doc in cursor:
        total_chapters += len(doc.get("completed_chapters", []))

    return total_chapters


def compute_dynamic_plan(
    start_date: date,
    end_date: date,
    remaining_chapters: int
) -> Dict[date, int]:
    """
    Create a dynamic reading plan from start_date to end_date.
    Distributes remaining_chapters across the days.

    Args:
        start_date: First day of plan (usually today)
        end_date: Last day of plan (usually Dec 31)
        remaining_chapters: Number of chapters left to read

    Returns:
        Dictionary mapping each date to number of chapters
    """
    days = list(daterange(start_date, end_date))

    if not days:
        return {}

    # Precompute future max capacity from each day onward
    max_caps = [max_chapters_for_day(d) for d in days]
    suffix_max = [0] * (len(days) + 1)
    for i in range(len(days) - 1, -1, -1):
        suffix_max[i] = suffix_max[i + 1] + max_caps[i]

    remaining = remaining_chapters
    plan: Dict[date, int] = {}

    for i, d in enumerate(days):
        remaining_days_after = len(days) - (i + 1)

        today_max = max_caps[i]
        future_max = suffix_max[i + 1]

        # Minimum needed today so the rest is still doable
        min_needed_today = max(1, remaining - future_max)

        # Maximum allowed today so we do NOT finish early
        max_allowed_today = remaining - remaining_days_after
        if max_allowed_today < 1:
            max_allowed_today = 1

        # Target by weekday/weekend preference
        target = today_max

        # Pick a value satisfying constraints
        x = min(target, today_max, max_allowed_today)
        x = max(x, min_needed_today)

        # Safety clamp
        x = max(1, min(x, today_max, remaining))

        plan[d] = x
        remaining -= x

        if remaining <= 0:
            # Finished early - fill rest with 1 chapter/day
            for j in range(i + 1, len(days)):
                plan[days[j]] = 1
            break

    return plan


def compute_plan_for_year(year: int) -> Dict[date, int]:
    """
    Create a per-day plan that:
      - targets 3 chapters weekdays, 4 weekends
      - may reduce later so we finish exactly on Dec 31
      - minimum 1 chapter/day
      - never exceeds the day max (3/4)

    NOTE: This is the static version. For dynamic progress-aware planning,
    use compute_dynamic_plan() instead.
    """
    start, end = year_start_end(year)
    days = list(daterange(start, end))

    # Precompute future max capacity from each day onward
    max_caps = [max_chapters_for_day(d) for d in days]
    suffix_max = [0] * (len(days) + 1)  # suffix_max[i] = sum(max_caps[i:])
    for i in range(len(days) - 1, -1, -1):
        suffix_max[i] = suffix_max[i + 1] + max_caps[i]

    remaining = TOTAL_CHAPTERS
    plan: Dict[date, int] = {}

    for i, d in enumerate(days):
        remaining_days_after = len(days) - (i + 1)

        today_max = max_caps[i]
        future_max = suffix_max[i + 1]

        # Minimum needed today so the rest is still doable within max capacity:
        # if we leave too many chapters, future days can't fit them.
        min_needed_today = max(1, remaining - future_max)

        # Maximum allowed today so we do NOT finish early:
        # after today, we must have at least 1 chapter/day remaining.
        max_allowed_today = remaining - remaining_days_after
        if max_allowed_today < 1:
            max_allowed_today = 1

        # Target by weekday/weekend preference
        target = today_max

        # Pick a value satisfying:
        #   min_needed_today <= x <= today_max
        #   x <= max_allowed_today
        x = min(target, today_max, max_allowed_today)
        x = max(x, min_needed_today)

        # Safety clamp
        x = max(1, min(x, today_max, remaining))

        plan[d] = x
        remaining -= x

    # By construction we should end at 0 on Dec 31
    if remaining != 0:
        # Extremely unlikely unless TOTAL_CHAPTERS changes
        raise RuntimeError(f"Plan did not finish exactly. Remaining={remaining}")

    return plan

async def reading_for_date(d: date, include_progress: bool = False) -> Dict[str, Any]:
    """
    Returns dynamic reading assignment based on actual progress.

    The plan adjusts based on how many chapters have actually been read,
    ensuring all 1,189 chapters are completed by Dec 31.

    Returns:
      - date
      - chapters_count
      - chapters: list of {book, chapter}
      - also a compact range label if chapters are contiguous within same book
      - optionally includes progress data if include_progress=True
    """
    year = d.year
    start, end = year_start_end(year)
    if not (start <= d <= end):
        return {"error": "Date must be within the selected year."}

    # Get actual chapters read before this date
    chapters_read_before = await get_total_chapters_read_before_date(d, year)

    # Calculate remaining chapters to read
    remaining_chapters = TOTAL_CHAPTERS - chapters_read_before

    # Compute dynamic plan from today to end of year
    dynamic_plan = compute_dynamic_plan(d, end, remaining_chapters)

    # Get today's assignment
    today_count = dynamic_plan.get(d, 1)  # Default to 1 if not in plan

    # Calculate chapter indices
    start_idx = chapters_read_before
    end_idx = start_idx + today_count

    # Get today's chapters
    todays = CHAPTER_INDEX[start_idx:end_idx]
    chapters = [{"book": b, "chapter": c} for (b, c) in todays]

    # Friendly label
    label = build_label(todays)

    remaining_after = TOTAL_CHAPTERS - end_idx
    days_left_after = (end - d).days

    result = {
        "date": d.isoformat(),
        "year": year,
        "version": "NIV",
        "chapters_count": today_count,
        "chapters": chapters,
        "label": label,
        "meta": {
            "total_chapters": TOTAL_CHAPTERS,
            "chapter_index_start": start_idx + 1,  # 1-based for humans
            "chapter_index_end": end_idx,
            "remaining_chapters_after_today": remaining_after,
            "days_left_after_today": days_left_after,
        },
    }

    # Optionally add progress data
    if include_progress:
        date_str = d.isoformat()
        progress = await get_progress_for_date(date_str)

        if progress:
            progress_data = progress_to_data(progress)
            # Serialize completed chapters with datetime conversion
            completed_chapters_serialized = []
            for ch in progress_data.completed_chapters:
                ch_dict = ch.dict()
                # Convert datetime to ISO string
                if ch_dict.get("completed_at"):
                    ch_dict["completed_at"] = ch_dict["completed_at"].isoformat()
                completed_chapters_serialized.append(ch_dict)

            result["progress"] = {
                "completed_chapters": completed_chapters_serialized,
                "is_complete": progress_data.is_fully_complete,
                "completion_percentage": progress_data.completion_percentage,
            }
        else:
            result["progress"] = {
                "completed_chapters": [],
                "is_complete": False,
                "completion_percentage": 0.0,
            }

        # Add current streak
        history_collection = get_reading_history_collection()
        history_doc = await history_collection.find_one({"year": year})
        current_streak = history_doc.get("current_streak", 0) if history_doc else 0

        result["stats"] = {
            "current_streak": current_streak
        }

    return result

def build_label(todays: List[Tuple[str, int]]) -> str:
    if not todays:
        return ""
    if len(todays) == 1:
        b, c = todays[0]
        return f"{b} {c}"

    # If all same book and contiguous chapters, show book a-b
    books = {b for b, _ in todays}
    if len(books) == 1:
        b = todays[0][0]
        chs = [c for _, c in todays]
        if chs == list(range(chs[0], chs[0] + len(chs))):
            return f"{b} {chs[0]}–{chs[-1]}"
        return f"{b} " + ", ".join(str(x) for x in chs)

    # Otherwise show first and last
    b1, c1 = todays[0]
    b2, c2 = todays[-1]
    return f"{b1} {c1} → {b2} {c2}"

# -----------------------------
# API
# -----------------------------

@app.get("/api/today")
async def api_today(include_progress: bool = Query(True, description="Include progress data")):
    result = await reading_for_date(date.today(), include_progress=include_progress)
    return JSONResponse(result)

@app.get("/api/reading")
async def api_reading(
    date_str: str = Query(..., description="YYYY-MM-DD within the year"),
    include_progress: bool = Query(True, description="Include progress data"),
):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    result = await reading_for_date(d, include_progress=include_progress)
    return JSONResponse(result)

# -----------------------------
# Progress Tracking API
# -----------------------------

@app.post("/api/progress/mark-complete")
async def api_mark_complete(request: MarkCompleteRequest) -> Dict[str, Any]:
    """
    Mark chapters as complete for a specific date.
    If no chapters specified, marks all assigned chapters for the day.
    """
    try:
        # Parse and validate date
        d = datetime.strptime(request.date, "%Y-%m-%d").date()
        year = d.year

        # Get assigned chapters for this date
        reading_data = await reading_for_date(d, include_progress=False)
        if "error" in reading_data:
            raise HTTPException(status_code=400, detail=reading_data["error"])

        assigned_chapters = [Chapter(**ch) for ch in reading_data["chapters"]]

        # Determine which chapters to mark
        chapters_to_mark = None
        if request.chapters:
            chapters_to_mark = request.chapters

        # Mark chapters complete
        progress, current_streak = await mark_chapters_complete(
            request.date,
            year,
            assigned_chapters,
            chapters_to_mark
        )

        # Build response
        progress_data = progress_to_data(progress)

        message = "All chapters marked as complete!" if progress.is_fully_complete else "Progress saved!"

        response = ProgressResponse(
            success=True,
            progress=progress_data,
            current_streak=current_streak,
            message=message
        )

        return serialize_progress_response(response)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking complete: {str(e)}")


@app.post("/api/progress/undo")
async def api_undo_chapter(request: UndoChapterRequest) -> Dict[str, Any]:
    """
    Undo completion of a specific chapter.
    """
    try:
        # Validate date
        datetime.strptime(request.date, "%Y-%m-%d").date()

        # Undo the chapter
        progress = await undo_chapter_completion(request.date, request.book, request.chapter)

        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found for this date")

        # Get current streak
        history_collection = get_reading_history_collection()
        history_doc = await history_collection.find_one({"year": progress.year})
        current_streak = history_doc.get("current_streak", 0) if history_doc else 0

        # Build response
        progress_data = progress_to_data(progress)

        response = ProgressResponse(
            success=True,
            progress=progress_data,
            current_streak=current_streak,
            message="Chapter completion undone"
        )

        return serialize_progress_response(response)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error undoing chapter: {str(e)}")


@app.get("/api/progress/range")
async def api_get_progress_range(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
) -> Dict[str, Any]:
    """
    Get progress summary for a date range (for calendar view).
    """
    try:
        # Validate dates
        datetime.strptime(start, "%Y-%m-%d").date()
        datetime.strptime(end, "%Y-%m-%d").date()

        # Get progress range
        days = await get_progress_range(start, end)

        # Convert DayProgress objects to dicts
        days_serialized = [
            {
                "date": day.date,
                "is_complete": day.is_complete,
                "completion_percentage": day.completion_percentage,
                "chapters_assigned_count": day.chapters_assigned_count,
                "chapters_completed_count": day.chapters_completed_count,
            }
            for day in days
        ]

        return {"days": days_serialized}

    except ValueError as e:
        print(f"ValueError in progress range: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        print(f"Exception in progress range: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error getting progress range: {str(e)}")


@app.get("/api/progress/{date_str}")
async def api_get_progress(date_str: str) -> Dict[str, Any]:
    """
    Get progress for a specific date.
    """
    try:
        # Validate date
        d = datetime.strptime(date_str, "%Y-%m-%d").date()

        # Get reading data
        reading_data = await reading_for_date(d, include_progress=False)
        if "error" in reading_data:
            raise HTTPException(status_code=400, detail=reading_data["error"])

        # Get progress
        progress = await get_progress_for_date(date_str)

        if progress:
            progress_data = progress_to_data(progress)
            result = progress_data.dict()

            # Serialize datetime fields
            for ch in result.get("completed_chapters", []):
                if ch.get("completed_at"):
                    ch["completed_at"] = ch["completed_at"].isoformat()

            if result.get("completed_at"):
                result["completed_at"] = result["completed_at"].isoformat()

            return result
        else:
            # No progress yet - return empty progress for assigned chapters
            assigned_chapters = [Chapter(**ch) for ch in reading_data["chapters"]]
            return {
                "date": date_str,
                "year": d.year,
                "chapters_assigned": [ch.dict() for ch in assigned_chapters],
                "completed_chapters": [],
                "is_fully_complete": False,
                "completion_percentage": 0.0,
                "completed_at": None,
            }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting progress: {str(e)}")


@app.get("/api/stats/current")
async def api_get_current_stats() -> CurrentStatsResponse:
    """
    Get current year statistics including streak.
    """
    try:
        year = date.today().year
        history_collection = get_reading_history_collection()
        history_doc = await history_collection.find_one({"year": year})

        if history_doc:
            # Calculate year progress percentage
            start, end = year_start_end(year)
            days_in_year = (end - start).days + 1
            today = date.today()
            days_elapsed = (today - start).days + 1
            year_progress = (days_elapsed / days_in_year) * 100

            return CurrentStatsResponse(
                current_streak=history_doc.get("current_streak", 0),
                longest_streak=history_doc.get("longest_streak", 0),
                total_days_read=history_doc.get("total_days_read", 0),
                total_chapters_read=history_doc.get("total_chapters_read", 0),
                year_progress_percentage=year_progress,
            )
        else:
            # No history yet
            return CurrentStatsResponse(
                current_streak=0,
                longest_streak=0,
                total_days_read=0,
                total_chapters_read=0,
                year_progress_percentage=0.0,
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

# -----------------------------
# Serve frontend build (Vite)
# -----------------------------

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
