# Workspace Architecture

## Overview
LifeGroww allows users to separate their tasks into contexts, termed "Workspaces". The two primary workspaces are **Personal** and **Professional**.

## Concept
Rather than using separate databases or requiring complex API queries to filter data, Workspaces are implemented purely through client-side routing of the JSON payload. This ensures instantaneous switching between views.

## File Dependencies
- `src/hooks/useWorkspace.ts`: Manages the currently selected workspace state.
- `src/components/WorkspaceSwitcher.tsx` (and inline components in `Index.tsx`): The UI for selecting a workspace.

## State Management (`useWorkspace.ts`)
```typescript
export type WorkspaceId = "personal" | "professional" | "all";
```
- The current workspace selection is stored in `SyncContext` under the `settings.workspace` key.
- It is also backed up to `localStorage` under `eisenhower.workspace.v1` for instant retrieval on hard refreshes before Supabase loads.

## Integration with Tasks (`useTasks.ts`)
The `useTasks` hook takes the `workspaceId` as an argument.
- **Reading Data:**
  - If `workspace === "personal"`, it returns `tasks.personal`.
  - If `workspace === "all"`, it merges the arrays: `[...tasks.personal, ...tasks.professional]`.
- **Writing Data:**
  - When `addTask` is called, it appends the new task to the array corresponding to the currently active workspace.
  - If the user is in the "All" view, new tasks default to the `personal` workspace.

## Integration with Recurring Tasks
`RecurringConfig` objects have a `workspace` property. When the `generateScheduledTasks` engine runs, it looks at the config and injects the generated task into the correct workspace array.

## UI Implementation
The active workspace dictates the tasks visible in the Eisenhower Matrix. The Dashboard (Habits) is currently global and not partitioned by workspace.
