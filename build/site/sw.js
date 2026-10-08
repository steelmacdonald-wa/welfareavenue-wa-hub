/* Welfare Avenue Hub: the service worker (wave219, 07/10/26). Deployed by host-sync from site_files path sw.js; source
   build/site/sw.js. It does one thing: Hub notifications. No caching and no fetch handler, so the Hub always loads from the
   network exactly as before.
   - push: shows the notification hub-push sent (title, body, the link inside the Hub, a tag so a newer one about the same
     thing replaces the older), and tells any open Hub page (wa-push), which refreshes what it shows.
   - notificationclick: brings an open Hub window forward and opens the link there (wa-open), or opens the Hub at the link.
   - pushsubscriptionchange: when the browser replaces the subscription, subscribes again with the same key and tells
     hub-push (renew; no key is needed: the old subscription's auth secret proves the device). The page also re-saves on
     every visit. */
var SUPABASE = 'https://zwnmulmnvopclzcvytce.supabase.co';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { body: e.data.text() }; } catch (y) { d = {}; } }
  var title = d.title || 'Welfare Avenue Hub';
  var opts = {
    body: d.body || '',
    icon: '/icons/hub-192.png',
    badge: '/icons/hub-badge-96.png',
    data: { url: d.url || '/' },
    timestamp: d.ts || Date.now(),
    lang: 'en'
  };
  if (d.tag) { opts.tag = d.tag; opts.renotify = true; }
  e.waitUntil(self.registration.showNotification(title, opts).then(function () {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { try { c.postMessage({ type: 'wa-push', tag: d.tag || '', url: d.url || '/' }); } catch (x) { /* fine */ } });
    });
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i], u;
      try { u = new URL(c.url); } catch (x) { continue; }
      if (u.origin === self.location.origin && (u.pathname === '/' || u.pathname === '/index.html') && 'focus' in c) {
        try { c.postMessage({ type: 'wa-open', url: url }); } catch (x) { /* fine */ }
        return c.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});

function b64u(buf) {
  var b = new Uint8Array(buf), s = '';
  for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
self.addEventListener('pushsubscriptionchange', function (e) {
  var old = e.oldSubscription;
  var key = old && old.options && old.options.applicationServerKey;
  if (!old || !key || !old.getKey) return;
  e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (sub) {
    return fetch(SUPABASE + '/functions/v1/hub-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renew', old_endpoint: old.endpoint, old_auth: b64u(old.getKey('auth')), endpoint: sub.endpoint, p256dh: b64u(sub.getKey('p256dh')), auth: b64u(sub.getKey('auth')) })
    });
  }).catch(function () { /* the page saves it again on the next visit */ }));
});
