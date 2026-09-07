# Taskboard setup

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run SQL from `supabase/migrations/001_taskboard.sql` in the SQL Editor
3. Create a **private** Storage bucket named `task-attachments`
4. Run `supabase/migrations/002_storage.sql`
5. Enable **Realtime** for the `tasks` table (Database → Replication)
6. Copy **Project URL**, **anon key**, and **JWT secret** (Settings → API)

## 2. Environment variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
TASKBOARD_USERNAME=vzorkovna
TASKBOARD_PASSWORD=your-secure-password
SUPABASE_JWT_SECRET=
```

`TASKBOARD_PASSWORD` and `SUPABASE_JWT_SECRET` are server-only (no `VITE_` prefix).

## 3. Local development

```bash
npm install
npm run dev
```

Auth API routes are served by the Vite dev plugin. Open http://localhost:5173/login

## 4. Deploy on Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add the same environment variables in Vercel project settings
4. Deploy — API routes in `/api` run as serverless functions

## 5. Usage

- **Login** in the site menu → shared username/password
- **Taskboard** → project list → Kanban board per project
- **Archive** → completed tasks (searchable)
- Drag tasks between columns; click a task to edit in the side drawer
- `+ Subtask` on parent tasks (one level only)
