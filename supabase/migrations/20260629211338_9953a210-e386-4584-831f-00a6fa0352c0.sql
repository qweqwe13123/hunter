-- user_usage
CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  searches_used integer NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_usage TO authenticated;
GRANT ALL ON public.user_usage TO service_role;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users insert own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users update own usage" ON public.user_usage;
CREATE POLICY "Users view own usage" ON public.user_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own usage" ON public.user_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own usage" ON public.user_usage
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND plan = (SELECT plan FROM public.user_usage WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_usage (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_usage ON auth.users;
CREATE TRIGGER on_auth_user_created_usage
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_usage();
REVOKE EXECUTE ON FUNCTION public.handle_new_user_usage() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_plan_limit(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _plan WHEN 'agency' THEN 2000 WHEN 'pro' THEN 500 WHEN 'starter' THEN 100 ELSE 3 END;
$$;

CREATE OR REPLACE FUNCTION public.consume_search(_user_id uuid, _cost integer DEFAULT 1)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.user_usage; _limit int; _new_used int;
BEGIN
  INSERT INTO public.user_usage (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO _row FROM public.user_usage WHERE user_id = _user_id FOR UPDATE;
  IF _row.period_start < date_trunc('month', now())::date THEN
    UPDATE public.user_usage SET searches_used = 0, period_start = date_trunc('month', now())::date, updated_at = now()
      WHERE user_id = _user_id RETURNING * INTO _row;
  END IF;
  _limit := public.get_plan_limit(_row.plan);
  IF _row.searches_used + _cost > _limit THEN
    RETURN json_build_object('allowed', false, 'plan', _row.plan, 'used', _row.searches_used, 'limit', _limit, 'remaining', GREATEST(_limit - _row.searches_used, 0));
  END IF;
  _new_used := _row.searches_used + _cost;
  UPDATE public.user_usage SET searches_used = _new_used, updated_at = now() WHERE user_id = _user_id;
  RETURN json_build_object('allowed', true, 'plan', _row.plan, 'used', _new_used, 'limit', _limit, 'remaining', _limit - _new_used);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_search(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_search(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_usage()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE EXECUTE ON FUNCTION public.get_my_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_usage() TO authenticated;

CREATE TABLE IF NOT EXISTS public.places_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.places_cache TO service_role;
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;