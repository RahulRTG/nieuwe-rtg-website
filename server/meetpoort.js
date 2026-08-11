/* DE POORT VOOR MEETGEGEVENS -- één deur, meerdere endpoints.

   Dit stond tot vandaag als functie `magMeten` binnen routes/meting.js, met er
   in het commentaar bij: "Zelfde poort, zodat er niet per ongeluk een tweede,
   lossere deur ontstaat." Die zin bleef gelden en de plek niet: de sonde meldt
   zich van een andere machine (routes/command/meten.js), en dat is precies zo'n
   tweede deur. Dus staat de poort nu hier en niet twee keer.

   TWEE SLOTEN, EN DE STRENGSTE DIE VAN TOEPASSING IS WINT:

   - RTG_METRICS_TOKEN gezet: dan MOET dat token mee. De normale opzet als de
     scraper of de sonde buiten het cluster staat.
   - Geen token gezet: dan alleen vanaf een intern adres. Dat is de gewone
     situatie waarin de monitoring naast de app draait, en het voorkomt dat een
     vergeten token het endpoint per ongeluk publiek maakt.

   ACHTER EEN POORTWACHTER DEUGT NABIJHEID NIET MEER. Draait deze server als
   kind van server/trio.js of achter welke reverse proxy dan ook, dan komt ELK
   verzoek via de loopback binnen en klopt "intern" voor de hele wereld. In die
   stand is een token de enige geldige sleutel en gaat de deur zonder token
   dicht -- liever geen meting dan een publieke. */
'use strict';

const { veiligGelijk } = require('./kern/util');

/* Zelfde vorm als in web/verrijk.js en sso/haal.js: wat niet op het open
   internet hoort. */
const INTERN = /^(::1|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|f[cd])/i;

/* Staat er een poortwachter voor ons? Dezelfde voorwaarde waarop de server zich
   tot de loopback beperkt. */
const achterPoort = () => !!(process.env.RTG_CLUSTER_KEY || process.env.RTG_DOMAINS);

function magMeten(req) {
  const token = process.env.RTG_METRICS_TOKEN || '';
  if (token) {
    const kop = (req.get ? req.get('authorization') : '') || '';
    const aangeboden = kop.startsWith('Bearer ') ? kop.slice(7).trim() : '';
    /* veiligGelijk en niet ===: wie dit endpoint vindt kan het token wel
       degelijk proberen te raden, en === stopt bij het eerste verschillende
       teken. */
    return !!aangeboden && veiligGelijk(aangeboden, token);
  }
  if (achterPoort()) return false;
  /* Het SOCKETADRES en niet req.ip: die kan van een X-Forwarded-For komen, en
     dan zou een bezoeker zich met een kop tot "intern" kunnen verklaren. */
  const bron = (req.socket && req.socket.remoteAddress) || '';
  return INTERN.test(bron);
}

/* Als middleware. 404 en niet 403: een 403 bevestigt dat het endpoint bestaat. */
function meetpoort(req, res, next) {
  if (!magMeten(req)) return res.status(404).json({ error: 'Onbekend eindpunt.' });
  next();
}

module.exports = { magMeten, meetpoort, INTERN };
