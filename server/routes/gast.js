/* Domein "gast": RTG Hospitality Guest OS -- de gastkant van de horecatoren.

   WAT DIT WEL EN NIET IS. De Horeca OS (routes/supplier/horeca/) is compleet
   voor de ZAAK: veertien modules, dertien verkoopkanalen, een rekening die
   blijft leven. Wat er niet was, is een deur voor de gast: elke poort zat achter
   supplierAuth, dus de rekenlaag kende wel een kanaal `qr` maar niemand kon er
   vanaf een telefoon bij. Deze laag is die deur -- en uitdrukkelijk NIET een
   tweede horecasysteem. De rekening waar een gast op bestelt is dezelfde rij in
   dezelfde opslag die de bediening op haar scherm ziet.

   DE POORT IS DE TAFELSLEUTEL EN NIET EEN INLOG. Een gast aan tafel 12 is vaak
   geen lid, en van een lid willen we hier niet meer weten dan nodig. Wie de QR
   scant en aanschuift krijgt een sleutel die bij DEZE open rekening hoort; gaat
   de rekening dicht, dan is de sleutel niets meer waard. Er staat dus geen
   account achter een tafelsessie, en op de rekening staat een handle -- nooit
   een echte naam, nooit een ledensleutel (CLAUDE.md, privacy by design).

   DE HORECA-KERN WORDT HIER OPNIEUW OPGEBOUWD en dat is geen tweede waarheid:
   kern/horeca.js is een fabriek zonder eigen geheugen die alles uit db.data
   haalt. De opslag is een plek. Het alternatief -- de instantie van het
   leveranciersdomein lenen -- zou betekenen dat de gastkant omvalt zodra een
   proces met RTG_DOMAINS zonder supplier draait. */
'use strict';

module.exports = (kern) => {
  const { db, save, crypto, schoon } = kern;

  const horeca = require('../kern/horeca')(kern);
  const regelbouw = require('../kern/horeca/regel')({ schoon, horeca });
  const beleid = require('../kern/gast/beleid')({ horeca });
  const sessie = require('../kern/gast/sessie')({ db, save, crypto, schoon, horeca });
  const orderlaag = require('../kern/gast/order')({ save, schoon, horeca, regelbouw, beleid });
  const verdeling = require('../kern/gast/verdeling')({ save, horeca, orderlaag });
  const betaallaag = require('../kern/gast/betalen')({ save, schoon, horeca, beleid, orderlaag, verdeling });
  const afrekenlaag = Object.assign({}, verdeling, betaallaag);

  /* De poort. Hij doet drie dingen tegelijk en dat is met opzet: een handler
     die zelf de sleutel moet opzoeken, is een handler die het een keer vergeet.
     Wat hier langskomt heeft altijd een zaak, een open rekening en een
     deelnemer -- of het komt er niet langs. */
  function gastAuth(req, res, next) {
    const gevonden = sessie.herken((req.body || {}).sleutel);
    if (!gevonden) return res.status(401).json({
      error: 'Deze tafelsessie is niet meer geldig. Scan de QR op tafel opnieuw.', code: 'sessie-weg' });
    req.gast = gevonden;
    next();
  }

  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error, code: r.code || null, item: r.item, rails: r.rails })
    : res.json(r);

  /* De gastkant heeft de folio-laag nodig om op de kamer te kunnen boeken, en
     die wordt LATER gemount (leveranciersdomein). Daarom een doorgeefluik dat
     de kern pas op het moment van aanroepen bevraagt -- net als betalen.js
     doet. Hem hier vastpakken zou een undefined opleveren die pas maanden later
     opvalt, bij de eerste gast die op zijn kamer wil boeken. */
  const folioBoek = (...a) => (kern.horecaFolioBoek
    ? kern.horecaFolioBoek(...a)
    : { status: 409, error: 'De hotellaag staat bij deze zaak niet aan.' });

  const ctx = Object.assign({}, kern, { horeca, beleid, sessie, orderlaag, afrekenlaag, gastAuth, stuur, folioBoek });
  require('./gast/tafel')(ctx);     // de QR, aanschuiven, de kaart en het beleid
  require('./gast/bestellen')(ctx); // bestellen, de rekening lezen, waarom-vragen
  require('./gast/afrekenen')(ctx); // verdelen, fooi, betalen
};
