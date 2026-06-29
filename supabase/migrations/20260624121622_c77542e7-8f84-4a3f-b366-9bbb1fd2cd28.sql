CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id uuid PRIMARY KEY,
  free_searches_used integer NOT NULL DEFAULT 0,
  is_subscribed boolean NOT NULL DEFAULT false,
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
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_usage (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_usage ON auth.users;
CREATE TRIGGER on_auth_user_created_usage
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_usage();

REVOKE EXECUTE ON FUNCTION public.handle_new_user_usage() FROM PUBLIC, anon, authenticated;