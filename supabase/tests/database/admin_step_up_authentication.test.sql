BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  TRUE
);
SET LOCAL ROLE authenticated;
SELECT isnt(
  public.has_recent_admin_authentication(),
  TRUE,
  'an access token without AMR does not satisfy administrator step-up'
);
SELECT throws_ok(
  $$SELECT public.admin_set_account_status(
      '10000000-0000-4000-8000-000000000002',
      'suspended'
    )$$,
  'P0001',
  'Recent administrator authentication required',
  'a sensitive RPC rejects an old session before mutation'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '10000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT - 301
    ))
  )::TEXT,
  TRUE
);
SELECT isnt(
  public.has_recent_admin_authentication(),
  TRUE,
  'a password confirmation older than five minutes is rejected'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '10000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT
    ))
  )::TEXT,
  TRUE
);
SELECT ok(
  public.has_recent_admin_authentication(),
  'a recent password confirmation satisfies administrator step-up'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '10000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'oauth',
      'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT
    ))
  )::TEXT,
  TRUE
);
SELECT ok(
  public.has_recent_admin_authentication(),
  'a recent Google OAuth confirmation satisfies administrator step-up'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '10000000-0000-4000-8000-000000000001',
    'role', 'authenticated',
    'aal', 'aal1',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'token_refresh',
      'timestamp', EXTRACT(EPOCH FROM NOW())::BIGINT
    ))
  )::TEXT,
  TRUE
);
SELECT isnt(
  public.has_recent_admin_authentication(),
  TRUE,
  'an ordinary token refresh is not administrator step-up authentication'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
