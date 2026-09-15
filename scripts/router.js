/* ROUTER.json -- WAT DE INTELLIGENTIEROUTER ZOU HEBBEN GEKOZEN, over echt
   verkeer, per ingang. EXECUTIE.md blok 8.

   DIT REGISTER IS EEN WAARNEMING EN GEEN AFLEIDING, en dat maakt hem anders dan
   bijna elk ander register in deze map. SYMBOLEN.json en KANTOORMACHT.json zijn
   uit de BRON te herrekenen: draai ze opnieuw op dezelfde commit en er komt
   hetzelfde uit. Dit niet. De tellers zijn opgebouwd terwijl er mensen met Rahul
   praatten, over een periode die meerdere commits kan omspannen.

   Daarom staat het stempel er MET die waarschuwing. Een `commit` die suggereert
   dat deze getallen uit die commit volgen, is precies de soort stilte waar
   scripts/lib/stempel.js voor is gemaakt -- alleen andersom: hier is de commit
   niet de herkomst van het getal maar de stand van de code toen het register
   werd uitgeschreven. `sinds` is wat telt.

   EN DAAROM STAAT ROUTER.json IN .gitignore. Hij komt uit server/data/, dat om
   dezelfde reden al niet wordt ingecheckt: de tellers van een laptop zijn niet
   die van productie, en ze committen maakt van iemands lokale
   gespreksstatistiek repo-waarheid. Het script hoort in de repo, de uitslag bij
   de installatie. Wie een productiegetal wil, draait dit dAAr.

   WAAROM DIT REGISTER BESTAAT. De router loopt in de schaduw: hij beslist niets
   en de modelaanroep gaat gewoon door. De vraag die hij moet beantwoorden is of
   de goedkope laag vOOr het model mag komen. Zonder dit register is die telling
   alleen in het geheugen van een draaiend proces te zien, en dus onbruikbaar
   voor een besluit.

   NUL WAARNEMINGEN IS NIET NUL PROCENT. Een ingang zonder verkeer krijgt
   `NIET_GEMETEN` en geen percentages. Dat is LAT.md regel 12: een meting die
   niet heeft gedraaid is geen slechte uitslag. Wie hier 0% neerzet, leest
   morgen dat deze ingang nooit goedkoper kan -- terwijl er alleen niemand is
   langsgeweest.

   EN RIJPHEID IS EEN DERDE STAND. Ook mét waarnemingen draagt een getal pas een
   besluit als er genoeg zijn en lang genoeg. De drempel komt van
   kern/commercie/schaduw.js, waar hij al een keer is vastgesteld: beide moeten
   gehaald, want duizend waarnemingen op een dag zegt niets over een rustige
   week en een week met drie verzoeken zegt niets over drukte.

   Draai: npm run router */
'use strict';

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const DOEL = path.join(__dirname, '..', 'ROUTER.json');

/* Dezelfde drempel als kern/commercie/schaduw.js. Overgetypt en niet
   geimporteerd, omdat die module een db en een save wil en dit script alleen
   leest -- maar met de bron erbij, zodat een verschil opvalt. */
const RIJP = { minWaarnemingen: 200, minDagen: 7 };
const DAG = 86400000;

function pct(deel, totaal) { return totaal ? Math.round(1000 * deel / totaal) / 10 : null; }

/* Een vak wordt pas een uitspraak als er iets in zit. Drie standen en niet
   twee: NIET_GEMETEN (niemand langsgeweest), ONRIJP (te weinig of te kort, het
   getal staat er wel maar draagt nog geen besluit) en GEMETEN. */
function beoordeel(v, sinds, nu) {
  if (!v.gewogen) {
    return { uitslag: 'NIET_GEMETEN',
      waarom: 'geen enkele vraag langs deze ingang sinds de meting begon. Dit is geen 0%.' };
  }
  const dagen = sinds ? Math.floor((nu - sinds) / DAG) : 0;
  const genoeg = v.gewogen >= RIJP.minWaarnemingen && dagen >= RIJP.minDagen;
  if (!genoeg) {
    return { uitslag: 'ONRIJP', dagen,
      waarom: 'de getallen staan er, maar dragen nog geen besluit: ' + v.gewogen + ' van ' +
        RIJP.minWaarnemingen + ' waarnemingen en ' + dagen + ' van ' + RIJP.minDagen + ' dagen.' };
  }
  return { uitslag: 'GEMETEN', dagen, waarom: 'genoeg waarnemingen over genoeg dagen.' };
}

function vak(v, sinds, nu) {
  return Object.assign({}, v, {
    /* De twee getallen die nooit worden opgeteld, en het verschil ertussen. */
    spoorPct: pct(v.spoor, v.gewogen),
    bewezenGedektPct: pct(v.bewezenGedekt, v.gewogen),
    routerEensPct: pct(v.gewogen - v.spoorZonderDekking - v.dekkingZonderSpoor, v.gewogen),
    modelNodigPct: pct(v.modelNodig, v.gewogen),
    nietsGafAntwoordPct: pct(v.nietsGafAntwoord, v.gewogen)
  }, beoordeel(v, sinds, nu));
}

function main() {
  const dbmod = require('../server/db');
  return Promise.resolve(typeof dbmod.load === 'function' ? dbmod.load() : null).then(() => {
    const rauw = (dbmod.db && dbmod.db.data && dbmod.db.data.routerschaduw) || null;
    const nu = Date.now();

    if (!rauw || !rauw.totaal) {
      return {
        uitslag: 'NIET_GEMETEN',
        waarom: 'er staat geen routerschaduw in de opslag. De meter telt pas zodra er een server ' +
          'heeft gedraaid waar iemand Rahul een vraag stelde; zie server/kern/ai/routermeting.js.',
        sinds: null, totaal: null, per: null
      };
    }

    const sinds = Number.isFinite(rauw.sinds) ? rauw.sinds : null;
    const per = {};
    for (const [naam, v] of Object.entries(rauw.per || {})) per[naam] = vak(v, sinds, nu);

    return {
      sinds: sinds ? new Date(sinds).toISOString() : null,
      sindsMs: sinds,
      drempel: RIJP,
      totaal: vak(rauw.totaal, sinds, nu),
      per,
      leeswijzer: {
        spoor: 'VERMOEDEN. router.kies() herkende een goedkopere techniek aan een regex over de ' +
          'vraag. Dit is een bovengrens van wat een woordpatroon kan zeggen, geen dekking.',
        bewezenGedekt: 'GEMETEN. De goedkope laag van die ingang kon de vraag echt beantwoorden.',
        nooitOptellen: 'spoor en bewezenGedekt gaan over dezelfde vragen en meten iets anders. ' +
          'Optellen levert een getal zonder betekenis.',
        spoorZonderDekking: 'de router zei "kan goedkoper" en dat kon niet. Draai je hierop de ' +
          'volgorde om, dan verdringt een standaardzin een modelantwoord.',
        dekkingZonderSpoor: 'de router zei "model nodig" en dat was het niet. De duurste van de ' +
          'twee: een goedkope techniek die je niet ziet, zet je nooit aan.',
        nietsGafAntwoord: 'geen goedkope dekking en geen model -- hier viel het gesprek terug op ' +
          'een algemene zin.',
        perIngang: 'niet vergelijkbaar met elkaar zonder na te denken: elke ingang heeft zijn ' +
          'eigen goedkope laag (kern/fluister op /api/fluister, cannedAnswer op de andere twee).'
      },
      nietGemeten: [
        'of een goedkoper antwoord ook GOED was. Geteld wordt of de goedkope laag iets anders dan ' +
          'haar standaardzin gaf, niet of dat het juiste antwoord was.',
        'de technieken algoritme, optimalisatie en voorspelling: die motoren zijn niet vanuit een ' +
          'kale vraag te draaien (ze willen een register, een lid of argumenten).',
        'of het model beter was dan de goedkope laag -- beide draaien niet op dezelfde vraag.',
        'wie de vragen stelde. Deze meter houdt tellers en geen journaal; er staat geen vraag en ' +
          'geen sessiesleutel in.'
      ],
      grens: rauw.duurzaam === false
        ? 'De tellers waren niet duurzaam toen ze werden geschreven.'
        : 'De router BESLIST NIETS: elk antwoord kwam tot stand zoals het zonder deze meter ook zou zijn.'
    };
  });
}

if (require.main === module) {
  main().then((uit) => {
    const stamp = Object.assign({}, stempel(), {
      let: 'Dit register is een WAARNEMING over een periode, geen afleiding uit de commit. ' +
        'De commit hieronder is de stand van de code toen het register werd uitgeschreven, ' +
        'niet de herkomst van de getallen. Kijk naar `sinds`.'
    });
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stamp }, uit), null, 2) + '\n');
    const t = uit.totaal;
    if (!t) {
      console.log('\nROUTER.json geschreven: ' + uit.uitslag + '\n  ' + uit.waarom + '\n');
    } else {
      console.log('\nROUTER.json geschreven.\n');
      console.log('  totaal      ' + t.uitslag + ' -- ' + t.waarom);
      console.log('  gewogen     ' + t.gewogen);
      console.log('  spoor       ' + t.spoorPct + '%  (vermoeden van de router)');
      console.log('  gedekt      ' + t.bewezenGedektPct + '%  (gemeten)');
      console.log('  router eens ' + t.routerEensPct + '%  -- te optimistisch: ' +
        t.spoorZonderDekking + ', gemist: ' + t.dekkingZonderSpoor);
      console.log('');
      for (const [naam, v] of Object.entries(uit.per)) {
        console.log('  ' + naam.padEnd(9) + ' ' + String(v.uitslag).padEnd(12) +
          (v.gewogen ? 'gewogen ' + v.gewogen + ', gedekt ' + v.bewezenGedektPct + '%' : ''));
      }
      console.log('');
    }
    process.exit(0);
  }).catch((e) => { console.error('router: ' + e.message); process.exit(1); });
}

module.exports = { main, beoordeel, RIJP };
