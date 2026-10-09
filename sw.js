// Service Worker для WORKOUT UP
// Стратегия: Cache-First для статики, оффлайн-режим, localStorage не затрагивается.

const CACHE_NAME = 'workout-up-cache-v1';
// Список ресурсов, которые необходимо закэшировать при установке
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// Установка SW и кэширование статических ресурсов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэш открыт, добавляются ресурсы:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Ошибка при добавлении в кэш:', err);
      })
  );
  // Форсируем активацию нового SW без ожидания закрытия старых вкладок
  self.skipWaiting();
});

// Активация SW и удаление старых кэшей
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Удалён старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Захватываем контроль над страницами без перезагрузки
      return self.clients.claim();
    })
  );
});

// Перехват запросов: стратегия Cache-First
self.addEventListener('fetch', event => {
  // Пропускаем запросы к API, chrome-extension и т.д.
  const url = event.request.url;
  if (url.includes('/api/') || url.startsWith('chrome-extension://')) {
    return;
  }

  // Для навигационных запросов (HTML) и статики: Cache First, затем Network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем из кэша, если есть
        if (response) {
          return response;
        }
        
        // Если в кэше нет, идём в сеть
        return fetch(event.request).then(networkResponse => {
          // Проверяем, что ответ валидный, и кладём в кэш для будущего оффлайна
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            // Не кэшируем запросы, которые не GET
            if (event.request.method === 'GET') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
          }
          return networkResponse;
        }).catch(error => {
          // Можно вернуть fallback страницу, но для SPA/PWA с index.html это не критично
          console.error('Fetch failed; returning offline page.', error);
          // Если запрос был на HTML, можно вернуть оффлайн-страницу, но здесь просто null
          // Оставляем возможность ошибки, чтобы браузер показал стандартную оффлайн-страницу.
        });
      })
  );
});