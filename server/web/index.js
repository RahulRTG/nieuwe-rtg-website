/* web: mini web-framework op node:http, i.p.v. express (zie docs/de-lijn.md).
   Opgesplitst in routing/bestanden/verrijk/body; deze index houdt de publieke
   vorm identiek: web() -> app, web.Router(), web.json/raw/static. */
'use strict';
const http = require('http');
const { maakRouter, padNaar } = require('./routing');
const { verrijk } = require('./verrijk');
const { json, raw } = require('./body');
const { statisch } = require('./bestanden');
const rtgjson = require('../lib/rtgjson');

function maakApp() {
  const router = maakRouter();
  const instellingen = {};

  const app = function (req, res) { app.handle(req, res); };
  // de router-methoden doorspiegelen op de app
  app.use = (...a) => { router.use(...a); return app; };
  for (const m of ['post', 'put', 'delete', 'patch', 'all', 'head', 'options']) {
    app[m] = (...a) => { router[m](...a); return app; };
  }
  // app.get is in express ook een instellingen-getter (1 string-argument)
  app.get = function (pat, ...fns) {
    if (typeof pat === 'string' && fns.length === 0) return instellingen[pat];
    router.get(pat, ...fns); return app;
  };
  app.set = (k, v) => { instellingen[k] = v; return app; };
  app.enable = (k) => { instellingen[k] = true; return app; };
  app.disable = (k) => { instellingen[k] = false; return app; };
  app.enabled = (k) => !!instellingen[k];
  app.disabled = (k) => !instellingen[k];

  /* Express-compatibele introspectie: sommige code (kern/stuur.js) leest de
     geregistreerde routes uit app._router.stack -> laag.route.{path,methods}.
     We bieden diezelfde vorm als een afgeleide weergave van de eigen stack. */
  app._router = {
    get stack() {
      return router._stack.map(l => {
        if (l.mount) return { handle: l.fn, route: undefined, name: 'router' };
        const methods = l.method ? { [l.method.toLowerCase()]: true } : { _all: true };
        return { handle: l.fn, route: { path: l.pad, methods, stack: [{ method: l.method, handle: l.fn }] } };
      });
    }
  };

  app.handle = function (req, res) {
    verrijk(req, res, instellingen);
    router._handle(req, res, (err) => {
      if (err) {
        if (res.headersSent) return res.destroy();
        res.statusCode = (err && err.status) || 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(rtgjson.stringify({ error: 'Interne fout.' }));
      }
      if (res.headersSent) return;
      res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('Not Found');
    });
  };

  app.listen = function (...args) {
    // Standaard op node:http (kern, veilig). Opt-in motoren:
    //   RTG_EIGEN_HTTP2=1 -> onze HTTP/2-listener (node:http2, multiplexing+HPACK)
    //   RTG_EIGEN_HTTP=1  -> onze eigen HTTP/1.1-motor op rauwe sockets
    let server;
    if (process.env.RTG_EIGEN_HTTP2 === '1') server = require('../lib/http2').maakServer(app);
    else if (process.env.RTG_EIGEN_HTTP === '1') server = require('../lib/http1').maakServer(app);
    else server = http.createServer(app);
    return server.listen(...args);
  };
  return app;
}

/* ---------- publieke API (zelfde vorm als express) ---------- */
function web() { return maakApp(); }
web.Router = maakRouter;
web.json = json;
web.raw = raw;
web.static = statisch;
web.urlencoded = () => (req, res, next) => next(); // niet gebruikt; veilige no-op voor drop-in
module.exports = web;
