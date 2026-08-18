# API Reference

## Supabase Endpoints

The application interacts with Supabase almost exclusively through the `user_data` table.

### `GET /rest/v1/user_data?user_id=eq.{user_id}`
- **Purpose:** Fetches the initial state on load.
- **Client Method:** `supabase.from("user_data").select("tasks, habits, settings").eq("user_id", userId).maybeSingle()`
- **Response Shape:**
  ```json
  {
    "tasks": { "personal": [], "professional": [] },
    "habits": { "months": {}, "theme": "dark" },
    "settings": { "appSettings": {}, "workspace": "professional" }
  }
  ```

### `POST /rest/v1/user_data` (Upsert)
- **Purpose:** Saves the entire state.
- **Client Method:** `supabase.from("user_data").upsert(payload, { onConflict: "user_id" })`
- **Request Payload:** The combined JSON object of tasks, habits, and settings.

## Local Client Methods (React Context)

These are the primary methods exposed to the UI layer for data manipulation.

### `SyncContext.updateTasks(workspace: string, newTasks: Task[])`
Replaces the task array for the specific workspace. Queues a sync.

### `SyncContext.updateHabits(newHabits: HabitsStore)`
Replaces the entire habit data tree. Queues a sync. Contains a safety guard to prevent overwriting existing data with empty objects.

### `SyncContext.updateSetting(key: string, value: unknown)`
Updates a specific key in the `settings` JSON object. Queues a sync.

### `SyncContext.forceSync()`
Manually triggers `pushToSupabase()`, bypassing the interval timer. Used when the user explicitly clicks a "Sync Now" button.
