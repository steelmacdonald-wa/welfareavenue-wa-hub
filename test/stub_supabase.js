/* Offline stub of @supabase/supabase-js v2 for the WA Hub per-page harness.
   Served in place of the CDN script. Reads fixture rows from window.__WAFIX.
   Plain objects with real methods (NOT a Proxy) so wave code that reassigns
   builder methods (e.g. wave62 insert merge) works exactly like production. */
(function () {
  "use strict";

  function fix() { return window.__WAFIX || {}; }

  function rowsFor(table) {
    var r = fix()[table];
    return Array.isArray(r) ? r : [];
  }

  function clone(x) { return x === undefined ? x : JSON.parse(JSON.stringify(x)); }

  function Builder(table) {
    this._table = table;
    this._op = "select";
    this._eq = [];
    this._in = [];
    this._is = [];
    this._neq = [];
    this._order = [];
    this._limit = null;
    this._offset = 0;
    this._single = false;
    this._maybe = false;
    this._count = null;
    this._payload = null;
    this._head = false;
  }

  Builder.prototype.select = function (cols, opts) {
    if (this._op === "select") this._op = "select";
    if (opts && opts.count) this._count = opts.count;
    if (opts && opts.head) this._head = true;
    return this;
  };
  Builder.prototype.insert = function (payload) { this._op = "insert"; this._payload = payload; return this; };
  Builder.prototype.update = function (payload) { this._op = "update"; this._payload = payload; return this; };
  Builder.prototype.upsert = function (payload) { this._op = "upsert"; this._payload = payload; return this; };
  Builder.prototype.delete = function () { this._op = "delete"; return this; };
  Builder.prototype.eq = function (c, v) { this._eq.push([c, v]); return this; };
  Builder.prototype.neq = function (c, v) { this._neq.push([c, v]); return this; };
  Builder.prototype.gt = function () { return this; };
  Builder.prototype.gte = function () { return this; };
  Builder.prototype.lt = function () { return this; };
  Builder.prototype.lte = function () { return this; };
  Builder.prototype.like = function () { return this; };
  Builder.prototype.ilike = function () { return this; };
  Builder.prototype.is = function (c, v) { this._is.push([c, v]); return this; };
  Builder.prototype.in = function (c, v) { this._in.push([c, v]); return this; };
  Builder.prototype.or = function () { return this; };
  Builder.prototype.not = function () { return this; };
  Builder.prototype.contains = function () { return this; };
  Builder.prototype.overlaps = function () { return this; };
  Builder.prototype.filter = function () { return this; };
  Builder.prototype.match = function (obj) {
    for (var k in obj) this._eq.push([k, obj[k]]);
    return this;
  };
  Builder.prototype.order = function (col, opts) { this._order.push([col, opts || {}]); return this; };
  Builder.prototype.limit = function (n) { this._limit = n; return this; };
  Builder.prototype.range = function (a, b) { this._offset = a; this._limit = (b - a + 1); return this; }; /* wave152: the offset counts, as in PostgREST */
  Builder.prototype.single = function () { this._single = true; return this; };
  Builder.prototype.maybeSingle = function () { this._maybe = true; return this; };
  Builder.prototype.csv = function () { return this; };
  Builder.prototype.returns = function () { return this; };
  Builder.prototype.abortSignal = function () { return this; };
  Builder.prototype.throwOnError = function () { return this; };

  Builder.prototype._resolve = function () {
    var res;
    if (this._op === "select") {
      var rows = rowsFor(this._table).slice();
      var i, f;
      for (i = 0; i < this._eq.length; i++) {
        f = this._eq[i];
        rows = rows.filter(function (r) {
          return r && Object.prototype.hasOwnProperty.call(r, f[0]) ? String(r[f[0]]) === String(f[1]) : true;
        });
      }
      for (i = 0; i < this._neq.length; i++) {
        f = this._neq[i];
        rows = rows.filter(function (r) {
          return r && Object.prototype.hasOwnProperty.call(r, f[0]) ? String(r[f[0]]) !== String(f[1]) : true;
        });
      }
      for (i = 0; i < this._in.length; i++) {
        f = this._in[i];
        var set = (f[1] || []).map(String);
        rows = rows.filter(function (r) {
          return r && Object.prototype.hasOwnProperty.call(r, f[0]) ? set.indexOf(String(r[f[0]])) >= 0 : true;
        });
      }
      for (i = 0; i < this._is.length; i++) {
        f = this._is[i];
        if (f[1] === null) {
          rows = rows.filter(function (r) {
            return r && Object.prototype.hasOwnProperty.call(r, f[0]) ? r[f[0]] === null : true;
          });
        }
      }
      for (i = this._order.length - 1; i >= 0; i--) {
        f = this._order[i];
        var col = f[0], asc = f[1].ascending !== false;
        rows.sort(function (a, b) {
          var x = a ? a[col] : null, y = b ? b[col] : null;
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          if (x < y) return asc ? -1 : 1;
          return asc ? 1 : -1;
        });
      }
      if (this._offset) rows = rows.slice(this._offset);
      if (this._limit !== null) rows = rows.slice(0, this._limit);
      if (this._single || this._maybe) {
        res = { data: rows.length ? clone(rows[0]) : null, error: null };
      } else {
        res = { data: clone(rows), error: null };
      }
      if (this._count) res.count = rows.length;
      if (this._head) res.data = null;
    } else {
      /* mutations: acknowledge, never mutate the fixture (deterministic) */
      var p = this._payload;
      var arr = p === null || p === undefined ? [] : (Array.isArray(p) ? p : [p]);
      res = { data: clone(arr), error: null };
      if (this._single || this._maybe) res.data = arr.length ? clone(arr[0]) : null;
    }
    return res;
  };

  /* optional network latency for load-order tests: window.__WA_LAT = ms (each call waits 0.5x to 1.5x of it); unset, calls resolve at once as before */
  function lag(v) {
    var L = Number(window.__WA_LAT || 0);
    if (!L) return Promise.resolve(v);
    return new Promise(function (r) { setTimeout(function () { r(v); }, Math.round(L * (0.5 + Math.random()))); });
  }
  Builder.prototype.then = function (onF, onR) {
    var self = this;
    return lag(null).then(function () { return self._resolve(); }).then(onF, onR);
  };
  Builder.prototype.catch = function (onR) { return this.then(null, onR); };
  Builder.prototype.finally = function (fn) { return this.then().finally(fn); };

  function makeClient() {
    var email = (window.__WA_TEST_EMAIL || "steel.macdonald@welfareavenue.com").toLowerCase();
    var name = window.__WA_TEST_NAME || "Steel MacDonald";
    var role = window.__WA_TEST_ROLE || "admin";
    var session = {
      access_token: "stub-token",
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: email,
        user_metadata: { full_name: name, name: name }
      }
    };
    var client = {
      from: function (table) { return new Builder(table); },
      rpc: function (fn, args) {
        var data = null;
        if (fn === "get_my_role") data = role;
        var rpcs = window.__WA_RPCS || {};
        if (Object.prototype.hasOwnProperty.call(rpcs, fn)) data = rpcs[fn];
        return lag({ data: data, error: null });
      },
      functions: {
        invoke: function (name, opts) {
          return Promise.resolve({ data: null, error: null });
        }
      },
      auth: {
        getSession: function () { var out = false; try { out = sessionStorage.getItem("stub_signed_out") === "1"; } catch (e) {} return lag({ data: { session: out ? null : session }, error: null }); },
        getUser: function () { return Promise.resolve({ data: { user: session.user }, error: null }); },
        onAuthStateChange: function (cb) {
          return { data: { subscription: { unsubscribe: function () {} } } };
        },
        signInWithOAuth: function () { return Promise.resolve({ data: null, error: null }); },
        signOut: function () { try { sessionStorage.setItem("stub_signed_out", "1"); } catch (e) {} return Promise.resolve({ error: null }); }
      },
      storage: {
        from: function (bucket) {
          return {
            getPublicUrl: function (path) {
              return { data: { publicUrl: "https://stub.local/storage/" + bucket + "/" + path } };
            },
            upload: function () { return Promise.resolve({ data: null, error: null }); },
            list: function () { return Promise.resolve({ data: [], error: null }); },
            download: function () { return Promise.resolve({ data: null, error: { message: "stub" } }); }
          };
        }
      },
      channel: function () {
        var ch = {
          on: function () { return ch; },
          subscribe: function (cb) { if (cb) { try { cb("SUBSCRIBED"); } catch (e) {} } return ch; },
          track: function () { return Promise.resolve("ok"); },
          presenceState: function () { return {}; },
          send: function () { return Promise.resolve("ok"); },
          unsubscribe: function () { return Promise.resolve("ok"); }
        };
        return ch;
      },
      removeChannel: function () { return Promise.resolve("ok"); },
      realtime: { channels: [] }
    };
    return client;
  }

  window.supabase = { createClient: function () { return makeClient(); } };
})();
