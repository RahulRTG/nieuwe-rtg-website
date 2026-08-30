#!/usr/bin/env node
/* ============================================================================
   DE CONTRACTEN DIE OP DE EFFECTMETER LEUNEN.

   NOT_APPLICABLE eist bewijs dat er niets verandert. De opslagmeter alleen is
   daar te zwak voor -- hij ziet de collecties en dus geen mail, geen sms en geen
   schrijfactie daarbuiten. server/lib/mutatiecontracten-leest.js vult dat gat met
   scripts/schrijfanalyse.js, en dat lukte veertig keer: die analyse volgt met
   opzet geen aanroep naar een andere module, en in dit huis gaat bijna elke
   handler meteen de kern in.

   server/effectmeter.js sluit hetzelfde gat vanaf de andere kant: hij meet niet
   wat de code KAN maar wat het verzoek HEEFT gedaan, op drie choke points. Twee
   kale oproepen die allebei `geen` melden zijn daarmee een tweede, onafhankelijke
   meting -- en anders dan de statische analyse schaalt hij wel, want hij hangt
   aan de aanroep en niet aan de brontekst.

   WAT DIT SCRIPT NIET DOET. Het verzint geen stand. Het schrijft alleen de routes
   op waar ALLE VIER waar is:

     1. de kale ronde deed twee geslaagde oproepen (2xx, 2xx);
     2. geen van beide liet een spoor na in de gemeten collecties;
     3. de effectmeter telde op allebei `geen`;
     4. de statische analyse spreekt dat niet tegen (geen schrijfvorm gevonden --
        vindt hij er wel een, dan is dat een TEGENSPRAAK en hoort de route hier
        niet, ook al zwijgen beide meters).

   En het schrijft in `nagekeken` wat de effectmeter NIET ziet, met naam. Een
   contract dat op een meter leunt hoort te zeggen waarover die meter zwijgt.

   Draaien: node scripts/effectcontracten.js  (schrijft het bestand)
            node scripts/effectcontracten.js --tel   (telt alleen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const proef = require(path.join(WORTEL, 'IDEMPROEF.json'));
const DOEL = path.join(WORTEL, 'server/lib/mutatiecontracten-effect.js');

/* De routes die al een verklaring van een mens hebben, blijven onaangeroerd:
   dit script vult aan en overschrijft nooit. */
const bestaand = (() => {
  /* mutatiecontracten.js exporteert { CONTRACTEN }, niet de contracten zelf. De
     eerste versie las daardoor precies EEN sleutel ('CONTRACTEN') en vond dus
     nooit een bestaande verklaring -- een dubbele definitie zou er stil in zijn
     geslopen. Vandaar de controle eronder. */
  const m = require(path.join(WORTEL, 'server/lib/mutatiecontracten.js'));
  const c = m.CONTRACTEN || m;
  const s = new Set(Object.keys(c));
  if (s.size < 50) {
    console.error('server/lib/mutatiecontracten.js leverde ' + s.size + ' contracten op; dat kan niet kloppen.');
    process.exit(2);
  }
  return s;
})();

/* De statische analyse als VETO, precies zoals mutatiecontract.js hem gebruikt:
   te ruim om iets te bewijzen, uitstekend om iets te weerleggen. */
let statisch = new Map();
{
  /* `perRoute` is hier een object met een TELLER als sleutel en de route in de
     rij zelf -- niet de route als sleutel, zoals in IDEMPROEF.json. Die twee
     vormen door elkaar halen kost geen foutmelding maar een leeg veto, en dan
     staat er in dit bestand een contract meer dan mag. Zo is het hier ook
     misgegaan: de eerste versie las 0 tegenspraken. */
  const sa = require(path.join(WORTEL, 'SCHRIJFANALYSE.json'));
  for (const r of Object.values(sa.perRoute || {})) if (r && r.route) statisch.set(r.route, r);
  if (!statisch.size) {
    console.error('SCHRIJFANALYSE.json leverde geen enkele rij op -- zonder veto schrijft dit script niets.');
    process.exit(2);
  }
}

const leeg = (d) => !d || !Object.keys(d).length;
const rijen = [];
const afgewezen = { geenKaleRonde: 0, spoorInOpslag: 0, effectGeteld: 0, geenEffectmeter: 0, tegenspraak: 0, alVerklaard: 0 };

for (const r of Object.values(proef.perRoute)) {
  const sleutel = (r.methode || 'POST') + ' ' + r.pad;
  if (bestaand.has(sleutel)) { afgewezen.alVerklaard++; continue; }
  const z = r.zonderSleutel;
  if (!z) { afgewezen.geenKaleRonde++; continue; }
  const st = z.statussen || [];
  if (!(st.length === 2 && st.every(x => x >= 200 && x < 300))) { afgewezen.geenKaleRonde++; continue; }
  if (!z.opslag || !leeg(z.opslag.d) || !leeg(z.opslag.e)) { afgewezen.spoorInOpslag++; continue; }
  if (!z.effect || z.effect.d == null || z.effect.e == null) { afgewezen.geenEffectmeter++; continue; }
  if (z.effect.d !== 'geen' || z.effect.e !== 'geen') { afgewezen.effectGeteld++; continue; }
  const sa = statisch.get(sleutel);
  if (sa && sa.schrijft === 'ja') { afgewezen.tegenspraak++; continue; }
  rijen.push({ sleutel, pad: r.pad, methode: r.methode || 'POST',
    nietGemeten: z.effect.nietGemeten || 'onbekend' });
}

rijen.sort((a, b) => a.sleutel.localeCompare(b.sleutel));

if (process.argv.includes('--tel')) {
  console.log('routes met twee meters op nul : ' + rijen.length);
  console.log('afgewezen, en waarom          : ' + JSON.stringify(afgewezen, null, 1));
  process.exit(0);
}

const mutatieId = (pad) => pad.replace(/^\/api\//, '').replace(/\//g, '.').replace(/:/g, '');
const nietGemeten = rijen.length ? rijen[0].nietGemeten : 'onbekend';
const vandaag = new Date().toISOString().slice(0, 10);

const kop = `/* ============================================================================
   MUTATIECONTRACTEN -- WAT TWEE METERS ALLEBEI OP NUL ZETTEN.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Geschreven door scripts/effectcontracten.js -- niet met de hand
   bijwerken, maar dat script opnieuw draaien.

   ./mutatiecontracten-leest.js doet hetzelfde met scripts/schrijfanalyse.js als
   tweede lijn, en kwam niet verder dan veertig routes: die analyse volgt met
   opzet geen aanroep over een modulegrens, en in dit huis gaat bijna elke handler
   meteen de kern in.

   server/effectmeter.js sluit hetzelfde gat van de andere kant. Hij meet niet wat
   de code KAN maar wat het verzoek HEEFT gedaan -- een schrijfpoging, een mail,
   een sms -- en schaalt daarom wel: hij hangt aan de aanroep en niet aan de
   brontekst.

   WAT DEZE METER NIET ZIET, en dat staat ook in elk contract hieronder:
   ${nietGemeten}. Bestandsschrijfacties hebben geen enkel choke point, en van de
   externe aanroepen is alleen server/ai.js er een -- halve dekking daar zou bij
   drie van de vier routes zwijgen, en dat leest als "er gebeurde niets".

   EEN ROUTE STAAT HIER ALLEEN ALS ALLE VIER WAAR IS: twee geslaagde kale
   oproepen, geen spoor in de collecties, 'geen' op de effectmeter bij allebei, en
   geen tegenspraak uit de statische analyse.
   ========================================================================== */
'use strict';

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZE IS. Deze contracten zijn opgesteld
   door Claude op grond van twee METINGEN -- niet door een mens die ze een voor
   een heeft gelezen. Dat verschil hoort in het register te staan: "twee keer
   gemeten" is iets anders dan "door een mens beoordeeld".

   Wie er een naleest en er zijn naam onder wil zetten, vervangt hem hier. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van twee onafhankelijke runtime-metingen (opslagmeter en effectmeter); ' +
    'niet door een mens nagelezen',
  op: '${vandaag}'
};

/* HETZELFDE BEWIJS, ${rijen.length} KEER -- dus EEN keer. Zie
   ./mutatiecontracten-beschermd.js voor waarom dat meer is dan een besparing:
   een reeks bijna-gelijke zinnen is de vorm waarin een verschil insluipt. */
const NIET_GEMETEN = '${nietGemeten}';

const geenEffect = (route, id) => [route, {
  mutatieId: id, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets achter in de ' +
      'gemeten collecties',
    op: '${vandaag}'
  },
  nagekeken: 'server/effectmeter.js, ${vandaag}: op allebei de kale oproepen telde de meter 'geen' -- geen ' +
    'schrijfpoging via save(), geen mail, geen sms. Dat is de tweede, onafhankelijke lijn die het gat sluit ' +
    'dat de opslagmeter laat. Wat ook deze meter NIET ziet: ' + NIET_GEMETEN,
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
`;

const regels = rijen.map(r =>
  `  geenEffect('${r.methode} ${r.pad}', '${mutatieId(r.pad)}'),`).join('\n');

fs.writeFileSync(DOEL, kop + regels + `
]);

module.exports = CONTRACTEN;
`);

console.log('server/lib/mutatiecontracten-effect.js geschreven: ' + rijen.length + ' contracten.');
console.log('afgewezen, en waarom: ' + JSON.stringify(afgewezen));
