# Supabase SQL Migrations

Run these in order in **Supabase Dashboard → SQL Editor → New query**.

| File | Description | Status |
|------|-------------|--------|
| `migrations/001_create_profiles.sql` | Profiles table, RLS policies, signup trigger | ✅ Run this |
| `migrations/002_profiles_analytics.sql` | Analytics timestamps on profiles | ✅ Run this |
| `migrations/003_projects_tasks_entries.sql` | Projects, Tasks, Time Entries tables | ✅ Run this |
| `migrations/004_tags.sql` | Tags + time_entry_tags junction table | ✅ Run this |
| `migrations/005_hourly_rate_billable.sql` | Hourly rate on profiles + billable flag on time_entries | ✅ Run this |
| `migrations/006_project_status.sql` | archived, is_template, is_favorite columns on projects | ✅ Run this |

## How to run

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → **New query**
4. Paste the contents of the migration file
5. Click **Run**
