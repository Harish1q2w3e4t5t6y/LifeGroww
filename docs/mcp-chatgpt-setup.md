# Lifegrow MCP server: connect ChatGPT to your tasks and habits

The site now includes an MCP server at **`https://<your-site>/mcp`**. Once it's
deployed and connected, ChatGPT can read and change your Eisenhower Matrix tasks
and habits for you ("add 'call the bank' to Do", "what's left in Schedule?",
"tick Gym for today").

## What ChatGPT can do (tools)

| Tool | What it does |
|---|---|
| `list_tasks` | Lists tasks with their ids. Filter by workspace, box (q1–q4) or open/done. Read-only. |
| `add_task` | Adds a task to a box (q1 Do, q2 Schedule, q3 Delegate, q4 Delete) in the personal or professional workspace. |
| `update_task` | Renames a task, moves it between boxes or workspaces, or changes its priority, due date, description or status. |
| `complete_task` | Marks a task done (or not done). Linked recurring tasks also tick their habit. |
| `delete_task` | Removes a task. Marked destructive, so ChatGPT asks before running it. |
| `get_habits` | Shows a day's habits and which are done. Read-only. |
| `check_habit` | Ticks or unticks a habit for a day. A linked recurring task is completed too. |

ChatGPT can't change your settings, recurring schedules or habit list, and it
never sees your password.

## How sign-in works

ChatGPT signs you in through **Supabase Auth's OAuth 2.1 server**, which is
already part of your Supabase project but switched off. After you approve on
the site's **`/oauth/consent`** page, ChatGPT gets a normal Supabase token for
your account. The existing row-level security on `user_data` then limits it to
your own data. There's no admin key and no extra database.

## Cost

* **Vercel Hobby (free):** the MCP server runs as three small serverless
  functions next to the site. Hobby is meant for non-commercial use.
* **Supabase Free:** sign-in and data use your existing free project. Free
  projects pause after about a week without activity.
* **ChatGPT:** custom connectors need a paid plan. The Free plan can't add them,
  and some plans may only allow read-only tools. Check OpenAI's help page for
  "Developer mode" on your plan.

## One-time setup

### 1. Supabase: turn on the OAuth server

Supabase dashboard → your project → **Authentication**:

1. **URL Configuration:** set **Site URL** to your live site, e.g.
   `https://lifegrow.example.com`.
2. **OAuth Server:**
   * turn **Enable the Supabase OAuth Server** on
   * set **Authorization Path** to `/oauth/consent`
   * turn **Allow Dynamic OAuth Apps** (dynamic client registration) on, so
     ChatGPT can register itself.
3. If the dashboard says the OAuth server needs asymmetric JWT signing keys,
   follow its prompt under **Project Settings → JWT Keys**.
4. **SQL Editor:** run `supabase/migrations/002_user_data_realtime.sql`. This
   turns on Realtime for `user_data`, so an open app tab shows ChatGPT's
   changes within a second or so. It's optional: without it, the app still
   reloads the moment you switch back to its tab.

To check it worked, this URL should return JSON instead of
`"OAuth server is disabled"`:

```
https://<your-project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1
```

### 2. Vercel: deploy

The functions read the same environment variables the site already uses:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Make sure both are set in
Vercel → Project → Settings → Environment Variables. Optionally, set
`MCP_PUBLIC_URL=https://<your-site>` if you use more than one domain.

Push to the branch Vercel deploys, then check:

```bash
curl -i -X POST https://<your-site>/mcp
```

You should get **`401`** with a `WWW-Authenticate: Bearer resource_metadata=...`
header. That's correct: it means "sign in first".

```bash
curl https://<your-site>/.well-known/oauth-protected-resource/mcp
```

That should return JSON that lists your Supabase project's `/auth/v1` as the
authorization server.

### 3. ChatGPT: add the connector

1. ChatGPT (web) → **Settings → Apps & Connectors → Advanced settings** → turn
   on **Developer mode**. On Business/Enterprise, a workspace admin has to allow
   it first.
2. **Settings → Apps & Connectors → Create**:
   * Name: `Lifegrow`
   * MCP server URL: `https://<your-site>/mcp`
   * Authentication: **OAuth**
3. ChatGPT opens your site. Sign in if asked, then press **Allow** on the
   "Allow ChatGPT to use your account?" page.
4. In a new chat, pick **Developer mode** / the Lifegrow connector from the
   tools menu and ask, e.g. "What's in my Do box?"

To disconnect, remove the connector in ChatGPT. You can also revoke access in
Supabase under **Authentication → OAuth Apps**.

## Running it locally

```bash
npm run mcp:dev
```

This serves the same handlers at `http://localhost:8787/mcp`, using
`.env.local`. ChatGPT can't reach localhost, so locally you can only test with
an MCP client such as the MCP Inspector (`npx @modelcontextprotocol/inspector`),
or through a tunnel.

## Code map

* `server/mcp/store.ts`: the data rules (same shapes and habit/task linking as
  the app)
* `server/mcp/server.ts`: tool definitions
* `server/mcp/http.ts`: sign-in check, OAuth discovery documents, MCP transport
* `api/*.ts` + `vercel.json`: Vercel entry points and URL rewrites
* `src/pages/OAuthConsent.tsx`: the Allow/Deny page
* `src/test/mcp-server.test.ts`: tool, HTTP and end-to-end tests

## App tabs that are already open

The web app keeps your data in memory and saves the whole row when you change
something. So it doesn't save an old copy over ChatGPT's changes, an open tab
reloads quietly:

* whenever you switch back to the tab or window, and
* live, as soon as the row changes, once Realtime is on (step 1.4).

It never reloads while it has unsaved or still-uploading edits of its own, and
a reload that started before you typed something is thrown away. There's still
a split second where an edit in the app and a change from ChatGPT can collide.
In practice that only happens if both land at the same instant.
