/* DE VELDEN VAN DE ENVELOP (scripts/envelopvelden.js + ENVELOP.json).

   WAAROM DEZE TOETS ER IS. `ENVELOP.json` droeg een lijst `veldenZonderHuis` en
   TAKEN.md 4.71 zei erbij: "Gemeten en geratelde stand in ENVELOP.json
   (npm run envelop:velden)". Dat commando bestond niet, geen script berekende
   de lijst en geen toets controleerde hem -- met de hand getypt, en de enige
   lezer (scripts/samenhang.js) nam hem als waarheid over. Een belofte in tekst
   zonder handhaver, LAT.md regel 6, en de tweede in dezelfde takenlijst na
   `actorVormen`.

   DRIE DINGEN DIE HIER VASTLIGGEN:

     1. DE DRAGER WORDT GECITEERD EN NIET GEZOCHT. "Staat het woord `intent`
        ergens in de bron" zou elk veld een drager geven en de meter op nul
        zetten -- de gevaarlijkste uitslag die er is, want dan lijkt het gat
        gedicht terwijl er niets is gebeurd. Verdwijnt het citaat, dan zakt hij.
     2. DAKLOOS EIST EEN REDEN. Een veld dat geen drager heeft en ook geen uitleg
        waarom niet, is een gat dat niemand heeft uitgelegd -- en dan meet deze
        lijst een mening en geen stand.
     3. DE DAKLOZE BLIJFT DAKLOOS, en dat is het besluit uit 4.71 en geen
        tekortkoming: `intent` is een OORDEEL dat een mens uitspreekt en dat
        nergens in dit huis wordt vastgelegd. Er waren er drie; `risicoklasse` en
        `omkeerbaarheid` hebben op 3 september 2026 een drager gekregen door het
        BESTAANDE beleid uit te lezen (kern/handelingsklasse.js) in plaats van
        beleid te verzinnen. Een verzonnen risicoklasse blijft gevaarlijker dan
        geen. Deze toets bewaakt dat van twee kanten: er mogen er niet MEER
        dakloos worden, en wie er een drager onder zet moet de ratel met de hand
        strakker zetten -- een besluit in plaats van een sluiproute.

   Draai los: node --test test/envelopvelden.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const meter = require('../scripts/envelopvelden.js');

const WORTEL = path.join(__dirname, '..');

function draai(args) {
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts', 'envelopvelden.js'), ...(args || [])],
    { cwd: WORTEL, encoding: 'utf8' });
  return { uit: (r.stdout || '') + (r.stderr || ''), code: r.status };
}

function metVervangen(rel, van, naar, doe) {
  const vol = path.join(WORTEL, rel);
  const origineel = fs.readFileSync(vol, 'utf8');
  assert.ok(origineel.includes(van), 'de aanname onder deze mutatie klopt niet meer: ' + van);
  try { fs.writeFileSync(vol, origineel.replace(van, naar)); doe(); }
  finally { fs.writeFileSync(vol, origineel); }
}

test('de grondstand is groen: elf velden, tien gedragen, EEN dakloos', () => {
  const r = draai();
  assert.equal(r.code, 0, r.uit);
  const nu = meter.meet();
  assert.deepEqual(nu.stuk, []);
  assert.equal(nu.velden, 11);
  /* WAS DRIE, IS EEN (3 september 2026). risicoklasse en omkeerbaarheid hebben
     een drager gekregen in server/kern/handelingsklasse.js -- niet door beleid
     te verzinnen maar door het BESTAANDE beleid uit te lezen (de bodem onder de
     frictie, de AI-allowlist, de herstelproef). `intent` blijft dakloos, en dat
     is de enige van de drie waarvoor er geen bestaande bron IS. */
  assert.equal(nu.dakloos.length, 1);
  assert.deepEqual(nu.dakloos.map(v => v.veld), ['intent']);
  assert.deepEqual(nu.weg, [], 'een drager is uit de bron verdwenen');
});

test('elke dakloze draagt een REDEN, en die zegt iets', () => {
  /* Zonder deze eis is "dakloos" een lege constatering en groeit de lijst met
     velden waarvan niemand meer weet waarom ze er staan. */
  for (const r of meter.meet().dakloos) {
    assert.ok(r.reden && r.reden.length > 60, r.veld + ' is dakloos zonder een reden die iets zegt');
  }
});

test('MUTATIE: verdwijnt een drager uit de bron, dan ZAKT de meter', () => {
  /* De hele reden dat de drager als CITAAT staat en niet als woord. Haal de
     tenant-regel uit envelop.js en de meter hoort dat te zien -- ook al blijft
     het woord "tenant" tien keer in het bestand staan. */
  metVervangen('server/opzet/envelop.js', 'tenant: g.tenantId', 'tenant: g.huisId', () => {
    const nu = meter.meet();
    assert.equal(nu.weg.length, 1);
    assert.equal(nu.weg[0].veld, 'tenant');
    const r = draai();
    assert.match(r.uit, /EEN DRAGER IS WEG/);
    assert.equal(r.code, 1, 'een weggevallen drager hoort de meter te laten zakken');
  });
});

test('MUTATIE: een dakloze zonder reden maakt de meter STUK, en niet stiller', () => {
  metVervangen('scripts/envelopvelden.js',
    "    reden: 'een intentie spreekt een MENS uit;",
    "    uitleg: 'een intentie spreekt een MENS uit;", () => {
      const r = draai();
      assert.match(r.uit, /DE METER IS STUK/);
      assert.match(r.uit, /intent: dakloos zonder reden/);
      assert.equal(r.code, 2, 'een stukke meter hoort niet netjes een getal te melden');
    });
});

test('MUTATIE: een veld erbij zonder drager laat de ratel zakken', () => {
  /* De kant die 4.71 bewaakt: het aantal daklozen mag alleen omlaag. */
  metVervangen('scripts/envelopvelden.js',
    "const VELDEN = [",
    "const VELDEN = [\n  { veld: 'sfeer', wat: 'hoe voelt dit', drager: null, reden: 'een verzonnen veld voor de mutatieproef, met een reden die lang genoeg is om de eis te halen' },", () => {
      const r = draai();
      assert.match(r.uit, /ZAKT: daklozen 1 -> 2/);
      assert.equal(r.code, 1);
    });
});

test('ENVELOP.json loopt niet achter, en draagt EEN naam voor dit getal', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ENVELOP.json'), 'utf8'));
  const nu = meter.meet();
  assert.equal(reg.gemeten.veldenZonderHuis, nu.dakloos.length);
  assert.equal(reg.gemeten.envelopVelden, nu.velden);
  /* Bij het bouwen stond hier even een tweede sleutel `veldenZonderHuisAantal`
     naast de bestaande -- twee namen voor een waarheid, precies de fout die
     deze ronde opruimt. Deze bewering houdt hem weg. */
  assert.equal(reg.gemeten.veldenZonderHuisAantal, undefined,
    'er staan twee namen voor hetzelfde getal in het register');
  assert.match(reg.veldenZonderHuisUitleg, /scripts\/envelopvelden\.js/);
  assert.deepEqual(reg.veldenZonderHuis.map(v => v.veld), nu.dakloos.map(v => v.veld));
});

test('`gemeten` draagt alleen getallen die een script berekent', () => {
  /* Bij het nalopen van alle registers op deze fout (3 september 2026) bleek
     ENVELOP.json nog vier getallen te dragen die geen enkel script berekent en
     geen enkele toets leest: routesZonderEnvelop, routesMetEnvelop,
     routesMetPoortwachter en routesTotaal. Ze waren al uiteengelopen met de
     tekst die ze aanhaalde -- TAKEN.md sprak van "3346 van de 3706 routes"
     waar het register 3421 van 3803 zei. Twee getallen over dezelfde vraag,
     allebei met de hand, allebei verouderd.

     Deze bewering houdt ze weg: wie een getal terug wil, bouwt eerst de meting. */
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ENVELOP.json'), 'utf8'));
  const BEREKEND = ['envelopVelden', 'veldenZonderHuis', 'actorVormen', 'actorDuplicaten', 'actorSessies'];
  const vreemd = Object.keys(reg.gemeten).filter(k => !BEREKEND.includes(k));
  assert.deepEqual(vreemd, [],
    'er staan getallen in `gemeten` die geen enkel script berekent: ' + vreemd.join(', '));
});

test('het npm-commando dat 4.71 noemt, bestaat nu ook echt', () => {
  /* Dit is geen vormcontrole maar de kern van de bevinding: de takenlijst
     verwees naar `npm run envelop:velden` en dat gaf "Missing script". Wie een
     getal wil narekenen en een foutmelding krijgt, gaat ervan uit dat hij zelf
     iets fout doet. */
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['envelop:velden'], 'node scripts/envelopvelden.js');
});
