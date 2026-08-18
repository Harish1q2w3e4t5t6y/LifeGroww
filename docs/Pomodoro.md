# Pomodoro Timer

## Overview
The Pomodoro timer is a self-contained feature built into the main header of the matrix view (`Index.tsx`). It helps users focus using the traditional Pomodoro technique (Focus, Short Break, Long Break).

## File Dependencies
- `src/components/PomodoroTimer.tsx`: The entire UI and timer logic.
- `src/lib/pomodoroSound.ts`: Audio handling logic.

## Architecture & Logic

### Local State (`useState` & `useRef`)
The component manages its own lifecycle using React hooks. It does not synchronize timer state to Supabase, meaning a timer running on the web will not display on a mobile device.

- `timeLeft`: Integer representing seconds remaining.
- `isActive`: Boolean indicating if the timer is ticking.
- `mode`: `"pomodoro" (25m) | "shortBreak" (5m) | "longBreak" (15m)`
- `sessionCount`: Tracks how many Pomodoros have been completed to determine when to trigger a long break.

### The Timer Loop
- A `useEffect` watches the `isActive` and `timeLeft` variables.
- If active, it creates a `setInterval` that decrements `timeLeft` by 1 every 1000ms.
- When `timeLeft` hits 0, the interval is cleared, an audio chime is triggered (`playTimerComplete()`), and the system automatically advances to the next mode (e.g., Focus -> Short Break).

### Audio and Settings
- Sounds are handled via the Web Audio API or HTML5 Audio elements.
- The user can toggle sounds on/off via the `SoundSettings.tsx` component, which stores preferences in `localStorage`.
- The volume and sound enabled status are checked right before `playTimerComplete()` is invoked.

## Interaction
The timer operates via a Popover. The user clicks a clock icon in the top navigation bar, which expands into a full control panel (Play/Pause, Reset, Skip, and manual mode selectors).
