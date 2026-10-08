/* Service worker: l'app si apre anche senza rete. I cammini scaricati stanno nelle cache "cammino-*" e "tiles". */
const V="cammini-v8";
const SHELL=["./","index.html","app.js","style.css","manifest.webmanifest","lib/leaflet.js","lib/leaflet.css","lib/fonts/garamond-400.woff2","lib/fonts/garamond-600.woff2","lib/fonts/garamond-400i.woff2","lib/fonts/sourcesans-400.woff2","lib/fonts/sourcesans-600.woff2","lib/fonts/sourcesans-400i.woff2","lib/images/layers.png","lib/images/layers-2x.png","lib/images/marker-icon.png","lib/images/marker-icon-2x.png","lib/images/marker-shadow.png","icons/icon-192.png","icons/icon-512.png","icons/icon-180.png","dati/indice.json","dati/aiuto.json","dati/tracce.json","dati/sicurezza.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open("app").then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(self.clients.claim());});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  if(u.hostname.endsWith("opentopomap.org")){
    // tessere: prima la cache, poi la rete (e si tengono quelle viste)
    e.respondWith(caches.open("tiles").then(async c=>{const hit=await c.match(e.request.url);if(hit)return hit;
      try{const r=await fetch(e.request);if(r.ok)c.put(e.request.url,r.clone());return r;}catch{return new Response("",{status:504});}}));
    return;
  }
  if(u.origin!==location.origin)return;
  // app e dati: cache prima (shell e cammini scaricati), altrimenti rete e si salva
  e.respondWith((async()=>{
    const hit=await caches.match(e.request,{ignoreSearch:true});
    if(hit){ if(u.pathname.endsWith(".json")||u.pathname.endsWith("app.js")||u.pathname.endsWith("style.css")||u.pathname.endsWith("index.html")||u.pathname.endsWith("/")){
        // aggiorna in sottofondo
        fetch(e.request).then(r=>{if(r.ok)caches.open("app").then(c=>c.put(e.request,r));}).catch(()=>{});}
      return hit;}
    try{const r=await fetch(e.request);
      if(r.ok&&(u.pathname.includes("/dati/")||u.pathname.endsWith(".png")||u.pathname.endsWith(".jpg"))){const c=await caches.open("visti");c.put(e.request,r.clone());}
      return r;}
    catch{ if(e.request.mode==="navigate")return caches.match("index.html"); return new Response("",{status:504}); }
  })());
});
