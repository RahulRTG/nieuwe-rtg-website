/* RTFoundation (deelmodule): TOESTEMMING VOOR GEZONDHEIDSGEGEVENS VAN HET GEZIN.

   Besluit van de eigenaar, 5 oktober 2026 (DPIA-GEZIN.md, AVG art. 9): het
   bewaren van gezondheidsgegevens vraagt een APARTE toestemming, en die wordt
   gevraagd op het moment dat iemand er voor het eerst een invult. Niet bij het
   aanmaken van het gezin: een vinkje tussen andere vinkjes is geen
   uitdrukkelijke toestemming, en wie nooit een allergie invult hoeft er ook
   nooit over na te denken.

   Wat eronder valt:
     - de allergie- en medische regel van de oppasinfo (zorg.js);
     - het Gezondheidsmaatje: medicijnen, medische afspraken en de groeicurve
       (gasten/gezondheid.js);
     - het gevoelsdagboek van een kind jonger dan 16 (kern/welzijn.js). Wie 16
       of ouder is geeft daar zelf toestemming voor.

   Een ouder of de beheerder geeft hem voor het gezin. Intrekken kan altijd en
   WIST wat erop rust, want zonder grondslag hoort er niets te blijven staan.
   Dat is zwaar (ook het dagboek van een jong kind gaat weg, dat de ouder nooit
   heeft gezien), dus het vraagt `bevestig: 'WIS'`. Bestaande gegevens van voor
   dit besluit blijven leesbaar; wat NIEUW wordt bewaard vraagt de toestemming. */
'use strict';
const { ouderGeeftToestemming } = require('../lib/leeftijd');

const VOLWASSEN = ['beheerder', 'ouder'];

module.exports = (ctx) => {
  const { router, save, nu, familieVan } = ctx;

  const heeft = g => !!(g && g.toestemmingGezondheid && g.toestemmingGezondheid.at);
  function weigering(p) {
    const magGeven = VOLWASSEN.includes(p.rol);
    return { error: magGeven ? 'Gezondheidsgegevens bewaren vraagt eerst uw aparte toestemming.'
      : 'Vraag je ouder om eerst toestemming te geven voor gezondheidsgegevens.', hoe: 'toestemming', magGeven };
  }
  // true als het mag; anders staat de 409 al op het antwoord
  function eis(s, res) {
    if (heeft(s.g)) return true;
    res.status(409).json(weigering(s.p));
    return false;
  }

  function wis(g) {
    delete g.gezondheid;
    if (g.oppasinfo) g.oppasinfo.allergie = '';
    // het dagboek van wie jonger is dan 16 rust op deze toestemming (kern/welzijn.js)
    for (const p of Object.values(g.profielen || {})) {
      if (p.welzijn && ouderGeeftToestemming(p)) delete p.welzijn;
    }
  }

  router.post('/gezin/toestemming/gezondheid', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!VOLWASSEN.includes(s.p.rol)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder geeft deze toestemming.' });
    if (req.body.aan === true) {
      if (!heeft(s.g)) s.g.toestemmingGezondheid = { door: s.p.id, at: nu(), versie: 1 };
      save();
      return res.json({ ok: true, toestemming: true });
    }
    if (req.body.aan === false) {
      if (req.body.bevestig !== 'WIS')
        return res.status(400).json({ error: 'Intrekken wist alle gezondheidsgegevens van het gezin. Bevestig met WIS.' });
      wis(s.g);
      delete s.g.toestemmingGezondheid;
      save();
      return res.json({ ok: true, toestemming: false, gewist: true });
    }
    res.status(400).json({ error: 'Zeg aan of uit.' });
  });

  return { heeft, eis };
};
