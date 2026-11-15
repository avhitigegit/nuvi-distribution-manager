// Supabase Edge Function: admin-users  (Step 6B)
// Lets an ADMIN list, invite, edit, block/unblock, re-invite and delete users.
// The service key is only available here on the server, never in the app.
//
// Request:  POST { action: 'list' | 'invite' | 'update' | 'set_active' | 'resend' | 'delete', ... }
//           Authorization: Bearer <the signed-in user's access token>
// Response: { ok: true, ... }  or  { error: 'message' }

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://nuvi-distribution-manager.nuviengineering.workers.dev/';

const admin = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Auth is by bearer token (no cookies), so any origin may call; the token decides.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
class Fail extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAN_FOREVER = '876000h'; // 100 years

async function caller(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Fail('Please sign in again.', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Fail('Please sign in again.', 401);
  const { data: me } = await admin.from('app_users').select('*').eq('user_id', data.user.id).maybeSingle();
  if (!me || !me.active || me.role !== 'ADMIN') throw new Fail('Only an admin can manage users.', 403);
  return me;
}

async function checkProfiles(ids: unknown): Promise<number[]> {
  if (!Array.isArray(ids)) throw new Fail('Choose at least one profile.');
  const clean = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!clean.length) return [];
  const { data, error } = await admin.from('profiles').select('id').in('id', clean);
  if (error) throw new Fail('Could not check the profiles.');
  if ((data ?? []).length !== clean.length) throw new Fail('One of the chosen profiles does not exist.');
  return clean;
}

function checkRole(role: unknown) {
  if (role !== 'ADMIN' && role !== 'MEMBER') throw new Fail('Role must be Admin or Member.');
  return role as 'ADMIN' | 'MEMBER';
}

async function activeAdminsOtherThan(userId: string) {
  const { count } = await admin.from('app_users').select('user_id', { count: 'exact', head: true })
    .eq('role', 'ADMIN').eq('active', true).neq('user_id', userId);
  return count ?? 0;
}

async function getTarget(userId: unknown) {
  if (typeof userId !== 'string' || !userId) throw new Fail('User not found.');
  const { data } = await admin.from('app_users').select('*').eq('user_id', userId).maybeSingle();
  if (!data) throw new Fail('User not found.');
  return data;
}

async function list() {
  const { data: rows, error } = await admin.from('app_users').select('*').order('created_at');
  if (error) throw new Fail('Could not load users.');
  const { data: au } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const byId = new Map((au?.users ?? []).map((u) => [u.id, u]));
  return (rows ?? []).map((r) => {
    const u = byId.get(r.user_id);
    const status = !r.active ? 'BLOCKED' : (u?.last_sign_in_at ? 'ACTIVE' : 'INVITED');
    return { ...r, status, last_sign_in_at: u?.last_sign_in_at ?? null, invited_at: u?.invited_at ?? null };
  });
}

async function invite(me: any, b: any) {
  const email = String(b.email ?? '').trim().toLowerCase();
  const name = String(b.name ?? '').trim();
  if (!EMAIL_RE.test(email)) throw new Fail('Please enter a valid email address.');
  if (!name || name.length > 80) throw new Fail('Please enter a name (max 80 characters).');
  const role = checkRole(b.role);
  const profile_ids = await checkProfiles(b.profile_ids ?? []);
  if (role === 'MEMBER' && !profile_ids.length) throw new Fail('Choose at least one profile for a member.');

  const { data: exists } = await admin.from('app_users').select('user_id').eq('email', email).maybeSingle();
  if (exists) throw new Fail('This email is already a user.');

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo: SITE_URL });
  if (error || !data.user) {
    const m = (error?.message ?? '').toLowerCase();
    if (m.includes('already') || m.includes('registered')) throw new Fail('This email already has a login. Ask the owner to check Supabase → Authentication → Users.');
    if (m.includes('rate limit')) throw new Fail('Too many emails were sent. Please wait a while and try again.');
    console.error('invite failed', error);
    throw new Fail('The invitation email could not be sent. Check the email (SMTP) settings in Supabase.');
  }
  const { error: insErr } = await admin.from('app_users')
    .insert({ user_id: data.user.id, email, name, role, profile_ids, invited_by: me.user_id });
  if (insErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Fail('Could not save the new user.');
  }
  return { user_id: data.user.id };
}

async function update(me: any, b: any) {
  const t = await getTarget(b.user_id);
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name || name.length > 80) throw new Fail('Please enter a name (max 80 characters).');
    patch.name = name;
  }
  if (b.role !== undefined) {
    const role = checkRole(b.role);
    if (t.user_id === me.user_id && role !== 'ADMIN') throw new Fail('You cannot remove your own admin role.');
    if (t.role === 'ADMIN' && role !== 'ADMIN' && await activeAdminsOtherThan(t.user_id) === 0) throw new Fail('At least one admin is needed.');
    patch.role = role;
  }
  if (b.profile_ids !== undefined) patch.profile_ids = await checkProfiles(b.profile_ids);
  const role = (patch.role ?? t.role) as string;
  const pids = (patch.profile_ids ?? t.profile_ids) as number[];
  if (role === 'MEMBER' && !pids.length) throw new Fail('Choose at least one profile for a member.');
  const { error } = await admin.from('app_users').update(patch).eq('user_id', t.user_id);
  if (error) throw new Fail('Could not save the changes.');
  if (patch.name) await admin.auth.admin.updateUserById(t.user_id, { user_metadata: { name: patch.name } });
  return {};
}

async function setActive(me: any, b: any) {
  const t = await getTarget(b.user_id);
  const active = b.active === true;
  if (t.user_id === me.user_id) throw new Fail('You cannot block yourself.');
  if (!active && t.role === 'ADMIN' && await activeAdminsOtherThan(t.user_id) === 0) throw new Fail('At least one admin is needed.');
  const { error } = await admin.from('app_users').update({ active }).eq('user_id', t.user_id);
  if (error) throw new Fail('Could not save the change.');
  await admin.auth.admin.updateUserById(t.user_id, { ban_duration: active ? 'none' : BAN_FOREVER });
  return {};
}

async function resend(_me: any, b: any) {
  const t = await getTarget(b.user_id);
  if (!t.active) throw new Fail('Unblock the user first.');
  // Not signed in yet -> a fresh invitation; otherwise a "set a new password" email.
  const { data: u } = await admin.auth.admin.getUserById(t.user_id);
  if (!u.user?.last_sign_in_at) {
    const { error } = await admin.auth.admin.inviteUserByEmail(t.email, { data: { name: t.name }, redirectTo: SITE_URL });
    if (!error) return { sent: 'invite' };
  }
  const { error } = await admin.auth.resetPasswordForEmail(t.email, { redirectTo: SITE_URL });
  if (error) {
    if ((error.message ?? '').toLowerCase().includes('rate limit')) throw new Fail('Too many emails were sent. Please wait a while and try again.');
    console.error('resend failed', error);
    throw new Fail('The email could not be sent. Check the email (SMTP) settings in Supabase.');
  }
  return { sent: 'reset' };
}

async function remove(me: any, b: any) {
  const t = await getTarget(b.user_id);
  if (t.user_id === me.user_id) throw new Fail('You cannot delete yourself.');
  if (t.role === 'ADMIN' && await activeAdminsOtherThan(t.user_id) === 0) throw new Fail('At least one admin is needed.');
  const { error } = await admin.auth.admin.deleteUser(t.user_id); // app_users row is removed by cascade
  if (error) throw new Fail('Could not delete the user.');
  return {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const me = await caller(req);
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case 'list':       return reply({ ok: true, users: await list() });
      case 'invite':     return reply({ ok: true, ...(await invite(me, b)) });
      case 'update':     return reply({ ok: true, ...(await update(me, b)) });
      case 'set_active': return reply({ ok: true, ...(await setActive(me, b)) });
      case 'resend':     return reply({ ok: true, ...(await resend(me, b)) });
      case 'delete':     return reply({ ok: true, ...(await remove(me, b)) });
      default:           return reply({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    if (e instanceof Fail) return reply({ error: e.message }, e.status);
    console.error(e);
    return reply({ error: 'Something went wrong on the server.' }, 500);
  }
});
