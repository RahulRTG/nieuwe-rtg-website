/* ============================================================================
   DE LIJFPOORT: WAT ER MET DE BODY VAN EEN VERZOEK GEBEURT.

   Het staartstuk van ./verzoekketen.js, en een eigen onderwerp: alles hier gaat
   over de INHOUD van een verzoek in plaats van over de herkomst ervan.

   De volgorde is de inhoud, en hij kan niet anders:

     1. de betaal-webhooks -- VOOR express.json(), want een handtekening wordt
        over de RAUWE body berekend. Staan ze erna, dan is de body al ontleed en
        klopt geen enkele handtekening meer.
     2. express.json() met een grens van 8 MB
     3. de dieptewacht -- tegen invoer die de stack laat overlopen
     4. het zaakdoos-journaal, alleen in lokale modus
   ========================================================================== */
'use strict';

const MAX_DIEPTE = 40;
/* Grenswacht tegen pathologisch diep geneste invoer. Een echte API-body is een
   handvol niveaus diep; een 20.000-diep geneste array is geen gebruiker maar
   een aanval: elke String()/Number()-coercie erop laat de stack overlopen
   (Array.toString -> join -> recursie). We keuren de diepte ITERATIEF (met een
   eigen stack, dus zelf niet te laten overlopen). */
function teDiep(wortel) {
  const stapel = [[wortel, 1]];
  while (stapel.length) {
    const [v, d] = stapel.pop();
    if (!v || typeof v !== 'object') continue;
    if (d > MAX_DIEPTE) return true;
    for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) stapel.push([v[k], d + 1]);
  }
  return false;
}

module.exports = function lijfpoort(deps) {
  const { app, express, db, save, log, betaal, muntbetaal, opslagKlaar,
    zaakdoos, muntenVan, settleFactuurVan, opdrachtenVan } = deps;

  /* De twee betaal-webhooks staan in ./webhooks.js. Ze horen HIER en niet in de
     gewone routebedrading: een handtekening wordt over de RAUWE body berekend,
     dus ze moeten voor express.json() gemount zijn. Welke poortwachters ze wel
     en niet krijgen -- en waarom de hoofdzekering er bewust niet bij zit --
     staat in de kop van dat bestand. */
  require('./webhooks')({
    app, express, db, save, log, betaal, muntbetaal,
    opslagKlaar: () => opslagKlaar(),
    // pas verderop in server.js gebouwd; zie de uitleg in webhooks.js
    muntenVan, settleFactuurVan, opdrachtenVan
  });

  app.use(express.json({ limit: '8mb' }));
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object' && teDiep(req.body))
      return res.status(400).json({ error: 'Ongeldige invoer: te diep genest.' });
    next();
  });

  /* DE IDEM-SLEUTEL WORDT HIER CANONIEK, EN NERGENS ANDERS.

     Wet RTG-038 op de geldketen. Vijftien routes lezen req.body.idem en bouwen
     daar een sleutel mee ('oplaad:' + codenaam + ':' + idem). Die samengestelde
     sleutel beslist of een verzoek een HERHALING is, en hij vergelijkt bytes.

     Waarom het hier moet en niet bij de vergelijking zelf: de client-sleutel
     staat MIDDEN in de samengestelde sleutel. Canoniseren in server/lib/idem.js
     trimt dan de buitenkant van 'oplaad:kiek: probe-1 ' en laat de spatie
     binnenin staan -- ik heb die reparatie gebouwd, gemeten, en zien falen. De
     canonisatie hoort dus VOOR het samenstellen, en dan is er precies een plek:
     hier, waar de body binnenkomt.

     Wat er gebeurde zonder dit: twee keer /api/pay/oplaad met idem 'probe-1' en
     ' probe-1 ' gaf saldo 10000 in plaats van 5000. De BETALING zag een
     herhaling (server/sleutelvorm.js canoniseerde die sleutel al wel) en het
     GROOTBOEK zag een nieuw verzoek. Vijftig euro werd honderd.

     Dit raakt ook de Rust-motor mee: die krijgt zijn sleutel van deze kant, dus
     beide engines zien nu dezelfde bytes zonder dat er een tweede canonisatie
     in Rust bij hoeft. */
  app.use((req, res, next) => {
    const b = req.body;
    if (b && typeof b === 'object' && b.idem !== undefined && b.idem !== null && b.idem !== '') {
      const canon = require('../sleutelvorm').canoniekeSleutel(b.idem);
      if (!canon) return res.status(400).json({ error: 'Ongeldige idem-sleutel (leeg, te lang of met stuurtekens).' });
      b.idem = canon;
    }
    next();
  });

  /* Zaakdoos, lokale modus: elke geslaagde zaak-schrijfactie komt in het
     journaal, zodat hij na herstel van de lijn wordt nagespeeld naar de cloud.
     Inloggen en de livestream horen bij de doos zelf en spelen we niet na. */
  if (zaakdoos.actief) {
    app.use((req, res, next) => {
      if (zaakdoos.modusVan() !== 'lokaal' || req.method !== 'POST') return next();
      if (!req.path.startsWith('/api/supplier/') || req.path === '/api/supplier/login' || req.path.startsWith('/api/supplier/stream')) return next();
      const echteJson = res.json.bind(res);
      res.json = (d) => { if (res.statusCode < 300) zaakdoos.schrijfJournaal(req.path, req.body, d); return echteJson(d); };
      next();
    });
  }

};
module.exports.teDiep = teDiep;
module.exports.MAX_DIEPTE = MAX_DIEPTE;
