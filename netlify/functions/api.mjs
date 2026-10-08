import { getStore } from '@netlify/blobs';
import { getUser, admin } from '@netlify/identity';

const ISL = ['Agatti', 'Bangaram', 'Kadmat', 'Kavaratti', 'Minicoy', 'Kalpeni'];
const VIBES = ['Relax', 'Adventure', 'Romance', 'Family', 'Culture'];
const TRAVEL = ['flight', 'ship', 'none'];
const ACTS = ['Snorkelling', 'Scuba diving', 'Kayaking', 'Glass-boat', 'Island hopping', 'Fishing', 'Beach stay'];
const MAX_PER_OWNER = 25;

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

export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = req.method;

  if (method !== 'GET') {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return fail('Forbidden', 403);
  }

  const user = await getUser();
  const isAdmin = !!user && adminEmails().includes((user.email || '').toLowerCase());
  const store = getStore({ name: 'packages', consistency: 'strong' });
  const listAll = async () => {
    const { blobs } = await store.list();
    const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
    return rows.filter(Boolean);
  };

  if (parts[0] === 'me') {
    return json({ user: user ? { id: user.id, email: user.email } : null, admin: isAdmin });
  }

  if (parts[0] === 'packages') {
    const id = parts[1];
    if (!id && method === 'GET') {
      const all = await listAll();
      if (url.searchParams.get('all')) {
        if (!isAdmin) return fail('Admins only', 403);
        return json(all.sort((a, b) => b.createdAt - a.createdAt));
      }
      if (url.searchParams.get('mine')) {
        if (!user) return fail('Please log in', 401);
        return json(all.filter((p) => p.ownerId === user.id).sort((a, b) => b.createdAt - a.createdAt));
      }
      return json(all.filter((p) => p.status === 'live').sort((a, b) => b.createdAt - a.createdAt)
        .map(({ ownerId, ownerEmail, ...pub }) => pub));
    }
    if (!user) return fail('Please log in', 401);

    if (!id && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const c = clean(body);
      if (c.error) return fail(c.error);
      const mineCount = (await listAll()).filter((p) => p.ownerId === user.id).length;
      if (mineCount >= MAX_PER_OWNER) return fail(`You can list up to ${MAX_PER_OWNER} packages.`);
      const rec = { ...c.p, id: crypto.randomUUID(), ownerId: user.id, ownerEmail: user.email, status: 'live', createdAt: Date.now() };
      await store.setJSON(rec.id, rec);
      return json(rec, 201);
    }

    if (id && ID.test(id)) {
      const cur = await store.get(id, { type: 'json' });
      if (!cur) return fail('Package not found', 404);
      if (cur.ownerId !== user.id && !isAdmin) return fail('Not your package', 403);
      if (method === 'DELETE') { await store.delete(id); return json({ ok: true }); }
      if (method === 'PUT') {
        const body = await req.json().catch(() => ({}));
        let next = { ...cur };
        if (body.title === undefined && ['live', 'hidden'].includes(body.status)) next.status = body.status;
        else {
          const c = clean(body);
          if (c.error) return fail(c.error);
          next = { ...cur, ...c.p };
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
      const all = await listAll();
      await Promise.all(all.filter((p) => p.ownerId === parts[1]).map((p) => store.delete(p.id)));
      await admin.deleteUser(parts[1]);
      return json({ ok: true });
    }
  }
  return fail('Not found', 404);
};

export const config = { path: '/api/*' };
