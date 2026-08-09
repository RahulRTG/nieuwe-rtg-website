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
