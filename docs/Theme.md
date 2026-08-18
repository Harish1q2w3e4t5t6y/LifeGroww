# Theme & Appearance

## Overview
LifeGroww supports extensive visual customization, including Dark/Light mode and custom Accent Colors. The theming engine uses a combination of Tailwind CSS classes and inline CSS custom properties (variables) controlled by React State.

## File Dependencies
- `src/hooks/useTheme.ts`: Manages Dark/Light mode.
- `src/hooks/useAppSettings.ts`: Manages the accent color for the main app.
- `src/lib/habit-store.ts`: The Dashboard manages its own independent accent color config.
- `src/index.css`: Defines base variables and Shadcn UI tokens.

## Dark/Light Mode
The theme is a `"dark" | "light"` string stored in the `SyncContext.settings` object (and backed up to `localStorage`).

The `useTheme` hook reads this value and applies the `.dark` class to the `document.documentElement` (`<html>` tag). Tailwind CSS uses this class to apply dark-mode specific utility classes (e.g., `dark:bg-slate-900`).

## Accent Colors

### Global App (`useAppSettings`)
The application defines multiple accent colors:
```typescript
const ACCENT_COLORS = {
  blue: "221 83% 53%",
  green: "142 71% 45%",
  purple: "262 83% 58%",
  orange: "24 95% 53%",
  red: "348 83% 47%",
  pink: "330 81% 60%"
};
```
These are HSL values. When the `useAppSettings` hook mounts or changes, it injects these values directly into the DOM as CSS variables (`--primary`, `--ring`). Shadcn UI components (buttons, inputs) automatically inherit these primary colors.

### Dashboard App (`Dashboard.tsx`)
The Habit Dashboard uses a more complex, inline theming system based on OKLCH colors to achieve a specific "glassmorphism" aesthetic.
- The `accentColor` is stored in `settings.habitgame.accentColor`.
- The root `div` of the Dashboard injects custom CSS properties like `--dashboard-accent`.
- The SVG charts and custom UI elements explicitly reference `var(--dashboard-accent)`.
