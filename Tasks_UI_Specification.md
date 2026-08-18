# Tasks Module UI Specification

This document provides a comprehensive UI specification for recreating the Tasks module (Eisenhower Matrix screen) in a React Native mobile application, based on the website's layout configuration and subcomponents.

---

## 1. Screen Architecture

### Complete Component Tree
```
TasksScreen (Screen Container)
├── Header
│   ├── Logo / Cycling Button (Branding gradient "E")
│   ├── Workspace switcher segmented group (Professional, Personal, All)
│   ├── Theme Toggle button (Moon / Sun)
│   ├── Recurring Task Manager Button (CalendarClock icon)
│   └── Backup Export Button (Download icon)
├── Main Content Wrapper
│   ├── DndContext (Drag & Drop Context)
│   │   ├── Quadrant List Grid (2x2 layout on desktop, 1x4 list on mobile)
│   │   │   ├── Quad 1: Do (Urgent & Important)
│   │   │   ├── Quad 2: Schedule (Important & Not Urgent)
│   │   │   ├── Quad 3: Delegate (Not Urgent & Important)
│   │   │   └── Quad 4: Delete (Not Urgent & Not Important)
│   │   └── DragOverlay (Overlay wrapper for dragged item cloning)
│   └── Grid Divider Lines (Desktop overlay crosshair)
└── RecurringTasksManagerDialog (Recurrence configurations panel)
```

### Layout Hierarchy
- **Parent Wrapper**: Flexbox container (`flex flex-col`), fills device screen height (`h-screen`).
- **Main View**: relative overflow grid container (`flex-1 relative overflow-y-auto md:overflow-hidden`).
- **Section Order**:
  1. Top Navigation & Action Header.
  2. Eisenhower Matrix 2x2 Grid (Urgent & Important first, moving clockwise to Not Important & Not Urgent).
  3. Overlay Grid Divider lines.
  4. Floating overlays (Dragging representations).

---

## 2. Visual Design

- **Colors**:
  - Background HSL: Light: `hsl(40 33% 97%)` | Dark: `hsl(224 30% 8%)`.
  - Quadrant container overlays (applied with 40% transparency):
    - Q1 (Coral): Light: `hsl(8, 80%, 88%)` | Dark: `hsl(8, 45%, 24%)`
    - Q2 (Sky Blue): Light: `hsl(200, 70%, 88%)` | Dark: `hsl(200, 45%, 22%)`
    - Q3 (Amber): Light: `hsl(45, 85%, 86%)` | Dark: `hsl(38, 45%, 22%)`
    - Q4 (Sage): Light: `hsl(140, 45%, 86%)` | Dark: `hsl(140, 30%, 20%)`
  - Task Card backgrounds: Low: green, Medium: yellow, High: red.
- **Theme**: Light Mode / Dark Mode, plus workspace specific overrides (Personal workspace shifts quadrant pastels to pink, lavender, peach, and tealish green).
- **Typography**:
  - Main Quadrant Title: `text-lg` (18px) to `md:text-xl` (20px), bold, tracking tight.
  - Subtitle description: `text-[11px]` (11px) uppercase tracking wide.
  - Task Titles: `text-[13px]` (13px) leading tight.
- **Padding & Margins**:
  - Header padding: `px-3 sm:px-4 py-2`.
  - Quadrants padding: `p-4` (16px).
  - Task cards spacing: `space-y-1.5` (6px) vertical margins.
- **Border Radius**:
  - Dialog boxes and panels: `rounded-lg` (14px).
  - Task Cards and segment buttons: `rounded-md` (12px).
- **Shadows**:
  - Card Shadow: `--shadow-card`.
- **Card Sizes**:
  - Task Card: Variable height padding `px-2 py-1.5` (horizontal 8px, vertical 6px).
- **Icons**: Lucide icons (`h-3.5 w-3.5`).

---

## 3. Complete UI Breakdown

### Toolbar / Header Controls
- Flex header containing workspace indicators, segmentation buttons, theme toggle, and backup actions.

### Workspace Switcher
- Segmented control to select active workspace: "Professional" (Briefcase), "Personal" (Home), or "Show Both" (Layers). Cycles on clicking logo branding.

### Task Filters
- Toggle state in settings (`showCompleted`) filters completed tasks on or off dynamically.

### Quadrant Panel Layout
- Title text showing priority.
- Action "+" button toggles input field.
- Interactive list containing task cards.
- Centered placeholder text (`Drop or add tasks here`) when empty.

### Task Cards details
- Checkbox on the left.
- Task text title.
- Dynamic tags: Status Badge (`Pending`, `In Progress`, `Done`), Overdue warning badge.
- Secondary Actions (Visible on hover on desktop): Priority flag cycles, In Progress zap button, due date clock, edit pencil, and delete X button.

---

## 4. Component Details

- **`Index`**: Core Matrix screen controller.
- **`Quad`**: Individual quadrant wrapper handling `useDroppable` hook.
- **`TaskCard`**: Draggable and sortable individual task item rendering details, popover calendars, and text renaming layouts.

---

## 5. Animations

- **Scale In**: Dialog layouts slide up and scale from `0.96` to `1` over `0.2s`.
- **Fade In**: Task cards slide in over `0.25s` on mount.
- **Check Completed transition**: Grey out opacity scales down to `60%`, strikeout lines animate across text.
- **Drag Tilt**: Hovering clones are rotated `2` degrees.

---

## 6. Colors

- Core HSL colors: `--q1`, `--q2`, `--q3`, `--q4` and respective foregrounds.
- Softer overrides inside `:root.workspace-personal` and `.dark.workspace-personal`.

---

## 7. Icons

- Lucide list: `Plus`, `Check`, `Moon`, `Sun`, `Briefcase`, `Home`, `Layers`, `CalendarClock`, `Download`, `X`, `Pencil`, `Zap`, `Clock`, `Flag`.

---

## 8. Responsive Behaviour

- **Desktop**: 2x2 grid divided by 1px absolute border lines.
- **Mobile/Tablet**: Stacked vertically, grid division overlay is hidden.

---

## 9. Mobile Adaptation

- **Drag and Drop**: React Native Pan gestures replace pointers. Press and hold (150ms) triggers active drag cloning.
- **Card Actions**: Instead of desktop hover visibility, action buttons (edit, delete, calendar) are always visible on card blocks, or moved to horizontal swipe actions (Swipeable Views).
- **Date Picker**: Web datetime popovers are replaced with native React Native DateTimePicker controls.

---

## 10. React Native Mapping

- Quadrant grid rows: flexbox container Views wrapping lists.
- Drag Overlay: Animated absolute Views rendering cloned components.
- Checkboxes: Native components or touchable outlines.

---

## 11. Assets

- **Icons**: SVG assets.
- **Fonts**: Geist custom font.
- **Audio**: Completion sound files.

---

## 12. Final Checklist

- [ ] Background changes based on theme: `oklch(0.16 0.005 260)` (dark) or `oklch(0.99 0.003 260)` (light).
- [ ] 2x2 layout is displayed on desktop, 1x4 layout is shown on mobile.
- [ ] Drag overlays display tilted cloned cards (`rotate-2`).
- [ ] Workspace selection filters cards and dynamically updates colors.
- [ ] Tasks support edit inline, inline deletion, status shifts, and calendar deadlines.
