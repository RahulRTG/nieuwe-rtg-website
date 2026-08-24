/* HET VANGNET: de outbox.

   De derde van de drie standen uit ./mail.js, en de enige die ALTIJD bestaat --
   ook met een smarthost of eigen bezorging ervoor, want een mislukte verzending
   valt hierop terug. Daarom heeft hij drie gebruikers: mail.js zelf, de eigen
   bezorging (./mail-bezorgen.js) en de SMS-kant (./mail-lokaal.js). Dat maakt
   hem geen detail van een van die drie.

   WAAROM DIT EEN EIGEN BESTAND IS. ./mail.js stond op 13302 byte en moest onder
   de 10 kB uit keuringsregel 13. Na het opstellen en de lokale kanalen bleef er
   9655 over: onder de grens, maar in de waarschuwingsband van 9400. Die band
   ontlopen door regels te schrappen is precies wat de kop van uitschieters()
   in scripts/keuring.js "schrijven naar de limiet" noemt, dus is er nog een
   ONDERWERP uit gegaan in plaats van een paar bytes.

   HET PAD WOONT NU BIJ ZIJN ENIGE LEZER. `OUTBOX` stond in mail.js en werd
   alleen hier gebruikt. Er is geen tweede plek meer die uitrekent waar de
   outbox staat.

   WAT ER BINNENKOMT. Alleen de afzender. Die staat ook in mail.js (send en
   bezorgNu noemen hem) en wordt hier daarom niet opnieuw uit process.env
   gelezen: een tweede lezing kan ooit iets anders vinden dan de eerste.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const rtgKlok = require('./lib/klok');

// Een LEZING en geen constante: het pad hoort de datamap van dit moment te
// volgen, niet die van het laadmoment. Zie de kop van server/db/opslag.js.
const outboxMap = () => path.join(process.env.RTG_DATA_DIR || path.join(__dirname, 'data'), 'outbox');

module.exports = ({ FROM }) => {
  /* De outbox is niet alleen de ontwikkelstand: hij vangt ook mail op als een
     ECHTE verzending mislukt (zie send() hieronder). Dan liggen er dus op de
     productiemachine bestanden met het e-mailadres van een lid en een werkende
     bevestigings- of herstel-link erin. Daarom gaat de outbox door dezelfde kluis
     als de rest: staat RTG_ENC_KEY, dan versleuteld (.eml.enc), anders leesbaar
     (.txt) zodat lokaal ontwikkelen niet omslachtig wordt. Terugkijken kan met
     `npm run outbox`. */
  function toOutbox(to, subject, text) {
    fs.mkdirSync(outboxMap(), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(outboxMap(), 0o700); } catch (e) {}
    /* De naam draagt de tijd EN een willekeurig staartje. Zonder dat staartje
       schrijven twee berichten in dezelfde milliseconde over elkaar heen -- en dat
       is geen zeldzaam geval: een herstelaanvraag stuurt de LINK en de CODE vlak
       na elkaar, precies de twee dingen die je allebei nodig hebt. Een van de twee
       verdween dan, terwijl het logboek beide als bewaard meldde. Zelfde soort
       fout als de rest: een storing die je niet kunt zien. */
    const stamp = rtgKlok.datum().toISOString().replace(/[:.]/g, '-');
    const staart = require('crypto').randomBytes(4).toString('hex');
    const bericht = `From: ${FROM}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`;
    const kluis = require('./kluis');
    const naam = stamp + '-' + staart + (kluis.AAN ? '.eml.enc' : '.txt');
    fs.writeFileSync(path.join(outboxMap(), naam), kluis.versleutel(bericht), { mode: 0o600 });
    // het adres zelf hoort niet in het logboek als de inhoud wel beschermd is
    console.log(`[mail] (outbox) ${kluis.AAN ? 'versleuteld opgeslagen' : 'naar ' + to}: ${subject}`);
  }

  /* OUTBOX blijft als levende eigenschap bestaan voor wie hem leest. */
  const uit = { toOutbox, outboxMap };
  Object.defineProperty(uit, 'OUTBOX', { enumerable: true, get: outboxMap });
  return uit;
};
