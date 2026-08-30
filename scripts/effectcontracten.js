#!/usr/bin/env node
/* ============================================================================
   DE VOORSTELLEN DIE OP TWEE METERS RUSTEN -- EN HET ZIJN VOORSTELLEN.

   NOT_APPLICABLE eist bewijs dat er niets verandert. De opslagmeter alleen is
   daar te zwak voor: hij ziet de collecties, dus geen mail, geen sms en geen
   schrijfactie daarbuiten. server/effectmeter.js sluit dat gat van de andere
   kant -- hij meet niet wat de code KAN maar wat het verzoek HEEFT gedaan, en
   schaalt daarom wel waar scripts/schrijfanalyse.js bleef steken op veertig
   routes (die volgt met opzet geen aanroep over een modulegrens).

   WAAROM DIT GEEN CONTRACTEN SCHRIJFT, en dat is de kern van dit bestand.

   Een eerdere versie schreef 848 kant-en-klare NOT_APPLICABLE-contracten weg.
   server/kern/mutatiecontract/keuring.js verbiedt dat, en zegt er de reden bij:
   vijf van de zes standen doen een uitspraak over GEDRAG, en die mag geen script
   zetten. "Zonder dit onderscheid zou een script in een middag 4653 contracten
   kunnen schrijven en zou 100% geclassificeerd niets meer betekenen."

   Dat is precies wat hier dreigde. Twee meters die allebei nul lezen is sterk
   bewijs, maar bewijs draagt een VOORSTEL en een mens draagt het besluit. Dus
   levert dit script een WACHTRIJ met per route het bewijs eronder, en niets dat
   zich als vastgesteld voordoet.

   EEN ROUTE STAAT HIER ALLEEN ALS ALLE VIER WAAR IS:

     1. de kale ronde deed twee geslaagde oproepen (2xx, 2xx);
     2. geen van beide liet een spoor na in de gemeten collecties;
     3. de effectmeter telde op allebei `geen`;
     4. de statische analyse spreekt dat niet tegen -- vindt zij wel een
        schrijfvorm, dan is dat een TEGENSPRAAK en hoort de route hier niet,
        ook al zwijgen beide meters.

   En bij elk voorstel staat wat de effectmeter NIET ziet. Een voorstel dat op
   een meter leunt hoort te zeggen waarover die meter zwijgt.

   Draaien: node scripts/effectcontracten.js         (schrijft de wachtrij)
            node scripts/effectcontracten.js --tel   (telt alleen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const proef = require(path.join(WORTEL, 'IDEMPROEF.json'));
const DOEL = path.join(WORTEL, 'MUTATIECONTRACT-VOORSTEL.json');

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

const voorstellen = {};
for (const r of rijen) {
  voorstellen[r.sleutel] = {
    mutatieId: mutatieId(r.pad),
    voorstel: 'NOT_APPLICABLE',
    bewijs: {
      opslagmeter: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets achter ' +
        'in de gemeten collecties',
      effectmeter: 'op allebei de kale oproepen telde server/effectmeter.js GEEN -- geen schrijfpoging ' +
        'via save(), geen mail, geen sms',
      statischeAnalyse: 'scripts/schrijfanalyse.js spreekt dat niet tegen',
      op: vandaag
    },
    nietGemeten: r.nietGemeten
  };
}

fs.writeFileSync(DOEL, JSON.stringify({
  stempel: { op: new Date().toISOString(), node: process.version },
  uitleg: 'VOORSTELLEN, GEEN CONTRACTEN. Elke regel hier is een route waar twee onafhankelijke ' +
    'runtime-metingen allebei nul lezen en de statische analyse dat niet tegenspreekt. Dat is sterk ' +
    'bewijs voor NOT_APPLICABLE -- en bewijs draagt een voorstel, geen stand.',
  grens: 'Een stand wordt hier NOOIT uit afgeleid. server/kern/mutatiecontract/keuring.js laat ' +
    'herkomst "afgeleid" alleen toe bij BLOCKED_BY_TEST_FIXTURE, en zegt de reden erbij: vijf van de zes ' +
    'standen doen een uitspraak over GEDRAG, en die mag geen script zetten. Wie een regel hier accepteert, ' +
    'zet hem met de hand in server/lib/mutatiecontracten.js -- met een aftekening die zegt wie er keek.',
  nietGemeten: nietGemeten + ' -- daarover zwijgt de effectmeter, en dat blijft ook na acceptatie waar',
  aantal: rijen.length,
  afgewezen,
  voorstellen
}, null, 1) + '\n');

console.log('MUTATIECONTRACT-VOORSTEL.json geschreven: ' + rijen.length + ' voorstellen (GEEN contracten).');
console.log('afgewezen, en waarom: ' + JSON.stringify(afgewezen));
