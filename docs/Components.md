# Components

## Overview
The application utilizes a combination of base generic UI components (provided by Shadcn UI / Radix) and specialized business logic components.

## Shadcn UI Primitives (`src/components/ui/`)
These components are headless accessibility wrappers from Radix UI, styled with Tailwind CSS.
- **Dialog:** Modals used for settings and the recurring tasks manager.
- **Popover:** Context menus (e.g., the mobile dropdown menu, Pomodoro settings).
- **Checkbox, Input, Select:** Standard form controls.
- **Toast / Sonner:** Notification snackbars used for success/error messages.

## Business Components

### `TaskCard.tsx`
Renders an individual task inside the Matrix.
- Supports inline editing (turns into an `<Input>` when the edit button is clicked).
- Renders the deadline picker (`<input type="datetime-local">`).
- Connects to `@dnd-kit/sortable` to provide the drag-and-drop `ref` and `listeners`.

### `PomodoroTimer.tsx`
Self-contained component rendering the timer. It maintains its own internal `setInterval` logic for the countdown.

### `SyncStatusIndicator.tsx`
A small icon that reads `syncStatus` from `SyncContext` and displays the current state (Loading, Synced, Saving, Offline, Error). It serves as the primary feedback mechanism for the offline-first architecture.

### `RecurringConfigDialog.tsx` & `RecurringTasksManagerDialog.tsx`
Complex forms for managing the custom JSON data structures required by the Recurring Tasks Engine.

### `WorkspaceSwitcher.tsx`
A segmented button component allowing the user to rapidly switch between `personal`, `professional`, and `all` views.
