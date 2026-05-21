# Supabase SQL Migrations

Run these in order in **Supabase Dashboard → SQL Editor → New query**.

| File | Description | Status |
|------|-------------|--------|
| `migrations/001_create_profiles.sql` | Profiles table, RLS policies, signup trigger | ✅ Run this |
| `migrations/002_profiles_analytics.sql` | Analytics timestamps on profiles | ✅ Run this |

## How to run

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → **New query**
4. Paste the contents of the migration file
5. Click **Run**
