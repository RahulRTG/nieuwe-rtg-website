#!/usr/bin/env node
/* ============================================================================
   DE VOORSTELLEN DIE OP TWEE METERS RUSTEN -- EN HET ZIJN VOORSTELLEN.

   NOT_APPLICABLE eist bewijs dat er niets verandert. De opslagmeter alleen is
   daar te zwak voor: hij ziet de collecties, dus geen mail, geen sms en geen
   schrijfactie daarbuiten. server/effectmeter.js sluit dat gat van de andere
   kant -- hij meet niet wat de code KAN maar wat het verzoek HEEFT gedaan, en
   schaalt daarom wel waar scripts/schrijfanalyse.js bleef steken op veertig
   routes (die volgt met opzet geen aanroep over een modulegrens).

   WAT DIT SCRIPT WEL EN NIET MAG, en dat is de kern van dit bestand.

   Een eerdere versie schreef 848 kant-en-klare NOT_APPLICABLE-contracten weg op
   eigen gezag. server/kern/mutatiecontract/keuring.js verbiedt dat, en zegt er de
   reden bij: vijf van de zes standen doen een uitspraak over GEDRAG, en die mag
   geen script zetten. "Zonder dit onderscheid zou een script in een middag 4653
   contracten kunnen schrijven en zou 100% geclassificeerd niets meer betekenen."

   Twee meters die allebei nul lezen is sterk bewijs -- en bewijs draagt een
   VOORSTEL. Het besluit of dat bewijs GENOEG is, is van de eigenaar, en dat
   besluit is op 30 augustus 2026 genomen: twee onafhankelijke runtime-metingen
   die allebei nul lezen, met genoemd waarover ze zwijgen, is voldoende grond voor
   NOT_APPLICABLE.

   Dit script schrijft daarom twee dingen, en het verschil staat in de bestanden
   zelf: de WACHTRIJ (MUTATIECONTRACT-VOORSTEL.json, alles wat de vier eisen
   haalt) en de LIJST DIE ONDER DAT BESLUIT VALT (./lib/effectroutes.json, alleen
   wat OOK een waargenomen toegangsklasse heeft -- want een contract zonder deur
   bestaat niet, en die verzint dit script niet).

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
  /* DE VIER SPECIFIEKE BESTANDEN, en NIET het samengestelde register.

     Dat las hij eerst, en dat is een lus: mutatiecontracten.js gooit zodra
     ./mutatiecontracten-effect een specifieker contract overschrijft -- precies
     de fout die dit script moet kunnen repareren. Wie dan opnieuw draait om hem
     recht te zetten, krijgt de fout in plaats van de reparatie. Gemeten met een
     mutatieproef: de generator liep vast op zijn eigen uitvoer.

     Hier staan de vier bestanden dus met naam. Ze staan ook in
     server/lib/mutatiecontracten.js; die tweede plek is bewust en de toets
     test/mutatiecontract.test.js houdt ze gelijk. */
  const DELEN = ['beschermd', 'leest', 'tweedehandeling', 'padparameter'];
  const c = Object.assign({}, ...DELEN.map(d =>
    require(path.join(WORTEL, 'server/lib/mutatiecontracten-' + d + '.js')).CONTRACTEN));
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

console.log('MUTATIECONTRACT-VOORSTEL.json geschreven: ' + rijen.length + ' voorstellen.');

/* ---------------------------------------------------------------------------
   DE LIJST DIE ONDER HET BESLUIT VALT.

   Alleen de routes die naast de vier eisen OOK een waargenomen toegangsklasse
   hebben. Een contract zonder deur bestaat niet (de keuring weigert het), en dit
   script verzint er geen -- een verzonnen toegangsklasse is erger dan een route
   die op LEGACY blijft staan.

   Alleen de NAMEN en de deur staan hier. De redenering, het bewijs en de
   aftekening staan EEN keer, in server/lib/mutatiecontracten-effect.js. Data in
   JSON, betekenis in JS: 848 keer dezelfde zin uitschrijven is de vorm waarin
   een verschil onopgemerkt insluipt.
   ------------------------------------------------------------------------- */
const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIECONTRACT.json'), 'utf8'));
const regRij = new Map((register.rijen || []).map(x => [x.route, x]));
const uitDeur = [];
let zonderDeur = 0;
for (const r of rijen) {
  const x = regRij.get(r.sleutel);
  const klasse = x && x.toegang && x.toegang.waargenomen;
  if (!klasse) { zonderDeur++; continue; }
  const rij = { route: r.sleutel, mutatieId: mutatieId(r.pad), toegang: klasse };
  if (klasse === 'OBJECT_SCOPED') {
    const uh = String((x.toegang && x.toegang.uitHandler) || '');
    const veld = uh.startsWith('object: ') ? uh.slice(8) : null;
    if (!veld) { zonderDeur++; continue; }   // OBJECT_SCOPED zonder veld is geen contract
    rij.objectVeld = veld;
  }
  uitDeur.push(rij);
}
fs.writeFileSync(path.join(WORTEL, 'server/lib/effectroutes.json'), JSON.stringify({
  uitleg: 'De routes die onder het besluit van 30 augustus 2026 vallen: twee onafhankelijke ' +
    'runtime-metingen lezen allebei nul. Alleen de namen en de deur -- de redenering, het bewijs en de ' +
    'aftekening staan een keer, in ./mutatiecontracten-effect.js.',
  geschrevenDoor: 'scripts/effectcontracten.js',
  aantal: uitDeur.length,
  zonderWaargenomenDeur: zonderDeur,
  routes: uitDeur
}, null, 1) + '\n');

console.log('server/lib/effectroutes.json geschreven: ' + uitDeur.length + ' routes onder het besluit.');
console.log('  zonder waargenomen deur, dus NIET meegenomen: ' + zonderDeur);
console.log('afgewezen, en waarom: ' + JSON.stringify(afgewezen));
