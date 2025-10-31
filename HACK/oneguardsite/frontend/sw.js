const CACHE_NAME = 'client-management-v1.3';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Файлы для кэширования при установке
const STATIC_FILES = [
    '/',
    '/static/css/styles.css',
    '/static/js/app.js',
    '/static/js/auth.js',
    '/static/js/router.js',
    '/static/js/engineer.js',
    '/static/js/admin.js',
    '/static/js/offline.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                // Используем addAll с обработкой ошибок для каждого файла
                return Promise.all(
                    STATIC_FILES.map(url => {
                        return cache.add(url).catch(error => {
                            console.warn(`Failed to cache ${url}:`, error);
                        });
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Installed');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker installation failed:', error);
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    // Удаляем старые кэши
                    if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
                        console.log('Service Worker: Deleting old cache', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
        .then(() => {
            console.log('Service Worker: Activated');
            // Берём управление всеми клиентами сразу
            return self.clients.claim();
        })
        .catch(error => {
            console.error('Service Worker activation failed:', error);
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Пропускаем не-GET запросы
    if (event.request.method !== 'GET') {
        return;
    }

    // Пропускаем запросы к API - они обрабатываются приложением
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Пропускаем запросы к админке Django
    if (url.pathname.startsWith('/admin/')) {
        return;
    }

    // Пропускаем запросы к статическим файлам Django (они уже обслуживаются Django)
    if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/media/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Возвращаем кэшированную версию, если есть
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Для HTML-страниц всегда возвращаем index.html (SPA routing)
                if (event.request.destination === 'document' ||
                    event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/')
                        .then(response => response || fetch(event.request));
                }

                // Для остальных файлов пробуем сетевой запрос
                return fetch(event.request)
                    .then((fetchResponse) => {
                        // Клонируем ответ, т.к. он может быть прочитан только один раз
                        const responseToCache = fetchResponse.clone();

                        // Кэшируем успешные ответы (кроме ошибок)
                        if (fetchResponse.status === 200) {
                            caches.open(DYNAMIC_CACHE)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                })
                                .catch(error => {
                                    console.warn('Failed to cache dynamic content:', error);
                                });
                        }

                        return fetchResponse;
                    })
                    .catch((error) => {
                        console.warn('Network request failed:', error);

                        // Fallback для CSS/JS файлов
                        if (event.request.destination === 'style' ||
                            event.request.destination === 'script') {
                            return new Response(
                                '/* Fallback content */',
                                { headers: { 'Content-Type': 'text/css' } }
                            );
                        }

                        // Fallback для изображений
                        if (event.request.destination === 'image') {
                            return new Response(
                                '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#ccc"/></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }

                        // Для документов возвращаем главную страницу
                        return caches.match('/');
                    });
            })
    );
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);

    if (event.tag === 'background-sync') {
        event.waitUntil(
            syncOfflineData().catch(error => {
                console.error('Background sync failed:', error);
            })
        );
    }
});

// Функция фоновой синхронизации данных
async function syncOfflineData() {
    try {
        console.log('Service Worker: Starting background sync...');

        // Получаем все открытые вкладки приложения
        const clients = await self.clients.matchAll();

        // Оповещаем каждую вкладку о начале синхронизации
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC_STARTED',
                timestamp: new Date().toISOString()
            });
        });

        // Здесь может быть логика синхронизации с сервером
        // Например, отправка накопленных офлайн-данных

        // Имитация синхронизации
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Оповещаем о завершении синхронизации
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC_COMPLETED',
                timestamp: new Date().toISOString(),
                success: true
            });
        });

        console.log('Service Worker: Background sync completed');

    } catch (error) {
        console.error('Service Worker: Background sync error:', error);

        // Оповещаем об ошибке
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC_FAILED',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        });
    }
}

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
    console.log('Service Worker: Received message', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME,
            timestamp: new Date().toISOString()
        });
    }

    if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(STATIC_CACHE)
                .then(cache => {
                    return cache.addAll(event.data.urls);
                })
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                })
                .catch(error => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                })
        );
    }
});

// Обработка push-уведомлений (если понадобится в будущем)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'Новое уведомление',
        icon: '/static/assets/icon.png',
        badge: '/static/assets/badge.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Client System', options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // Ищем открытую вкладку приложения
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }

                // Если вкладка не найдена, открываем новую
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
    );
});