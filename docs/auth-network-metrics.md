# Auth Network Metrics

`base44.auth.getNetworkMetrics()` exposes lightweight counters for checking auth-call reduction in development:

- `sessionReads`
- `userReads`
- `profileReads`
- `refreshes`
- `coalescedUserReads`
- `coalescedTokenReads`

Expected behavior after the auth refactor:

- App bootstrap uses the Supabase auth-state session payload before refetching profile data.
- Concurrent `base44.auth.me()` calls for the same user share one profile fetch.
- Concurrent API calls share one access-token lookup.
- Dashboard layouts and customer header consume `AuthContext` user state instead of fetching the profile again.

