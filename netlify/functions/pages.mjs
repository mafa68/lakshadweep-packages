import { getStore } from '@netlify/blobs';

const ISL = {
  Agatti: { b: 'The gateway island with the only airport and a large, calm lagoon.', f: ['Airport and large lagoon', 'Snorkelling and kayaking close to the beach', 'Easy boat connection to Bangaram'], best: 'first-time visitors and relaxed beach stays' },
  Bangaram: { b: 'An uninhabited atoll with quiet white beaches and premium stays.', f: ['Quiet white beaches', 'Resort-style stays', 'Calm lagoon for swimming'], best: 'couples and quiet getaways' },
  Kadmat: { b: 'A long lagoon island known for water sports and diving.', f: ['Scuba and diving schools', 'Sailing and kayaking', 'Long sandy lagoon'], best: 'adventure travellers and divers' },
  Kavaratti: { b: 'The capital island with culture, a mosque, a marine museum and glass-bottom boats.', f: ['Ujra Mosque and marine museum', 'Glass-bottom boat rides', 'Island village life'], best: 'families and culture seekers' },
  Minicoy: { b: 'A distinct island with Mahl culture, a historic lighthouse and a crescent beach.', f: ['Historic lighthouse', 'Unique Mahl language and dance', 'Crescent-shaped beach'], best: 'culture and offbeat travellers' },
  Kalpeni: { b: 'A triple-island lagoon with shallow turquoise water and sandbanks.', f: ['Sandbanks and tidal pools', 'Shallow turquoise lagoon', 'Calm, offbeat feel'], best: 'relaxed stays and snorkelling' },
};
const TRL = { flight: 'Flight included', ship: 'Ship included', none: 'Travel not included' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const slug = (p) => String(p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) + '-' + p.id.slice(0, 8);

async function livePackages() {
  const st = getStore({ name: 'packages', consistency: 'strong' });
  const { blobs } = await st.list();
  const rows = (await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' })))).filter((p) => p && p.status === 'live');
  return rows.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.createdAt - a.createdAt);
}

const CSS = `:root{--ink:#07303b;--mute:#4d6c75;--line:#cfe6e3;--lag:#0fb5a5;--bg:#f2fbfa}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,Segoe UI,Arial,sans-serif}a{color:#0a7f8c}
header,footer{padding:14px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}header{background:#fff;border-bottom:1px solid var(--line)}footer{background:#062a3a;color:#b9dcdf;margin-top:40px;font-size:14px}footer a{color:#7be0cf}
.logo{font-weight:800;text-decoration:none;color:var(--ink)}.logo b{color:var(--lag)}nav a{margin-left:14px;text-decoration:none;font-weight:600}
main{max-width:900px;margin:0 auto;padding:24px 20px}h1{font-size:clamp(26px,5vw,38px);line-height:1.2;margin:.2em 0}h2{margin-top:1.6em}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;margin:10px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.gal{display:flex;gap:8px;overflow-x:auto}.gal img{height:220px;border-radius:12px;max-width:100%}.pill{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;padding:2px 12px;margin:2px;font-size:14px}
.btn{display:inline-block;background:var(--lag);color:#012a2a;border-radius:999px;padding:10px 20px;font-weight:700;text-decoration:none;margin:4px 6px 4px 0}.btn.alt{background:#fff;border:2px solid var(--line);color:var(--ink)}
.price{font-size:26px;font-weight:800}.meta{color:var(--mute)}ol.it{padding-left:20px}ol.it li{margin:10px 0}`;

function layout({ title, desc, path, body, ld, img }, o) {
  const t = esc(title), d = esc(desc), u = o + path, im = img || o + '/og.png';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title><meta name="description" content="${d}"><link rel="canonical" href="${u}"><meta property="og:type" content="website"><meta property="og:site_name" content="Lakshadweep Packages"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${u}"><meta property="og:image" content="${esc(im)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(im)}">${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}<style>${CSS}</style></head><body><header><a class="logo" href="/">Lakshadweep <b>Packages</b></a><nav><a href="/#packages">All packages</a><a href="/guide">Travel guide</a><a href="/#operators">For owners</a></nav></header><main>${body}</main><footer><span>© 2026 Lakshadweep Packages. Packages are listed by independent operators; confirm prices and permit rules before booking.</span><span>${Object.keys(ISL).map((n) => `<a href="/islands/${n.toLowerCase()}">${n}</a>`).join(' · ')}</span></footer></body></html>`;
}

function packageCard(p) {
  return `<div class="card"><a href="/packages/${slug(p)}"><b>${esc(p.title)}</b></a>${p.verified ? ' <span class="pill">✔ Verified</span>' : ''}<div class="meta">${esc(p.op)} · ${esc(p.isl)} · ${p.days} days · ${TRL[p.tr] || TRL.none}</div><div><b>${inr(p.price)}</b> per person</div></div>`;
}

function islandPage(name, pkgs, o) {
  const d = ISL[name], list = pkgs.filter((p) => p.isl === name);
  const min = list.length ? Math.min(...list.map((p) => p.price)) : 0;
  const desc = `${name} Island, Lakshadweep: ${d.b} ${list.length ? `Compare ${list.length} tour package${list.length > 1 ? 's' : ''} from ${inr(min)} per person.` : 'Find packages and contact local operators.'}`.slice(0, 300);
  const body = `<p class="meta"><a href="/">Home</a> › Islands › ${name}</p><h1>${name} Island Packages – Lakshadweep</h1><p>${esc(d.b)}</p><h2>Why visit ${name}</h2><ul>${d.f.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p>Best for: ${esc(d.best)}.</p><h2>${name} tour packages</h2>${list.length ? list.map(packageCard).join('') : '<p>No packages are listed for this island yet. Operators can <a href="/#operators">list a package</a>.</p>'}<p><a class="btn" href="/#packages">Compare all packages</a> <a class="btn alt" href="/guide">Travel guide</a></p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'TouristDestination', name: `${name} Island, Lakshadweep`, description: d.b, url: `${o}/islands/${name.toLowerCase()}` };
  return layout({ title: `${name} Island Packages – Lakshadweep Tour Packages`, desc, path: `/islands/${name.toLowerCase()}`, body, ld }, o);
}

function packagePage(p, o) {
  const ph = String(p.ph).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  const imgs = Array.from({ length: p.pc || 0 }, (_, i) => `${o}/api/photos/${p.id}/${i}`);
  const path = `/packages/${slug(p)}`;
  const desc = `${p.days}-day ${p.isl} package by ${p.op}: ${(p.acts || []).join(', ')}. ${TRL[p.tr] || TRL.none}. From ${inr(p.price)} per person.`.slice(0, 300);
  const msg = encodeURIComponent(`Hi ${p.op}, I found "${p.title}" on Lakshadweep Packages. Is it available?`);
  const body = `<p class="meta"><a href="/">Home</a> › <a href="/islands/${p.isl.toLowerCase()}">${esc(p.isl)}</a> › ${esc(p.title)}</p><h1>${esc(p.title)}</h1>${p.verified ? '<span class="pill">✔ Verified operator</span>' : ''}<p class="meta">By ${esc(p.op)} · ${esc(p.isl)} · ${p.days} days · Best for ${esc(p.vibe)}</p>${imgs.length ? `<div class="gal">${imgs.map((s, i) => `<img src="${s}" alt="${esc(p.title)} photo ${i + 1}" loading="lazy">`).join('')}</div>` : ''}<div class="card"><div class="price">${inr(p.price)} <small class="meta">per person</small></div><p>${TRL[p.tr] || TRL.none}${p.months && p.months.length ? ` · Best months: ${esc(p.months.join(', '))}` : ''}</p><p>${(p.acts || []).map((a) => `<span class="pill">${esc(a)}</span>`).join('')}</p>${p.inc ? `<p><b>Included:</b> ${esc(p.inc)}</p>` : ''}<a class="btn" rel="noopener" target="_blank" href="https://wa.me/${ph}?text=${msg}">WhatsApp</a><a class="btn alt" href="tel:+${ph}">Call</a><a class="btn alt" href="mailto:${esc(p.mail)}?subject=${encodeURIComponent(p.title)}">Email</a></div><h2>Day-by-day itinerary</h2><ol class="it">${(p.it || []).map((d) => `<li><b>${esc(d.t)}</b>${d.d ? `<br>${esc(d.d)}` : ''}</li>`).join('')}</ol><p class="meta">Bookings and payments are agreed directly with the operator. Confirm prices, inclusions and permit rules before you book.</p><p><a class="btn alt" href="/islands/${p.isl.toLowerCase()}">More ${esc(p.isl)} packages</a> <a class="btn alt" href="/#packages">Compare all packages</a></p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'TouristTrip', name: p.title, description: desc, url: o + path, ...(imgs.length ? { image: imgs } : {}), provider: { '@type': 'Organization', name: p.op },
    itinerary: { '@type': 'ItemList', itemListElement: (p.it || []).map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.t, description: d.d || '' })) },
    offers: { '@type': 'Offer', price: p.price, priceCurrency: 'INR', availability: 'https://schema.org/InStock', url: o + path } };
  return layout({ title: `${p.title} – ${p.days}-Day ${p.isl} Package from ${inr(p.price)}`, desc, path, body, ld, img: imgs[0] }, o);
}

function guidePage(o) {
  const body = `<h1>Lakshadweep Travel Guide</h1><p>A short guide to planning a trip to Lakshadweep. Rules, schedules and prices change, so confirm details with the Lakshadweep administration or your tour operator before you travel.</p><h2>Best time to visit</h2><p>Calm seas and clear water are usual from around October to May, which is the main tourist season. The monsoon months (roughly June to September) bring rough seas, and some services and water activities are reduced.</p><h2>How to get there</h2><p>Most visitors fly from Kochi to Agatti, the island with the airport. Passenger ships also run from Kochi to the islands, and the journey takes much longer. Bangaram is reached by boat from Agatti. Check current flight and ship schedules before you book. Many packages here say whether flights or ships are included.</p><h2>Entry permit</h2><p>Visiting Lakshadweep generally requires an entry permit from the Lakshadweep administration, and the rules differ for Indian citizens and foreign nationals. Apply well in advance, and ask your operator whether they help with the application.</p><h2>Choosing an island</h2><ul>${Object.entries(ISL).map(([n, d]) => `<li><a href="/islands/${n.toLowerCase()}">${n}</a> – ${esc(d.b)}</li>`).join('')}</ul><h2>Good to know</h2><p>Alcohol is restricted on most islands, so dress modestly in villages and protect the coral. Mobile coverage and internet can be limited, so keep some cash and confirm arrangements before you leave.</p><p><a class="btn" href="/#packages">Browse packages</a></p>`;
  return layout({ title: 'Lakshadweep Travel Guide – Best Time, How to Reach, Permits', desc: 'Plan a Lakshadweep trip: best time to visit, how to reach the islands from Kochi, entry permit basics and how to choose an island.', path: '/guide', body }, o);
}

export default async (req) => {
  const url = new URL(req.url), o = url.origin, path = url.pathname.replace(/\/+$/, '') || '/';
  const html = (s, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  if (path === '/guide') return html(guidePage(o));
  if (path === '/sitemap.xml') {
    const pk = await livePackages();
    const urls = [['/', 1], ['/guide', 0.7], ...Object.keys(ISL).map((n) => [`/islands/${n.toLowerCase()}`, 0.8]), ...pk.map((p) => [`/packages/${slug(p)}`, 0.9, p.createdAt])];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr, t]) => `<url><loc>${o}${u}</loc>${t ? `<lastmod>${new Date(t).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`;
    return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
  }
  const im = path.match(/^\/islands\/([a-z]+)$/);
  if (im) {
    const name = Object.keys(ISL).find((n) => n.toLowerCase() === im[1]);
    if (name) return html(islandPage(name, await livePackages(), o));
  }
  const pm = path.match(/^\/packages\/([a-z0-9-]+)$/);
  if (pm) {
    const key = pm[1].split('-').pop();
    const p = key.length === 8 ? (await livePackages()).find((x) => x.id.startsWith(key)) : null;
    if (p) return html(packagePage(p, o));
  }
  return html(layout({ title: 'Page not found – Lakshadweep Packages', desc: 'This page could not be found.', path, body: '<h1>Page not found</h1><p>The package may have been removed. <a href="/#packages">Browse all packages</a>.</p>' }, o).replace('<head>', '<head><meta name="robots" content="noindex">'), 404);
};

export const config = { path: ['/sitemap.xml', '/guide', '/islands/*', '/packages/*'] };
