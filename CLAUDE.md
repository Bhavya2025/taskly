# Taskly — Project Context for Claude

## What it is
Taskly is a kanban-style personal task manager built as a React/Vite SPA. It supports multiple projects, each with its own board of columns and task cards. It has a full mobile UI, an AI assistant, Supabase cloud sync, and a guest (localStorage-only) mode.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Plain CSS (index.css, ~4800 lines), CSS custom properties for theming |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` |
| Backend / Auth | Supabase (Postgres + Auth + Realtime) |
| AI | Groq API (`deepseek-r1-distill-llama-70b`) via a small Express-like server layer |
| Routing | React Router v6 |
| Deployment | Vercel (serverless functions in `/api/`) |
| Analytics | Vercel Analytics |

---

## Directory Structure

```
src/
  App.jsx                  — root component, all state, Supabase sync
  main.jsx                 — entry, Supabase session init, BrowserRouter
  index.css                — all styles (~4800 lines)
  components/
    Board.jsx              — desktop kanban board (dnd-kit drag for tasks + columns)
    Column.jsx             — single column with custom scrollbar, rename, grip handle
    TaskCard.jsx           — draggable task card
    TaskModal.jsx          — add/edit task modal
    ColumnModal.jsx        — add/edit column modal (color, icon, sound preset)
    Topbar.jsx             — search, filter, undo/redo, view toggle, AI button
    ListView.jsx           — flat list view alternative to board
    AIAgent.jsx            — desktop AI chat panel (command input → board mutations)
    AuthModal.jsx          — sign in / sign up modal
    ProfilePanel.jsx       — avatar, display name, theme, sign out
    SettingsPanel.jsx      — global settings panel
    ProjectSettingsModal.jsx — per-project rename, emoji, color, theme, image, delete
    TrashPanel.jsx         — recently deleted projects (30-day restore)
    Toast.jsx              — snackbar notifications
    Tutorial.jsx           — step-by-step onboarding tooltips
    IntroAnimation.jsx     — first-visit animated intro
    DatePicker.jsx         — custom due-date picker
    PortalMenu.jsx         — portal-rendered context menus
    UserAvatar.jsx         — SVG animal avatar (bear, fox, panda, etc.)
  mobile/
    MobileHome.jsx         — mobile project list + create project screen
    MobileBoard.jsx        — mobile board (tabs per column, swipe-style)
    MobileTaskSheet.jsx    — bottom sheet for add/view/edit tasks on mobile
    MobileAISheet.jsx      — bottom sheet AI input on mobile
  hooks/
    useIsMobile.js         — returns true when window.innerWidth <= 768
    useSounds.js           — Web Audio API sound engine (pickup, drop, click, etc.)
  utils/
    aiAgent.js             — client-side AI helpers (fuzzy find, generateTasks, buildProjectSeed, parseCommand)
    data.js                — createColumn, generateId, normalizeBoardData, getDefaultData
    dateUtils.js           — getDueStatus, formatDate
  lib/
    supabase.js            — all Supabase queries (fetch, upsert, trash, profile, realtime)
  pages/
    Home.jsx               — project list / home page (desktop)
    AuthPage.jsx           — standalone auth page
server/
  geminiHelpers.js         — Groq API wrapper (system prompt, callGemini, JSON parsing)
  index.js                 — dev server plugin for Vite (proxies /ai/* routes)
api/
  generate.js              — Vercel serverless: POST /api/generate (project seed)
  command.js               — Vercel serverless: POST /api/command (natural language board commands)
```

---

## Core Data Model

### Project
```js
{
  id: string,
  name: string,
  emoji: string,
  color: string,       // hex accent color
  theme: string|null,  // per-project theme override
  summary: string,     // AI-generated one-liner
  createdAt: ISO string,
  taskCount: number,
  tasksDone: number,
  imageUrl: string|null,
}
```

### Board Data (per project)
```js
{
  columns: [{ id, title, color, icon, soundPreset }],
  tasks:   [{ id, title, description, columnId, priority, done, dueDate, tags, emoji, accentColor, createdAt }]
}
```

- Priority values: `'urgent' | 'high' | 'medium' | 'low'`
- Themes: `'dark' | 'light' | 'teal' | 'midnight' | 'neon'`
- Sound presets per column: `'soft' | 'bright' | 'lift' | 'chime' | 'reward'`

---

## State Management (App.jsx)

Everything lives in `App.jsx`. No external state library.

- `boardState: { present, past[], future[] }` — undo/redo history for the active board
- `commitBoardChange(updater, options)` — the only way to mutate a board. Pushes to history, debounces Supabase save (500ms for board, 750ms for projects list)
- `projects[]` — list of all project metadata
- `activeProjectId` — which project is open
- `globalTheme` / `effectiveTheme` — global theme can be overridden per project
- `soundEnabled` — global toggle
- `searchQuery` + `filterPriority` — live filter applied to tasks in Board/ListView

Board mutations (add/edit/delete task, move task, reorder task, add/delete/rename/reorder column) all go through `commitBoardChange`.

---

## Drag & Drop (Board.jsx)

Single `DndContext` handles both column reordering and task reordering/moving.

- **Column drag**: `useSortable({ id: col.id, data: { type: 'column' } })` — `listeners` applied to the grip handle (`⠿`) only. Dragging the grip moves the whole column.
- **Task drag**: `useSortable({ id: task.id, data: { type: 'task', columnId } })` in `TaskCard.jsx`
- `onDragStart` — sets `activeType` ('column'|'task') and `activeId`
- `onDragOver` — if column: `arrayMove` on `orderedCols`; if task: calls `onMoveTask` when crossing column boundaries
- `onDragEnd` — commits column reorder via `onReorderColumns` or task reorder via `onReorderTask`
- `DragOverlay` — shows `ColGhost` (purple-tinted 240px wide card) or `TaskCard overlay`
- Column.jsx uses `useDroppable({ id: \`drop-${column.id}\` })` — note the `drop-` prefix to avoid ID collision with the column's own `useSortable`
- Sensors: `PointerSensor` (distance: 5px) + `TouchSensor` (delay: 200ms)

---

## AI Features

### Server-side (Groq / deepseek-r1-distill-llama-70b)
- `POST /api/generate` — given a project name + description, returns full board seed (columns + tasks with priorities, colors, tags, emoji)
- `POST /api/command` — natural language → structured board mutation (add task, move task, rename column, change theme, etc.)
- Responses strip `<think>...</think>` blocks before JSON parsing
- Falls back to regex JSON extraction if the model wraps in prose

### Client-side (aiAgent.js)
- `buildProjectSeed(name, description)` — calls `/api/generate`, normalizes result, returns `{ data: { columns, tasks }, summary, suggestedEmoji }`
- `generateTasks(description, existingColumns)` — lighter call, returns tasks mapped to existing columns
- `parseCommand(input, columns, tasks)` — calls `/api/command`, returns typed action objects
- `fuzzyFindTask(query, tasks)` / `fuzzyFindColumn(query, columns)` — client-side fuzzy match for AI command resolution

### AIAgent.jsx (desktop)
Natural language chat panel. Parses commands and applies them directly to the board (add task, delete task, move task, set priority, rename column, change theme, set sound, etc.) with undo support.

---

## Supabase Schema (lib/supabase.js)

Tables:
- `profiles` — `user_id`, `display_name`, `avatar_animal`, `avatar_color`, `global_theme`
- `projects` — `id`, `user_id`, `name`, `emoji`, `color`, `theme`, `summary`, `task_count`, `tasks_done`, `image_url`, `created_at`
- `board_data` — `project_id`, `user_id`, `data` (jsonb — full `{ columns, tasks }`)
- `trash` — `project_id`, `user_id`, `project_snapshot` (jsonb), `board_snapshot` (jsonb), `deleted_at`

Auth: Supabase email/password + magic link. Guest mode stores everything in `localStorage` under keys `taskly-projects`, `taskly-data-{projectId}`, `taskly-theme`, `taskly-global-settings`.

Realtime: Supabase Realtime subscription on `projects` and `trash` tables for the logged-in user, so changes sync across tabs.

---

## Mobile UI

Rendered when `useIsMobile()` returns true (window width ≤ 768px). Completely separate component tree from desktop.

- `MobileHome` — project cards in a scrollable list, "New Project" button, AI-generated project creation sheet
- `MobileBoard` — column tabs at the top, tasks in a vertical list below, swipe between columns
- `MobileTaskSheet` — bottom sheet for viewing/editing a task
- `MobileAISheet` — bottom sheet for the AI input
- Column reorder on mobile: hold the `⠿` grip on a column tab (220ms) → enters drag mode with pointer capture, drag to swap position

---

## Themes

Applied via `data-theme` attribute on `<html>`. Five themes:
- `dark` (default), `light`, `teal`, `midnight`, `neon`

Each theme defines CSS custom properties: `--bg-app`, `--bg-card`, `--bg-hover`, `--border`, `--text-1/2/3`, `--accent`, `--accent-dim`, etc.

Per-project theme overrides the global theme while that project is open.

---

## Sounds (useSounds.js)

Web Audio API. Sound is tied to drag events:
- `playPickup(priority)` — on task drag start (tone varies by priority)
- `playDrop({ column, fromIndex, toIndex, totalColumns })` — on task drop (tone based on column's `soundPreset` and direction of movement)
- `playClick()` — undo/redo

---

## Key Patterns & Gotchas

- **`commitBoardChange`** is the single source of truth for board mutations. Never mutate `boardState` directly.
- **Column droppable ID** must be `drop-${column.id}`, not `column.id` — the latter conflicts with `useSortable`.
- **`buildProjectSeed`** returns `{ data: { columns, tasks } }` — tasks already have pre-mapped `columnId` values. Use this for new project creation, not `generateTasks`.
- **`deepseek-r1-distill-llama-70b`** via Groq returns `<think>` blocks — always strip them before `JSON.parse`.
- **Debounce timers**: board 500ms, projects list 750ms. Don't reduce further or Supabase will rate-limit.
- **Guest → auth migration**: on sign-in, local-only projects are pushed to Supabase. The `key={session?.user?.id ?? 'guest'}` on `<App>` forces a full remount on auth change.
- **`orderedCols`** in Board.jsx is only the live preview during a column drag — `columns` from props is the source of truth. Use `displayCols` (which switches between them) for rendering.
