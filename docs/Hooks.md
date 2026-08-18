# Custom Hooks

## Overview
To keep React components clean and testable, LifeGroww extracts almost all complex state transformations into custom hooks.

## Key Hooks

### `useTasks(workspaceId)`
- **File:** `src/hooks/useTasks.ts`
- **Purpose:** Fetches the task array for the requested workspace from `SyncContext`.
- **Logic:** Performs the `normalize` sorting function (overdue first, completed last). Exposes `addTask`, `removeTask`, `toggleTask`, `reorderTask`, etc.

### `useHabitStore(year, month)`
- **File:** `src/lib/habit-store.ts`
- **Purpose:** Fetches the habit state tree from `SyncContext`.
- **Logic:** Navigates the JSON object down to `months[YYYY-MM]`. If the month doesn't exist, it intelligently seeds it with habits from the previous month. Exposes `toggleCheck`, `addHabit`, etc.

### `useWorkspace()`
- **File:** `src/hooks/useWorkspace.ts`
- **Purpose:** Gets and sets the active workspace context.
- **Logic:** Reads `workspace` from `SyncContext.settings` and falls back to `localStorage` during initial load.

### `useAppSettings()`
- **File:** `src/hooks/useAppSettings.ts`
- **Purpose:** Manages the global matrix theme settings.
- **Logic:** Handles the Accent Color injection and the `reportLayout` preferences.

### `useNotifications.ts`
Contains two specialized hooks:
1. **`useDeadlineWatcher(tasks)`:** Uses a `setInterval` every minute to scan the current tasks for any that have passed their `dueDate` in the last minute. If found, it triggers a browser notification and sound.
2. **`useHourlyChime()`:** Uses a `setInterval` to check the system clock. If the minute is `00` and the sound settings permit it, it plays a soft hourly chime.
