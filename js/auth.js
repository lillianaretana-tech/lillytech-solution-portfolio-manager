// =====================================================================
// LillyTech Solution Portfolio Manager — Autenticación
// Guarda de sesión para páginas protegidas, obtención del perfil
// (con su rol) del usuario actual, y cierre de sesión.
// =====================================================================

import { supabase } from './supabase-client.js';

/**
 * Debe llamarse al inicio de toda página protegida (dashboard,
 * solution-edit, etc.). Si no hay sesión activa, redirige al login
 * y devuelve null. Si hay sesión, devuelve el objeto session.
 */
export async function requireSession(redirectTo = 'index.html') {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error verificando sesión:', error);
  }
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

/**
 * Obtiene el perfil (incluyendo role) del usuario autenticado actual.
 * Devuelve null si no hay usuario o si el perfil no se pudo leer.
 */
export async function getCurrentProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('Error obteniendo usuario actual:', userError);
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at, updated_at')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error obteniendo perfil:', error);
    return null;
  }

  return { ...data, email: user.email };
}

export function canEdit(profile) {
  return !!profile && (profile.role === 'admin' || profile.role === 'editor');
}

export function isAdmin(profile) {
  return !!profile && profile.role === 'admin';
}

export async function logout(redirectTo = 'index.html') {
  await supabase.auth.signOut();
  window.location.href = redirectTo;
}
