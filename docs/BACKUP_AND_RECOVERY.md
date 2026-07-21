# Backup And Recovery

## Required Controls

- Confirm the Supabase plan's automated backup frequency and retention in **Database > Backups**.
- Paid projects normally receive daily backups; verify the actual project screen rather than assuming.
- Keep a separate encrypted logical export outside Supabase at least weekly during the pilot.
- Restrict backup access to named district-approved operators.
- Never commit exports, tokens, or connection strings.

## Logical Backup

Run from a secured operator machine linked to production:

```bash
mkdir -p private-backups/$(date +%F)
supabase db dump --linked --role-only -f private-backups/$(date +%F)/roles.sql
supabase db dump --linked -f private-backups/$(date +%F)/schema.sql
supabase db dump --linked --data-only --use-copy -f private-backups/$(date +%F)/data.sql
shasum -a 256 private-backups/$(date +%F)/*.sql
```

Encrypt the directory and move it to district-approved off-site storage. `private-backups/` must remain
outside the repository.

## Restore Drill

Perform before the pilot and quarterly:

1. Create a disposable, access-restricted Supabase project or PostgreSQL environment.
2. Record its connection string in a temporary shell variable named `RESTORE_DATABASE_URL`.
3. Restore in order:

```bash
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f roles.sql
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f schema.sql
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f data.sql
```

4. Verify row counts for schools, profiles, clubs, memberships, events, approvals, audit rows, and
   deletion requests.
5. Point a local StormHub instance at the disposable database and test confirmed-email student and admin sign-in,
   school isolation, RSVP, bookmark, and approval history.
6. Record recovery point, elapsed recovery time, errors, operator, and date.
7. Delete the disposable project and temporary credentials after sign-off.

The migration-only recovery path is separately validated by `supabase db reset` and pgTAP in CI.
