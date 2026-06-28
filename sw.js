// FC Sunday V2 — Service Worker
// Đủ điều kiện PWA install, cache shell assets để load nhanh

const CACHE_NAME = 'fc-sunday-v2-v4';
const SHELL_ASSETS = [
  './',
  './index.html',
  './chi-tieu.html',
  './thu-thang.html',
  './thu-phat.html',
  './thanh-vien.html',
  './settings.html',
  './share.html',
  './style.css',
  './app.js',
  './date-picker.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './TossFaceFontWeb.otf',
  './components/header.html',
  './components/bottom-nav.html',
  './components/sidebar.html',
  './components/login-modal.html',
  './components/components-loader.js',
];

// Install: cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting(); // kích hoạt SW mới ngay, không chờ tab đóng
});

// Activate: xoá cache cũ
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  // Thông báo tất cả tab đang mở để reload
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

// Fetch: Network first → fallback cache
// Firebase & CDN luôn lấy từ network
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bỏ qua Firebase, CDN, API calls
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('iconify') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('chart.js') ||
    e.request.method !== 'GET'
  ) {
    return; // browser xử lý bình thường
  }

  // Shell assets: cache first, revalidate background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached); // offline fallback
      return cached || fetchPromise;
    })
  );
});
