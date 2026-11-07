CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_settings()
RETURNS TABLE(setting_key text, setting_value jsonb, description text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permisos de Superadmin.' USING errcode = '42501';
  END IF;
  RETURN QUERY
    SELECT ps.setting_key, ps.setting_value, ps.description, ps.updated_at
    FROM public.platform_settings ps ORDER BY ps.setting_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.platform_save_setting(
  p_setting_key text, p_setting_value jsonb, p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_old jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'No tienes permisos de Superadmin.' USING errcode = '42501';
  END IF;
  IF p_setting_key IS NULL OR p_setting_key !~ '^[a-z][a-z0-9_.-]{1,79}$' THEN
    RAISE EXCEPTION 'Clave de ajuste inválida.' USING errcode = '22023';
  END IF;
  IF p_setting_value IS NULL THEN
    RAISE EXCEPTION 'El valor del ajuste no puede ser nulo.' USING errcode = '22023';
  END IF;
  SELECT setting_value INTO v_old FROM public.platform_settings WHERE setting_key = p_setting_key;
  INSERT INTO public.platform_settings(setting_key, setting_value, description, updated_by, updated_at)
  VALUES (p_setting_key, p_setting_value, p_description, auth.uid(), now())
  ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
  INSERT INTO public.platform_audit_logs(actor_user_id, business_name, previous_status, new_status, note)
  VALUES (auth.uid(), 'Ajustes de plataforma', 'updated',
          CASE WHEN v_old IS NULL THEN 'created' ELSE 'updated' END,
          'Ajuste modificado: ' || p_setting_key);
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_list_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_save_setting(text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_save_setting(text, jsonb, text) TO authenticated, service_role;