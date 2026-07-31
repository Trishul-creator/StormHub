# Tenant Offboarding and Verified Deletion Runbook

StormHub uses a recoverable, reviewed workflow for school and district deletion
instructions. The workflow preserves an audit trail and does not expose a
one-click physical cascade delete for a populated tenant. A platform super
administrator may permanently remove a provably empty setup-only district, and
a district or platform administrator may remove a provably empty school in
their scope, after exact-name and recent-identity confirmation. The server
rechecks that the tenant has no accounts or activity and records the operation
in the administrator audit log.

## Roles and separation of duties

- A school administrator may submit or cancel an early request only for their
  own school.
- A district administrator may submit school requests in their district,
  acknowledge those requests, and record that a protected export is ready.
  They may also submit a request for their own district.
- A platform super administrator is the final reviewer. Only this role may
  approve deactivation, schedule deletion, restore an approved tenant, or mark
  verified deletion complete.
- A requester cannot review their own request.

Use **Administration → Tenant offboarding** for every populated-tenant request. Do not process a
school or district deletion from email, chat, or an untracked support message.
Do not directly delete a populated `schools` or `districts` row as a shortcut. This
workflow is the supported school/district removal function and preserves the
authorization, recovery, hold, and evidence controls required for safe removal.
StormHub permits only one active workflow in a tenant tree: an active district
request blocks child-school requests, and any active child-school request must
be resolved before district offboarding can begin.

## What approval does

Platform approval is an operational, transactional soft deletion:

- School approval sets `schools.is_active=false` and
  `schools.is_public=false`.
- District approval sets `districts.is_active=false` and makes every child
  school inactive and private.
- Approval snapshots each covered profile's exact account status, then sets
  those profiles to `deactivated` so existing sessions fail the application
  authorization and RLS gates.
- Approval records an explicit tenant access-disabled marker. Tenant-scoped RLS
  and authorization checks reject an already-authenticated covered user, and
  queued user mail is no longer claimed for delivery.
- StormHub records the prior availability state, approving user, timestamp,
  and append-only offboarding events.

Approval does not physically purge database, Auth, Storage, backup, email, or
Google Drive data. Before physical purge, a platform administrator can cancel
the request; StormHub restores the exact recorded district and school
availability state.

## Required workflow

1. Confirm the requester and tenant scope against the executed district
   agreement. Record the instruction and reason in Tenant offboarding.
2. Check for litigation hold, investigation hold, open records obligation,
   contract retention, or a district-requested preservation period. If a hold
   applies, an individual platform super administrator must record it through
   the authenticated `place_legal_hold` RPC with its district/school scope,
   category, reason, and optional expiration. Do not rely on review notes alone.
   An active hold pauses automatic retention deletion, and a matching hold
   prevents this request from being scheduled or completed. Release a hold only
   through `release_legal_hold` with a separate reason.
3. Prepare a protected tenant export. Store it only in the district-approved
   encrypted location, never in a public link or ordinary support email. Record
   the vault/ticket reference, not a secret or download token.
4. Have a different, higher-scope administrator verify the export. A district
   administrator may mark a school export ready. Platform staff must verify a
   district export.
5. A platform super administrator approves the request. Confirm immediately
   that the tenant is inactive/private and normal users can no longer enter the
   workspace.
6. Observe the documented recovery window. Set the future deletion window in
   StormHub only after confirming no matching legal hold is active. If the
   district withdraws the instruction, use **Cancel request** before physical
   purge and verify that the exact captured tenant and profile states, including
   the access-disabled markers, were restored.
7. At the approved window, an authorized operator performs a tenant-scoped
   purge under a change ticket. The purge must cover:
   - tenant profiles and corresponding Supabase Auth identities;
   - clubs, memberships, posts, resources, events, RSVPs, opportunities,
     signups, assignments, submissions, grades, attendance, service hours, and
     notifications;
   - coursework objects and other tenant-owned Supabase Storage objects;
   - support messages, email queue payloads, analytics rows, policy acceptance
     links, access codes, temporary support sessions, and provider tokens;
   - derived/search/cache copies and any separately stored exports that have
     reached their approved lifetime.
8. Do not delete the offboarding request or its event history. The migration
   intentionally prevents authenticated users from rewriting or deleting this
   evidence. Its school/district UUIDs are immutable audit identifiers rather
   than tenant foreign keys, so the history survives a later verified purge of
   the school or district row.
9. Run the verification checks below. Store the ticket/report reference in the
   completion field, then mark the request complete. Marking it complete
   records evidence only; it does not run another purge.

## Verification checklist

For a school purge, verify zero current rows for the school ID and zero covered
Auth users for profiles formerly assigned to that school. For a district
purge, repeat the check for every captured child school and the district ID.

The operator must attach counts or screenshots from:

- the tenant profile inventory;
- club/coursework/opportunity/event inventories;
- the Supabase Storage object listing for the tenant prefixes;
- the Supabase Auth identity listing;
- the email outbox, support inbox, analytics, and provider-token inventories;
- the next backup-deletion or backup-expiry date.

Backups are not silently edited in place. Record when the final backup
containing the tenant will expire under the retention schedule. If a backup is
restored before that date, replay the completed deletion instruction before
returning the environment to service, as described in
`docs/BACKUP_AND_RECOVERY.md`.

## Incident and rollback rule

Before physical purge, canceling an approved or scheduled request restores the
captured tenant and per-profile account states. After physical purge begins, do
not use restore as an ordinary rollback. Stop the change, preserve logs, and follow
`docs/INCIDENT_RESPONSE.md`; restoring deleted student data requires documented
district authorization and a privacy review.
