/* w219crypto.js (wave219): hub-push's Web Push crypto, checked offline.
   Takes the block between "push-crypto start" and "push-crypto end" from fn/hub-push/index.ts, strips the types with
   TypeScript and runs it in Node's WebCrypto. Then:
   - a browser-side key pair (P-256) and auth secret are made as a browser would; hub-push's encryptPayload output is
     decrypted with http_ece (the reference implementation the web-push library uses) and must give the plaintext back;
   - the record header: salt 16 bytes, rs 4096, keyid length 65, an uncompressed P-256 point;
   - the VAPID header: "vapid t=<jwt>, k=<public key>", the JWT verifies with jose (ES256) against k, aud is the push
     service's origin, sub is a mailto, exp within 24 hours;
   - newVapidKeys and importVapid agree on the public key; two encryptions of one payload differ (fresh salt and key).
   Run: NODE_PATH=<scratch>/npm219/node_modules:/home/claude/.npm-global/lib/node_modules node test/w219crypto.js */
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const ts = require('typescript');
const ece = require('http_ece');
const jose = require('jose');

const src = fs.readFileSync(path.join(__dirname, '../fn/hub-push/index.ts'), 'utf8');
const a = src.indexOf('/* push-crypto start'), b = src.indexOf('/* push-crypto end */');
if (a < 0 || b < 0) throw new Error('markers not found');
const block = src.slice(a, b);
const js = ts.transpileModule(block + '\nmodule.exports = { b64u, unb64u, encryptPayload, vapidHeader, newVapidKeys, importVapid };', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'crypto', 'btoa', 'atob', 'TextEncoder', 'SUBJECT', js)(m, m.exports, globalThis.crypto, globalThis.btoa, globalThis.atob, TextEncoder, 'mailto:hub@welfareavenue.com');
const H = m.exports;

let pass = 0, fail = 0;
function ok(c, label) { if (c) { pass++; console.log('ok   ' + label); } else { fail++; console.log('FAIL ' + label); } }

(async () => {
  /* the browser side */
  const ua = nodeCrypto.createECDH('prime256v1'); ua.generateKeys();
  const uaPub = ua.getPublicKey();             /* 65 bytes, uncompressed */
  const authSecret = nodeCrypto.randomBytes(16);
  const p256dh = H.b64u(new Uint8Array(uaPub)), auth = H.b64u(new Uint8Array(authSecret));
  ok(p256dh.length === 87 && auth.length === 22, 'the subscription keys look like a browser\'s (87 and 22 characters)');

  const text = JSON.stringify({ title: 'Steel MacDonald mentioned you', body: 'On the task “Board pack”: can you check the numbers? éè …', url: '/#task/194', tag: 'mention-5', ts: 1 });
  const sealed = await H.encryptPayload(p256dh, auth, new TextEncoder().encode(text));
  const buf = Buffer.from(sealed);
  ok(buf.length > 86 + 16, 'the body has a header and a sealed record');
  ok(buf.readUInt32BE(16) === 4096, 'record size 4096');
  ok(buf[20] === 65 && buf[21] === 4, 'keyid is the sender\'s 65-byte uncompressed key');
  const plain = ece.decrypt(buf, { version: 'aes128gcm', privateKey: ua, authSecret: authSecret });
  ok(plain.toString('utf8') === text, 'http_ece decrypts it to the same JSON');
  const again = Buffer.from(await H.encryptPayload(p256dh, auth, new TextEncoder().encode(text)));
  ok(!again.equals(buf) && !again.slice(0, 16).equals(buf.slice(0, 16)), 'a second encryption uses a fresh salt and key');
  ok(ece.decrypt(again, { version: 'aes128gcm', privateKey: ua, authSecret: authSecret }).toString('utf8') === text, 'and decrypts too');
  /* a wrong auth secret must not decrypt */
  let threw = false; try { ece.decrypt(buf, { version: 'aes128gcm', privateKey: ua, authSecret: nodeCrypto.randomBytes(16) }); } catch (e) { threw = true; }
  ok(threw, 'another auth secret cannot read it');
  let bad = false; try { await H.encryptPayload(p256dh.slice(0, 40), auth, new Uint8Array([1])); } catch (e) { bad = true; }
  ok(bad, 'a broken subscription key is refused');

  /* VAPID */
  const k = await H.newVapidKeys();
  ok(k.jwk.kty === 'EC' && k.jwk.crv === 'P-256' && !!k.jwk.d && k.pub.length === 87, 'newVapidKeys gives a P-256 private JWK and an 87-character public key');
  const v = await H.importVapid(JSON.parse(JSON.stringify(k.jwk)));
  ok(v.pub === k.pub, 'importVapid reads the same public key back from the stored JWK');
  const now = Math.floor(Date.now() / 1000);
  const header = await H.vapidHeader('https://fcm.googleapis.com/fcm/send/abc:def', v.key, v.pub, now);
  const mm = /^vapid t=([^,]+), k=(.+)$/.exec(header);
  ok(!!mm && mm[2] === k.pub, 'the header is "vapid t=..., k=<public key>"');
  const raw = Buffer.from(H.unb64u(mm[2]));
  const pubJwk = { kty: 'EC', crv: 'P-256', x: raw.slice(1, 33).toString('base64url'), y: raw.slice(33, 65).toString('base64url') };
  const key = await jose.importJWK(pubJwk, 'ES256');
  const res = await jose.jwtVerify(mm[1], key, { algorithms: ['ES256'] });
  ok(res.payload.aud === 'https://fcm.googleapis.com', 'aud is the push service\'s origin');
  ok(res.payload.sub === 'mailto:hub@welfareavenue.com', 'sub is the Hub\'s mailto');
  ok(res.payload.exp > now && res.payload.exp <= now + 24 * 3600, 'exp is within 24 hours');
  ok(res.protectedHeader.alg === 'ES256' && res.protectedHeader.typ === 'JWT', 'the JWT header is ES256');
  const apple = await H.vapidHeader('https://web.push.apple.com/QGuQyavXutnMH', v.key, v.pub, now);
  const r2 = await jose.jwtVerify(/t=([^,]+)/.exec(apple)[1], key, { algorithms: ['ES256'] });
  ok(r2.payload.aud === 'https://web.push.apple.com', 'Safari\'s push service gets its own aud');
  let forged = false; try { await jose.jwtVerify(mm[1].slice(0, -4) + 'AAAA', key, { algorithms: ['ES256'] }); } catch (e) { forged = true; }
  ok(forged, 'a changed signature does not verify');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
