# Contexts

## Overview
React Contexts are the backbone of LifeGroww's global state management. They act as the single source of truth for the UI and the interface to the Supabase backend.

## `AuthContext.tsx`
Provides authentication state to the app.

**Exports:**
- `user`: The Supabase User object.
- `loading`: Boolean state while the initial session is being established.
- `isConfigured`: Boolean flag indicating if the environment variables are present.
- `logout()`: Function to terminate the session and clear tokens.

## `SyncContext.tsx`
The most critical file in the application. It holds the entire dataset in memory.

**Exports:**
- `tasks`: The full tasks JSON payload.
- `habits`: The full habits JSON payload.
- `settings`: The full settings JSON payload.
- `syncStatus`: String ("loading" | "saving" | "synced" | "failed" | "offline" | "retry").
- `isOnline`: Boolean mapped to the browser's `navigator.onLine` event.
- `isInitialized`: Boolean indicating if the initial fetch from Supabase has completed.
- `updateTasks()`, `updateHabits()`, `updateSetting()`: The unified mutation methods. Calling these will update the local React state, write to `localStorage`, mark the data as `dirty`, and queue a background push to Supabase.

Because `SyncContext` holds all data, the application does not need complex state management libraries like Redux or Zustand. The entire state tree is simple enough to be passed down via React Context, and the "local-first" sync logic handles the persistence layer automatically.
