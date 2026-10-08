import { getStore } from '@netlify/blobs';
import { getUser, admin } from '@netlify/identity';

const ISL = ['Agatti', 'Bangaram', 'Kadmat', 'Kavaratti', 'Minicoy', 'Kalpeni'];
const VIBES = ['Relax', 'Adventure', 'Romance', 'Family', 'Culture'];
const TRAVEL = ['flight', 'ship', 'none'];
const ACTS = ['Snorkelling', 'Scuba diving', 'Kayaking', 'Glass-boat', 'Island hopping', 'Fishing', 'Beach stay'];
const MAX_PER_OWNER = 25;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const json = (d, s = 200) => Response.json(d, { status: s });
const fail = (m, s = 400) => json({ error: m }, s);
const t = (v, n) => String(v ?? '').trim().slice(0, n);
const adminEmails = () => (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
const ID = /^[0-9a-f-]{36}$/;

function clean(b) {
  const p = {
    title: t(b.title, 80), op: t(b.op, 80), isl: t(b.isl, 30), vibe: t(b.vibe, 20), tr: t(b.tr, 10),
    price: Math.round(+b.price), days: Math.round(+b.days), inc: t(b.inc, 400), ph: t(b.ph, 20), mail: t(b.mail, 100),
    acts: (Array.isArray(b.acts) ? b.acts : []).filter((a) => ACTS.includes(a)).slice(0, 7),
    months: (Array.isArray(b.months) ? b.months : []).filter((m) => MONTHS.includes(m)),
    it: (Array.isArray(b.it) ? b.it : []).slice(0, 14)
      .map((d) => ({ e: t(d?.e || '📍', 4), t: t(d?.t, 80), d: t(d?.d, 300) })).filter((d) => d.t),
  };
  if (!p.title || !p.op) return { error: 'Business name and package title are required.' };
  if (!ISL.includes(p.isl) || !VIBES.includes(p.vibe) || !TRAVEL.includes(p.tr)) return { error: 'Choose a valid island, vibe and travel option.' };
  if (!(p.price >= 1000 && p.price <= 500000)) return { error: 'Price must be between ₹1,000 and ₹5,00,000.' };
  if (!(p.days >= 2 && p.days <= 14)) return { error: 'Duration must be 2 to 14 days.' };
  if (p.ph.replace(/\D/g, '').length < 10) return { error: 'Enter a phone number with at least 10 digits.' };
  if (!/^\S+@\S+\.\S+$/.test(p.mail)) return { error: 'Enter a valid email address.' };
  if (!p.acts.length) p.acts = ['Beach stay'];
  if (!p.it.length) return { error: 'Add at least one itinerary day.' };
  return { p };
}

const toBuf = (b64) => { const u = Buffer.from(b64, 'base64'); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); };

export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = req.method;
  const ip = req.headers.get('x-nf-client-connection-ip') || 'x';

  if (method !== 'GET') {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return fail('Forbidden', 403);
  }

  const user = await getUser();
  const isAdmin = !!user && adminEmails().includes((user.email || '').toLowerCase());
  const store = getStore({ name: 'packages', consistency: 'strong' });
  const photos = getStore({ name: 'photos', consistency: 'strong' });
  const stats = getStore({ name: 'stats' });
  const reports = getStore({ name: 'reports', consistency: 'strong' });
  const meta = getStore({ name: 'meta', consistency: 'strong' });
  const body = async () => (await req.json().catch(() => ({}))) || {};
  const listAll = async () => {
    const { blobs } = await store.list();
    return (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
  };
  const withStats = (list) => Promise.all(list.map(async (p) => ({ ...p, stats: (await stats.get(p.id, { type: 'json' })) || {} })));
  const newest = (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.createdAt - a.createdAt;
  const savePhotos = async (id, arr) => {
    const ok = (Array.isArray(arr) ? arr : []).filter((d) => typeof d === 'string' && d.startsWith('data:image/jpeg;base64,') && d.length < 400000).slice(0, 3);
    for (let i = 0; i < 3; i++) await photos.delete(`${id}/${i}`);
    for (let i = 0; i < ok.length; i++) await photos.set(`${id}/${i}`, toBuf(ok[i].split(',')[1]));
    return ok.length;
  };
  const dropPackage = async (p) => { for (let i = 0; i < 3; i++) await photos.delete(`${p.id}/${i}`); await stats.delete(p.id); await store.delete(p.id); };

  if (parts[0] === 'me') return json({ user: user ? { id: user.id, email: user.email } : null, admin: isAdmin });

  if (parts[0] === 'photos' && ID.test(parts[1] || '') && /^[0-2]$/.test(parts[2] || '')) {
    const buf = await photos.get(`${parts[1]}/${parts[2]}`, { type: 'arrayBuffer' });
    if (!buf) return fail('Not found', 404);
    return new Response(buf, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
  }

  if (parts[0] === 'track' && method === 'POST') {
    const b = await body();
    if (!ID.test(b.id || '') || !['view', 'wa', 'call', 'mail'].includes(b.type)) return fail('Bad request');
    if (!(await store.get(b.id, { type: 'json' }))) return fail('Not found', 404);
    const s = (await stats.get(b.id, { type: 'json' })) || {};
    s[b.type] = (s[b.type] || 0) + 1;
    await stats.setJSON(b.id, s);
    return json({ ok: true });
  }

  if (parts[0] === 'report') {
    if (method === 'POST') {
      const b = await body();
      const last = await meta.get(`rl-${ip.replace(/[^\w.:-]/g, '')}`, { type: 'json' });
      if (last && Date.now() - last < 30000) return fail('Please wait a moment before sending another report.', 429);
      const p = ID.test(b.id || '') && (await store.get(b.id, { type: 'json' }));
      if (!p) return fail('Package not found', 404);
      await meta.setJSON(`rl-${ip.replace(/[^\w.:-]/g, '')}`, Date.now());
      const rid = crypto.randomUUID();
      await reports.setJSON(rid, { id: rid, pkg: p.id, title: p.title, reason: t(b.reason, 300), at: Date.now() });
      return json({ ok: true }, 201);
    }
    return fail('Not found', 404);
  }

  if (parts[0] === 'reports') {
    if (!isAdmin) return fail('Admins only', 403);
    if (method === 'GET') {
      const { blobs } = await reports.list();
      const rows = (await Promise.all(blobs.map((x) => reports.get(x.key, { type: 'json' })))).filter(Boolean);
      return json(rows.sort((a, b) => b.at - a.at));
    }
    if (method === 'DELETE' && ID.test(parts[1] || '')) { await reports.delete(parts[1]); return json({ ok: true }); }
    return fail('Not found', 404);
  }

  if (parts[0] === 'settings') {
    if (!isAdmin) return fail('Admins only', 403);
    if (method === 'PUT') { const b = await body(); await meta.setJSON('approval', !!b.approval); }
    return json({ approval: !!(await meta.get('approval', { type: 'json' })) });
  }

  if (parts[0] === 'packages') {
    const id = parts[1];
    if (!id && method === 'GET') {
      const all = await listAll();
      if (url.searchParams.get('all')) {
        if (!isAdmin) return fail('Admins only', 403);
        return json(await withStats(all.sort(newest)));
      }
      if (url.searchParams.get('mine')) {
        if (!user) return fail('Please log in', 401);
        return json(await withStats(all.filter((p) => p.ownerId === user.id).sort(newest)));
      }
      return json(all.filter((p) => p.status === 'live').sort(newest).map(({ ownerId, ownerEmail, ...pub }) => pub));
    }
    if (!user) return fail('Please log in', 401);

    if (!id && method === 'POST') {
      const b = await body();
      const c = clean(b);
      if (c.error) return fail(c.error);
      const mine = (await listAll()).filter((p) => p.ownerId === user.id);
      if (mine.length >= MAX_PER_OWNER) return fail(`You can list up to ${MAX_PER_OWNER} packages.`);
      if (mine.some((p) => Date.now() - p.createdAt < 10000)) return fail('Please wait a few seconds before adding another package.', 429);
      const pid = crypto.randomUUID();
      const pc = await savePhotos(pid, b.photos);
      const approval = !!(await meta.get('approval', { type: 'json' }));
      const rec = { ...c.p, id: pid, pc, ownerId: user.id, ownerEmail: user.email, status: approval && !isAdmin ? 'pending' : 'live', verified: false, featured: false, createdAt: Date.now() };
      await store.setJSON(pid, rec);
      return json(rec, 201);
    }

    if (id && ID.test(id)) {
      const cur = await store.get(id, { type: 'json' });
      if (!cur) return fail('Package not found', 404);
      if (cur.ownerId !== user.id && !isAdmin) return fail('Not your package', 403);
      if (method === 'DELETE') { await dropPackage(cur); return json({ ok: true }); }
      if (method === 'PUT') {
        const b = await body();
        let next = { ...cur };
        if (b.title === undefined) {
          if (b.status === 'hidden' || (b.status === 'live' && (isAdmin || cur.status !== 'pending'))) next.status = b.status;
          else if (b.status) return fail('This package is waiting for admin approval.', 403);
          if (isAdmin && typeof b.verified === 'boolean') next.verified = b.verified;
          if (isAdmin && typeof b.featured === 'boolean') next.featured = b.featured;
        } else {
          const c = clean(b);
          if (c.error) return fail(c.error);
          next = { ...cur, ...c.p };
          if (Array.isArray(b.photos) && b.photos.length) next.pc = await savePhotos(id, b.photos);
        }
        await store.setJSON(id, next);
        return json(next);
      }
    }
    return fail('Not found', 404);
  }

  if (parts[0] === 'users') {
    if (!isAdmin) return fail('Admins only', 403);
    if (method === 'GET' && !parts[1]) {
      const users = await admin.listUsers();
      return json(users.map((u) => ({ id: u.id, email: u.email, created: u.createdAt || u.created_at || '' })));
    }
    if (method === 'DELETE' && parts[1]) {
      if (parts[1] === user.id) return fail('You cannot delete your own account.');
      for (const p of (await listAll()).filter((x) => x.ownerId === parts[1])) await dropPackage(p);
      await admin.deleteUser(parts[1]);
      return json({ ok: true });
    }
  }
  return fail('Not found', 404);
};

export const config = { path: '/api/*' };
