# Database

## Overview
LifeGroww uses Supabase (PostgreSQL) as its backend database. However, instead of highly normalized relational tables (e.g., separate tables for tasks, habits, and settings), it uses a **Document Store pattern** leveraging a single table with JSONB columns.

## Table: `user_data`

This is the primary (and effectively only) data table for the application state. It stores all user data in large JSON objects. 

### Schema
- `user_id` (uuid, Primary Key, Foreign Key to `auth.users`)
- `tasks` (jsonb)
- `habits` (jsonb)
- `settings` (jsonb)

### Why this approach?
Because the app is heavily offline-first, retrieving and merging complex relational data on every reconnect is difficult. Storing the entire state tree as JSON allows the client to push and pull its entire state in a single upsert operation.

---

## Data Structures (JSON)

### 1. `tasks` (JSONB)
Stores arrays of tasks grouped by workspace.
```typescript
{
  "personal": [ Task, Task, ... ],
  "professional": [ Task, Task, ... ]
}
```

**Task Object Structure (`Task`):**
- `id` (string): UUID generated on the client.
- `title` (string): The name of the task.
- `description` (string, optional)
- `quadrant` (string): "q1", "q2", "q3", or "q4". Maps to the Eisenhower Matrix.
- `completed` (boolean)
- `status` (string): "pending", "in_progress", "done".
- `dueDate` (string, ISO datetime, optional)
- `priority` (string): "low", "medium", "high".
- `createdAt` (string, ISO datetime)
- `recurringConfigId` (string, optional): ID linking to the schedule that generated this task.
- `recurringDate` (string, optional): The target date (YYYY-MM-DD) for which this task was generated.

### 2. `habits` (JSONB)
Stores the entire state of the habit tracker.
```typescript
{
  "theme": "dark" | "light",
  "months": {
    "YYYY-MM": MonthData,
    "2026-07": MonthData
  }
}
```

**MonthData Structure:**
- `habits`: Array of habit definitions (`{ id, name, emoji }`).
- `days`: Object mapping a day number (1-31) to a `DayLog`.

**DayLog Structure:**
- `checks`: Object mapping habit IDs to boolean values (`{ "habit_id": true }`).
- `mood`: Number (1-5).
- `sleep`: Number (hours).
- `notes`: String (reflection/journal).

### 3. `settings` (JSONB)
Stores application preferences and recurring task configurations.
```typescript
{
  "appSettings": {
    "accent": string,
    "reportLayout": string,
    "showCompleted": boolean
  },
  "workspace": "personal" | "professional" | "all",
  "theme": "dark" | "light",
  "recurringConfigs": [ RecurringConfig, ... ],
  "habitgame": {
    "accentColor": string,
    "cardSize": string,
    "dailyChartType": "bar" | "line"
  }
}
```

**RecurringConfig Structure:**
- `id`: string
- `habitId`: string (optional, if linked to a habit)
- `workspace`: "personal" | "professional"
- `quadrant`: "q1" | "q2" | "q3" | "q4"
- `taskName`: string
- `schedule`: "daily" | "weekly" | "monthly" | "3months" | "6months" | "yearly" | "custom"
- `customValue`, `customUnit`: for custom schedules.
- `enabled`: boolean
- `startDate`, `endDate`: string (YYYY-MM-DD)

## Reads & Writes
- **Reads:** Handled by `SyncContext.tsx` on initialization. It performs a `.maybeSingle()` select on the `user_data` table based on the `user.id`.
- **Writes:** Handled via `supabase.from("user_data").upsert()`. The entire local state tree is passed as the payload. Conflicting writes are resolved by "Last Write Wins" at the row level via Supabase.
