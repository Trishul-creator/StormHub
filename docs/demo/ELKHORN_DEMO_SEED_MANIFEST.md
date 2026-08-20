# Elkhorn fictional demonstration seed manifest

Seed version: `2026-08-19.1`

All records are synthetic. No official logo, `epsne.org` address, real student data, real staff identity, or private club information is included.

## Tenant records

- District ID: `e1c00000-0000-4000-8000-000000000001`
- District slug: `elkhorn-public-schools-demo`
- District name: `Elkhorn Public Schools — DEMO`
- Description: `Synthetic StormHub demonstration tenant; not an official EPS deployment.`
- School slugs:
  - `elkhorn-south-demo` — primary, fully populated school
  - `elkhorn-high-demo` — secondary district example
  - `elkhorn-north-demo` — secondary district example
- Accepted domain: `demo.stormhubapp.com` only
- Signup access codes: deterministic demo-only codes stored in `school_signup_access`
- Email: disabled in each `school_settings` row; notification preferences are in-app only
- Elkhorn South student-content staff review: enabled

## Login-capable accounts

The seed creates 29 confirmed fictional authentication users. The five presentation accounts are Dana Mitchell, Alex Morgan, Elena Carter, Jordan Lee, and Maya Patel. The full email, role, scope, and purpose inventory is in `ELKHORN_DEMO_ACCOUNTS.md`. Authentication IDs are resolved by stable email because Supabase Auth owns user UUID creation. Reruns update the same Auth users rather than creating duplicates.

## Clubs

Stable club IDs use the `e1c00000-0000-4000-8000-*` namespace.

### Elkhorn South High School — DEMO

| Slug | State | Purpose |
| --- | --- | --- |
| `demo-engineering-robotics` | Active, listed, featured | Primary live-demo club |
| `demo-community-service` | Active, listed | Maya membership and service event |
| `demo-speech-debate` | Active, listed | Advisor/member depth |
| `demo-environmental-action` | Active, listed | Directory and statistics depth |
| `demo-business-entrepreneurship` | Active, listed | Directory and statistics depth |
| `demo-health-careers` | Active, listed | Directory and statistics depth |
| `demo-international-culture` | Active, listed | Directory and statistics depth |
| `demo-jazz-ensemble` | Active, listed | Upcoming interest event |
| `demo-student-council` | Active, listed | Schoolwide Fall Activities Fair announcement mapping |
| `demo-photography` | Draft, unlisted, inactive | Alex's school-approval workflow |

### Other schools

- Elkhorn High: `demo-high-quiz-bowl`, `demo-high-coding`, `demo-high-art`, `demo-high-future-educators`
- Elkhorn North: `demo-north-science-olympiad`, `demo-north-key-club`, `demo-north-creative-writing`, `demo-north-esports`

## Main content

- Prepared private student draft ID `e1c00000-0000-4000-8000-0000000000c8`: **Robotics Open Lab — Room Update**
- Published Robotics announcement: **Build Team Orientation**
- Published schoolwide story: **Fall Activities Fair**. The current schema requires announcements to belong to a club, so this is represented as a public Student Council announcement rather than by introducing a competing school-announcement model.
- Scheduled optional announcement: **Competition Interest Check**
- Events: Robotics New-Member Open Lab, Fall Activities Fair, Community Service Kickoff, Speech & Debate Information Session, Jazz Ensemble Interest Meeting, plus four secondary-school events
- Opportunities: Fall Activities Fair Volunteer Crew, Youth STEM Mentor Interest Form, Community Cleanup Day, Student Photography Team, Peer Tutoring Interest Form, and one intentionally expired lifecycle example
- Coursework: **Open Lab Safety Check**, one returned Maya submission, private Advisor feedback, and one in-app safety resource
- In-app records: leadership assignment, event reminders, approval attention, registration confirmation, and district readiness notifications
- Analytics: 36 real synthetic `analytics_events` rows supporting derived statistics
- Audit: deterministic non-PII synthetic approval/assignment activity plus the super-administrator safety snapshot

## Reset identifiers

- District, schools, clubs, announcements, events, opportunities, assignment, submission, resource, analytics, and seeded audit records use deterministic UUIDs returned by `demoUuid()` in `scripts/demo/elkhorn-manifest.ts`.
- Auth users are identified only by the exact `@demo.stormhubapp.com` suffix and enumerated manifest emails.
- The safety snapshot audit ID is `e1c00000-0000-4000-8000-000000000384`.
- Rerunning the seed restores rehearsal-mutated stable records and removes the prepared announcement's prior review request.
- Full reset deletes dependency records first, removes the exact demo Auth users, then removes the three demo schools and district. The two platform super-administrator IDs must match the snapshot before reset proceeds.

## Existing-schema mappings and assumptions

- StormHub's database role `officer` is displayed as **Vice President**. Noah's Secretary story uses that same content/roster permission tier because the current schema intentionally has one secondary student-leadership tier.
- Every profile references `auth.users`, so supporting people are minimum login-capable fictional Auth records rather than a new profile-only identity model.
- Schoolwide announcements currently require a club; Student Council is the existing-model owner for the Fall Activities Fair message.
- Aggregate statistics continue to use `get_admin_statistics` and actual synthetic profiles, memberships, events, RSVPs, and analytics rows. No UI statistic is hard-coded.
- The seed is an idempotent REST/Auth workflow rather than a single SQL transaction. A `seeding` safety marker prevents a partial run from verifying successfully; rerunning the deterministic seed repairs a partial nonproduction run.
