# Android Preparation Guide (React Native)

This document is the master blueprint for building a dedicated Android application (using React Native + Expo) that perfectly synchronizes with the existing LifeGroww web application.

> [!IMPORTANT]
> The Android app must NOT be a web view. It must be a completely native UI that shares only the backend logic and data structures with the web app.

## 1. Monorepo Setup (Prerequisite)
Before building the mobile app, the current project must be restructured into a monorepo (e.g., using Turborepo). 

Expected structure:
- `apps/web` (The current project)
- `apps/mobile` (The new React Native Expo project)
- `packages/shared-types`
- `packages/sync-engine`

## 2. Shared Data Structures
The Android app MUST use the exact same JSON data structures to communicate with Supabase.

### The Supabase Payload
The app will read/write to the `user_data` table. The payload is exactly:
```typescript
{
  user_id: string,
  tasks: { personal: Task[], professional: Task[] },
  habits: { theme: string, months: Record<string, MonthData> },
  settings: { appSettings: object, workspace: string, theme: string, recurringConfigs: RecurringConfig[] }
}
```

## 3. The Offline-First Sync Engine (Mobile Translation)
The web app's `SyncContext.tsx` uses `localStorage`. The Android app must implement the same "Last Write Wins" logic using a mobile-optimized local database.

### Requirements for Mobile Sync:
1. **Local Database:** Use **WatermelonDB** or **Expo SQLite**. Do NOT use `AsyncStorage` for the main data payload, as the JSON objects will eventually become too large for async storage limits.
2. **Offline Mutation Queue:** If the phone is offline, state changes must be written to the local SQLite DB and marked with a `dirty` flag.
3. **Background Worker:** Use `expo-background-fetch` and `expo-task-manager` to periodically attempt to flush the `dirty` data to Supabase, even when the app is minimized.
4. **Safety Guard:** Port the defensive logic from `updateHabits` (see Web `SyncContext.tsx`). The mobile app MUST refuse to upload an empty `habits.months` object if the server previously had data.

## 4. Mobile User Interface Guidelines
The mobile app must feel distinctly native.

- **Navigation:** Use **Expo Router**. Implement a native Bottom Tab Navigator (Tabs: Matrix, Habits, Settings) instead of the web's header/sidebar layout.
- **Gestures:** Use `react-native-reanimated` and `react-native-gesture-handler`. 
  - Tasks in the Matrix should be swiped left to delete, and swiped right to complete.
- **Modals:** Use native Bottom Sheets (e.g., `@gorhom/bottom-sheet`) for task editing and the Pomodoro timer, rather than centered web dialogs.
- **Inputs:** Use the native Android/iOS date and time pickers.

## 5. Feature Implementation specifics

### The Eisenhower Matrix
- Instead of showing all four quadrants on screen at once (which is too cramped on a phone), default to showing "Q1: Do" and allow the user to swipe horizontally (Tab View) between the four quadrants, or use a list view grouped by quadrant.

### Habit Tracker
- The large monthly grid from the web dashboard will not fit on a phone screen.
- **Mobile Design:** Show a horizontal scrolling strip for the days of the week at the top. Below it, show a vertical list of habits for the selected day. Tapping the habit toggles the checkbox.

### Recurring Tasks Engine
- The pure functions in `src/lib/recurring-engine.ts` (e.g., `generateScheduledTasks`, `syncTaskCompletionToHabits`) are completely platform-agnostic. They MUST be extracted to a shared package and imported directly into the React Native app. 
- The Android app must run `generateScheduledTasks` locally on startup just like the web app.

### Notifications
- **Web App:** Uses browser `setInterval` for deadlines.
- **Android App:** Must use `expo-notifications`. When a task with a `dueDate` is created, the Android app must schedule a local push notification for that exact time.

## 6. Development Roadmap for AI/Developer
1. **Extract Types:** Move `src/lib/types.ts` to a shared package.
2. **Extract Logic:** Move `recurring-engine.ts` to a shared package.
3. **Init Expo:** Create the `apps/mobile` Expo project.
4. **Auth:** Implement Google Sign-In using `expo-auth-session` connecting to the same Supabase project.
5. **Database Sync:** Implement the SQLite sync engine replicating `SyncContext.tsx`.
6. **UI:** Build the Bottom Tabs, Task List, and Habit screen.
