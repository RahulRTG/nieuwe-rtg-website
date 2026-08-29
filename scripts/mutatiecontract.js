#!/usr/bin/env node
/* ============================================================================
   HET MUTATIECONTRACTREGISTER -- afgeleid, nooit met de hand geschreven.

   WAT DIT IS. Per schrijfroute een regel met vijf assen: wat de mutatie is, wat
   "hetzelfde verzoek" betekent, wat er is gemeten, wie er binnen mag, en hoe
   hard onze kennis is. De vocabulaires staan in server/kern/mutatiecontract.js;
   dit script vult ze in uit de bronnen en telt het resultaat.

   WAAROM AFGELEID EN NIET EEN JSON DIE IEMAND BIJHOUDT. De kop van
   kern/mutatie.js zegt het al: "een register naast de code loopt achter op de
   dag dat iemand een route verplaatst". Daarom komt hier alles uit een bron:

     de routes        uit de draaiende router      (scripts/lib/routes.js)
     de deur          uit dezelfde router          (scripts/lib/bewakers.js)
     de duplicaatregel uit de verklaringen         (server/lib/idemsleutels.js)
     het bewijs       uit de laatste meting        (IDEMPROEF.json)
     de BEDOELING     uit de verklaringen bij de route (server/lib/mutatiecontracten.js)

   Alleen die laatste is mensenwerk, en dat hoort: de bedoeling van een route is
   geen waarneming.

   DE REGEL DIE DIT REGISTER EERLIJK HOUDT. Een stand wordt NOOIT afgeleid uit
   bewijs alleen. Het bewijs kan hooguit een VOORSTEL dragen; de stand komt uit
   een verklaring van een mens. Zou dit script zelf mogen indelen, dan stond er
   binnen een uur 100% geclassificeerd en wist niemand meer wat dat betekende --
   en dan is het register precies de schijnzekerheid die het moest voorkomen.

   Draaien:  node scripts/mutatiecontract.js [--vastleggen] [--open]
             --open toont de eerste vijftig regels die nog een besluit vragen
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { alleRoutes, isSchakel, bewakerskaart } = require('./lib/routes');
const contract = require('../server/kern/mutatiecontract');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'MUTATIECONTRACT.json');
const vastleggen = process.argv.includes('--vastleggen');
const toonOpen = process.argv.includes('--open');

const sleutelVan = (methode, pad) => String(methode || 'POST').toUpperCase() + ' ' + pad;

/* ---------------------------------------------------------------------------
   DE BRONNEN
   ------------------------------------------------------------------------- */
const routes = alleRoutes()
  .filter(r => r.pad.startsWith('/api/') && String(r.methode).toUpperCase() !== 'GET')
  .filter(r => !isSchakel(r.pad));

let verklaringen = {};
try { verklaringen = require('../server/lib/idemsleutels').SLEUTELS; } catch (e) {}

let bedoelingen = {};
try { bedoelingen = require('../server/lib/mutatiecontracten').CONTRACTEN; } catch (e) {}

let proef = { perRoute: [] };
try { proef = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); } catch (e) {}
const meting = new Map((proef.perRoute || []).map(r => [sleutelVan(r.methode, r.pad), r]));
const gemetenOp = (proef.stempel && proef.stempel.op) || null;

/* ---------------------------------------------------------------------------
   DE WAARNEMING AAN DE DEUR -> een TOEGANG-klasse.

   Dit is met opzet een WAARNEMING en geen bedoeling. Hij zegt wat er in de
   router staat, en niets over wat iemand wilde. Waar de waarneming en de
   verklaarde bedoeling uiteenlopen, is dat een bevinding -- en dat is de enige
   manier waarop een verkeerd bedoelde deur ooit opvalt.

   `geenBewaker` en een lege bewakerslijst leveren met opzet NIETS op. Zo'n route
   kan met opzet open staan (PUBLIC) of in zijn handler bewaakt zijn
   (CAPABILITY_GATED), en die twee door elkaar halen is precies het gat dat de
   612 routes zonder laag vandaag vormen. Raden zou het gat onzichtbaar maken.
   ------------------------------------------------------------------------- */
const SOORT_NAAR_TOEGANG = {
  rol: 'AUTHENTICATED',
  eigenrol: 'AUTHENTICATED',
  objectpoort: 'OBJECT_SCOPED',
  lichaamssleutel: 'OBJECT_SCOPED',
  omgeving: 'SYSTEM_INTERNAL'
};

function waargenomenToegang(r) {
  const namen = Array.isArray(r.bewakers) ? r.bewakers : [];
  if (!r.bewakersBekend || !namen.length) return null;
  /* scimAuth is een eigenrol in de bewakerskaart, maar het is geen mens: een
     eigen geheim per organisatie. Die uitzondering staat hier bij naam, want een
     kaart die hem als 'gewone rol' doorgeeft laat een koppeling eruitzien als
     een gebruiker. */
  if (namen.includes('scimAuth')) return 'SERVICE_TO_SERVICE';
  const RANG = { rol: 6, eigenrol: 5, lichaamssleutel: 4, objectpoort: 3, omgeving: 2, geenBewaker: 1, verfijner: 0, onbekend: 0 };
  const soorten = namen.map(n => bewakerskaart.soortVan(n));
  const zwaarste = soorten.slice().sort((a, b) => (RANG[b] || 0) - (RANG[a] || 0))[0];
  return SOORT_NAAR_TOEGANG[zwaarste] || null;
}

/* ---------------------------------------------------------------------------
   DE NAAM VAN DE MUTATIE.

   `POST /api/office/verificaties/goedkeuren` -> `office.verificaties.goedkeuren`.
   Een naam die los van het pad bestaat, zodat een route kan verhuizen zonder dat
   het contract een ander ding wordt. Dat is het verschil tussen een register van
   HANDELINGEN en een register van URL's.
   ------------------------------------------------------------------------- */
function mutatieIdVan(pad) {
  return pad.replace(/^\/api\//, '').replace(/\/:?/g, '.').replace(/[^A-Za-z0-9.\-_]/g, '');
}

/* ---------------------------------------------------------------------------
   HET VOORSTEL UIT HET BEWIJS.

   Geen stand -- een VOORSTEL, met de grond erbij. Wat hier uitkomt is wat een
   mens zou moeten bevestigen, en het bewijs waarop hij dat doet.

   Het leunt op de RONDE ZONDER SLEUTEL, want dat is de dubbeltik. De ronde MET
   sleutel meet server/middleware/idempotentie.js, en die staat voor elke
   /api-POST: daar "beschermd" uit lezen is de platformlaag verwarren met de
   route (nagemeten op 29 augustus 2026; zie scripts/idemvoorstel.js).
   ------------------------------------------------------------------------- */
function voorstelUitBewijs(m) {
  if (!m) return { voorstel: null, grond: 'niet gemeten' };
  const z = m.zonderSleutel;
  if (!z) return { voorstel: null, grond: 'geen kale ronde in deze meting' };
  if (z.stand === 'beschermd') {
    /* DRIE GRONDEN, EN MAAR TWEE ERVAN ZIJN IDEMPOTENTIE.

       `opslag`  de eerste kale oproep deed werk, de herhaling niet. Dat IS het.
       `gemerkt` de server zei zelf `herhaald: true` zonder dat er een sleutel
                 meeging -- dat kan alleen de idem-poort zijn, op grond van een
                 verklaring.
       `geweigerd` de herhaling kreeg een 409 of een 403. Dat is een
                 TOESTANDSCONTROLE en geen herkende herhaling, en het verschil is
                 duur: een `zelfdeVerzoek` legt daar het eerste antwoord over een
                 bewuste weigering heen. Precies de fout die de kop van
                 server/middleware/idempotentie.js beschrijft, waar zestien
                 toetsen op zakten. */
    if (z.grond === 'geweigerd') {
      return { voorstel: null, grond: 'kale ronde: de herhaling werd GEWEIGERD (' + (z.statussen || []).join('/') +
        ') -- dat is een toestandscontrole en geen idempotentie; welke van de twee dit is, leest geen meter af' };
    }
    if (z.grond === 'opslag') {
      /* EEN VERSCHIL IN DE OPSLAG IS NIET ALTIJD WERK. Gemeten geval:
         POST /api/metier/zoek is een pure zoekroute, en toch bewoog er bij de
         eerste kale oproep iets ("wacht") en bij de tweede niet. Dat was geen
         gededupliceerde handeling maar een REM die zijn emmer bijwerkte. Een
         voorstel PROTECTED zou daar de verkeerde semantiek vastleggen: die route
         is NOT_APPLICABLE, hij verandert niets.

         De ruisijking van de idemproef vangt alleen wat bij ELKE oproep beweegt;
         een rem die alleen de eerste keer aanslaat glipt er per definitie langs.
         Daarom draagt dit voorstel de collecties met zich mee, zodat de mens die
         bevestigt ziet WAARIN het verschil zat. */
      const waar = Object.keys((z.opslag && z.opslag.d) || {}).join(', ');
      return { voorstel: 'PROTECTED', grond: 'kale ronde (opslag): het verschil zat in ' + (waar || 'onbekend') +
        '. NA TE KIJKEN: is dat werk van deze route, of een rem/meter die alleen de eerste keer aansloeg? ' +
        'In dat laatste geval is de juiste stand NOT_APPLICABLE en niet PROTECTED.' };
    }
    return { voorstel: 'PROTECTED', grond: 'kale ronde (' + (z.grond || 'grond niet vastgelegd') + '): ' + z.reden };
  }
  if (z.stand === 'onbeschermd') {
    /* Met opzet GEEN voorstel. Dit is precies het punt waar twee keer {} naar
       een dobbelworp twee worpen zijn en twee keer {} naar "maak een concern"
       een dubbeltik: het verschil zit in wat de handeling betekent, en dat leest
       geen meter af. */
    return { voorstel: null, grond: 'kale ronde: de herhaling deed het werk OPNIEUW -- ' +
      'of dat een dubbeltik is of een tweede handeling, beantwoordt geen meting' };
  }
  const st = z.statussen || [];
  const kaalOk = st.length === 2 && st.every(x => x >= 200 && x < 300);
  const leeg = (d) => !d || !Object.keys(d).length;
  if (kaalOk && z.opslag && leeg(z.opslag.d) && leeg(z.opslag.e)) {
    return { voorstel: 'NOT_APPLICABLE', grond: 'kale ronde: twee geslaagde oproepen zonder spoor in de opslag ' +
      '(na te kijken: schrijft de handler buiten de gemeten collecties?)' };
  }
  if (m.hindernis) {
    return { voorstel: 'BLOCKED_BY_TEST_FIXTURE', grond: 'de proef kwam er niet bij: "' + m.hindernis + '"' };
  }
  return { voorstel: null, grond: z.reden || 'geen uitspraak' };
}

/* ---------------------------------------------------------------------------
   DE RONDE
   ------------------------------------------------------------------------- */
const rijen = [];
const tegenspraken = [];

for (const r of routes) {
  const sleutel = sleutelVan(r.methode, r.pad);
  const bedoeld = bedoelingen[sleutel] || null;
  const m = meting.get(sleutel) || null;
  const dup = verklaringen[sleutel] || null;
  const waargenomen = waargenomenToegang(r);
  const { voorstel, grond } = voorstelUitBewijs(m);

  const rij = {
    mutatieId: (bedoeld && bedoeld.mutatieId) || mutatieIdVan(r.pad),
    route: sleutel,
    /* AS 1 + 2 -- uit hun eigen huizen, hier alleen samengebracht. */
    semantiek: bedoeld ? bedoeld.semantiek : null,
    duplicaatregel: dup ? Object.keys(dup)[0] : null,
    /* AS 4 -- waarneming en bedoeling apart, zodat een verschil opvalt. */
    toegang: {
      waargenomen,
      bedoeld: (bedoeld && bedoeld.toegang && bedoeld.toegang.klasse) || null,
      bewakers: Array.isArray(r.bewakers) ? r.bewakers : []
    },
    /* AS 3 */
    bewijs: m ? {
      op: gemetenOp,
      metSleutel: m.idempotentie,
      zonderSleutel: m.zonderSleutel ? m.zonderSleutel.stand : null,
      grond: m.zonderSleutel ? m.zonderSleutel.grond || null : null,
      hindernis: m.hindernis || null
    } : null,
    /* AS 5 -- alleen uit een verklaring. Nooit uit bewijs. */
    stand: (bedoeld && bedoeld.stand) || 'LEGACY_PENDING_CLASSIFICATION',
    voorstel: bedoeld ? null : voorstel,
    voorstelGrond: bedoeld ? null : grond
  };

  if (bedoeld && waargenomen && bedoeld.toegang && bedoeld.toegang.klasse &&
      bedoeld.toegang.klasse !== waargenomen) {
    tegenspraken.push({ route: sleutel, bedoeld: bedoeld.toegang.klasse, waargenomen,
      wat: 'de verklaarde toegang en de deur in de router zeggen niet hetzelfde' });
  }
  rijen.push(rij);
}

const t = contract.telling(rijen);

/* ---------------------------------------------------------------------------
   HET BORD
   ------------------------------------------------------------------------- */
const rij = (n, wat) => String(n).padStart(6) + '  ' + wat;
const pct = (n) => (t.totaal ? (100 * n / t.totaal).toFixed(1) : '0.0') + '%';

console.log('\n=== HET MUTATIECONTRACTREGISTER ===\n');
console.log(rij(t.totaal, 'schrijfroutes in de mutatie-inventaris'));
console.log(rij(t.totaal - (t.perStand.LEGACY_PENDING_CLASSIFICATION || 0),
  'GECLASSIFICEERD  (' + pct(t.totaal - (t.perStand.LEGACY_PENDING_CLASSIFICATION || 0)) + ')'));
console.log('');
for (const naam of contract.STATUSNAMEN) {
  const n = t.perStand[naam] || 0;
  const d = contract.STATUS[naam];
  console.log(rij(n, naam + (d.naarNul ? '   <- de enige stand die naar NUL moet' : (d.eindstand ? '' : '   <- hoort te slinken'))));
}

console.log('\n  TOEGANG (waargenomen aan de router, niet verklaard)\n');
const waarTelling = {};
for (const r of rijen) { const k = r.toegang.waargenomen || '(niet af te leiden -- vraagt een verklaring)'; waarTelling[k] = (waarTelling[k] || 0) + 1; }
for (const [k, n] of Object.entries(waarTelling).sort((a, b) => b[1] - a[1])) console.log(rij(n, k));

console.log('\n  BEWIJS\n');
const bewijsTelling = { 'kale ronde: beschermd': 0, 'kale ronde: onbeschermd': 0, 'kale ronde: geen uitspraak': 0, 'niet gemeten': 0 };
for (const r of rijen) {
  if (!r.bewijs) bewijsTelling['niet gemeten']++;
  else if (r.bewijs.zonderSleutel === 'beschermd') bewijsTelling['kale ronde: beschermd']++;
  else if (r.bewijs.zonderSleutel === 'onbeschermd') bewijsTelling['kale ronde: onbeschermd']++;
  else bewijsTelling['kale ronde: geen uitspraak']++;
}
for (const [k, n] of Object.entries(bewijsTelling)) console.log(rij(n, k));

console.log('\n  VOORSTELLEN DIE KLAARLIGGEN (een mens bevestigt, deze meter niet)\n');
const voorstelTelling = {};
for (const r of rijen) if (r.voorstel) voorstelTelling[r.voorstel] = (voorstelTelling[r.voorstel] || 0) + 1;
if (!Object.keys(voorstelTelling).length) console.log('       geen');
for (const [k, n] of Object.entries(voorstelTelling).sort((a, b) => b[1] - a[1])) console.log(rij(n, k));

if (tegenspraken.length) {
  console.log('\n  TEGENSPRAAK -- verklaarde toegang tegen de deur in de router\n');
  for (const x of tegenspraken.slice(0, 20)) console.log('       ' + x.route + ': verklaard ' + x.bedoeld + ', router zegt ' + x.waargenomen);
}

if (toonOpen) {
  console.log('\n  DE EERSTE VIJFTIG DIE EEN BESLUIT VRAGEN\n');
  const open = rijen.filter(r => r.stand === 'LEGACY_PENDING_CLASSIFICATION');
  /* Eerst wat een voorstel draagt: die kosten seconden. */
  open.sort((a, b) => (b.voorstel ? 1 : 0) - (a.voorstel ? 1 : 0) || a.route.localeCompare(b.route));
  for (const r of open.slice(0, 50)) {
    console.log('       ' + (r.voorstel ? '[' + r.voorstel + '] ' : '[-] ') + r.route);
    console.log('             ' + (r.voorstelGrond || ''));
  }
}

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per schrijfroute vijf assen: semantiek (kern/mutatie.js), duplicaatgedrag ' +
      '(lib/idemsleutels.js), bewijs (IDEMPROEF.json), toegang en stand ' +
      '(kern/mutatiecontract.js). Afgeleid uit die bronnen; alleen de BEDOELING komt uit ' +
      'server/lib/mutatiecontracten.js, want die is geen waarneming.',
    grens: 'Een stand wordt nooit afgeleid uit bewijs. Het bewijs draagt hooguit een VOORSTEL; ' +
      'de stand komt uit een verklaring van een mens. Zonder die regel staat dit register binnen ' +
      'een uur op 100% en weet niemand meer wat dat betekent.',
    gemeten: {
      totaal: t.totaal,
      geclassificeerd: t.totaal - (t.perStand.LEGACY_PENDING_CLASSIFICATION || 0),
      perStand: t.perStand,
      toegangWaargenomen: waarTelling,
      bewijs: bewijsTelling,
      voorstellen: voorstelTelling,
      metingVan: gemetenOp
    },
    tegenspraken,
    rijen
  }, null, 1) + '\n');
  console.log('\n  MUTATIECONTRACT.json geschreven.');
} else {
  console.log('\n  (niets weggeschreven -- draai met --vastleggen)');
}
