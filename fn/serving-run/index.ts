// Welfare Avenue: serving-run (v2, 02/10/26, wave191m)
// The driver and team leader's run for a serving, worked out from the real stops.
// Steel (01/10/26): the driver's start time with the team leader "will always depend on how many cooks to pick up from"
// (3 to 6 cooks, the storage unit, the serving at Place Émilie-Gamelin; after it the dishes at the Old Brewery Mission and
// back to the storage unit), and "a working google maps trajectory link of a starting point, all the stops on the way and
// how long in order to calculate their starting time". Choices: the faster of storage-first and cooks-first, free map
// data (OpenStreetMap).
// How: wa191_run_inputs gives the serving, the cooks to pick up (or the community kitchen), the drivers' parts, the
// minutes and the map addresses. Each address is cleaned (no apartment or door codes) and placed with Photon, then
// Nominatim, then the postal code (cached in geo_cache; 1 request a second to Nominatim). OSRM's table gives the driving
// time between every pair; every order of the pickups is tried. Runs: the only driver and the team leader do every stop
// in the faster order; with two drivers the pickup driver takes the cooks (two pickup drivers split them by direction) and
// the main driver and the team leader the storage unit; with no driver yet, the full run is shown as unassigned. Times go
// backwards from being at the serving run_setup_min before it starts (the start rounded down to 5 minutes), then forwards
// for each stop. After the serving: the serving, the Old Brewery Mission, the storage unit. Google Maps links: from
// where the person is, through every stop. Stored in volunteer_event_runs (plan, inputs_hash).
// Actions: plan {event_id, force?} (staff, or the trigger secret); tick (trigger secret: the servings of the next 14
// days whose stops changed, at most 4 a call; it answers at once and works in the background, so the cron's 10-second
// call never cuts it short; wait: true to get the result).
// v2: a run that does not end at the storage unit (a pickup driver, a second main driver) ends when the serving packs up.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = createClient(SUPABASE_URL, SERVICE_KEY);
const UA = 'WelfareAvenueHub/1.0 (+https://hub.welfareavenue.com)';
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wa-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getSecret(name: string): Promise<string> {
  const { data, error } = await svc.rpc('get_secret', { secret_name: name });
  if (error || !data) throw new Error('secret ' + name + ' unavailable');
  return data as string;
}
type Who = { ok: boolean; who: string; system: boolean };
async function authorize(req: Request): Promise<Who> {
  try {
    const given = req.headers.get('x-wa-secret');
    if (given && given === (await getSecret('WA_TRIGGER_SECRET'))) return { ok: true, who: 'system', system: true };
  } catch (_) { /* fall through */ }
  const h = req.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: h } } });
    const { data } = await asUser.auth.getUser();
    const email = (data?.user?.email || '').toLowerCase();
    if (email) { const s = await asUser.rpc('is_wa_staff'); if (s.data === true) return { ok: true, who: email, system: false }; }
  }
  return { ok: false, who: '', system: false };
}

/* ---------- addresses ---------- */
const CITY = /(montr[eé]al|laval|longueuil|westmount|outremont|verdun|lachine|lasalle|anjou|saint-laurent|st-laurent|mont-royal|mount royal|c[oô]te[- ]saint[- ]luc|hampstead|dorval|pointe-claire|kirkland|beaconsfield|dollard|pierrefonds|roxboro|brossard|saint-l[eé]onard|\bqc\b|qu[eé]bec)/i;
export function cleanAddress(a: string): string {
  let s = String(a || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/,?\s*(buzzer|buzz|interphone|intercom|door code|entry code|code porte|code)\b[^,]*/gi, '');
  s = s.replace(/,?\s*(apt|apartment|app|appart|appartement|unit|unité|suite|bureau|logement)\.?\s*#?\s*[\w-]+/gi, '');
  s = s.replace(/\s#\s*\d+\w*/g, '').replace(/^\s*\d+\s*-\s*(?=\d)/, '');
  s = s.replace(/\bBlvd\.?\b/gi, 'Boulevard').replace(/\bBoul\.?\s/gi, 'Boulevard ').replace(/\bAv\.\s/gi, 'Avenue ').replace(/\bSt-/g, 'Saint-').replace(/\bSte-/g, 'Sainte-');
  s = s.replace(/(\bRue [^,]+?|\bBoulevard [^,]+?|\bAvenue [^,]+?|\bChemin [^,]+?) O\b/gi, '$1 Ouest').replace(/(\bRue [^,]+?|\bBoulevard [^,]+?|\bAvenue [^,]+?|\bChemin [^,]+?) E\b/gi, '$1 Est');
  s = s.replace(/\s*,\s*,+/g, ',').replace(/\s*,\s*$/, '').replace(/^\s*,\s*/, '').trim();
  if (!CITY.test(s)) s += ', Montréal, QC';
  return s;
}
function postal(s: string): string | null { const m = String(s || '').toUpperCase().match(/\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/); return m ? m[1] + ' ' + m[2] : null; }
type Pt = { lat: number; lng: number; label: string; src: string; approx: boolean };
const inRegion = (p: { lat: number; lng: number }) => p.lat > 45.2 && p.lat < 45.9 && p.lng > -74.3 && p.lng < -73.2;
let lastNominatim = 0;
async function nominatimWait() { const d = Date.now() - lastNominatim; if (d < 1100) await sleep(1100 - d); lastNominatim = Date.now(); }
async function photon(q: string): Promise<Pt | null> {
  const r = await fetch('https://photon.komoot.io/api/?limit=1&lat=45.508&lon=-73.587&q=' + encodeURIComponent(q), { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json(); const f = (j.features || [])[0]; if (!f) return null;
  const p = f.properties || {}; const [lng, lat] = f.geometry.coordinates;
  const pt = { lat, lng, label: [p.housenumber, p.street || p.name, p.city || p.district, p.postcode].filter(Boolean).join(' '), src: 'photon', approx: p.type !== 'house' };
  return inRegion(pt) ? pt : null;
}
async function nominatim(params: Record<string, string>): Promise<Pt | null> {
  await nominatimWait();
  const u = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'ca', viewbox: '-74.3,45.9,-73.2,45.2', ...params }).toString();
  const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) return null;
  const j = await r.json(); const f = j[0]; if (!f) return null;
  const pt = { lat: +f.lat, lng: +f.lon, label: String(f.display_name || '').split(',').slice(0, 3).join(','), src: params.postalcode ? 'postal' : 'nominatim', approx: !!params.postalcode || !['house', 'building', 'residential', 'apartments', 'commercial', 'retail', 'yes'].includes(String(f.type)) };
  return inRegion(pt) ? pt : null;
}
async function geocode(addr: string): Promise<Pt | null> {
  const q = cleanAddress(addr); const key = q.toLowerCase();
  const { data: hit } = await svc.from('geo_cache').select('*').eq('q', key).maybeSingle();
  if (hit && (hit.ok || Date.now() - Date.parse(hit.at) < 7 * 864e5)) return hit.ok ? { lat: hit.lat, lng: hit.lng, label: hit.label || q, src: hit.src || 'cache', approx: !!hit.approx } : null;
  let best: Pt | null = null;
  try { best = await photon(q); } catch (_) { /* next */ }
  if (!best || best.approx) { try { const n = await nominatim({ q }); if (n && (!best || !n.approx)) best = n; } catch (_) { /* next */ } }
  if (!best) { const pc = postal(q); if (pc) { try { best = await nominatim({ postalcode: pc, country: 'Canada' }); if (best) best.approx = true; } catch (_) { /* none */ } } }
  await svc.from('geo_cache').upsert({ q: key, lat: best?.lat ?? null, lng: best?.lng ?? null, label: best?.label ?? null, src: best?.src ?? null, approx: best?.approx ?? false, ok: !!best, at: new Date().toISOString() });
  return best;
}

/* ---------- driving times ---------- */
function haversineKm(a: Pt, b: Pt) { const R = 6371, dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
async function durations(pts: Pt[]): Promise<{ m: number[][]; src: string }> {
  try {
    const coords = pts.map((p) => p.lng.toFixed(6) + ',' + p.lat.toFixed(6)).join(';');
    const r = await fetch('https://router.project-osrm.org/table/v1/driving/' + coords + '?annotations=duration', { headers: { 'User-Agent': UA } });
    if (r.ok) { const j = await r.json(); if (j.code === 'Ok' && Array.isArray(j.durations)) return { m: j.durations.map((row: (number | null)[]) => row.map((x) => (x == null ? 1e7 : x))), src: 'osm' }; }
  } catch (_) { /* estimate */ }
  // no answer from OSRM: straight line x 1.35 at 26 km/h, plus 2 minutes
  return { m: pts.map((a) => pts.map((b) => (a === b ? 0 : haversineKm(a, b) * 1.35 / 26 * 3600 + 120))), src: 'estimate' };
}
function* permutations(a: number[]): Generator<number[]> {
  if (a.length <= 1) { yield a.slice(); return; }
  for (let i = 0; i < a.length; i++) { const rest = a.slice(0, i).concat(a.slice(i + 1)); for (const p of permutations(rest)) yield [a[i]].concat(p); }
}
/* the cheapest order of the cooks between an optional fixed start and a fixed end */
function bestChain(D: number[][], cooks: number[], start: number | null, end: number): { order: number[]; cost: number } {
  if (!cooks.length) return { order: [], cost: start == null ? 0 : D[start][end] };
  const cost = (o: number[]) => { let c = start == null ? 0 : D[start][o[0]]; for (let i = 0; i + 1 < o.length; i++) c += D[o[i]][o[i + 1]]; return c + D[o[o.length - 1]][end]; };
  if (cooks.length <= 7) { let best = { order: cooks.slice(), cost: Infinity }; for (const p of permutations(cooks)) { const c = cost(p); if (c < best.cost) best = { order: p, cost: c }; } return best; }
  // more than 7: nearest neighbour from the start (or the cook farthest from the end)
  const left = cooks.slice(); const order: number[] = [];
  let cur = start != null ? start : left.reduce((a, b) => (D[b][end] > D[a][end] ? b : a));
  if (start == null) { order.push(cur); left.splice(left.indexOf(cur), 1); }
  while (left.length) { const nx = left.reduce((a, b) => (D[cur][b] < D[cur][a] ? b : a)); order.push(nx); left.splice(left.indexOf(nx), 1); cur = nx; }
  return { order, cost: cost(order) };
}

/* ---------- times ---------- */
const toMin = (hm: string) => { const [h, m] = String(hm || '12:00').split(':').map(Number); return h * 60 + (m || 0); };
const hm = (min: number) => { const x = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
function gmaps(addrs: string[], origin?: string): string {
  const p = new URLSearchParams({ api: '1', travelmode: 'driving', destination: addrs[addrs.length - 1] });
  if (origin) p.set('origin', origin);
  const w = addrs.slice(0, -1); if (w.length) p.set('waypoints', w.join('|'));
  return 'https://www.google.com/maps/dir/?' + p.toString();
}

type Stop = { k: string; rid?: number | null; label: string; hood?: string | null; address: string; idx: number; dwell: number; approx?: boolean; arrive?: string; leave?: string; drive_min?: number };

async function plan(eventId: number, force: boolean, who: string) {
  const { data: inp, error } = await svc.rpc('wa191_run_inputs', { p_event: eventId });
  if (error || !inp) return { error: 'no such serving' };
  const { data: prev } = await svc.from('volunteer_event_runs').select('inputs_hash').eq('event_id', eventId).maybeSingle();
  if (!force && prev && prev.inputs_hash === inp.hash) return { event_id: eventId, unchanged: true };
  const S = inp.settings || {};
  const num = (k: string, d: number) => { const v = Number(S[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const cookMin = num('run_cook_min', 7), storeMin = num('run_storage_min', 15), setupMin = num('run_setup_min', 30), serveMin = num('run_serve_min', 105), dishMin = num('run_dish_min', 45), closeMin = num('run_close_min', 20);
  const factor = Math.min(3, Math.max(0.8, num('run_drive_factor', 1.25)));
  const serve = toMin(inp.event.start), arriveBy = serve - setupMin, packUp = serve + serveMin;
  const warnings: { rid?: number | null; name?: string; why: string }[] = [];

  // the places
  const storageAddr = cleanAddress(S.storage_address || '888 Rue Saint-Antoine Ouest, Montréal, QC H3C 4G3');
  const servingAddr = cleanAddress(S.serving_address || '1500 Rue Berri, Montréal, QC H2L 2C4');
  const dishAddr = S.dish_address ? cleanAddress(S.dish_address) : '';
  const pts: Pt[] = []; const addrOf: string[] = [];
  const add = (p: Pt, a: string) => { pts.push(p); addrOf.push(a); return pts.length - 1; };
  const gS = await geocode(storageAddr), gE = await geocode(servingAddr), gD = dishAddr ? await geocode(dishAddr) : null;
  if (!gS || !gE) return { error: 'could not place the storage unit or the serving: check their addresses in Text settings' };
  const iS = add(gS, storageAddr), iE = add(gE, servingAddr), iD = gD ? add(gD, dishAddr) : -1;
  const cooks: Stop[] = [];
  for (const c of (inp.cooks || [])) {
    const raw = String(c.address || '').trim();
    if (!raw) { warnings.push({ rid: c.rid, name: c.name, why: 'no address' }); continue; }
    const a = cleanAddress([raw, c.postal && !postal(raw) ? c.postal : ''].filter(Boolean).join(', '));
    const g = await geocode(a);
    if (!g) { warnings.push({ rid: c.rid, name: c.name, why: 'address not found on the map' }); continue; }
    if (g.approx) warnings.push({ rid: c.rid, name: c.name, why: g.src === 'postal' ? 'placed by its postal code' : 'placed on its street, not the house' });
    cooks.push({ k: c.kitchen ? 'kitchen' : 'cook', rid: c.rid ?? null, label: c.kitchen ? 'The kitchen' : c.name, hood: c.hood || null, address: a, idx: add(g, a), dwell: c.kitchen ? 15 : cookMin, approx: g.approx });
  }
  const { m: D, src } = await durations(pts);
  const drv = (a: number, b: number) => Math.max(1, Math.ceil(D[a][b] * factor / 60));
  const stopS = (dwell: number): Stop => ({ k: 'storage', label: 'Storage unit', address: storageAddr, idx: iS, dwell });
  const stopE: Stop = { k: 'serving', label: 'Place Émilie-Gamelin', address: servingAddr, idx: iE, dwell: 0 };
  const byIdx = new Map(cooks.map((c) => [c.idx, c]));

  // timing: backwards from being at the serving by arriveBy, the start rounded down to 5 minutes, then forwards
  function timed(stops: Stop[]) {
    let t = arriveBy;
    for (let i = stops.length - 2; i >= 0; i--) { t -= drv(stops[i].idx, stops[i + 1].idx); t -= stops[i].dwell; }
    const start = Math.floor(t / 5) * 5; let now = start; let driveTotal = 0;
    const out = stops.map((s, i) => {
      const d = i ? drv(stops[i - 1].idx, s.idx) : 0; now += d; driveTotal += d;
      const o: Stop = { ...s, arrive: hm(now), drive_min: d }; if (s.dwell) { now += s.dwell; o.leave = hm(now); }
      return o;
    });
    return { start, stops: out, drive: driveTotal, total: toMin(out[out.length - 1].arrive!) - start + (toMin(out[out.length - 1].arrive!) < start ? 1440 : 0) };
  }
  const clean = (s: Stop) => { const { idx, dwell, ...rest } = s; void idx; void dwell; return rest; };
  const atOf = (s: Stop) => (s.k === 'storage' ? 'storage' : s.k === 'serving' ? 'serving' : 'pickup');
  function runOf(kind: string, stops: Stop[], drivers: { rid: number; name: string }[], withTl: boolean) {
    const t = timed(stops);
    const withStorage = stops.some((s) => s.k === 'storage');
    return { kind, drivers: drivers.map((d) => d.rid), names: drivers.map((d) => d.name), with_tl: withTl, with_storage: withStorage,
      start: hm(t.start), at: atOf(stops[0]), drive_min: t.drive, total_min: t.total,
      end: withStorage ? null : hm(packUp),
      stops: t.stops.map(clean), maps_url: gmaps(stops.map((s) => s.address)) };
  }

  // storage first or cooks first, for a run that does every stop
  const cookIdx = cooks.map((c) => c.idx);
  const sf = bestChain(D, cookIdx, iS, iE);
  const cfChain = bestChain(D, cookIdx, null, iS);
  const sfStops = [stopS(storeMin), ...sf.order.map((i) => byIdx.get(i)!), stopE];
  const cfStops = cookIdx.length ? [...cfChain.order.map((i) => byIdx.get(i)!), stopS(storeMin), stopE] : sfStops;
  const sfT = timed(sfStops), cfT = timed(cfStops);
  const order = !cookIdx.length || sfT.total <= cfT.total ? 'storage_first' : 'cooks_first';
  const fullStops = order === 'storage_first' ? sfStops : cfStops;

  const drivers: { rid: number; name: string; kind: string }[] = inp.drivers || [];
  const both = drivers.filter((d) => d.kind === 'both'), mains = drivers.filter((d) => d.kind === 'main'), picks = drivers.filter((d) => d.kind === 'pickup');
  // the cooks split between pickup drivers by direction from the serving (one driver: all of them)
  const splitCooks = (k: number): number[][] => {
    if (k <= 1 || cookIdx.length < 2) return [cookIdx.slice()];
    const ang = (i: number) => Math.atan2(pts[i].lat - pts[iE].lat, pts[i].lng - pts[iE].lng);
    const sorted = cookIdx.slice().sort((a, b) => ang(a) - ang(b)); const n = Math.min(k, sorted.length); const parts: number[][] = [];
    for (let g = 0; g < n; g++) parts.push(sorted.slice(Math.floor(g * sorted.length / n), Math.floor((g + 1) * sorted.length / n)));
    return parts;
  };
  const cookStops = (part: number[], end: number, start: number | null = null) => bestChain(D, part, start, end).order.map((i) => byIdx.get(i)!);
  const runs: unknown[] = [];
  if (both.length) {
    // the only driver (and the team leader) do every stop in the faster order
    runs.push(runOf('both', fullStops, [both[0]], true));
    if (both.length > 1) warnings.push({ why: 'more than one driver is set to do every stop: the first one is planned' });
    for (const d of mains.concat(picks)) runs.push(runOf(d.kind, [stopE], [d], false));
  } else if (mains.length && picks.length) {
    // two drivers: the main driver and the team leader fetch the equipment, the pickup driver(s) the food
    runs.push(runOf('main', [stopS(storeMin), stopE], [mains[0]], true));
    for (const d of mains.slice(1)) runs.push(runOf('main', [stopE], [d], false));
    if (!cookIdx.length) for (const d of picks) runs.push(runOf('pickup', [stopE], [d], false));
    else splitCooks(picks.length).forEach((part, g) => runs.push(runOf('pickup', [...cookStops(part, iE), stopE], [picks[g]], false)));
  } else if (mains.length) {
    // main drivers only: the first one (and the team leader) does every stop
    runs.push(runOf('main', fullStops, [mains[0]], true));
    for (const d of mains.slice(1)) runs.push(runOf('main', [stopE], [d], false));
  } else if (picks.length) {
    // pickup drivers only: nobody else fetches the equipment, so the first one also stops at the storage unit
    if (picks.length === 1 || cookIdx.length < 2) {
      runs.push(runOf('pickup', fullStops, [picks[0]], true));
      for (const d of picks.slice(1)) runs.push(runOf('pickup', [stopE], [d], false));
    } else {
      splitCooks(picks.length).forEach((part, g) => {
        const withS = g === 0;
        const st = withS ? (order === 'storage_first' ? [stopS(storeMin), ...cookStops(part, iE, iS), stopE] : [...cookStops(part, iS), stopS(storeMin), stopE]) : [...cookStops(part, iE), stopE];
        runs.push(runOf('pickup', st, [picks[g]], withS));
      });
    }
  } else {
    // nobody drives yet: the whole run, for the team to see
    runs.push(runOf('none', fullStops, [], true));
  }

  // each cook's pickup time (from the run that picks them up)
  const cookEta: Record<string, string> = {};
  for (const r of runs as { stops: Stop[] }[]) for (const s of r.stops) if (s.k === 'cook' && s.rid != null) cookEta[String(s.rid)] = s.arrive!;

  // after the serving: the dishes, then the storage unit
  const leave = packUp; let now = leave; const after: Stop[] = [{ k: 'serving', label: 'Place Émilie-Gamelin', address: servingAddr, idx: iE, dwell: 0, leave: hm(leave) }];
  let prevIdx = iE;
  if (iD >= 0) { now += drv(prevIdx, iD); after.push({ k: 'dish', label: 'Old Brewery Mission', address: dishAddr, idx: iD, dwell: dishMin, arrive: hm(now), leave: hm(now + dishMin), drive_min: drv(prevIdx, iD) }); now += dishMin; prevIdx = iD; }
  const dS = drv(prevIdx, iS); now += dS;
  after.push({ k: 'storage', label: 'Storage unit', address: storageAddr, idx: iS, dwell: closeMin, arrive: hm(now), leave: hm(now + closeMin), drive_min: dS }); now += closeMin;
  for (const r of runs as { with_storage: boolean; end: string | null }[]) if (r.with_storage) r.end = hm(now);

  const planOut = {
    v: 2, computed_at: new Date().toISOString(), serve: hm(serve), arrive_by: hm(arriveBy), order: cookIdx.length ? order : null,
    compared: cookIdx.length ? { storage_first: sfT.total, cooks_first: cfT.total } : null,
    minutes: { cook: cookMin, storage: storeMin, setup: setupMin, serve: serveMin, dish: dishMin, close: closeMin, factor },
    runs, after: { leave: hm(leave), end: hm(now), stops: after.map(clean), maps_url: gmaps(after.slice(1).map((s) => s.address), servingAddr) },
    cook_eta: cookEta, warnings, source: src,
  };
  const { error: e2 } = await svc.from('volunteer_event_runs').upsert({ event_id: eventId, inputs_hash: inp.hash, plan: planOut, computed_at: new Date().toISOString(), computed_by: who });
  if (e2) return { error: 'could not save: ' + e2.message };
  return { event_id: eventId, plan: planOut };
}

async function tick() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const until = new Date(Date.parse(today + 'T12:00:00Z') + 14 * 864e5).toISOString().slice(0, 10);
  const { data: evs } = await svc.from('volunteer_events').select('id, status').eq('kind', 'service').gte('event_date', today).lte('event_date', until).order('event_date');
  const done: unknown[] = []; let worked = 0;
  for (const e of (evs || []).filter((x: { status: string }) => !['cancelled', 'completed'].includes(String(x.status || '')))) {
    if (worked >= 4) break;
    const r = await plan(e.id, false, 'cron') as { unchanged?: boolean };
    if (!r.unchanged) worked++;
    done.push({ id: e.id, unchanged: !!r.unchanged, error: (r as { error?: string }).error });
  }
  return { today, servings: done };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const auth = await authorize(req);
  if (!auth.ok) return json({ error: 'staff only' }, 401);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  const action = String(body.action || 'plan');
  try {
    if (action === 'plan') {
      const id = Number(body.event_id); if (!Number.isInteger(id)) return json({ error: 'event_id required' }, 400);
      return json(await plan(id, !!body.force, auth.who));
    }
    if (action === 'tick') {
      if (!auth.system) return json({ error: 'tick is for the Hub itself' }, 403);
      const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (!body.wait && rt && typeof rt.waitUntil === 'function') {
        rt.waitUntil(tick().then((r) => console.log('serving-run tick', JSON.stringify(r))).catch((e) => console.error('serving-run tick failed', String(e))));
        return json({ queued: true });
      }
      return json(await tick());
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
