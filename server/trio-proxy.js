/* ============================================================================
   HET DOORSTUREN ZELF -- wat er met EEN verzoek gebeurt.

   Dit stond in server/trio.js. Het staat hier omdat dat bestand er de
   voordeurprocessen bij kreeg (./trio-werkers.js) en daarmee over de
   keuringsgrens ging, en omdat dit de nette naad is: trio.js gaat over opzetten,
   starten en stoppen, dit gaat over een verzoek.

   TWEE DINGEN DIE HIER NIET WEG MOGEN

   1. HET LICHAAM IS AL BINNENGEHAALD voordat stuurDoor() wordt aangeroepen (dat
      gebeurt in trio.js). Daardoor kan een verzoek bij een uitval nog naar een
      andere server, ook halverwege een POST. Dat kost een kopie per verzoek en
      dat is bewust: een lid dat zijn betaling opnieuw moet doen omdat er net een
      server omviel, is duurder dan die kopie.

   2. DE GEVALLEN SERVER GAAT OP ROL 'uit', en niet alleen op onbereikbaar.
      trio-wacht.js leunt op de invariant "onbereikbaar betekent rol uit", en een
      invariant die op een van de twee plekken niet wordt gezet, is er geen.

   maakProxy() krijgt de wacht mee en niet andersom: een werkerproces heeft een
   schaduwwacht (./trio-werkers.js) en moet hier precies hetzelfde doen.
   ========================================================================== */
'use strict';
const http = require('http');

function maakProxy({ wacht, servers, LOKAAL_TLS }) {
  function stuurDoor(req, res, body, idx, magOpnieuw) {
    const s = servers[idx];
    const headers = { ...req.headers };
    headers['x-forwarded-for'] = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '') + (req.socket.remoteAddress || '');
    if (!headers['x-forwarded-proto']) headers['x-forwarded-proto'] = LOKAAL_TLS ? 'https' : 'http';
    const proxy = http.request({ host: '127.0.0.1', port: s.port, path: req.url, method: req.method, headers }, pres => {
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res); // streamt ook SSE gewoon door
    });
    proxy.on('error', async () => {
      /* Ook s.rol, en niet alleen s.healthy: 'onbereikbaar betekent rol uit' is de
         invariant waar trio-wacht.js op leunt, en een invariant die op een van de
         twee plekken niet wordt gezet, is er geen. kleefDoel() filtert toevallig
         ook op healthy, dus het gedrag klopte -- maar dan hangt het aan een detail
         in een andere module in plaats van aan de regel zelf. */
      s.healthy = false; s.healthySince = 0; s.rol = 'uit';
      if (res.headersSent || !magOpnieuw) { try { res.destroy(); } catch (e) {} return; }
      await wacht.kiesActieve('server ' + s.nr + ' liet een verzoek vallen');
      const actief = wacht.actieve();
      if (actief < 0) return uitleg503(res);
      /* Opnieuw kleven en niet blind naar de leider: de gevallen server staat nu
         op rol 'uit' (hierboven), dus kleefDoel wijst dit lid vanzelf een ANDERE
         meeloper toe -- en de rest van de leden blijft staan waar hij stond. Dat
         is de hele reden dat er rendezvous-hashing onder zit. */
      const opnieuw = wacht.kleefDoel(req, actief);
      if (opnieuw !== idx) stuurDoor(req, res, body, opnieuw, false);
      else uitleg503(res);
    });
    if (body && body.length) proxy.end(body); else proxy.end();
  }
  function uitleg503(res) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Alle servers zijn tijdelijk onbereikbaar; ze worden automatisch herstart. Probeer het over een paar seconden opnieuw.' }));
  }
  return { stuurDoor, uitleg503 };
}

module.exports = { maakProxy };
