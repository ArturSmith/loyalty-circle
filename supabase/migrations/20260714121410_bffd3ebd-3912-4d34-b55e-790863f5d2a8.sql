
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#1a1a2e',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Businesses publicly readable" ON public.businesses FOR SELECT USING (true);
CREATE POLICY "Owners insert own business" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own business" ON public.businesses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own business" ON public.businesses FOR DELETE USING (auth.uid() = owner_id);
CREATE INDEX idx_businesses_owner ON public.businesses(owner_id);

CREATE TABLE public.card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  total_steps INTEGER NOT NULL DEFAULT 10 CHECK (total_steps BETWEEN 3 AND 20),
  shape TEXT NOT NULL DEFAULT 'rounded' CHECK (shape IN ('rounded','square','ticket')),
  bg_color TEXT NOT NULL DEFAULT '#faf8f2',
  accent_color TEXT NOT NULL DEFAULT '#1a1a2e',
  text_color TEXT NOT NULL DEFAULT '#1a1a2e',
  stamp_icon TEXT NOT NULL DEFAULT 'scissors',
  logo_url TEXT,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_templates TO authenticated;
GRANT SELECT ON public.card_templates TO anon;
GRANT ALL ON public.card_templates TO service_role;
ALTER TABLE public.card_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates publicly readable" ON public.card_templates FOR SELECT USING (true);
CREATE POLICY "Owners manage templates" ON public.card_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()));
CREATE INDEX idx_templates_business ON public.card_templates(business_id);

CREATE TABLE public.card_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.card_templates(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stamps_count INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_instances TO authenticated;
GRANT ALL ON public.card_instances TO service_role;
ALTER TABLE public.card_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own instances" ON public.card_instances FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Owner reads business instances" ON public.card_instances FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.card_templates t JOIN public.businesses b ON b.id = t.business_id
    WHERE t.id = template_id AND b.owner_id = auth.uid()
  ));
CREATE POLICY "Customer creates own instance" ON public.card_instances FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer deletes own instance" ON public.card_instances FOR DELETE USING (customer_id = auth.uid());
CREATE INDEX idx_instances_customer ON public.card_instances(customer_id);
CREATE INDEX idx_instances_template ON public.card_instances(template_id);

CREATE TABLE public.stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_instance_id UUID NOT NULL REFERENCES public.card_instances(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES auth.users(id),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stamps TO authenticated;
GRANT ALL ON public.stamps TO service_role;
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own stamps" ON public.stamps FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.card_instances ci WHERE ci.id = card_instance_id AND ci.customer_id = auth.uid()));
CREATE POLICY "Owner reads own stamps" ON public.stamps FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid()));
CREATE INDEX idx_stamps_instance ON public.stamps(card_instance_id);
CREATE INDEX idx_stamps_business ON public.stamps(business_id);

CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template public.card_templates%ROWTYPE;
  v_business public.businesses%ROWTYPE;
  v_instance public.card_instances%ROWTYPE;
  v_last_stamp TIMESTAMPTZ;
  v_new_count INTEGER;
  v_reward JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_instance FROM public.card_instances WHERE id = _card_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not found'; END IF;
  SELECT * INTO v_template FROM public.card_templates WHERE id = v_instance.template_id;
  SELECT * INTO v_business FROM public.businesses WHERE id = v_template.business_id;
  IF v_business.owner_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF v_instance.stamps_count >= v_template.total_steps THEN RAISE EXCEPTION 'card is full'; END IF;
  SELECT MAX(created_at) INTO v_last_stamp FROM public.stamps WHERE card_instance_id = _card_instance_id;
  IF v_last_stamp IS NOT NULL AND v_last_stamp > now() - INTERVAL '30 seconds' THEN
    RAISE EXCEPTION 'please wait a moment before stamping again';
  END IF;
  v_new_count := v_instance.stamps_count + 1;
  INSERT INTO public.stamps (card_instance_id, issued_by, business_id, step_number)
  VALUES (_card_instance_id, auth.uid(), v_business.id, v_new_count);
  UPDATE public.card_instances
    SET stamps_count = v_new_count,
        completed_at = CASE WHEN v_new_count >= v_template.total_steps THEN now() ELSE completed_at END
    WHERE id = _card_instance_id;
  SELECT r INTO v_reward FROM jsonb_array_elements(v_template.rewards) r WHERE (r->>'step')::int = v_new_count LIMIT 1;
  RETURN jsonb_build_object('stamps_count', v_new_count, 'total_steps', v_template.total_steps, 'reward', v_reward, 'completed', v_new_count >= v_template.total_steps);
END; $$;
GRANT EXECUTE ON FUNCTION public.add_stamp(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.card_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
