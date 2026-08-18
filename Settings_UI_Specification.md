# Settings Module UI Specification

This document provides a comprehensive UI specification for recreating the Settings module in a React Native mobile application, based on the website's layout configuration and app configuration parameters.

---

## 1. Screen Architecture

### Complete Component Tree
```
SettingsScreen (Screen Container)
├── Header
│   ├── Back Button (ArrowLeft icon to return to previous page)
│   └── Settings Title Text
├── Scrollable Settings List
│   ├── Profile Section (User branding indicator, email display)
│   ├── Theme Configuration Row
│   │   ├── Light Mode Select button
│   │   └── Dark Mode Select button
│   ├── Accent Colors Selection Grid
│   │   └── Color swatches grid (Blue, Green, Purple, Orange, Red)
│   ├── Workspace Defaults Section
│   │   ├── Default workspace select dropdown (Personal / Professional / All)
│   │   └── Show Completed Tasks toggle checkbox
│   ├── Focus / Pomodoro Configuration Row
│   │   ├── Focus duration input (minutes)
│   │   └── Break duration input (minutes)
│   ├── Backup & Sync Section
│   │   ├── Cloud database sync trigger (Sync StatusIndicator details)
│   │   └── Backup Export json trigger button
│   ├── About Info Section (Version strings, description metadata)
│   └── Logout Action Row
└── Confirmation Overlay (Signout modal panel)
```

### Layout Hierarchy
- **Parent Wrapper**: Flexbox container (`flex flex-col`), fills device screen height (`h-screen`).
- **Main View**: Scrollable options panel (`flex-1 overflow-y-auto`).
- **Section Order**:
  1. Header Bar
  2. Profile / Account info
  3. UI Appearance (Theme mode, Accent color)
  4. Matrix & Tasks Defaults (Workspace segment choice, show completed tasks)
  5. Pomodoro Customizations (Focus/Break durations)
  6. Data Backup & Sync Actions
  7. About Metadata Information
  8. Sign Out action block (Bottom)

---

## 2. Visual Design

- **Colors**:
  - Background HSL: Light: `hsl(40 33% 97%)` | Dark: `hsl(224 30% 8%)`.
  - Panel / Row Card backgrounds: `oklch(0.20 0.006 260)`.
  - Accent Color Meta swatch highlights.
- **Theme**: Light Mode / Dark Mode buttons.
- **Typography**:
  - Header Title: `font-bold text-lg`.
  - Section Headers: `text-[10px] uppercase tracking-wide text-muted-foreground`.
  - Option Labels: `font-medium text-xs`.
- **Padding & Margins**:
  - Inner padding: `p-3` (12px) or `p-4` (16px).
  - Row item vertical margin: `mb-2` (8px).
- **Border Radius**:
  - Main containers: `rounded-lg` (14px).
  - Swatches, inputs, toggles: `rounded-md` (12px) or circular (`rounded-full`).
- **Shadows**:
  - Base shadow: `shadow-sm`.
  - Dialog details: `shadow-xl`.

---

## 3. Complete UI Breakdown

### Profile Section
- Display card showing profile photo placeholder and email address.

### Theme Selector
- Row button selector displaying Sun (Light mode) and Moon (Dark mode) controls. Active option displays highlighted borders (`border-primary bg-primary/10`).

### Accent Colors Grid
- Displays 5 circular color selection buttons (Blue, Green, Purple, Orange, Red) with outline selections (`border-foreground scale-110`) when selected.

### Workspace & Matrix Defaults
- Selector default workspaces.
- Checkbox to toggle completed task views (`showCompleted`).

### Pomodoro Settings
- Input fields to adjust standard focus and break times (synced dynamically with database storage settings).

### Backup & Cloud Sync Actions
- Display panel showing last successful sync timestamp, listing pending changes queue.
- Button to trigger backup downloads.

### About Section
- Simple labels showing application version numbers and developer links.

### Logout Card
- Destructive highlight row button triggers session logout.

---

## 4. Component Details

- **`AppSettingsButton`**: Main settings drawer popover rendering options controls.
- **`SyncStatusIndicator`**: Sync panel detailing cloud statuses.

---

## 5. Animations

- **Selection scales**: Swatch icons scale up slightly (`scale-110`) on tap.
- **Transitions**: Slide in list panels.

---

## 6. Colors

- Dark base canvas: `oklch(0.16 0.005 260)`
- Light base canvas: `oklch(0.99 0.003 260)`
- Swatch HSL hex codes:
  - Blue: `hsl(220 60% 50%)`
  - Green: `hsl(150 60% 42%)`
  - Purple: `hsl(265 60% 55%)`
  - Orange: `hsl(25 90% 55%)`
  - Red: `hsl(0 75% 55%)`

---

## 7. Icons

- Lucide list: `Settings`, `Sun`, `Moon`, `RotateCcw`, `Check`, `ArrowLeft`, `LogOut`, `Download`, `Cloud`.

---

## 8. Responsive Behaviour

- **Desktop**: Renders as a popover overlay in the corner.
- **Mobile/Tablet**: Full screen configurations view page.

---

## 9. Mobile Adaptation

- **Popovers & Triggers**: Transformed from overlay popup boxes into clean full-screen pages or native bottom-drawer sheets.
- **Export backup**: On Android, download triggers open system DocumentProvider download file picker intents.

---

## 10. React Native Mapping

- Recreate rows using list layouts.
- Accent swatches: TouchableOpacity circles with custom style colors.
- Theme switching: Integrated with system appearance states.

---

## 11. Assets

- **Icons**: SVG assets.
- **Fonts**: Geist custom font.

---

## 12. Final Checklist

- [ ] Background changes based on theme: `oklch(0.16 0.005 260)` (dark) or `oklch(0.99 0.003 260)` (light).
- [ ] Theme toggles between Light/Dark mode.
- [ ] Accent color selection updates layout highlights.
- [ ] Completed tasks visibility checkbox saves settings state.
- [ ] Pomodoro session settings configure default durations.
- [ ] Sync status lists errors and logs out users correctly.
