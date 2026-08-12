# Supabase setup

## Existing tables

| Table | Purpose |
|---|---|
| `profiles` | Players, commissioner flag, bankroll |
| `weeks` | NFL weeks, phase, allowance, `reveal_at` |
| `bets` | Weekly wagers (regular season + playoffs) |
| `futures` | Pre-season futures wagers |

## Run the migration

In the [Supabase SQL Editor](https://supabase.com/dashboard), run:

```
supabase/migrations/002_extend_existing_schema.sql
```

**Do not run** `001_initial_schema.sql` — it targets a greenfield setup and will conflict.

### What `002` adds

- `profiles.bankroll` — running play-money total
- `settled_at` / `settled_by` on `bets` and `futures`
- Budget triggers (use-it-or-lose-it per week / futures pool)
- Futures lock once any `regular` week has `reveal_at <= now()`
- Settlement triggers (American odds → bankroll update)
- `standings` view
- RLS policies (players place own bets; commissioners settle)

## Weeks table setup

Add rows like:

| week_number | phase | allowance | reveal_at |
|---|---|---|---|
| 0 | futures | 300 | season open |
| 1–18 | regular | 100 | each week's open time |
| 19+ | playoff | 200 | each playoff round |

Futures allowance comes from the `weeks` row where `phase = 'futures'` (defaults to 300 if missing).

## Environment variables

`.env.local` at the **project root**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Auth redirect URL

In Supabase **Authentication → URL Configuration**, add:

- `http://localhost:3000/auth/callback`
- Your production URL, e.g. `https://theshittywager.com/auth/callback`

Set **Site URL** to your production domain (not localhost).

## Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create OAuth credentials (Web application).
2. Add **Authorized redirect URI**:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Find your project ref in Supabase **Project Settings → API**.
3. In Supabase **Authentication → Providers → Google**, enable Google and paste the Client ID and Client Secret.
4. Ensure your app redirect URLs (above) include `/auth/callback` for localhost and production.

Users can sign in with **Continue with Google** on the login page. Existing profiles are linked by email via `claim_profile_by_email`.

Auth uses `@supabase/ssr` with cookie-based PKCE. The callback is handled server-side at `/auth/callback`, then the client finishes at `/auth/complete`.

Grant the first platform administrator manually in Supabase:

```sql
update public.profiles
set is_administrator = true
where lower(email) = lower('you@example.com');
```

Run migration **`008_platform_administrators.sql`** for the full administrator model.

## Access levels

| Role | Scope |
|---|---|
| Player | Own bets and profile within joined leagues |
| League commissioner | Manage one league (budgets, invites, roster, settlement) |
| Platform administrator | Commissioner access to **every** league on the site |


Commissioners see a tools panel in the app to:

- Set weekly ($100), futures ($300), and playoff ($200) budgets
- Sync weeks from ESPN
- Settle pending bets

## Seed weeks from ESPN

Populate the `weeks` table from the 2026 NFL schedule:

```bash
npm run seed:weeks
```

This generates `supabase/seed/2026_weeks.sql` using ESPN's schedule API (same source as [ESPN Week 1 2026](https://www.espn.com/nfl/schedule/_/week/1/year/2026/seasontype/2)).

Then run **`supabase/seed/2026_weeks.sql`** in the Supabase SQL Editor.

| Phase | week_number | allowance | reveal_at |
|---|---|---|---|
| futures | 0 | $300 | ~90 days before Week 1 |
| regular | 1–18 | $100 | 4 days before first kickoff |
| playoff | 19–21 | $200 | Wild Card, Divisional, Conference Championships |

Super Bowl is excluded (handled outside the app).
