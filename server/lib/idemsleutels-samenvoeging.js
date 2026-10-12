/* VIER ROUTES UIT DE SAMENVOEGING VAN #542, elk met zijn idem-verklaring.

   Geen van de takken verklaarde ze zelf; elke tak tilde alleen zijn eigen
   idemschuld op, en in de samenvoeging kwamen die op een stand uit. Hier staat
   per route wat een herhaling doet. */
'use strict';

const SLEUTELS = {
  /* Het eigen ledger om mee te nemen (#581): een projectie, de sleutel komt uit de sessie. */
  'POST /api/carriere/ledger/afschrift': { leest: true },
  /* Opnieuw beginnen (#580): een overzicht over export, wissen en herstel dat zelf niets bewaart. */
  'POST /api/privacy/opnieuw': { leest: true },
  /* De risicogoedkeuring van een incassoronde (#564, eigenaarsbesluit 2C). */
  'POST /api/office/bank/incasso/risico/opties': { nietIdempotent: true,
    waarom: 'de ceremonie voor de risicogoedkeuring, gebonden aan dat voornemen; een herhaalde challenge is een herbruikbare challenge' },
  'POST /api/office/bank/incasso/risico': { nietIdempotent: true,
    waarom: 'een tweede goedkeuring op hetzelfde voornemen weigert met 409: een toestandscontrole in de route, en een bewaard antwoord zou de verse passkey van die goedkeuring omzeilen' }
};

module.exports = { SLEUTELS };
