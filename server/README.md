# Backend — Supabase

| File | What it is | How to apply |
|---|---|---|
| `schema.sql` | Tables, first rules, starting data (Step 3) | Already run once |
| `migrations/002_users_and_permissions.sql` | Users, roles (Admin / Member), per-profile access rules (Step 6B) | Supabase → SQL Editor → paste → Run (once) |
| `supabase/functions/admin-users/` | Server function: invite / edit / block / delete users. Uses the service key on the server only | `npx supabase functions deploy admin-users --project-ref yuwvfgnytetrzfqjqdjx --workdir server --use-api` |

Roles: **ADMIN** sees all profiles and manages users, profiles, settings and backups.
**MEMBER** sees only the profiles in `app_users.profile_ids`. Row Level Security enforces this in the database.
