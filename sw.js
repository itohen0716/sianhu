"use strict";

const SCORE_FONT_CACHE="shian-score-font-v157";
const SCORE_FONT_FILES=[
  "./fonts/BIZUDPMincho-Regular.ttf"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(SCORE_FONT_CACHE).then(cache=>cache.addAll(SCORE_FONT_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("shian-score-font-")&&key!==SCORE_FONT_CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||!event.request.url.endsWith("/fonts/BIZUDPMincho-Regular.ttf"))return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok)caches.open(SCORE_FONT_CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  })));
});
