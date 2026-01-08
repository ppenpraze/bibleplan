# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A daily Bible reading planner with a FastAPI backend and React frontend. The app generates a dynamic reading schedule that:
- Targets 3 chapters on weekdays, 4 on weekends
- Automatically adjusts later in the year to finish exactly on Dec 31
- Ensures at least 1 chapter per day
- Covers all 1,189 chapters of the Protestant Bible (NIV)

## Architecture

### Backend (Python/FastAPI)
- `backend/main.py`: Core API server with scheduling algorithm
  - `compute_plan_for_year()`: Dynamic planning algorithm that distributes 1,189 chapters across 365 days with weekday/weekend awareness
  - Uses suffix array optimization to ensure the plan never finishes early or requires impossible catch-up
  - Two endpoints: `/api/today` and `/api/reading?date_str=YYYY-MM-DD`
  - Serves frontend static files from `frontend/dist` when built
- `backend/bible_niv_chapters.py`: Book/chapter data
  - `BOOKS`: 66-book Protestant canon with chapter counts
  - `CHAPTER_INDEX`: Flat list of 1,189 (book, chapter) tuples
  - `TOTAL_CHAPTERS`: Constant 1189

### Frontend (React/TypeScript/Vite)
- Material-UI components
- Single-page app (`src/App.tsx`) showing today's reading
- Fetches from `/api/reading` endpoint
- Displays chapter assignments, progress tracking, and metadata

## Development Commands

### Backend
```bash
cd backend
python -m venv ../.venv  # if not exists
source ../.venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python main.py  # or: uvicorn main:app --reload
```
Backend runs on `http://localhost:8000`

### Frontend
```bash
cd frontend
npm install
npm run dev  # Development server with proxy
npm run build  # Production build to dist/
```
Frontend dev server runs on `http://localhost:5173` with API proxy to `localhost:8000`

### Full Stack Development
1. Terminal 1: `cd backend && python main.py`
2. Terminal 2: `cd frontend && npm run dev`
3. Access frontend at `http://localhost:5173`

### Production Build
```bash
cd frontend && npm run build
cd ../backend && python main.py
```
Access at `http://localhost:8000` (serves both API and static frontend)

## Key Constraints & Design Decisions

### Scheduling Algorithm
The `compute_plan_for_year()` function in `backend/main.py:35-91` implements a greedy algorithm with lookahead:
- **Suffix max optimization**: Pre-computes remaining capacity from each day forward to avoid impossible schedules
- **Min/max constraints**: Balances "don't finish early" vs "must be doable" constraints
- **Safety clamps**: Prevents edge cases where min > max
- The algorithm is deterministic and regenerates the entire year's plan on each request (no state persistence)

### API Design
- All dates must be within the same calendar year (Jan 1 - Dec 31)
- The plan is year-specific and recalculated for the requested year
- Chapter indices are 0-based internally but displayed as 1-based to humans

### Frontend State
- No global state management (no Redux/Context)
- Single component fetches today's reading on mount
- "Mark as read" and "View plan" buttons are UI placeholders (non-functional)

## Testing

No test suite is currently implemented. To manually test the scheduling algorithm:
1. Add a test date in the API call (e.g., `/api/reading?date_str=2025-06-15`)
2. Verify chapter counts match weekday/weekend expectations
3. Check edge cases: Jan 1, Dec 31, leap years

## Dependency Notes

- Backend: FastAPI + Uvicorn for async ASGI serving
- Frontend: Vite for fast HMR, Material-UI for components
- Python 3.12+ (uses `from __future__ import annotations`)
- The `.venv` directory is at the project root (shared by backend)