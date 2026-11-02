// wave275 (amended 02/11/26): the stand-in for wa275_availability_of on the in-memory rig (test/w271rig.mjs), shared by the onboard-run and onboard-link
// tests. It reads what the SQL reads (build/wa275a_streamlined.sql 3c and 7, proved in test/w275sql.sql on PGlite): the person's current hub_team_avail rows
// (wave276's typical week: per team, the newest row with a save time whose effective_from is today or earlier, matched on the roster email in lower case),
// the teams' cells joined into blocks, the one-off dates from team_members.availability.except, and the latest hub_team_avail_ask per team for stale.
// weekRows() turns a week of blocks back into the rows wave276 would have saved, so a test can say "Sam is free Monday 13:00 to 17:00".
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAULT_WEEK = { mon: [['09:00', '17:00']], tue: [['09:00', '17:00']], wed: [['09:00', '17:00']], thu: [['09:00', '17:00']], fri: [['09:00', '17:00']] };
const hm = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(String(s)); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const clock = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

/* {mon: [["13:00","17:00"]], ...} to sorted slots (weekday * 1440 + minute), one per cell */
export function slotsOf(weekly, cell = 30) {
  const out = [];
  DAYS.forEach((d, wd) => { for (const [a, b] of (weekly && weekly[d]) || []) for (let t = hm(a); t + cell <= hm(b); t += cell) out.push(wd * 1440 + t); });
  return [...new Set(out)].sort((x, y) => x - y);
}
/* the row wave276 saves for that week (one team), saved at `at` and current from `from` */
export function weekRows(email, weekly, { department = 'progdev', from = '2026-10-01', at = '2026-10-19T12:00:00Z', id = 1 } = {}) {
  const slots = slotsOf(weekly);
  return [{ id, email, department, effective_from: from, slots, hours: slots.length / 2, snoozed_until: null, created_at: at, updated_at: at }];
}

export function weekOf(db, memberId, today) {
  const m = (db.tables['team_members'] || []).find((x) => Number(x.id) === Number(memberId));
  const email = String((m && m.email) || '').trim().toLowerCase();
  const cellRow = (db.tables['app_config'] || []).find((x) => x.key === 'avail_cell_min');
  const cell = cellRow && /^\d{1,3}$/.test(String(cellRow.value).trim()) && Number(cellRow.value) > 0 ? Number(cellRow.value) : 30;
  const mine = email ? (db.tables['hub_team_avail'] || []).filter((h) => String(h.email || '').trim().toLowerCase() === email && h.updated_at) : [];
  const current = {};
  for (const h of mine) {
    if (String(h.effective_from) > today) continue;
    const c = current[h.department];
    if (!c || String(h.effective_from) > String(c.effective_from) || (String(h.effective_from) === String(c.effective_from) && Number(h.id) > Number(c.id))) current[h.department] = h;
  }
  const rows = Object.values(current);
  const at = rows.length ? rows.map((r) => r.updated_at).sort().at(-1) : null;
  const slots = [...new Set(rows.flatMap((r) => (r.slots || []).map(Number)))].filter((x) => x >= 0 && x < 7 * 1440).sort((a, b) => a - b);
  const weekly = {};
  let wd = -1, s = 0, e = 0;
  const push = () => { (weekly[DAYS[wd]] ||= []).push([clock(s), clock(Math.min(e, 1440))]); };
  for (const x of slots) {
    const d = Math.floor(x / 1440), min = x % 1440;
    if (d !== wd || min > e) { if (wd >= 0) push(); wd = d; s = min; e = min + cell; } else e = Math.max(e, min + cell);
  }
  if (wd >= 0) push();
  const asks = (db.tables['hub_team_avail_ask'] || []);
  const lastByTeam = {};
  for (const h of mine) if (!lastByTeam[h.department] || h.updated_at > lastByTeam[h.department]) lastByTeam[h.department] = h.updated_at;
  const current_ = Object.entries(lastByTeam).some(([dept, last]) => {
    const ask = asks.filter((k) => k.department === dept && String(k.ask_date) <= today).map((k) => String(k.ask_date)).sort().at(-1);
    return !ask || Date.parse(last) >= Date.parse(ask + 'T00:00:00Z');
  });
  if (!slots.length) return { weekly: DEFAULT_WEEK, no_week: true, stale: true, availability_at: at };
  return { weekly, no_week: false, stale: !email || !current_, availability_at: at };
}

/* the rpc: wa275_availability_of(p_member) as the service key reads it (onboard-run and onboard-link always call it with the service key) */
export function availabilityOf(args, db, who) {
  if (who && who.jwt) throw new Error('rig: wa275_availability_of is read with the service key here');
  const m = (db.tables['team_members'] || []).find((x) => Number(x.id) === Number(args.p_member));
  if (!m) throw new Error('That person is not on the roster');
  const today = new Date().toISOString().slice(0, 10);
  const w = weekOf(db, m.id, today);
  const ex = m.availability && Array.isArray(m.availability.except) ? m.availability.except : [];
  return { availability: { weekly: w.weekly, except: ex, tz: 'America/Toronto' }, availability_at: w.availability_at, stale: w.stale, no_week: w.no_week, except_at: m.availability_at ?? null };
}
