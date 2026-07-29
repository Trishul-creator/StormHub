# StormHub Product Specification

Last updated: 2026-07-02

## 1. Product summary

StormHub is a multi-school-capable club and opportunity platform for school communities. The root landing page is platform-neutral; individual schools exist as workspaces inside StormHub. Super admins choose a school workspace from the platform admin area. Students, teachers, and school admins belong to one school. Super admins are platform-level operators and are not tied to a single school.

## 2. Product scope

Current core scope:

- School workspaces.
- Clubs and club discovery.
- Draft club catalogs for admins before publication.
- Club portals with announcements, events, resources, roster management, and member views.
- Calendar/events for school and club activity.
- School-wide opportunities with save/sign-up style actions.
- Student dashboard.
- In-app notifications.
- Controlled important/urgent email notifications through the configured email delivery mode.
- School admin management.
- Platform admin school chooser and school management entry points.
- Support/contact flow using `stormhubsupport@gmail.com`.
- App-focused AI assistant with guardrails.

## 3. Explicitly out of scope right now

- Volunteering.
- Service hours.
- Standalone workshops module.
- Billing/payments.
- Student-to-student messaging.
- Public student profiles.
- Ads.
- Selling data.

The code still contains some legacy routes for disabled surfaces (`/volunteering`, `/service-hours`, `/workshops`) so old links do not hard-crash, but these are not active product modules.

## 4. Roles

Global roles:

- `student`
- `teacher`
- `admin` = school admin
- `district_admin` = district administrator
- `super_admin` = ultimate platform administrator

Club roles:

- `member`
- `officer`
- `president`
- `sponsor`

## 5. Role behavior

- Students use the main app for their own school: dashboard, clubs, opportunities, calendar, saved items, notifications, and settings.
- Teachers manage sponsored clubs. A teacher may exist without assigned clubs.
- School admins manage one school: clubs, drafts, opportunities, users, analytics, email outbox, and school content.
- District administrators manage district setup, district/school statistics, school signup controls, and school-level accounts only inside their assigned district.
- Officers and presidents manage their own club content and dashboard.
- Sponsors and school admins can remove club content.
- Super admins manage the entire platform, create districts, attach or create schools, and assign district administrators. They can access school management views but should not receive school-task notifications/emails and do not join clubs as students.
- Admins and super admins preview/manage clubs; they should not see Join Club as their primary action.

## 6. District and school workspace model

- Districts contain schools through `schools.district_id`.
- Each school has its own clubs, users, opportunities, events, notifications, and settings.
- Students, teachers, and school admins are school-specific through `profiles.school_id`; their district is synchronized from the school.
- District administrators have `profiles.district_id` and no school assignment.
- School admins cannot manage other schools.
- District administrators cannot manage another district.
- Super admins can access all districts and schools.
- Public school routes use `/s/[schoolSlug]`.
- Legacy routes such as `/clubs` and `/calendar` remain as compatibility/fallback surfaces, but school-scoped routes are preferred.

## 7. Main routes

- `/` — neutral platform landing page.
- `/admin/districts` — platform district chooser or the current district administrator’s workspace.
- `/admin/districts/[districtSlug]` — district schools, manager assignments, and school creation.
- `/admin/schools` — compatibility redirect to the correct administration workspace.
- `/admin/schools/[schoolSlug]` — authorized platform, district, or school-admin view into a school workspace.
- `/admin/schools/[schoolSlug]/drafts` — school draft club catalog for a selected school.
- `/s/[schoolSlug]` — public school workspace page.
- `/clubs` and `/s/[schoolSlug]/clubs` — club discovery.
- `/clubs/[slug]` and `/s/[schoolSlug]/clubs/[slug]` — public club profile.
- `/clubs/[slug]/member` — club member/manager dashboard.
- `/calendar` and `/s/[schoolSlug]/calendar` — calendar.
- `/opportunities` and `/s/[schoolSlug]/opportunities` — opportunities.
- `/dashboard` — student/officer dashboard.
- `/manage` — school management dashboard.
- `/manage/clubs` — published/manageable clubs.
- `/manage/clubs/drafts` — draft club catalog.
- `/manage/clubs/[slug]` — club management dashboard.
- `/manage/clubs/[slug]/announcements` — create/list announcements.
- `/manage/clubs/[slug]/events` — create/list events.
- `/manage/clubs/[slug]/resources` — create/list resources.
- `/notifications` — notification center.
- `/settings` — profile/settings page.
- `/auth/sign-in` and `/auth/sign-up` — auth flows.

## 8. Clubs

Club statuses:

- `draft`: hidden from students; editable by admins/managers.
- `interest_open`: public and joinable/get-updates oriented.
- `active`: public and active.
- `paused`: not actively joinable.
- `archived`: hidden/retired.

Visibility:

- `public`: visible on public school surfaces when status/listing also allow it.
- `unlisted`: not visible in public discovery.
- `private`: restricted behavior.

Join behavior:

- Only students can join clubs.
- Students can join only clubs in their own school.
- Students cannot rejoin a club after being rejected/banned by a teacher/admin.
- Teachers/admins/super admins manage or preview; they do not use the student join flow.

Club portal sections:

- Announcements.
- Events.
- Resources.
- Member area.
- Management dashboard.
- Roster management for authorized users.

Club setup intentionally does not store recurring meeting date/time. Meetings should be created as dated events from the club dashboard.

## 9. Opportunities

Opportunities are school-wide action items such as competitions, applications, auditions, tryouts, interest forms, scholarships, and deadlines.

Expectations:

- Opportunities are school-scoped.
- Students can save/sign up for opportunities in their own school.
- Students should not save/sign up for another school’s opportunity.
- School admins create opportunities for their own school.
- Super admins can operate in a selected school context.
- Opportunity action labels are normalized so `RSVP` does not appear for opportunity cards.

## 10. Calendar/events

Events are dated school or club calendar items.

- Club meetings are events.
- Events are school-scoped.
- Club-specific events include `club_id`.
- Events have start time and optional end time.
- Event detail pages are available at `/events/[id]`.
- Sponsors/admins can archive/delete club events.
- Archived events are removed from student-facing calendar surfaces.

## 11. Notifications/email

- Normal updates should create in-app notifications only.
- Important updates may queue/send email when the sender explicitly enables email and user preferences allow it.
- Urgent updates queue/send email by default when preferences allow it.
- Email delivery is controlled by `EMAIL_DELIVERY_MODE`:
  - `disabled`: no outbox rows or sends.
  - `outbox_only`: create email outbox records but do not send real email.
  - `send`: send through Resend when configured.
- Support email is `stormhubsupport@gmail.com`.
- Reply-to should be configured as `EMAIL_REPLY_TO=stormhubsupport@gmail.com`.
- Normal updates should not spam email.
- App feedback/support should go to support rather than school admins.

## 12. Privacy/security expectations

- Collect minimal student data.
- No disciplinary records.
- No ads.
- No selling data.
- No public student profiles.
- No student-to-student messaging.
- No cross-school data leakage.
- School admins are limited to their own school.
- Super admins can access platform/school management but should not be included in school-specific notification fanout.

## 13. Acceptance criteria

StormHub is considered working only when:

- Public root landing page is platform-neutral.
- Users sign up/sign in and receive the correct school-scoped experience.
- Super admins land on the school chooser.
- Students land on dashboard and cannot access management/admin surfaces.
- School admins manage only their school.
- Teachers manage only sponsored clubs.
- Club drafts remain hidden until published.
- Published clubs appear in the correct school workspace.
- Students can join only own-school published clubs.
- Club dashboards do not 404 for managers or members.
- Club events appear on the correct school calendar.
- Event detail links do not 404 for authorized users.
- Sponsors/admins can delete/archive club content.
- Opportunities are school-scoped.
- Notifications and emails respect importance, preference, and delivery mode.
- Disabled modules are not presented as active features.
- Lint, typecheck, build, and unit tests pass.
- E2E tests pass when real test accounts are configured.
