# Synchronization Engine

## Overview
The synchronization engine, managed via `src/context/SyncContext.tsx`, is the most complex system in the application. It handles the offline-first data model, background syncing, and merging state changes.

## File Structure & Dependencies
- `SyncContext.tsx`: The orchestrator and global state provider.
- `lib/db.ts`: Contains older raw fetch/save methods (mostly bypassed by the advanced SyncContext logic, but kept for standalone utility functions if needed).

## The Sync Lifecycle

### 1. Initialization (Server-First Load)
When the app boots, it attempts to fetch the "truth" from the server:
- Calls `supabase.from("user_data").select()`.
- **Safety Fallback:** It checks `localStorage` for any pending offline changes via the `dirtyRef`.
- If the server has data but `localStorage` has offline edits (dirty flag `true`), the local edits take precedence over the server state to prevent data loss.
- Sets `isInitialized` to true. Until this happens, the UI displays a loading matrix.

### 2. Immediate Local Mutation (Optimistic UI)
When a user updates data (e.g., ticking a habit, moving a task via `updateTasks` or `updateHabits`):
- The React State (`tasksState`, `habitsState`) is updated immediately.
- A deep copy is written to `localStorage`.
- A `dirty` flag for that specific domain (`tasks`, `habits`, or `settings`) is set to `true`.

### 3. Server Push
- If the user is `isOnline`, the system calls `pushToSupabase()`.
- It executes a `supabase.from("user_data").upsert()` sending the full JSON payloads.
- If successful, it clears the `dirty` flags and sets `syncStatus` to `"synced"`.

### 4. Retry Loop (Offline Mode)
- If the push fails (network error, offline), `syncStatus` becomes `"failed"` or `"offline"`.
- A background `setInterval` runs every 5 seconds.
- It checks if `navigator.onLine` is true and if any `dirtyRef` flags are set.
- If conditions are met, it attempts `pushToSupabase()` again.

## Data Structures

### Local Storage Keys (`KEYS`)
- `eisenhower.tasks.v1:personal`
- `eisenhower.tasks.v1:professional`
- `habitgame:v1`
- `eisenhower.appSettings.v1`
- `eisenhower.sync.dirty`: A JSON object tracking which data trees need pushing `{"tasks": true, "habits": false}`.

## Conflict Resolution
The app uses a **Last Write Wins (LWW)** strategy at the JSON payload level. Because it is a single-user productivity app (no multi-user collaboration), complex CRDTs are not required. If a user edits data on their phone while offline, and edits data on their laptop while offline, whichever device connects and pushes to the server *last* will overwrite the row in Supabase.

## Safety Guards
- **Data Erasure Prevention:** `updateHabits` has a defensive guard. If the payload attempts to overwrite a known, populated habit history with an empty object (a common race condition in React initial renders), the engine explicitly aborts the write and throws a safety error.
