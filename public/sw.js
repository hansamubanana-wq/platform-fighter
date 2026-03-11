// Service Worker - オフライン対応 & PWA インストール
const CACHE_NAME = 'pf-fighter-v1';

// インストール: すぐにアクティブ化
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // 古いキャッシュを削除
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ: ネットワーク優先 → キャッシュにも保存
self.addEventListener('fetch', (e) => {
  // GET リクエストのみキャッシュ対象
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // 正常なレスポンスをキャッシュにコピー
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // オフライン時はキャッシュから返す
        return caches.match(e.request);
      })
  );
});
