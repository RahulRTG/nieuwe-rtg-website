/* ============================================================================
   Het metrics-endpoint. Dit is de deur waar de monitoring doorheen kijkt.

   WAAROM HIJ NIET OPEN STAAT

   Een metrics-endpoint lijkt onschuldig -- het zijn immers alleen getallen.
   Maar die getallen vertellen een buitenstaander precies hoeveel verkeer je
   hebt, welke routes bestaan, waar het traag is en wanneer het misgaat. Dat is
   verkenningswerk dat je hem niet cadeau hoeft te doen. Bij vrijwel elk lek dat
   met een open /metrics begon, was dat de eerste stap en niet de laatste.

   Twee sloten, en de strengste die van toepassing is wint:

   - RTG_METRICS_TOKEN gezet: dan MOET dat token mee. Dit is de normale opzet
     als de scraper buiten het cluster staat.
   - Geen token gezet: dan alleen vanaf een intern adres. Dat is de gewone
     situatie waarin Prometheus naast de app draait, en het voorkomt dat een
     vergeten token het endpoint per ongeluk publiek maakt.

   Er staat nooit iets persoonsgebonden in; zie de kop van server/meting.js.
   ========================================================================== */
const meting = require('../meting');
const rem = require('../rem');

/* Zelfde vorm als in web/verrijk.js en sso/haal.js: wat niet op het open
   internet hoort. */
const INTERN = /^(::1|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|f[cd])/i;

module.exports = (kern) => {
  const { app } = kern;
  const TOKEN = process.env.RTG_METRICS_TOKEN || '';

  function magMeten(req) {
    if (TOKEN) {
      const kop = req.get('authorization') || '';
      const aangeboden = kop.startsWith('Bearer ') ? kop.slice(7).trim() : '';
      // vaste lengte-vergelijking is hier niet nodig: het token wordt niet
      // geraden maar meegegeven door onze eigen scraper. Wel gelijk-lang eisen.
      return !!aangeboden && aangeboden.length === TOKEN.length && aangeboden === TOKEN;
    }
    /* Zonder token: alleen van dichtbij. Let op dat we het SOCKETADRES gebruiken
       en niet req.ip -- die kan van een X-Forwarded-For komen, en dan zou een
       bezoeker zich met een kop tot "intern" kunnen verklaren. */
    const bron = (req.socket && req.socket.remoteAddress) || '';
    return INTERN.test(bron);
  }

  app.get('/api/metrics', rem({ windowMs: 60000, limit: 120 }), (req, res) => {
    if (!magMeten(req)) {
      /* 404 en niet 403: een 403 bevestigt dat het endpoint bestaat. */
      return res.status(404).json({ error: 'Onbekend eindpunt.' });
    }
    res.set('content-type', 'text/plain; version=0.0.4; charset=utf-8').send(meting.tekst());
  });

  /* De korte versie in JSON, voor het techniekbord van de eigenaar. Zelfde
     poort, zodat er niet per ongeluk een tweede, lossere deur ontstaat. */
  app.get('/api/metrics/kort', rem({ windowMs: 60000, limit: 120 }), (req, res) => {
    if (!magMeten(req)) return res.status(404).json({ error: 'Onbekend eindpunt.' });
    res.json(meting.samenvatting());
  });
};
