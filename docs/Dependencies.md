# Dependencies

## Core Framework
- **`react` & `react-dom`**: The core UI library.
- **`react-router-dom`**: Handles client-side routing between pages.
- **`vite`**: The build tool and development server.
- **`typescript`**: Static typing language.

## Backend & State
- **`@supabase/supabase-js`**: The official client for interacting with the Supabase database and authentication services.
- **`@tanstack/react-query`**: Included in `package.json`, though the primary data fetching relies heavily on `SyncContext`. Used for any supplementary asynchronous fetching.

## UI & Styling
- **`tailwindcss`**: The utility-first CSS framework used for all styling.
- **`lucide-react`**: The icon library used throughout the application (e.g., `<Plus>`, `<Check>`, `<Moon>`).
- **`class-variance-authority` & `clsx` & `tailwind-merge`**: Utility libraries used by Shadcn UI to dynamically merge and construct Tailwind class strings.
- **`@radix-ui/react-*`**: The unstyled, accessible UI primitives that power the Shadcn UI components (Dialogs, Popovers, Tabs).
- **`next-themes`**: Used for managing Dark/Light mode classes.
- **`sonner` & `@radix-ui/react-toast`**: Used for displaying non-blocking notifications and error messages.

## Features
- **`@dnd-kit/core` & `@dnd-kit/sortable`**: The robust drag-and-drop library powering the task movement between the Eisenhower quadrants.
- **`recharts`**: The charting library used in `Dashboard.tsx` to render the daily progress bar/line charts and the wellness line charts.
- **`date-fns`**: Utility library for parsing and manipulating dates (used heavily in the recurring engine).
