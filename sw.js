const CACHE = 'furosion-v4';
const ASSETS = ['/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Never intercept Firebase, Google APIs, or external resources
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('furosion.com') ||
    url.includes('furosion.org') ||
    url.includes('cdnjs.cloudflare.com')
  ) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .catch(() =>
          caches.match('/index.html').then(r =>
            r || new Response(
              `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
              <meta name="viewport" content="width=device-width,initial-scale=1.0">
              <title>Furosion — Offline</title>
              <style>
                body{font-family:sans-serif;background:#0f0e0a;color:#f5f0dc;display:flex;
                flex-direction:column;align-items:center;justify-content:center;
                height:100vh;text-align:center;gap:20px;padding:32px;margin:0}
                h1{font-size:22px;color:#e8c840}
                p{font-size:14px;color:#a09878;max-width:280px;line-height:1.7}
                a{color:#e8c840;font-size:13px}
                button{background:#e8c840;color:#1a1200;border:none;padding:12px 24px;
                border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px}
              </style></head><body>
              <h1>⚡ You're offline</h1>
              <p>Something broke or your device lost connection. If you need help, find a staff member with a lanyard.</p>
              <a href="mailto:support@furosion.com">support@furosion.com</a>
              <button onclick="location.reload()">Try again</button>
              </body></html>`,
              { status: 503, headers: { 'Content-Type': 'text/html' } }
            )
          )
        )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// Push notifications from Firebase Cloud Messaging
self.addEventListener('push', e => {
  let data = { title: 'Furosion', body: 'New update!' };
  try {
    if (e.data) data = e.data.json();
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title || 'Furosion', {
      body:    data.body  || '',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      tag:     data.tag   || 'furosion-' + Date.now(),
      data:    { url: data.url || '/' },
      vibrate: [200, 100, 200],
      requireInteraction: data.sticky || false
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const match = cls.find(c => c.url.includes(self.location.origin));
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});

// Allow main thread to trigger SW update
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});