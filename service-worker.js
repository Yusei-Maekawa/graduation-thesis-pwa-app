// キャッシュのバージョン名。アプリファイルを更新したらこの数字を上げる。
// 名前が変わると、古いキャッシュは activate 時に削除される。
const CACHE_NAME = "household-accounting-v1";

// オフラインで動作させるためにキャッシュするファイル一式。
const CACHE_TARGETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/main.js",
  "./js/router.js",
  "./js/db.js",
  "./js/record-service.js",
  "./js/summary-service.js",
  "./js/validation.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon-32.png",
];

// install：キャッシュにアプリファイルを保存する
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_TARGETS))
  );
  // 新しい Service Worker をすぐ有効化する
  self.skipWaiting();
});

// activate：現在のバージョン以外の古いキャッシュを削除する
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // すぐにページの制御を開始する
  self.clients.claim();
});

// fetch：キャッシュ優先で応答する
self.addEventListener("fetch", (event) => {
  // GET 以外（将来的な通信など）はそのまま通す
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // キャッシュにあればそれを返す
      if (cachedResponse) {
        return cachedResponse;
      }
      // なければネットワークから取得する
      return fetch(event.request);
    })
  );
});