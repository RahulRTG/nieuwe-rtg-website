/* ============================================================================
   HET SCHILD EN DE WACHT AAN DE VOORDEUR.

   Twee lagen die allebei een verzoek kunnen weigeren voordat er ook maar een
   route naar kijkt, en die allebei laat gebonden zijn -- vandaar dat ze samen
   in een eigen bestand staan.

   HET SCHILD (kern/schild.js): applicatie-WAF + DDoS-rem. Altijd aan; localhost
   (health-checks, tests, poortwachter) slaat hij over. Treffers en bans landen
   als melding op het beveiligingsbord (techniek).

   DE WACHT (kern/veilig/wacht.js) doet hier twee dingen:
     1. RAND-STATUS. Komt dit verzoek via de rand (Cloudflare/edge) binnen, dan
        draagt het CF-Ray / CF-Connecting-IP. We noteren dat als live signaal
        zodat de boardroom ziet of de eerste linie staat -- eerlijk, want het is
        wat we echt kunnen waarnemen, geen bevoorrechte inkijk in Cloudflare.
     2. AUTOMATISCHE LASTAFWORP. Trip De Wacht bij een L7-piek zelf een
        zekering, dan serveren we hier 503 "kom zo terug" (met Retry-After)
        zolang die dicht staat. Localhost slaan we over, net als bij het schild.
        De zekering dooft vanzelf; een mens kan hem eerder opheffen.

   WAAROM LAAT GEBONDEN. Het schild raadpleegt De Wacht voor de quarantaine, en
   De Wacht wordt pas gebouwd als de database er is -- ver na dit punt in de
   bedrading. Een zetter is dan eerlijker dan een gedeelde variabele: tijdens het
   opstarten luistert er nog geen poort, dus er glipt niets langs een schild dat
   nog niets weet.
   ========================================================================== */
'use strict';

module.exports = function schildWacht({ app, log, beveiligVan }) {
  let wacht = null;

  const schild = require('../kern/schild').maakSchild({
    meld: (type, ernst, tekst, meta) => { const b = beveiligVan(); if (b) b.meld(type, ernst, tekst, meta); },
    logboek: log,
    quarantaine: (ip) => !!(wacht && wacht.inQuarantaine(ip))
  });
  app.use(schild.middleware);

  app.use((req, res, next) => {
    if (wacht) {
      const ray = req.get('cf-ray'); const cfip = req.get('cf-connecting-ip');
      if (ray || cfip) { try { wacht.randGezien({ ray, provider: ray ? 'cloudflare' : 'edge' }); } catch (e) {} }
      const ip = String(req.ip || '');
      const lokaal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
      if (!lokaal) {
        try {
          if (wacht.lastAfworpActief()) {
            res.set('Retry-After', '30');
            return res.status(503).json({ error: 'De Wacht heeft even de deur op een kier gezet wegens grote drukte. Kom zo terug.' });
          }
        } catch (e) {}
      }
    }
    next();
  });

  return { schild, zetWacht: (w) => { wacht = w; } };
};
