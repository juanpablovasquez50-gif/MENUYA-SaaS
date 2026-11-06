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
}) {
  ensureConfigured();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
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
    memberships: (membershipResult.data || []) as MenuyaAuthContext['memberships'],
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
