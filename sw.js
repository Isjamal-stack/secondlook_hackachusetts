/**
 * Service Worker for ELM327 Vehicle Insights PWA
 * Handles offline caching and provides instant loading
 */

const CACHE_NAME = 'vehicle-insights-v1.0.0';
const RUNTIME_CACHE = 'vehicle-insights-runtime';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/app.js',
    '/js/bluetooth-manager.js',
    '/js/elm327-protocol.js',
    '/js/storage-manager.js',
    '/js/demo/sample-data.js',
    '/js/demo/simulation.js',
    '/js/demo/demo-examples.js',
    '/js/demo/demo-presentation.js',
    '/js/demo/insight-engine.js',
    '/js/demo/simulation-adapter.js',
    '/workers/data-worker.js'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Remove old caches
                            return name !== CACHE_NAME && name !== RUNTIME_CACHE;
                        })
                        .map((name) => {
                            console.log('[Service Worker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim(); // Take control immediately
            })
    );
});

/**
 * Fetch event - serve from cache, fallback to network
 * Strategy: Cache-first for static assets, network-first for data
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Cache-first strategy for static assets
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request));
    } else {
        // Network-first strategy for dynamic content
        event.respondWith(networkFirst(request));
    }
});

/**
 * Check if request is for a static asset
 */
function isStaticAsset(request) {
    const url = new URL(request.url);
    const ext = url.pathname.split('.').pop();
    
    // Static file extensions
    const staticExtensions = ['html', 'css', 'js', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'json'];
    
    return staticExtensions.includes(ext) || STATIC_ASSETS.some(asset => url.pathname === asset);
}

/**
 * Cache-first strategy: check cache, then network
 */
async function cacheFirst(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback to network
        const networkResponse = await fetch(request);
        
        // Cache the response for future use
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Cache-first failed:', error);
        
        // Return offline page if available
        return caches.match('/index.html');
    }
}

/**
 * Network-first strategy: try network, then cache
 */
async function networkFirst(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        console.error('[Service Worker] Network-first failed:', error);
        throw error;
    }
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => caches.delete(name))
                );
            })
        );
    }
});

/**
 * Sync event - handle background sync (future feature)
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

/**
 * Background sync function (placeholder)
 */
async function syncData() {
    console.log('[Service Worker] Background sync triggered');
    // Future: sync data with cloud or external services
}

/**
 * Push notification event (future feature)
 */
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    
    const options = {
        body: data.body || 'New notification from Vehicle Insights',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [200, 100, 200],
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Vehicle Insights', options)
    );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('[Service Worker] Loaded successfully');
