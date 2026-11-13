import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesión requerida.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Credenciales del servidor no configuradas.' }, 500);
  const callerClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: authError } = await callerClient.auth.getUser(authorization.slice(7));
  if (authError || !caller.user) return json({ error: 'La sesión no es válida.' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: platformAdmin, error: roleError } = await admin.from('platform_admins').select('user_id').eq('user_id', caller.user.id).maybeSingle();
  if (roleError) return json({ error: 'No se pudo validar el rol de Súper Admin.' }, 500);
  if (!platformAdmin) return json({ error: 'Solo el Súper Admin de Menuya puede crear administradores de soporte.' }, 403);
  let input: { displayName?: string; username?: string; password?: string };
  try { input = await req.json(); } catch { return json({ error: 'Solicitud inválida.' }, 400); }
  const displayName = String(input.displayName || '').trim();
  const username = String(input.username || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (displayName.length < 2 || displayName.length > 80) return json({ error: 'Escribe el nombre del administrador.' }, 400);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return json({ error: 'El usuario debe tener entre 3 y 32 caracteres y usar letras, números, punto, guion o guion bajo.' }, 400);
  if (password.length < 10 || password.length > 72) return json({ error: 'La contraseña debe tener entre 10 y 72 caracteres.' }, 400);
  const email = username + '@agents.clickok.internal';
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: displayName } });
  if (createError || !created.user) {
    const message = createError?.message || 'No fue posible crear el usuario.';
    if (/already|registered|exists/i.test(message)) return json({ error: 'Ese nombre de usuario ya está ocupado.' }, 409);
    return json({ error: message }, 400);
  }
  const { error: insertError } = await admin.from('clickok_support_admins').insert({ user_id: created.user.id, display_name: displayName, is_active: true });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: 'No se pudo asignar el rol de administrador. La cuenta fue revertida.' }, 500);
  }
  return json({ ok: true, userId: created.user.id, username, displayName }, 201);
});