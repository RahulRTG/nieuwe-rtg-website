/* Levensgraaf, deelbestand "bronnen-zaak": wat een RTG-kantoor al van zichzelf
   weet.

   Dezelfde motor, andere eigenaar. Een partner heeft precies hetzelfde probleem
   als een lid -- er komen dingen op hem af met een datum, en die staan verspreid
   over zijn schermen -- en precies dezelfde oplossing werkt: alles met een datum
   op een rij, in vier vensters, met achterstallig apart.

   TWEE BRONNEN, EN ALLEBEI ZONDER EEN TOETSAANSLAG EXTRA:

     boekingen   wat er bij deze zaak is geboekt en nog moet komen. Staat al in
                 db.data.boekingen; hier alleen op supplierCode in plaats van op
                 customerKey.
     agenda      de eigen agenda van de zaak. Die bestaat al en ligt onder
                 'sup:<code>' -- dezelfde opslag als de leden-agenda, andere
                 sleutel (kern/agenda.js).

   WAT ER NOG NIET IN ZIT, en dat is geen vergetelheid: contracten hebben in dit
   huis geen einddatumveld (routes/supplier/contract.js bewaart `velden` als
   vrije tekst), en HACCP kent wel metingen maar geen volgende-controle-datum.
   Ik heb daar geen datum uit gedestilleerd: een keuringstermijn die uit vrije
   tekst is geraden, staat op een dag op de verkeerde datum en dan is hij erger
   dan afwezig. Krijgen die twee ooit een echt datumveld, dan horen ze hier.

   Gemount via ./index.js, als eigen bronnenlijst naast die van het lid. */
'use strict';

const H = require('./hulp');
const { PERSOONLIJK, isDatum, vandaag, lijst } = H;
const { agendaZaakSleutel } = require('../agenda');

// een boeking die geen aandacht meer vraagt; zelfde lijst als aan de ledenkant
const DOOD = new Set(['afgewezen', 'geannuleerd', 'afgerond', 'afgerekend', 'vervallen']);
const DAK = 200;
const afgekapt = (bron, dak) => ({ __afgekapt: { bron, dak } });
const dagVan = w => { const d = String(w || '').slice(0, 10); return isDatum(d) ? d : ''; };

const ZAAK = [
  /* ---- Wat er bij deze zaak is geboekt en nog moet komen ---- */
  { kamer: 'boekingen', knopen(l, K, ctx) {
    const db = ctx && ctx.db, code = ctx && ctx.key;
    if (!db || !code) return [];
    const t = vandaag();
    const uit = [];
    for (const b of lijst(db.data && db.data.boekingen)) {
      if (String(b.supplierCode || '').toUpperCase() !== String(code).toUpperCase()) continue;
      if (DOOD.has(b.status)) continue;
      const dag = dagVan(b.wanneer);
      if (!dag || dag < t) continue;
      const dienst = (b.service && b.service.name) || 'boeking';
      uit.push(K({ id: 'zboeking:' + (b.ref || b.id), soort: 'boeking',
        /* De KLANT staat er met zijn codenaam bij en niet met een naam: dat is
           het privacy-ontwerp van dit huis, en een zaak heeft aan de codenaam
           genoeg om te weten wie er komt. */
        naam: dienst + (b.customerCodename ? ' · ' + b.customerCodename : ''),
        kamer: 'boekingen', bron: 'Boekingen', gevoelig: PERSOONLIJK, deel: 'kantoor',
        vervalt: dag, vervaltWat: 'boeking' }));
      if (uit.length >= DAK) { uit.push(afgekapt('Boekingen', DAK)); break; }
    }
    return uit;
  } },

  /* ---- De eigen agenda van de zaak ---- */
  { kamer: 'agenda', knopen(l, K, ctx) {
    const db = ctx && ctx.db, code = ctx && ctx.key;
    if (!db || !code) return [];
    const mijn = lijst(db.data && db.data.agendas && db.data.agendas[agendaZaakSleutel(code)]);
    const t = vandaag();
    const uit = [];
    for (const i of mijn) {
      if (i.gedaan) continue;
      if (!isDatum(i.datum) || i.datum < t) continue;
      uit.push(K({ id: 'zagenda:' + i.id, soort: 'afspraak', naam: i.titel,
        kamer: 'agenda', bron: 'Agenda', gevoelig: PERSOONLIJK, deel: 'kantoor',
        vervalt: i.datum, vervaltWat: 'afspraak' }));
      if (uit.length >= DAK) { uit.push(afgekapt('Agenda', DAK)); break; }
    }
    return uit;
  } }
];

module.exports = ZAAK;
