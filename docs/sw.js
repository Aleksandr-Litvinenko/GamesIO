/* Service worker: «скачал один раз — играешь всегда».
 *
 * При установке в кеш кладётся весь сайт целиком: страницы, скрипты, стили,
 * обложки. Дальше страницы отдаются из кеша мгновенно, а сеть используется
 * только чтобы тихо обновить копию в фоне (stale-while-revalidate).
 * Поэтому вторая загрузка не ждёт сеть вообще, а в самолёте сайт работает
 * так же, как дома.
 *
 * Файл собирается генератором: список ассетов и версия подставляются в сборке.
 */
const VERSION = '26be477e57';
const CACHE = 'gamesio-' + VERSION;
const ASSETS = [
  "./",
  "./breakout/",
  "./snake/",
  "./light-cycles/",
  "./sky-squadron/",
  "./motorbike-3d/",
  "./coast-runner/",
  "./split-duel/",
  "./ru/",
  "./ru/arkanoid/",
  "./ru/zmeyka/",
  "./ru/motocikly/",
  "./ru/samolyotiki/",
  "./ru/moto-3d/",
  "./ru/tachki-3d/",
  "./ru/duel-na-dvoih/",
  "./manifest.webmanifest",
  "./data/leaderboard.json",
  "./assets/styles.css",
  "./assets/engine.js",
  "./assets/scores.js",
  "./assets/pwa.js",
  "./assets/road.js",
  "./assets/racer.js",
  "./assets/arkanoid.js",
  "./assets/snake.js",
  "./assets/moto.js",
  "./assets/moto3d.js",
  "./assets/cars3d.js",
  "./assets/duel3d.js",
  "./assets/planes.js",
  "./assets/ads.js",
  "./assets/app.js",
  "./assets/ui.js",
  "./og/arkanoid.png",
  "./og/cars3d.png",
  "./og/cover.png",
  "./og/duel3d.png",
  "./og/icon-192.png",
  "./og/icon-512.png",
  "./og/moto.png",
  "./og/moto3d.png",
  "./og/snake.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll падает целиком, если хоть один запрос не удался, поэтому
      // кладём по одному: пропущенная обложка не должна ломать установку
      .then((cache) => Promise.all(ASSETS.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Таблица лидеров должна быть свежей: сеть первой, кеш — как запасной путь
  if (url.pathname.endsWith('/leaderboard.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      // отдаём кеш сразу, если он есть, и обновляем копию в фоне
      return cached || network;
    })
  );
});

// Страница может попросить пересчитать, что уже лежит офлайн
self.addEventListener('message', (event) => {
  if (event.data !== 'gamesio:status') return;
  caches.open(CACHE).then((cache) =>
    cache.keys().then((keys) => {
      event.source.postMessage({
        type: 'gamesio:status',
        cached: keys.length,
        total: ASSETS.length,
        version: VERSION,
      });
    })
  );
});
