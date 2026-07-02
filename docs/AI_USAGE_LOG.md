# StormHub AI Usage Log

Last updated: 2026-07-02

This project has used AI assistance for rapid implementation, debugging, documentation, and test scaffolding. AI-generated changes must be reviewed, tested, and constrained by the rules in `docs/LOGS.md`.

## Current AI-assisted areas

- Multi-school product refactor.
- Club draft catalog and publishing flow.
- Notification/email workflow improvements.
- Event/calendar bug fixes.
- Testing foundation and documentation.
- App assistant feature and guardrails.

## Required review standard

Before accepting AI-generated changes:

1. Inspect the diff.
2. Run lint/typecheck/build.
3. Run relevant unit/component tests.
4. Run E2E or manual QA for role/routing/auth changes.
5. Update docs if behavior changed.

## Known AI-risk areas

- Server actions with implicit Supabase/RLS behavior.
- School scoping.
- Role permissions.
- Email fanout.
- Generated SQL patches.
- AI assistant safety behavior.

## Policy

AI output is implementation assistance, not proof. “Works” means validated by tests or documented manual QA.
