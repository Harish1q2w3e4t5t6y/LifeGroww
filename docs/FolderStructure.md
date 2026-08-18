# Folder Structure

## Root Directory (`/`)
- `package.json` / `vite.config.ts`: Node and Vite build configurations.
- `tailwind.config.ts` / `postcss.config.js`: Styling engine configurations.
- `vercel.json`: Deployment configuration.
- `demo_data.json` / `demo_habits.json` etc.: Fallback data files used when Supabase is not configured.

## `src/` Directory
The core of the application logic.
- `App.tsx` / `main.tsx`: The React entry points and router configuration.
- `index.css`: Global CSS and Tailwind directives.

### `src/components/`
- `ui/`: Contains standard Shadcn UI primitive components (Buttons, Dialogs, Checkboxes). These are typically generated and lightly customized.
- Root level: Contains custom business-logic components (e.g., `TaskCard.tsx`, `PomodoroTimer.tsx`, `RecurringConfigDialog.tsx`).

### `src/context/`
- `AuthContext.tsx`: Manages the Supabase user session.
- `SyncContext.tsx`: The global data store and synchronization engine.

### `src/hooks/`
- Contains custom React hooks (`useTasks.ts`, `useHabitStore.ts`, `useWorkspace.ts`, etc.) that abstract away complex business logic from the components.

### `src/lib/`
- `supabase.ts`: Initializes the Supabase client.
- `types.ts`: Centralizes TypeScript interfaces for Tasks, Habits, Workspaces, etc.
- `db.ts`: Raw database utility functions (often wrapped by Contexts).
- `recurring-engine.ts`: Pure functions for parsing and generating recurring tasks.
- `sound.ts` / `pomodoroSound.ts`: Audio utilities.

### `src/pages/`
- `Index.tsx`: The default route (`/`). Displays the Eisenhower Matrix.
- `Dashboard.tsx`: The `/dashboard` route. Displays the Habit Tracker and charts.
- `Login.tsx`: The `/login` route. Handles authentication.
- `NotFound.tsx`: Fallback 404 page.
