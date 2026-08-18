# Habit System

## Overview
The Habit System (referred to as "HabitGame" in the UI) tracks daily recurring actions. It provides a visual calendar, streak tracking, and analysis graphs to motivate users.

## File Dependencies
- `src/lib/habit-store.ts`: Core hooks and data processing.
- `src/pages/Dashboard.tsx`: The primary interface for viewing and modifying habits.

## Architecture

Unlike tasks which are flat arrays, habits are structured hierarchically by month to optimize rendering and state management.

### Store Structure (`HabitsStore`)
```typescript
{
  "theme": "dark",
  "months": {
    "2026-07": {
      "habits": [
        { "id": "123", "name": "Gym", "emoji": "💪" }
      ],
      "days": {
        "14": {
          "checks": { "123": true },
          "mood": 4,
          "sleep": 7.5,
          "notes": "Felt good today"
        }
      }
    }
  }
}
```

### Hook: `useHabitStore(year, month)`
This hook acts as a specialized wrapper around `SyncContext`. It requests the exact month's data tree.
- **Seeding:** If a new month is opened and it doesn't exist, the hook finds the *previous* month's habit list and seeds the new month with those habits, ensuring continuity.
- **Safety Rule:** Seeding *only* occurs if `SyncContext.isInitialized` is true to prevent overwriting server data with default data before it has loaded.

### Mutation Methods
- `toggleCheck(habitId, dayNumber)`: Toggles the boolean state.
- `addHabit / updateHabit / deleteHabit`: Modifies the `habits` array for that specific month.
- `setDayMeta`: Updates mood, sleep, or notes for a specific day.

### Analytics (`computeStats`)
A pure function exported from `habit-store.ts` that calculates:
- `completed`: Total checks across the month.
- `pct`: Overall completion percentage.
- `longestStreak`: Longest consecutive run of days where *all* habits were checked.
- `currentStreak`: Current active run of perfect days leading up to today.

## Dashboard UI (`Dashboard.tsx`)
A highly responsive, grid-based dashboard utilizing:
- **Recharts** for plotting daily progress and wellness metrics (mood/sleep).
- A **Table/Matrix** representing the days of the month (columns) and habits (rows).
- Local state hooks to manage appearance settings (e.g., Accent Color, Card Size) stored in the `settings.habitgame` object.
