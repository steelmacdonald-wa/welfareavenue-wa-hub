/* fn_harness.mjs: runs an edge function's index.ts under Node, with no network and no database.
   It stands in for the Supabase edge runtime: Deno.env, Deno.serve, EdgeRuntime.waitUntil, a supabase client backed by plain
   arrays, and a fetch the test answers. Functions in this repo are plain JavaScript in a .ts file, so the only edit made to
   the source is the supabase import line. Used by test/fn_slack_ask_test.mjs. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let SEQ = 0;

/* a database made of arrays: { tables: { name: [rows] }, unique: { name: [cols] }, uuid: [names], rpc: { name: fn }, authUser: fn } */
export function makeDb(spec) {
  const db = Object.assign({ tables: {}, unique: {}, uuid: [], rpc: {}, authUser: null, log: [], clients: [] }, spec || {});
  db.rows = (t) => (db.tables[t] = db.tables[t] || []);
  return db;
}
const same = (a, b) => (a === b) || (a != null && b != null && String(a) === String(b));

class Query {
  constructor(db, table, client) { this.db = db; this.t = table; this.client = client; this.f = []; this.op = 'select'; this.opts = {}; this.one = ''; this.ord = null; this.lim = null; this.ret = false; this.payload = null; }
  select(_cols, opts) { if (this.op === 'select') this.opts = opts || {}; else this.ret = true; return this; }
  insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.f.push((r) => same(r[c], v)); return this; }
  neq(c, v) { this.f.push((r) => !same(r[c], v)); return this; }
  is(c, v) { this.f.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c, op, v) { if (op === 'is') this.f.push((r) => (v === null ? r[c] != null : r[c] !== v)); return this; }
  in(c, arr) { this.f.push((r) => (arr || []).some((v) => same(r[c], v))); return this; }
  gte(c, v) { this.f.push((r) => r[c] != null && String(r[c]) >= String(v)); return this; }
  lte(c, v) { this.f.push((r) => r[c] != null && String(r[c]) <= String(v)); return this; }
  gt(c, v) { this.f.push((r) => r[c] != null && String(r[c]) > String(v)); return this; }
  lt(c, v) { this.f.push((r) => r[c] != null && String(r[c]) < String(v)); return this; }
  ilike(c, pat) { const re = new RegExp('^' + String(pat).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); this.f.push((r) => re.test(String(r[c] || ''))); return this; }
  or() { return this; }            /* PostgREST "or" strings and full-text search are not modelled: the function's own checks must hold */
  textSearch() { return this; }
  order(c, o) { this.ord = [c, !o || o.ascending !== false]; return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  single() { this.one = 'one'; return this; }
  then(res, rej) { let out; try { out = this.run(); } catch (e) { return Promise.reject(e).then(res, rej); } return Promise.resolve(out).then(res, rej); }
  shape(rows) {
    if (this.one === 'maybe') return { data: rows[0] || null, error: null };
    if (this.one === 'one') return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'no rows' } };
    return { data: rows, error: null };
  }
  run() {
    const db = this.db, all = db.rows(this.t);
    db.log.push({ table: this.t, op: this.op, payload: this.payload, as: this.client.kind });
    if (db.fail && db.fail[this.t + ':' + this.op]) return { data: null, error: { message: 'forced failure' } };
    if (this.op === 'insert') {
      const made = [];
      for (const row0 of this.payload) {
        const row = Object.assign({}, row0);
        for (const col of (db.unique[this.t] || [])) {
          if (row[col] != null && all.some((r) => same(r[col], row[col]))) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        if (row.id == null) row.id = db.uuid.indexOf(this.t) >= 0 ? randomUUID() : (all.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1);
        const now = new Date().toISOString();
        if (row.created_at == null) row.created_at = now;
        if (row.at == null) row.at = now;
        all.push(row); made.push(row);
      }
      return this.ret ? this.shape(made) : { data: null, error: null };
    }
    let rows = all.filter((r) => this.f.every((fn) => fn(r)));
    if (this.op === 'update') { rows.forEach((r) => Object.assign(r, this.payload)); return this.ret ? this.shape(rows) : { data: null, error: null }; }
    if (this.op === 'delete') { rows.forEach((r) => all.splice(all.indexOf(r), 1)); return { data: null, error: null }; }
    if (this.ord) { const [c, asc] = this.ord; rows = rows.slice().sort((a, b) => (String(a[c] ?? '') < String(b[c] ?? '') ? -1 : String(a[c] ?? '') > String(b[c] ?? '') ? 1 : 0) * (asc ? 1 : -1)); }
    if (this.opts && this.opts.head) return { data: null, count: rows.length, error: null };
    if (this.lim != null) rows = rows.slice(0, this.lim);
    const out = this.shape(rows.map((r) => Object.assign({}, r)));
    if (this.opts && this.opts.count) out.count = rows.length;
    return out;
  }
}

function makeCreateClient(db) {
  return function createClient(_url, key, opts) {
    const headers = (opts && opts.global && opts.global.headers) || {};
    const client = { key, headers, kind: headers.Authorization ? 'user:' + headers.Authorization : 'service' };
    db.clients.push(client);
    client.from = (t) => new Query(db, t, client);
    client.rpc = async (name, args) => {
      db.log.push({ table: 'rpc:' + name, op: 'rpc', payload: args, as: client.kind });
      const fn = db.rpc[name];
      if (!fn) return { data: null, error: { message: 'no such rpc ' + name } };
      try { return { data: await fn(args || {}, client), error: null }; } catch (e) { return { data: null, error: { message: String(e) } }; }
    };
    client.auth = { getUser: async () => ({ data: { user: db.authUser ? db.authUser(headers) : null } }) };
    return client;
  };
}

/* load one function. env: what Deno.env.get returns. Returns { call(Request) -> Response, drain() } */
export async function loadFn(file, { env, db }) {
  const src0 = fs.readFileSync(file, 'utf8');
  const needle = "import { createClient } from 'jsr:@supabase/supabase-js@2';";
  if (src0.indexOf(needle) < 0) throw new Error('supabase import line not found in ' + file);
  const key = '__waFn' + (++SEQ);
  const src = src0.replace(needle, 'const { createClient, Deno, EdgeRuntime } = globalThis.' + key + ';');
  const bg = [];
  const slot = { createClient: makeCreateClient(db), handler: null,
    Deno: { env: { get: (k) => (env || {})[k] }, serve: (h) => { slot.handler = h; } },
    EdgeRuntime: (env && env.__NO_EDGE_RUNTIME) ? undefined : { waitUntil: (p) => { bg.push(Promise.resolve(p).catch(() => {})); } } };
  globalThis[key] = slot;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-fn-'));
  const tmp = path.join(dir, path.basename(path.dirname(file)) + '.mjs');
  fs.writeFileSync(tmp, src);
  await import(pathToFileURL(tmp).href);
  if (!slot.handler) throw new Error('the function did not call Deno.serve');
  return {
    call: (req) => slot.handler(req),
    /* wait for everything handed to EdgeRuntime.waitUntil, including work started by that work */
    drain: async () => { while (bg.length) { const p = bg.splice(0); await Promise.all(p); } }
  };
}

/* a fetch the test answers: routes is a list of [test(url) -> bool, handler(url, init) -> Response | object] */
export function makeFetch(routes, calls) {
  return async function fetchMock(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const rec = { url, method: (init && init.method) || 'GET', headers: Object.assign({}, (init && init.headers) || {}), body: init && init.body };
    try { rec.json = rec.body ? JSON.parse(rec.body) : undefined; } catch (_) { rec.json = undefined; }
    calls.push(rec);
    for (const [test, handler] of routes) {
      if (test(url)) {
        const out = await handler(url, init || {}, rec);
        if (out instanceof Response) return out;
        return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response('no route for ' + url, { status: 599 });
  };
}
