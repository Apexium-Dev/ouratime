# OurATime AI Agent Instructions

## Project Overview

**OurATime** is a free, open-source time tracking webapp built with Next.js, inspired by Clockify. It allows users to track time with a distraction-free timer, manage projects and tags, collaborate with teams via workspaces, and generate invoices.

**Tech Stack:**

- Framework: Next.js 14 with App Router
- Language: TypeScript + React 18
- Auth & Database: Supabase (PostgreSQL)
- Styling: CSS Modules + Tailwind CSS
- Linting: ESLint + TypeScript

## Quick Start Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server (localhost:3000)
npm run build && npm start     # Production build and run
npm run lint                   # Run ESLint
```

## Project Structure

```
app/                # Next.js pages and layouts
├── (public)/       # Landing pages (no navbar)
├── auth/           # Auth callback handler
├── onboarding/     # Onboarding flow (profile, preferences)
├── join/           # Workspace invite acceptance
├── invoice/        # Public invoice display
├── login/signup    # Auth pages
└── dashboard/      # Protected app (timer, analytics, team, etc.)

components/        # Reusable React components
├── Navbar.tsx, AuthNavbar.tsx
├── DashboardNavbar.tsx, DashboardSidebar.tsx
├── CreateProjectModal.tsx, EditEntryModal.tsx
├── TagPicker.tsx, OnlineHeartbeat.tsx
└── *.module.css    # Scoped component styles

lib/               # Utilities and config
├── supabase.ts    # Supabase client initialization
├── colors.ts      # Design system colors
└── sidebarConfig.ts # Sidebar navigation state

public/            # Static assets
├── logo.png       # Brand logo

supabase/          # Database & migrations
└── migrations/    # 15+ SQL migrations (incrementally applied)
```

## Design System

- **Colors:** Teal (#008080 primary), Light Gray (#F6F5F4 secondary), Rust (#A96039 tertiary), Black (#050505 neutral)
- **Typography:** Inter font family
- **Button Styles:** Primary (teal), Secondary (light gray), Inverted (black), Outlined (transparent with border)
- **Component Patterns:** CSS modules with BEM-like naming, TypeScript interfaces for all data

See [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) for full specs.

## Architecture Patterns

### Authentication Flow

1. User signs up at `/signup` with email + password
2. Supabase sends verification email with callback link
3. Callback (`/auth/callback`) exchanges code for session
4. Profile onboarding (`/onboarding`) captures user preferences
5. Redirect to `/dashboard` (protected by Supabase auth)

### Protected Routes

- All dashboard pages require `supabase.auth.getUser()` check
- Client-side auth state tracked via `useEffect` + `useState`
- No middleware—auth checked per-page (allows graceful fallback)

### Database & RLS (Row-Level Security)

- 15 migrations progressively add schema
- All tables have RLS policies enabling data isolation by user/workspace
- Functions marked `SECURITY DEFINER` bypass RLS for bootstrap operations (e.g., `create_workspace`)
- Workspaces enable team collaboration; members see each other's entries within workspace

### Component Patterns

- **Modal Components:** Accept `onClose`, `onSave`, `onDelete` props; overlay with click-outside detection
- **Form Components:** Use uncontrolled or controlled inputs; emit changes via `onChange` callbacks
- **Data Fetching:** Supabase queries in `useEffect`, cache in `useState`; manual refetch on mutations
- **Styling:** CSS Modules (`.module.css`), no inline styles; colors from `lib/colors.ts`

## Naming Conventions

- **Files:** kebab-case for pages/components (`dashboard-sidebar.tsx`), PascalCase for exports (`DashboardSidebar`)
- **CSS Classes:** BEM-like format (`.block__element--modifier`)
- **API Responses:** snake_case in database, camelCase in TypeScript
- **Components:** PascalCase exports, "use client" for interactive components
- **Types:** `Interface` + `Props` suffix for component props (`DashboardNavbarProps`)

## Common Tasks

### Adding a New Dashboard Page

1. Create `app/dashboard/[feature]/page.tsx` (e.g., `timesheet/page.tsx`)
2. Import `{ supabase }` from `@/lib/supabase`
3. Add auth check: `supabase.auth.getUser()` in `useEffect`
4. Import layout from `@/app/dashboard/layout.tsx` (auto-wraps with sidebar)
5. Add entry to `lib/sidebarConfig.ts` for navigation

### Adding a Database Table

1. Create migration file in `supabase/migrations/NNN_description.sql`
2. Define table with UUID PK, timestamps, FK constraints
3. Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. Create policies for owner access + workspace access if needed
5. Document in `supabase/README.md`

### Styling Components

1. Create `.module.css` file next to component
2. Import: `import styles from "./Component.module.css"`
3. Use classes: `className={styles.className}`
4. Color variables available in `lib/colors.ts` and Tailwind config
5. No global CSS except `app/globals.css` (reset + Tailwind directives)

### Managing Workspace Data

- Use `workspace_members` to check if user is in workspace
- Filter queries with workspace context when displaying shared data
- Workspace owner can delete entire workspace + members
- Use `public.create_workspace()` RPC to bypass RLS bootstrap issue
- Invites are shareable tokens; use `accept_workspace_invite()` RPC to join

## Git Workflow

- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Group commits by feature (not one-per-file)
- Push to `main` directly (no PR workflow in this project)
- Examples:
  - `feat: add projects management page`
  - `fix: update dashboard layout for workspace integration`
  - `chore: update dependencies and npm configuration`

## Known Constraints & Gotchas

- **No middleware auth:** Auth is checked per-page, so redirect logic is client-side
- **Workspace bootstrap problem:** RLS prevents creating a workspace you're not yet a member of; use `SECURITY DEFINER` functions to avoid circular dependency
- **Deprecated dependencies:** Some old packages (rimraf, eslint) show warnings; upgrade needed but not critical for dev
- **Storage bucket:** Avatar uploads use `public/avatars` bucket with user-scoped paths
- **Sidebar persistence:** Drag-to-reorder saves to `localStorage` via `sidebarConfig.ts`
- **Live updates:** No real-time subscriptions; manual refetch needed when data changes in other tabs

## Extension Points

- **Add new metrics to reports:** Update query in `/dashboard/reports/page.tsx`
- **Add new invoice fields:** Alter `invoices` table in migration, update form in `/dashboard/invoices/[id]/page.tsx`
- **Add team permissions:** Extend `workspace_members.role` enum and create new RLS policies
- **Add more entry fields (e.g., screenshots):** Alter `time_entries` table, update modal components
- **Add mobile apps:** Supabase client works with React Native; mirror app logic to mobile

## Useful Links

- [Supabase Docs](https://supabase.com/docs) - Auth, database, storage, RLS
- [Next.js 14 App Router](https://nextjs.org/docs/app) - Pages, layouts, client/server components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Type system reference

## Common Errors & Solutions

| Error                                                    | Cause                                     | Solution                                                                         |
| -------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` | Missing or malformed `.env.local`         | Copy `.env.local.example`, add real Supabase credentials                         |
| `RLS policy violation`                                   | User trying to access another user's data | Check RLS policies match your query; add workspace context if needed             |
| `undefined is not an object (evaluating 'user.id')`      | Auth state not loaded yet                 | Wrap in `useEffect` with `supabase.auth.getUser()` first                         |
| `Cannot create workspace`                                | RLS bootstrap issue                       | Use `public.create_workspace()` RPC instead of direct INSERT                     |
| Module not found errors                                  | Import path mismatch                      | Use `@/` prefix for root imports (e.g., `@/lib/supabase`, `@/components/Navbar`) |

---

_Last updated: May 22, 2026_
