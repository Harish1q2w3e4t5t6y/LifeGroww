# Known Limitations & Risks

## 1. Sync Engine Race Conditions
The offline-first architecture relies on a "Last Write Wins" JSON blob update.
- **Risk:** If a user has the app open on their phone (offline) and their laptop (online), makes changes on both, and then the phone connects to the internet, the phone will overwrite the laptop's changes completely.
- **Improvement:** Implementing a true CRDT (Conflict-free Replicated Data Type) or operational transformation system, or splitting the `tasks` and `habits` JSONB columns into individual relational rows with their own `updated_at` timestamps for granular merging.

## 2. File Size Limitations
The entire state (all tasks, all habits for all months) is loaded into memory on boot.
- **Limitation:** For a user who has used the app for 5 years, the `habits` JSON object will become massive. This increases the payload size for every sync operation, eventually causing performance degradation and potential Supabase API limits.
- **Improvement:** Implement pagination or archiving. The `SyncContext` should only pull the current and previous month's habit data, and active tasks. Completed tasks older than 30 days should be moved to a cold-storage table.

## 3. Lack of True Push Notifications
Currently, reminders (Deadline watchers and Pomodoro completion) only trigger if the web app tab is actively open in the browser.
- **Limitation:** Users will not receive a notification on their phone if the app is closed.
- **Improvement:** Integration with Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNs) via a native mobile app, or implementing standard Web Push API Service Workers.

## 4. Single Point of Failure in `SyncContext`
The `SyncContext.tsx` file is over 600 lines long and handles reading, writing, scheduling, and conflict resolution.
- **Limitation:** High technical debt. It is difficult to unit test effectively.
- **Improvement:** Refactor `SyncContext` by extracting the network logic, the `localStorage` caching logic, and the recurring-task injection logic into separate, testable service classes.
