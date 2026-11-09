import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type MenuyaAuthContext = {
  session: Session;
  user: User;
  profile: { id: string; full_name: string | null; phone: string | null } | null;
  memberships: Array<{
    business_id: string;
    role: string;
    status: string;
    businesses: {
      id: string;
      name: string;
      slug: string;
      business_type: string;
      status: string;
      is_published: boolean;
    } | null;
  }>;
  isPlatformAdmin: boolean;
};

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error('Falta configurar la conexión de Supabase en las variables de entorno.');
  }
}

export async function signInWithEmail(email: string, password: string) {
  ensureConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  businessName: string;
  businessType: string;
  privacyPolicyVersion: string;
  privacyConsentAt: string;
  termsVersion: string;
}) {
  ensureConfigured();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        business_name: input.businessName.trim(),
        business_type: input.businessType.trim(),
        privacy_policy_version: input.privacyPolicyVersion,
        privacy_consent_at: input.privacyConsentAt,
        terms_version: input.termsVersion,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordRecovery(email: string) {
  ensureConfigured();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/reset-password` },
  );
  if (error) throw error;
}

export async function signOut() {
  ensureConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAuthContext(): Promise<MenuyaAuthContext | null> {
  ensureConfigured();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData.session;
  if (!session?.user) return null;

  const userId = session.user.id;
  const [profileResult, membershipResult, adminResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('id', userId).maybeSingle(),
    supabase
      .from('business_memberships')
      .select('business_id, role, status, businesses(id, name, slug, business_type, status, is_published)')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('platform_admins').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (adminResult.error) throw adminResult.error;

  return {
    session,
    user: session.user,
    profile: profileResult.data,
    memberships: (membershipResult.data || []) as unknown as MenuyaAuthContext['memberships'],
    isPlatformAdmin: Boolean(adminResult.data),
  };
}

export function subscribeToAuthChanges(
  callback: (session: Session | null) => void,
) {
  ensureConfigured();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function ensureBusinessForCurrentUser(): Promise<MenuyaAuthContext | null> {
  const context = await getAuthContext();
  if (!context) return null;
  if (context.memberships.length > 0 || context.isPlatformAdmin) return context;

  const metadata = context.user.user_metadata || {};
  const businessName = String(metadata.business_name || '').trim();
  const businessType = String(metadata.business_type || '').trim();
  const phone = String(metadata.phone || '').trim();
  if (!businessName || !businessType) return context;

  const slugBase = businessName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'mi-comercio';
  const slug = `${slugBase}-${context.user.id.slice(0, 6)}`;
  const { error } = await supabase.rpc('register_business', {
    p_name: businessName,
    p_slug: slug,
    p_business_type: businessType,
    p_phone: phone || null,
    p_email: context.user.email || null,
  });
  if (error) throw error;
  return getAuthContext();
}

export async function preparePasswordRecovery(): Promise<boolean> {
  ensureConfigured();
  const current = await supabase.auth.getSession();
  if (current.data.session) return true;

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (data.session) return true;
  }
  if (tokenHash && type === 'recovery') {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) throw error;
    if (data.session) return true;
  }
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    if (data.session) return true;
  }
  const refreshed = await supabase.auth.getSession();
  return Boolean(refreshed.data.session);
}

export async function updatePassword(password: string) {
  ensureConfigured();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    throw new Error('El enlace de recuperación no inició sesión. Solicita un correo nuevo y abre el enlace completo.');
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export { isSupabaseConfigured };
