from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

# MongoDB connection settings
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "bible_reading"

# Global database client
_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongodb():
    """Initialize MongoDB connection on application startup."""
    global _client, _database

    try:
        _client = AsyncIOMotorClient(MONGODB_URL)
        _database = _client[DATABASE_NAME]

        # Test the connection
        await _client.admin.command('ping')
        print(f"Successfully connected to MongoDB at {MONGODB_URL}")

        # Create indexes for better performance
        await create_indexes()

    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongodb_connection():
    """Close MongoDB connection on application shutdown."""
    global _client

    if _client:
        _client.close()
        print("MongoDB connection closed")


async def create_indexes():
    """Create database indexes for optimal query performance."""
    global _database

    if _database is None:
        return

    # Index on reading_progress.date for fast date lookups
    await _database.reading_progress.create_index("date", unique=True)

    # Index on reading_progress.year for year-based queries
    await _database.reading_progress.create_index("year")

    # Index on reading_history.year
    await _database.reading_history.create_index("year", unique=True)

    print("Database indexes created successfully")


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance."""
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongodb() first.")
    return _database


# Collection helper functions
def get_users_collection():
    """Get users collection."""
    return get_database().users


def get_reading_progress_collection():
    """Get reading_progress collection."""
    return get_database().reading_progress


def get_reading_history_collection():
    """Get reading_history collection."""
    return get_database().reading_history
