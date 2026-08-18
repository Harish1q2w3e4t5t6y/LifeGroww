# Home Dashboard UI Specification

This document provides a comprehensive UI specification for recreating the Home Dashboard screen in a React Native mobile application, based on the website's unified design tokens and layouts.

---

## 1. Screen Architecture

### Complete Component Tree
```
HomeDashboard (Screen Container)
├── Header
│   ├── User Branding Display & Greeting ("Hello, User")
│   └── Mobile Workspace Cycler (Cycles through Personal / Professional / Both)
├── Statistics Summary Row
│   ├── Goal Tracker Metric Card
│   ├── Completion Ratio Card
│   └── Daily Consistency Card
├── Quick Actions Grid
│   ├── Add Task Button
│   ├── Start Focus Timer Button
│   └── Log Habits Button
├── Focus Status Card (Compact Pomodoro Timer Preview)
│   ├── Mode Status Indicator (Focus / Break)
│   ├── Timer Display (MM:SS)
│   └── Mini Play/Pause Controls
├── Today's Tasks Overview (Previews from Eisenhower Matrix Q1/Q2)
│   ├── Section Header (Urgent & Important Tasks)
│   └── Task Item List (Custom Task Rows)
├── Habits Preview Section (Mini habit metrics checklist)
│   ├── Progress Percentage bar
│   └── Habit List Items (Horizontal Checklist)
└── Shortcut Footer Bar
    ├── Calendar Shortcut Button
    ├── Search Shortcut Button
    └── Notifications Settings Shortcut
```

### Layout Hierarchy
- **Parent Wrapper**: Vertical Flexbox container (`flex flex-col`), fills device screen, dynamic height spacing (`100dvh`).
- **Main Scroll Area**: Scrollable content container containing all widgets.
- **Section Order**:
  1. Top Branding Header (Fixed)
  2. Greeting & Workspace Selector
  3. Statistics Overview Cards (Horizontal sliding row)
  4. Focus Session Card (Dynamic timer display)
  5. Today's Urgent Tasks Checklist
  6. Habits Tracker Progress Summary
  7. Bottom Navigation Shortcut Footer

---

## 2. Visual Design

- **Colors**:
  - Background: Dark Mode: `oklch(0.16 0.005 260)` | Light Mode: `oklch(0.99 0.003 260)`.
  - Panel Backgrounds: `oklch(0.20 0.006 260)` (uniform across themes, border: `1px solid rgba(255,255,255,0.1)`).
- **Theme**: Unified theme transitions matching system appearance settings (Light / Dark mode).
- **Typography**:
  - Fonts: `Geist, ui-sans-serif, system-ui, sans-serif`.
  - Header Title: `font-bold text-lg` to `text-xl` (18px–20px).
  - Metric Values: `font-semibold text-2xl` with monospaced numbers.
- **Padding & Margins**:
  - Container Padding: `p-4` (16px) standard spacing.
  - Item spacing: `gap-3` (12px) between card panels.
- **Border Radius**:
  - Panel containers: `rounded-lg` (14px).
  - Shortcut items and buttons: `rounded-md` (12px).
- **Shadows**:
  - Card Shadow: Subtle depth shadows matching `--shadow-card`.
- **Card Sizes**:
  - Standard cards expand horizontally to fill container width, with variable heights matching content details.
- **Icons**: Lucide icon system (sizes set uniformly to `14px` / `h-3.5 w-3.5`).

---

## 3. Complete UI Breakdown

### Header & Greeting
- Left-aligned text welcoming the user ("Hello, Harish") with a dynamic timestamp greeting (Morning/Afternoon).
- Right-aligned branding cycler displaying the current workspace status indicator.

### Workspace Switcher
- Segmented button control cycles between "Personal" (Home icon), "Professional" (Briefcase icon), and "Both" (Layers icon). Updates background theme hues instantly.

### Dashboard Stats Row
- Horizontal carousel displaying three stats cards: Goal Target Progress, Completion Ratio, and consistency index.

### Quick Actions Grid
- Row of three quick-tap button elements: "New Task", "Start Focus", and "Log Habits", which directly deep-link to those modules.

### Focus Widget Card
- A preview of the Pomodoro timer. Displays "Focus" or "Break" state, running timer countdown, and quick controls (Start, Pause, Reset).

### Today's Tasks Preview
- Renders up to 3 highest priority tasks from Quadrant 1 (Do). Clicking a task opens the Tasks view.

### Habits Preview Card
- Shows progress percentage and horizontal checklist items of habits for today.

### Navigation Shortcut Footer
- Thin layout containing links to Calendar, Search, and Notifications menus.

---

## 4. Component Details

- **`HomeDashboard`**: The main page shell containing scrolling layouts.
- **`Panel`**: Base layout card component.
- **`PomoTimerCard`**: Mini-instance of the Pomodoro widget showing state and countdown indicators.
- **`StatsCard`**: Individual summary cards displaying numeric statistics.
- **`TaskCardPreview`**: Minimal task row containing checkbox and title text.

---

## 5. Animations

- **Slide in Transitions**: Dashboard widgets fade and slide up slightly when loading.
- **Donut Progress Animations**: SVG circles scale based on progress.
- **State Changes**: Tapping buttons triggers scale animations (`active:scale-95`).

---

## 6. Colors

- Canvas Dark: `oklch(0.16 0.005 260)`
- Canvas Light: `oklch(0.99 0.003 260)`
- Card Containers: `oklch(0.20 0.006 260)`
- Border stroke: `border-white/10`
- Dynamic Accent color values.

---

## 7. Icons

Uses Lucide icons: `Briefcase`, `Home`, `Layers`, `Plus`, `Play`, `Pause`, `Calendar`, `Search`, `Bell`, `Flame`, `Zap`, `Check`.

---

## 8. Responsive Behaviour

- **Desktop**: Grid organization containing multiple sections side-by-side.
- **Tablet/Mobile**: Single vertical scrolling flow, statistics cards organized as horizontal sliding rows.

---

## 9. Mobile Adaptation

- **Hover States**: Removed entirely. Focus highlights are visible on selection.
- **Menu Popovers**: Replaced with clean Native bottom sheets or modal layouts.
- **Horizontal lists**: Swipeable lists handle task reorder or workspace changes.

---

## 10. React Native Mapping

- Recreate layout grid structures using `<View>` with flex wrap parameters.
- Handle lists using `<FlatList>` and `<ScrollView>` elements.
- Recreate SVG components using `react-native-svg`.

---

## 11. Assets

- **Icons**: Lucide SVG items.
- **Fonts**: Custom Geist font asset bundles.
- **Sounds**: Completion alerts.

---

## 12. Final Checklist

- [ ] Dark background maps to `oklch(0.16 0.005 260)`, light maps to `oklch(0.99 0.003 260)`.
- [ ] Card panels use background `oklch(0.20 0.006 260)` with 14px borders.
- [ ] Workspace switcher cycles personal/professional/all options.
- [ ] Today's tasks are fetched correctly from Q1.
- [ ] Habits preview checklist reflects current day logs.
- [ ] Focus card runs in sync with global Pomodoro timer.
