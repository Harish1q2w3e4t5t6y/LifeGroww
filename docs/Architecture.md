# Architecture

## Overview
LifeGroww is a single-page application (SPA) built with React and Vite. It is designed as an **Offline-First** productivity platform. The application combines an Eisenhower Matrix for task management, a Habit Tracker ("HabitGame"), a Pomodoro timer, and a recurring task engine.

## Core Tech Stack
- **Frontend Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS + custom CSS for dynamic themes (Light/Dark mode and accent colors)
- **UI Components:** Shadcn UI (Radix UI primitives)
- **Routing:** React Router DOM
- **Backend / Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (Email/Password & Google OAuth)
- **Drag & Drop:** `@dnd-kit/core`
- **Charts:** Recharts

## Architectural Paradigm: Local-First Data Flow

The most critical architectural decision in LifeGroww is its **Local-First Synchronization Strategy**.

1. **State as the Source of Truth:** The application state lives in React Contexts (`SyncContext.tsx` and `AuthContext.tsx`).
2. **Immediate UI Updates:** When a user performs an action (e.g., checks a habit, moves a task), the React state is updated *immediately*. There is no waiting for a server response to reflect UI changes.
3. **Local Storage Fallback:** Every state mutation is simultaneously saved to the browser's `localStorage` and marked with a `dirty` flag.
4. **Background Sync:** A sync engine observes the `dirty` flags. If the user is online, it pushes the entire state payload to Supabase. If the push fails or the user is offline, the sync engine enters a retry loop, periodically attempting to flush the pending operations until successful.

## Workspaces
Data is virtually partitioned into "Workspaces" (`personal` and `professional`). This partition is entirely handled on the client side. The global `tasks` object contains arrays for each workspace, allowing the UI to quickly switch or merge views without additional network requests.

## Component Hierarchy Strategy
- **Context Providers:** Wrap the entire app (`AuthProvider`, `SyncProvider`) to provide global access to the current user session and their entire productivity dataset.
- **Pages:** Top-level route components (`Index.tsx` for the Matrix, `Dashboard.tsx` for Habits, `Login.tsx`).
- **Hooks:** Business logic is heavily extracted into custom hooks (`useTasks`, `useHabitStore`, `useAppSettings`) to keep components clean.
- **Smart UI:** Components like `PomodoroTimer` and `SyncStatusIndicator` subscribe directly to their required contexts/hooks and manage their own lifecycles.
