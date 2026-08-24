/* Het CA-loket naast de beveiligde voordeur.

   Uw telefoon vertrouwt onze certificaten nog niet, dus het CA-bestand moet
   langs een GEWONE verbinding binnenkomen -- over https zou hij het weigeren
   voordat u het kunt vertrouwen. Alle andere adressen op dit loket sturen we
   door naar de beveiligde site; verder staat er niets op.

   Dit stond in server/trio.js zelf. Het staat hier omdat de voordeur er de
   voordeurprocessen bij kreeg (./trio-werkers.js) en daarmee over de
   keuringsgrens van 10 kB ging. Dit is de nettere naad: het loket is een
   afgerond onderwerp dat niets met doorsturen of failover te maken heeft. */
'use strict';
const http = require('http');

function maakCaLoket({ tlsCert, PORT }) {
  const loket = http.createServer((req, res) => {
    if (require('./lokaal-tls').loketAntwoord(req, res, tlsCert, PORT)) return;
    const gastheer = String(req.headers.host || '').split(':')[0] || 'localhost';
    // de voorpagina vertelt een mens of hij binnen is en wat er nog moet gebeuren
    if ((req.url || '/').split('?')[0] === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(require('./lokaal-tls').loketPagina(PORT, gastheer));
    }
    res.writeHead(302, { Location: 'https://' + gastheer + ':' + PORT + (req.url || '/') });
    res.end();
  });
  loket.on('error', e => console.error('[poortwachter] CA-loket: ' + e.message));
  return loket;
}

module.exports = { maakCaLoket };
