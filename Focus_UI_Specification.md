# Focus Module UI Specification

This document provides a comprehensive UI specification for recreating the Focus / Pomodoro module in a React Native mobile application, based on the website's layout configuration and subcomponents.

---

## 1. Screen Architecture

### Complete Component Tree
```
FocusScreen (Screen Container)
├── Header
│   ├── Back Button (ArrowLeft icon to return to Matrix)
│   └── Focus Dashboard Title Text
├── Main Content Scroll Container
│   ├── Active Timer Card (Pomodoro Widget)
│   │   ├── Status Label indicator ("Focus" or "Break" mode text)
│   │   ├── Countdown Numeric Display (MM:SS)
│   │   └── Control Buttons (Play/Pause, Reset, Mute/Unmute, Settings Trigger)
│   ├── Analytics Progress Rings (Session goals visual gauges)
│   │   ├── Today's Complete Sessions Gauge
│   │   └── Current Streak Counter display
│   ├── Focus Metrics Grid (Statistics summary)
│   │   ├── Total Focus Time (hours)
│   │   ├── Focus Sessions completed
│   │   └── Average focus duration card
│   └── Focus History List (Recent logs timeline)
│       ├── History Header (Summary count)
│       └── Log List Items (Session dates, duration details, completion status)
└── Settings Popover (Inline durations customization panel)
```

### Layout Hierarchy
- **Parent Wrapper**: Vertical Flexbox container (`flex flex-col`), fills device screen height (`h-screen`).
- **Scroll Container**: Content block allowing vertical scrolling of analytics list (`flex-1 overflow-y-auto`).
- **Section Order**:
  1. Header Bar
  2. Large Focus Timer Card (Centerpiece)
  3. Interactive Controls Row (Play, Pause, Reset, Sound toggle, duration configurations)
  4. Quick Session Statistics (Today vs All-time metrics cards)
  5. Focus Session History list (Timeline of recent sessions)

---

## 2. Visual Design

- **Colors**:
  - Background HSL: Light: `hsl(40 33% 97%)` | Dark: `hsl(224 30% 8%)`.
  - Panel Backgrounds: `oklch(0.20 0.006 260)` (uniform across themes, border: `1px solid rgba(255,255,255,0.1)`).
  - Active Focus mode state color: White/Foreground.
  - Active Break mode state color: Primary Accent color.
- **Theme**: Dark and Light modes. Accent color customizations adapt the visual highlight borders and text headers dynamically.
- **Typography**:
  - Timer Digits: `font-mono tabular-nums text-4xl` (large layout for mobile main view), bold.
  - State Label: `font-semibold text-sm` uppercase.
- **Padding & Margins**:
  - Card outer bounds: `p-3` (12px) or `p-4` (16px) standard padding.
  - Items spacing: `gap-1.5` (6px) or `gap-2` (8px).
- **Border Radius**:
  - Panel cards: `rounded-lg` (14px).
  - Controls, inputs, popovers: `rounded-md` (12px).
- **Shadows**:
  - Base shadow: `shadow-sm`.
  - Floating panels: `shadow-xl`.

---

## 3. Complete UI Breakdown

### Pomodoro Timer Widget
- Compact container integrating all controls:
  - Flex row containing:
    - Mode Indicator: "Focus" (standard color) or "Break" (accent color) label text.
    - Countdown timer: `MM:SS` formatted characters.
    - Control triggers container: Plays audio ticks, toggles mute states, toggles play/pause, resets timer values, opens configuration menu.

### Dynamic Session Ring
- Circular layout showing percentage progress of current Focus session (custom path rendering).

### Statistics Widgets
- Metrics cards summary containing total completed sessions, today's targets, current focus streaks, and average sessions daily.

### Focus History Timeline
- Simple list rendering completed focus logs. Show dates, duration (e.g. 25m focus), and checkboxes indicating successful completion.

---

## 4. Component Details

- **`PomodoroTimer`**: Core widget handling timer state, localStorage sync, Supabase replication, sound toggles, and duration updates.
- **`Panel`**: Base container card.

---

## 5. Animations

- **Hover expansion**: Controls layout transitions from collapsed size `max-w-0` to expanded width `max-w-[10rem]` and fades from `opacity-0` to `opacity-100` when hovering/focusing inside container.
- **Circular progress**: The SVG path updates its stroke-dashoffset value smoothly.

---

## 6. Colors

- Dark base canvas: `oklch(0.16 0.005 260)`
- Light base canvas: `oklch(0.99 0.003 260)`
- Card boundary: `oklch(0.20 0.006 260)`
- Accent values.

---

## 7. Icons

- Lucide list: `Play`, `Pause`, `RotateCcw`, `Volume2`, `VolumeX`, `Settings`, `ArrowLeft`.

---

## 8. Responsive Behaviour

- **Desktop Layout**: Collapsed timer sits inside header toolbar. Focus analytics cards display side-by-side in main view.
- **Mobile Layout**: Enlarged centered layout, actions visible by default.

---

## 9. Mobile Adaptation

- **Action controls visibility**: Always display control buttons.
- **Timer Settings**: Convert the settings popover dropdown to an elegant bottom sheet.
- **Alert sounds**: Connect timer chimes to mobile system audio notifications, and configure standard local OS alerts when a session completes in the background.

---

## 10. React Native Mapping

- Recreate layout grids using `<View>` with flex wrap.
- Build progress rings using `react-native-svg` `<Circle>` component with offset animations.
- Integrate sound chimes using `react-native-sound`.

---

## 11. Assets

- **Icons**: SVG assets.
- **Fonts**: Geist custom font.
- **Sounds**: Pomodoro focus end and break end chimes (`workEndSound`, `breakEndSound`).

---

## 12. Final Checklist

- [ ] Background changes based on theme: `oklch(0.16 0.005 260)` (dark) or `oklch(0.99 0.003 260)` (light).
- [ ] Timer digits use a clean monospaced layout (`font-mono tabular-nums`).
- [ ] Controls support play, pause, reset, mute, and settings popups.
- [ ] Focus durations and break durations can be customized.
- [ ] System triggers chimes on focus/break completions.
- [ ] History records list updates correctly.
