-- 1. Tighten user_usage write access (prevent plan escalation)
DROP POLICY IF EXISTS "Users insert own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users update own usage" ON public.user_usage;
REVOKE INSERT, UPDATE ON public.user_usage FROM authenticated;
-- SELECT policy and grant remain so users can read their own row.

-- 2. Fix mutable search_path on get_plan_limit
CREATE OR REPLACE FUNCTION public.get_plan_limit(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan WHEN 'agency' THEN 2000 WHEN 'pro' THEN 500 WHEN 'starter' THEN 100 ELSE 3 END;
$$;

-- 3. get_my_usage: switch to SECURITY INVOKER (reads own row via SELECT policy)
CREATE OR REPLACE FUNCTION public.get_my_usage()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE _row public.user_usage; _uid uuid := auth.uid(); _l int;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _row FROM public.user_usage WHERE user_id = _uid;
  IF NOT FOUND THEN
    _l := public.get_plan_limit('free');
    RETURN json_build_object('plan','free','used',0,'limit',_l,'remaining',_l);
  END IF;
  _l := public.get_plan_limit(_row.plan);
  IF _row.period_start < date_trunc('month', now())::date THEN
    RETURN json_build_object('plan',_row.plan,'used',0,'limit',_l,'remaining',_l);
  END IF;
  RETURN json_build_object('plan', _row.plan, 'used', _row.searches_used, 'limit', _l, 'remaining', GREATEST(_l - _row.searches_used, 0));
END;
$$;

-- 4. Revoke EXECUTE on consume_search from signed-in users; only service role calls it.
REVOKE EXECUTE ON FUNCTION public.consume_search(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_search(uuid, integer) TO service_role;