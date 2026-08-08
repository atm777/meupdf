/* Meu PDF — Service Worker (PWA offline real)
 *
 * Mesmo origin do shell (Cloudflare Pages). NÃO é blob.
 * Em cada release: bump VERSAO abaixo junto com PDFTools.VERSAO no index.html e a tag git.
 *
 * Estratégia:
 *  - install: precache shell (Pages) + libs/tools da tag no jsDelivr
 *  - activate: apaga caches de versões antigas
 *  - fetch GET: cache-first para precache; network + cache runtime para o resto (CORS ok);
 *    navegação offline → index.html em cache
 */
/* eslint-disable no-restricted-globals */
'use strict';

// === bump junto com index.html (PDFTools.VERSAO) e tag git ===
const VERSAO = 'v1.0.21';
const CACHE_NAME = 'meupdf-' + VERSAO;
const CDN = 'https://cdn.jsdelivr.net/gh/atm777/meupdf@' + VERSAO + '/';

// Shell no Pages (mesmo origin do SW)
const SHELL = [
  './',
  './index.html',
  './style.css',
  './page-editor.js'
];

// Libs + tools versionadas no GitHub/jsDelivr (variante A)
const ASSETS_CDN = [
  'pdf-lib.min.js',
  'pdf.min.js',
  'pdf.worker.min.js',
  'imagens-para-pdf.js',
  'juntar.js',
  'estudio.js',
  'organizar.js',
  'comprimir.js',
  'tarjar.js',
  'carimbar.js',
  'assinar.js',
  'pdf-para-imagens.js',
  'extrair-texto.js',
  'inspecionar.js'
].map(function (f) { return CDN + f; });

const PRECACHE = SHELL.concat(ASSETS_CDN);

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        // addAll falha se um único URL quebrar; precache em paralelo com tolerância.
        return Promise.all(
          PRECACHE.map(function (url) {
            return cache.add(url).catch(function (err) {
              console.warn('[meupdf-sw] precache falhou:', url, err);
            });
          })
        );
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== CACHE_NAME && key.indexOf('meupdf-') === 0) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') &&
      request.headers.get('accept').indexOf('text/html') !== -1);
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Navegação: network first, fallback para shell em cache (offline)
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put('./index.html', copy);
          });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (cached) {
            return cached || caches.match('./') ||
              new Response('Meu pdf está offline e o cache ainda não está pronto. Abra o site online uma vez.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
              });
          });
        })
    );
    return;
  }

  // Assets: cache first, depois rede (e grava no cache se CORS/basic 200)
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (res) {
        if (!res || res.status !== 200) return res;
        // basic = same origin; cors = jsDelivr etc.
        if (res.type === 'basic' || res.type === 'cors') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return res;
      }).catch(function () {
        // Offline e sem cache: resposta vazia amigável só para scripts/css conhecidos
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
