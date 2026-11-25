// Only a generic offline response. No private pages, calendar records or tokens
// are put into Cache Storage. All online requests always go to the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
 if(event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly — Offline</title><main><h1>You are offline</h1><p>Your private planner needs a connection. Reconnect and reload this page. Unsaved changes are not queued.</p><a href="/">Try again</a></main></html>',{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})));
});
