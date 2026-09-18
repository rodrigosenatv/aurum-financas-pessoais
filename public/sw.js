/* -------------------------------------------------------------------------- */
/* Aurum · Finanças Pessoais - Service Worker                                  */
/* Versão de Cache: aurum-pwa-v1                                              */
/* -------------------------------------------------------------------------- */

const CACHE_NAME = 'aurum-pwa-v1';

// Recursos essenciais para pré-cache imediato no install
const PRECACHE_ASSETS = [
  '/offline',
  '/icon.svg',
  '/favicon.svg',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest'
];

// Instalação: pré-carrega os assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usa Promise.allSettled para garantir que a instalação continue mesmo se algum item falhar
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Falha ao pré-cachear:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Ativação: limpa versões de cache antigas e assume controle imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removendo cache obsoleto:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Apenas métodos GET são cacheados
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignorar protocolos não suportados (ex: chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // 1. Requisições para rotas de API: Network-only para evitar servir dados financeiros desatualizados
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'offline',
            message: 'Você está offline. Conecte-se à internet para sincronizar suas finanças.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 2. Navegação de páginas (HTML): Network-first com fallback para cache e página offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // Se a página requisitada não estiver em cache, exibe o fallback offline
          const offlinePage = await caches.match('/offline');
          if (offlinePage) return offlinePage;

          return new Response(
            '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Aurum Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#060807;color:#f3efe6;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px;text-align:center"><div><h1>Modo Offline</h1><p>Você está sem conexão no momento. Reconecte-se para carregar o Aurum.</p><button onclick="location.reload()" style="background:#b6f244;color:#060807;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:16px">Tentar novamente</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 3. Assets estáticos (Next.js scripts, CSS, fontes Google, imagens e ícones): Cache-first / Stale-while-revalidate
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|css|js)$/i) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Padrão para demais requisições GET: Network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Comunicação com a interface (atualização forçada)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
