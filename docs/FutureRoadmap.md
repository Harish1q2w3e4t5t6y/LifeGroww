# Future Roadmap

This document outlines the architectural support needed for planned future features.

## 1. Voice Notes & Attachments
- **Current State:** Tasks only support string titles and string descriptions.
- **Required Architecture:**
  - Supabase Storage buckets need to be provisioned.
  - The `Task` interface needs a new `attachments` array (`{ type: "image" | "audio", url: string }`).
  - Mobile App integration: React Native `expo-av` for audio recording and `expo-image-picker` for camera access.

## 2. Native Mobile Application
- **Current State:** The app is a responsive website.
- **Required Architecture:**
  - Transition to a Monorepo structure (`apps/web`, `apps/mobile`, `packages/shared`).
  - The React Native app must implement a true SQLite local database (e.g., WatermelonDB) to replace the browser's `localStorage` for the offline-first sync engine.

## 3. Biometric Login & Secure Workspaces
- **Current State:** Authentication relies purely on the session token.
- **Required Architecture:**
  - Implement `expo-local-authentication` on the mobile app.
  - Add a flag to the `settings` JSON: `requireBiometricsForProfessionalWorkspace: true`.

## 4. Calendar Integration (Google/Apple)
- **Current State:** Deadlines are internal.
- **Required Architecture:**
  - Supabase Edge Functions. When a task with a deadline is pushed to the database, an Edge Function fires, authenticates via the user's OAuth tokens, and pushes the event to Google Calendar via their API.

## 5. AI Assistant
- **Current State:** Manual data entry.
- **Required Architecture:**
  - A new chat interface. User types "Remind me to call John tomorrow at 5pm and sort it as important".
  - Send the prompt to a Supabase Edge Function running an LLM (e.g., OpenAI/Gemini).
  - The LLM returns a structured JSON payload matching the `Task` interface, which the client then injects into the `SyncContext` and saves.

## 6. Widgets (iOS/Android)
- **Current State:** None.
- **Required Architecture:**
  - React Native app must use Expo Config Plugins to write native Swift/Kotlin widget code.
  - The native widget must be able to read the local SQLite database created by the main app to display the habits and tasks without needing to wake up the React Native javascript thread.
