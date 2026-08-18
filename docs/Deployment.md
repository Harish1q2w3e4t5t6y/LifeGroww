# Deployment

## Overview
The application is currently designed to be deployed on **Vercel**, taking advantage of their seamless Vite integration and edge network.

## Configuration
The `vercel.json` file in the root directory handles the routing configuration for the Single Page Application (SPA).

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
This configuration ensures that if a user directly navigates to `https://app.com/dashboard`, Vercel serves the `index.html` file, allowing React Router to take over and render the correct view, preventing 404 errors.

## Build Process
The build process is managed by Vite.
- `npm run build` triggers `tsc -b && vite build`.
- It compiles the TypeScript code, bundles the CSS, and outputs the production-ready assets into the `dist/` folder.

## Environment Variables
The production deployment on Vercel requires the same environment variables as local development:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These must be set securely in the Vercel project dashboard.
