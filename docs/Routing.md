# Routing

## Overview
Routing in LifeGroww is handled by `react-router-dom`. The application is a Single Page Application (SPA), meaning navigation between the Matrix and the Dashboard happens entirely client-side without page reloads.

## File Dependencies
- `src/App.tsx`: The main router configuration.
- `src/components/ProtectedRoute.tsx`: Route guard logic.

## Routes
```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

## Route Guard (`ProtectedRoute.tsx`)
The `ProtectedRoute` component wraps all authenticated pages.
1. It consumes the `AuthContext`.
2. If `loading` is true, it returns `null` (or a spinner).
3. If `!isConfigured`, it assumes the user is in "Offline Mode" and renders the children regardless.
4. If `!user`, it redirects the user to `/login`.
5. If authenticated, it renders the `children`.

## Navigation Patterns
- Links between `/` and `/dashboard` are implemented using the `<Link>` component from `react-router-dom` to preserve the React Context state across views.
