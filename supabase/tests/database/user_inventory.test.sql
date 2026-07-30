BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(19);

SELECT has_function(
  'public',
  'get_admin_user_inventory',
  ARRAY['integer', 'integer', 'text', 'uuid', 'text'],
  'the scoped administrator inventory RPC exists'
);

INSERT INTO public.districts (id, name, slug, is_active)
VALUES (
  'd6000000-0000-4000-8000-000000000002',
  'Inventory Outside District',
  'inventory-outside-district',
  TRUE
);

INSERT INTO public.schools (
  id, district_id, name, slug, is_active, is_public, allowed_email_domains
) VALUES (
  'b6000000-0000-4000-8000-000000000002',
  'd6000000-0000-4000-8000-000000000002',
  'Inventory Outside School',
  'inventory-outside-school',
  TRUE,
  TRUE,
  ARRAY['outside.test']
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '76000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'inventory-platform@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory Platform"}',
    NOW(), NOW()
  ),
  (
    '76000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'inventory-district@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory District"}',
    NOW(), NOW()
  ),
  (
    '76000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'inventory-admin@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory School Admin"}',
    NOW(), NOW()
  ),
  (
    '76000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'inventory-student@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory Local Student"}',
    NOW(), NOW()
  ),
  (
    '76000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'inventory-outside@example.test', '', NOW(),
    '{"provider":"google","providers":["google"]}', '{"full_name":"Inventory Outside Student"}',
    NOW(), NOW()
  );

UPDATE public.profiles
SET role = 'super_admin', school_id = NULL, district_id = NULL
WHERE id = '76000000-0000-4000-8000-000000000001';

UPDATE public.profiles
SET
  role = 'district_admin',
  school_id = NULL,
  district_id = 'd0000000-0000-4000-8000-000000000001'
WHERE id = '76000000-0000-4000-8000-000000000002';

UPDATE public.profiles
SET role = 'admin', school_id = 'a0000000-0000-4000-8000-000000000001'
WHERE id = '76000000-0000-4000-8000-000000000003';

UPDATE public.profiles
SET school_id = 'a0000000-0000-4000-8000-000000000001'
WHERE id = '76000000-0000-4000-8000-000000000004';

UPDATE public.profiles
SET school_id = 'b6000000-0000-4000-8000-000000000002'
WHERE id = '76000000-0000-4000-8000-000000000005';

-- Simulate a legacy bad assignment so the inventory proves that nested club
-- details cannot leak across a school boundary even when profile scope is valid.
INSERT INTO public.club_memberships (club_id, user_id, status, role)
SELECT
  club.id,
  '76000000-0000-4000-8000-000000000004',
  'active',
  'member'
FROM public.clubs club
WHERE club.school_id = 'a0000000-0000-4000-8000-000000000001'
ORDER BY club.id
LIMIT 1;

INSERT INTO public.club_memberships (club_id, user_id, status, role)
SELECT
  club.id,
  '76000000-0000-4000-8000-000000000004',
  'active',
  'member'
FROM public.clubs club
WHERE club.school_id = 'b6000000-0000-4000-8000-000000000002'
ORDER BY club.id
LIMIT 1;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"76000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT COUNT(*) FROM public.get_admin_user_inventory(1, 2, NULL, NULL, NULL)),
  2::BIGINT,
  'platform inventory applies server-side page size'
);
SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_user_inventory(1, 2, NULL, NULL, NULL)
    LIMIT 1
  ),
  5::BIGINT,
  'platform inventory reports the exact platform profile count'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.get_admin_user_inventory(1, 50, 'Outside Student', NULL, NULL)
  ),
  1::BIGINT,
  'platform inventory searches the complete platform scope'
);
SELECT is(
  (
    SELECT user_id
    FROM public.get_admin_user_inventory(1, 50, NULL, NULL, 'super_admin')
    WHERE user_id = '76000000-0000-4000-8000-000000000001'
  ),
  '76000000-0000-4000-8000-000000000001'::UUID,
  'platform inventory includes and filters elevated accounts'
);
SELECT ok(
  STRPOS(
    pg_get_function_result(
      'public.get_admin_user_inventory(integer,integer,text,uuid,text)'::REGPROCEDURE
    ),
    'grade_level'
  ) = 0
  AND STRPOS(
    pg_get_function_result(
      'public.get_admin_user_inventory(integer,integer,text,uuid,text)'::REGPROCEDURE
    ),
    'graduation_year'
  ) = 0
  AND STRPOS(
    pg_get_function_result(
      'public.get_admin_user_inventory(integer,integer,text,uuid,text)'::REGPROCEDURE
    ),
    'onboarding_reset_at'
  ) = 0
  AND STRPOS(
    pg_get_function_result(
      'public.get_admin_user_inventory(integer,integer,text,uuid,text)'::REGPROCEDURE
    ),
    'avatar_url'
  ) = 0,
  'the platform inventory omits unused student lifecycle and profile-decoration fields'
);
SELECT is(
  (
    SELECT JSONB_ARRAY_LENGTH(club_assignments)
    FROM public.get_admin_user_inventory(1, 100, 'Inventory Local Student', NULL, NULL)
    WHERE user_id = '76000000-0000-4000-8000-000000000004'
  ),
  0,
  'platform aggregate inventory omits private club roster details'
);
SELECT is(
  (
    SELECT JSONB_ARRAY_LENGTH(club_assignments)
    FROM public.get_admin_user_inventory(
      1,
      100,
      'Inventory Local Student',
      'a0000000-0000-4000-8000-000000000001',
      NULL
    )
    WHERE user_id = '76000000-0000-4000-8000-000000000004'
  ),
  0,
  'platform school inventory omits club roster details without support access'
);

RESET ROLE;
INSERT INTO public.platform_support_sessions (
  actor_user_id,
  school_id,
  reason,
  expires_at
) VALUES (
  '76000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Testing scoped inventory access',
  NOW() + INTERVAL '30 minutes'
);
SET LOCAL ROLE authenticated;

SELECT is(
  (
    SELECT JSONB_ARRAY_LENGTH(club_assignments)
    FROM public.get_admin_user_inventory(
      1,
      100,
      'Inventory Local Student',
      'a0000000-0000-4000-8000-000000000001',
      NULL
    )
    WHERE user_id = '76000000-0000-4000-8000-000000000004'
  ),
  1,
  'active school support access reveals only the selected school roster details'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.admin_audit_log audit
    WHERE audit.actor_user_id = '76000000-0000-4000-8000-000000000001'
      AND audit.action = 'view'
      AND audit.entity_type = 'user_inventory'
      AND audit.new_data->>'page' = '1'
      AND audit.new_data->>'page_size' = '50'
      AND audit.new_data->>'search_used' = 'true'
      AND NOT audit.new_data ? 'search'
      AND audit.new_data::TEXT NOT LIKE '%Outside Student%'
  ),
  'inventory access is audited without storing raw search text or user PII'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM (
      SELECT user_id FROM public.get_admin_user_inventory(1, 2, NULL, NULL, NULL)
      INTERSECT
      SELECT user_id FROM public.get_admin_user_inventory(2, 2, NULL, NULL, NULL)
    ) overlap
  ),
  0::BIGINT,
  'adjacent inventory pages do not duplicate users'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"76000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  TRUE
);
SELECT ok(
  (
    SELECT BOOL_AND(district_id = 'd0000000-0000-4000-8000-000000000001')
    FROM public.get_admin_user_inventory(1, 100, NULL, NULL, NULL)
  ),
  'district administrators see only users assigned to their district'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.get_admin_user_inventory(1, 100, 'Inventory District', NULL, NULL)
  ),
  1::BIGINT,
  'district inventory includes its district administrator account'
);
SELECT throws_ok(
  $$
    SELECT *
    FROM public.get_admin_user_inventory(
      1, 50, NULL, 'b6000000-0000-4000-8000-000000000002', NULL
    )
  $$,
  'P0001',
  'Administrator access required for this school',
  'district administrators cannot request another district school'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"76000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  TRUE
);
SELECT ok(
  (
    SELECT BOOL_AND(school_id = 'a0000000-0000-4000-8000-000000000001')
    FROM public.get_admin_user_inventory(1, 100, NULL, NULL, NULL)
  ),
  'school administrators see only users assigned to their school'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.get_admin_user_inventory(1, 100, 'Outside Student', NULL, NULL)
  ),
  0::BIGINT,
  'school administrators cannot search another school user'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.get_admin_user_inventory(1, 100, 'Inventory Local Student', NULL, NULL) inventory
    CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(inventory.club_assignments) assignment
    WHERE inventory.user_id = '76000000-0000-4000-8000-000000000004'
      AND assignment->>'club_id' IN (
        SELECT club.id::TEXT
        FROM public.clubs club
        WHERE club.school_id = 'b6000000-0000-4000-8000-000000000002'
      )
  ),
  0::BIGINT,
  'school inventory does not expose a legacy cross-school club assignment'
);
SELECT throws_ok(
  $$
    SELECT *
    FROM public.get_admin_user_inventory(
      1, 50, NULL, 'b6000000-0000-4000-8000-000000000002', NULL
    )
  $$,
  'P0001',
  'Administrator access required for this school',
  'school administrators cannot request another school'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"76000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',
  TRUE
);
SELECT throws_ok(
  $$ SELECT * FROM public.get_admin_user_inventory(1, 50, NULL, NULL, NULL) $$,
  'P0001',
  'Administrator access required',
  'non-administrators cannot access the user inventory'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
