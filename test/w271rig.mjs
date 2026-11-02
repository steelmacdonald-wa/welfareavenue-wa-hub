// wave271: the offline test rig for the Hub's edge functions. Node 24 only, no Deno, no network, no live calls of any kind.
//   const rig = await loadFn('onboard-link', { secrets, config, tables })
//   rig.call(new Request(url, init)) -> Response      runs the function's Deno.serve handler
//   rig.db                                            the in-memory database the function sees (see makeDb)
//   rig.fetchLog / rig.fetchOn(match, reply)          every fetch the function makes; any URL nobody registered throws and is
//                                                     logged with matched: false (assert none: rig.unregistered())
//   rig.setNow(iso | null)                            a fixed clock while a call runs (null: the real one)
//   rig.client()                                      a stub client on the same database, to read or set up rows in a test
//   rig.env / rig.mod                                the env values it sees, and the function module's exports
// How it works: module.registerHooks sends 'jsr:@supabase/supabase-js@2' to an in-memory stub, globalThis.Deno gets env.get and a
// serve that keeps the handler, and globalThis.fetch is the recorder. Several functions can be loaded side by side: each call
// switches the globals to its own function, secrets, database and clock.
// What the stub does NOT do: triggers (register a stand-in with db.on), row security (every client sees every row), embedded
// selects like 'a, b(c)', and counts. It throws on those so a later task adds exactly what it needs.
import module from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const STUB = 'wa271-stub:supabase-js';
const RealDate = Date;
const state = { current: null, installed: false, loads: 0, pending: null };

// Tables whose new rows get an id (the live ones are serial or identity columns). Others (app_config, grids, steps) keep what they are given.
const SERIAL = ['hub_candidates', 'hub_onboard_flows', 'change_log', 'team_members', 'onboardings', 'hub_positions', 'hub_notifications'];

/* ---------- the in-memory database ---------- */
const same = (a, b) => a != null && b != null && String(a) === String(b);
const iso = (v) => (v instanceof RealDate ? v.toISOString() : v);
function cmp(a, b) { a = iso(a); b = iso(b); return a < b ? -1 : a > b ? 1 : 0; }
function listOf(v) { return Array.isArray(v) ? v : String(v).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim()).filter((s) => s !== ''); }
function scalar(v) { return v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v; }
function test(row, col, op, val) {
  const a = row[col];
  switch (op) {
    case 'eq': return same(a, val);
    case 'neq': return a != null && val != null && String(a) !== String(val);
    case 'is': return val === null || val === 'null' ? a == null : a === scalar(val);
    case 'in': return a != null && listOf(val).some((x) => String(x) === String(a));
    case 'ilike': return a != null && new RegExp('^' + String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i').test(String(a));
    case 'gte': return a != null && cmp(a, val) >= 0;
    case 'lte': return a != null && cmp(a, val) <= 0;
    case 'gt': return a != null && cmp(a, val) > 0;
    case 'lt': return a != null && cmp(a, val) < 0;
    default: throw new Error('rig: filter ' + op + ' is not supported yet');
  }
}
// 'a.eq.1,b.is.null,c.in.(x,y)' -> [[a,eq,1],[b,is,null],[c,in,'(x,y)']]
function parseOr(s) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
  if (cur) parts.push(cur);
  return parts.map((p) => { const [col, op, ...rest] = p.split('.'); return [col, op, rest.join('.')]; });
}

class Query {
  constructor(db, table) { Object.assign(this, { db, table, op: 'select', cols: '*', tests: [], sort: [], max: null, ret: false, shape: 'many' }); }
  select(cols = '*') { if (this.op !== 'select') this.ret = true; this.cols = cols; return this; }
  insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this; }
  update(patch) { this.op = 'update'; this.patch = patch; return this; }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.rows = [].concat(rows); this.keys = String(opts.onConflict || '').split(',').map((s) => s.trim()).filter(Boolean); return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { return this.f(c, 'eq', v); }
  neq(c, v) { return this.f(c, 'neq', v); }
  is(c, v) { return this.f(c, 'is', v); }
  in(c, v) { return this.f(c, 'in', v); }
  ilike(c, v) { return this.f(c, 'ilike', v); }
  gte(c, v) { return this.f(c, 'gte', v); }
  lte(c, v) { return this.f(c, 'lte', v); }
  gt(c, v) { return this.f(c, 'gt', v); }
  lt(c, v) { return this.f(c, 'lt', v); }
  not(c, op, v) { this.tests.push((r) => (op === 'is' ? !test(r, c, op, v) : r[c] != null && !test(r, c, op, v))); return this; }
  or(s) { const alts = parseOr(s); this.tests.push((r) => alts.some(([c, op, v]) => test(r, c, op, v))); return this; }
  f(c, op, v) { this.tests.push((r) => test(r, c, op, v)); return this; }
  order(col, o = {}) { this.sort.push([col, o.ascending !== false]); return this; }
  limit(n) { this.max = n; return this; }
  single() { this.shape = 'single'; return this; }
  maybeSingle() { this.shape = 'maybe'; return this; }
  // each query takes a turn of the event loop, like a network round trip, so two requests really interleave; run() itself is atomic
  then(ok, bad) { return new Promise((go) => setImmediate(go)).then(() => this.run()).then(ok, bad); }
  project(rows) {
    if (this.cols.includes('(')) throw new Error('rig: embedded selects are not supported yet (' + this.cols + ')');
    const names = this.cols.split(',').map((s) => s.trim());
    return rows.map((r) => structuredClone(names.includes('*') ? r : Object.fromEntries(names.map((n) => [n, r[n]]))));
  }
  run() {
    const { db, table, op } = this;
    const failure = db.failures.find((x) => x.table === table && x.op === op);
    if (failure) { db.failures.splice(db.failures.indexOf(failure), 1); return { data: null, error: { message: failure.message } }; }
    const rows = db.rows(table);
    const matches = () => rows.filter((r) => this.tests.every((t) => t(r)));
    let hit;
    if (op === 'select') {
      hit = matches();
      for (const [col, asc] of [...this.sort].reverse()) hit.sort((x, y) => (x[col] == null ? 1 : y[col] == null ? -1 : cmp(x[col], y[col]) * (asc ? 1 : -1)));
      if (this.max != null) hit = hit.slice(0, this.max);
    } else if (op === 'insert') {
      hit = this.rows.map((r) => db.insert(table, r));
    } else if (op === 'update') {
      hit = matches();
      for (const r of hit) { const before = { ...r }; Object.assign(r, structuredClone(this.patch)); db.fire(table, 'update', r, before); }
    } else if (op === 'delete') {
      hit = matches();
      for (const r of hit) rows.splice(rows.indexOf(r), 1);
      for (const r of hit) db.fire(table, 'delete', null, r);
    } else {   // upsert: a row with the same conflict key is merged into, otherwise added
      const keys = this.keys.length ? this.keys : ['id'];
      hit = this.rows.map((r) => {
        const old = rows.find((x) => keys.every((k) => same(x[k], r[k])));
        if (!old) return db.insert(table, r);
        const before = { ...old }; Object.assign(old, structuredClone(r)); db.fire(table, 'update', old, before); return old;
      });
    }
    if (op !== 'select' && !this.ret) return { data: null, error: null };
    const data = this.project(hit);
    if (this.shape === 'many') return { data, error: null };
    if (data.length > 1 || (this.shape === 'single' && !data.length)) return { data: null, error: { code: 'PGRST116', message: 'rig: expected one row, got ' + data.length } };
    return { data: data[0] ?? null, error: null };
  }
}

function makeDb({ tables, config, secrets, serial }) {
  const db = {
    tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, structuredClone(v)])),
    caller: null, hooks: [], handlers: {}, failures: [], serial: new Set([...SERIAL, ...serial]),
    rows(t) { return (this.tables[t] ||= []); },
    insert(t, row) {   // add a row straight to a table, as the function (or a trigger stand-in) would
      const r = structuredClone(row);
      if (this.serial.has(t) && r.id == null) r.id = Math.max(0, ...this.rows(t).map((x) => Number(x.id) || 0)) + 1;
      this.rows(t).push(r); this.fire(t, 'insert', r, null); return r;
    },
    on(t, op, fn) { this.hooks.push({ t, op, fn }); },   // a trigger stand-in: fn(newRow, oldRow, db) runs after each insert, update or delete on t
    fire(t, op, n, o) { for (const h of this.hooks) if (h.t === t && h.op === op) h.fn(n, o, this); },
    onRpc(name, fn) { this.handlers[name] = fn; },   // fn(args, db) returns the data; throw to return an error
    setCaller(user) { this.caller = user; },   // what auth.getUser() returns: { email, id, ... } or null (signed out)
    failOn(t, op, message = 'rig: forced failure') { this.failures.push({ table: t, op, message }); },   // the next op on t returns this error
    async rpc(name, args = {}) {
      const fn = this.handlers[name];
      if (!fn) return { data: null, error: { message: 'rig: rpc ' + name + ' is not registered' } };
      try { return { data: await fn(args, this), error: null }; } catch (e) { return { data: null, error: { message: String(e && e.message || e) } }; }
    },
  };
  db.tables.app_config = [...(db.tables.app_config || []), ...Object.entries(config).map(([key, value]) => ({ key, value: String(value) }))];
  db.onRpc('get_secret', ({ secret_name }) => secrets[secret_name] ?? null);
  return db;
}

/* ---------- the globals ---------- */
function install() {
  if (state.installed) return;
  state.installed = true;
  module.registerHooks({
    resolve(specifier, context, next) { return specifier === 'jsr:@supabase/supabase-js@2' ? { url: STUB, shortCircuit: true } : next(specifier, context); },
    load(url, context, next) {
      return url === STUB ? { format: 'module', source: 'export const createClient = (...a) => globalThis.__w271.createClient(...a);', shortCircuit: true } : next(url, context);
    },
  });
  globalThis.Deno = { env: { get: (k) => state.current.env[k] }, serve: (handler) => { state.pending = handler; } };
  globalThis.fetch = (input, init) => state.current.fetch(input, init);
}

function makeFetch(rig) {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url || String(input);
    const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    let body = init.body ?? null;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { /* keep the text */ } }
    const entry = { url, method, headers: Object.fromEntries(new Headers(init.headers || {})), body, matched: false };
    rig.fetchLog.push(entry);
    const route = rig.routes.find((r) => r.match(url, method));
    if (!route) throw new Error('rig: fetch to an unregistered URL: ' + method + ' ' + url);
    entry.matched = true;
    const out = typeof route.reply === 'function' ? await route.reply(entry) : route.reply;
    if (out instanceof Response) return out;
    return new Response(out.json !== undefined ? JSON.stringify(out.json) : (out.text ?? ''), { status: out.status ?? 200, headers: { 'Content-Type': out.json !== undefined ? 'application/json' : 'text/plain' } });
  };
}

/* ---------- loadFn ---------- */
export async function loadFn(name, { secrets = {}, config = {}, tables = {}, serial = [] } = {}) {
  install();
  const values = { SUPABASE_URL: 'https://stub.supabase.test', SUPABASE_ANON_KEY: 'anon-key-for-tests', SUPABASE_SERVICE_ROLE_KEY: 'service-key-for-tests', WA_TRIGGER_SECRET: 'trigger-secret-for-tests', ...secrets };
  const db = makeDb({ tables, config, secrets: values, serial });
  const rig = { env: values, db, fetchLog: [], routes: [], now: null, handler: null, mod: null };
  rig.fetch = makeFetch(rig);
  rig.createClient = () => ({
    from: (t) => new Query(db, t),
    rpc: (n, a) => db.rpc(n, a),
    auth: { getUser: async () => (db.caller ? { data: { user: db.caller }, error: null } : { data: { user: null }, error: { message: 'rig: no caller set', status: 401 } }) },
  });
  const activate = () => { state.current = rig; globalThis.__w271 = { createClient: rig.createClient }; };
  activate();
  state.pending = null;
  rig.mod = await import(pathToFileURL(join(here, '..', 'fn', name, 'index.ts')).href + '?w271=' + (++state.loads));
  rig.handler = state.pending;
  if (!rig.handler) throw new Error('rig: ' + name + ' did not call Deno.serve');

  return {
    db, env: values, mod: rig.mod, fetchLog: rig.fetchLog,
    client: () => { activate(); return rig.createClient(); },   // a stub client on the same database, to read or set up rows in a test
    setNow(when) { rig.now = when == null ? null : new RealDate(when).getTime(); },
    fetchOn(match, reply) {   // match: URL prefix, RegExp or fn(url, method); reply: {status, json | text}, a Response, or fn(entry) returning one
      const m = typeof match === 'function' ? match : match instanceof RegExp ? (u) => match.test(u) : (u) => u === match || u.startsWith(match + '?');
      rig.routes.push({ match: m, reply });
    },
    unregistered: () => rig.fetchLog.filter((e) => !e.matched),
    async call(request) {
      activate();
      if (rig.now == null) return rig.handler(request);
      const fixed = rig.now;
      globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } };
      try { return await rig.handler(request); } finally { globalThis.Date = RealDate; }
    },
  };
}
