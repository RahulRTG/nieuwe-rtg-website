/* DE KETENPROEF (scripts/ketenbereik.js + scripts/lib/ketenspoor.js).

   Deze toets bewaakt niet de UITSLAG -- die hoort te veranderen zodra er wordt
   bedraad. Hij bewaakt de manier waarop de uitslag tot stand komt, en dat is
   precies waar deze meter tijdens het bouwen twee keer op zijn bek ging:

     1. `gedaan: true` werd gelezen als "er is een effect", terwijl de enige
        uitgevoerde actie het GEREEDSCHAP `plan` was -- een bestand dat per
        eigen doctrine niets uitvoert. De meter meldde twee mutaties buiten
        mandaat waar nul mutaties hadden plaatsgevonden.
     2. `buitenMandaat: 0` las als een veiligheidsbewijs, terwijl er niets was
        uitgevoerd en de vraag dus niet eens gesteld was.

   Beide zijn beschuldigingen zonder bewijs, en beide zijn hier vastgelegd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const M = require('../scripts/ketenbereik.js');
const HAAK = path.join(WORTEL, 'scripts/lib/ketenspoor.js');

/* ---- de meethaak verandert niets ---------------------------------------- */

test('de haak doet zonder RTG_KETENSPOOR letterlijk niets', () => {
  const ruw = fs.readFileSync(HAAK, 'utf8');
  assert.match(ruw, /const UIT_PAD = process\.env\.RTG_KETENSPOOR \|\| '';\s*\n\s*if \(!UIT_PAD\) return;/,
    'de haak moet meteen terugkeren zonder vlag; anders loopt hij in productie mee');
});

test('de haak is geen productiecode en staat in scripts/', () => {
  assert.ok(fs.existsSync(HAAK));
  assert.ok(!fs.existsSync(path.join(WORTEL, 'server/kern/ai/ketenspoor.js')) &&
    !fs.existsSync(path.join(WORTEL, 'server/opzet/ketenspoor.js')),
    'de waarneming hoort niet in server/ te landen: dan is het geen observatie meer maar gedrag');
});

/* ---- de eerste fout: gereedschap is geen effect -------------------------- */

/* DEZE TOETS EERST, EN HIJ IS MET EEN MUTATIE AFGEDWONGEN. De toets hieronder
   voerde een AL GECLASSIFICEERDE actie in (`soort: 'gereedschap'`) en beproefde
   de classificator dus nooit -- draai `soortVanActie` om en hij bleef groen.
   Dezelfde blindheid als de toonvormtoets in test/routermeting.test.js. */
test('soortVanActie scheidt gereedschap, lezen en mutatie', () => {
  assert.strictEqual(M.soortVanActie('plan'), 'gereedschap',
    'plan is het gereedschap van de lus en voert per eigen doctrine niets uit');
  assert.strictEqual(M.soortVanActie('kaart'), 'gereedschap');
  assert.strictEqual(M.soortVanActie('/api/agenda/mijn'), 'lezen',
    'beleid.js kent dit pad als `lezen`; de indeling komt daarvandaan en niet uit dit script');
  const mut = M.soortVanActie('/api/agenda/bewaar');
  assert.ok(mut === 'mutatie' || mut === 'onbekend',
    'een schrijfpad is nooit `lezen` en nooit `gereedschap`; onbekend mag, stil goedpraten niet');
  assert.notStrictEqual(M.soortVanActie('/api/agenda/mijn'), M.soortVanActie('plan'),
    'een instrument dat alles hetzelfde noemt, is geen instrument');
});

test('weegAntwoord telt alleen geslaagde acties, en gereedschap niet als mutatie', () => {
  const w = M.weegAntwoord({ lijf: { gedaan: true, stuur: [
    { pad: 'plan', status: 200 },
    { pad: '/api/agenda/mijn', status: 200 },
    { pad: '/api/agenda/bewaar', status: 403 }
  ] } });
  assert.strictEqual(w.geslaagdeActies.length, 2, 'de 403 telt niet mee');
  assert.strictEqual(w.mutaties, 0, 'gedaan:true met alleen gereedschap en een lezing is geen mutatie');
});


test('een gereedschap van de lus telt niet als mutatie', () => {
  const b = M.bypass([{
    stand: 't', ingang: 'fluister', geval: 'lezen', schakels: ['plan'],
    weging: { geslaagdeActies: [{ pad: 'plan', soort: 'gereedschap' }], mutaties: 0, onbekendeActies: 0 }
  }], { geinstrumenteerd: [{ schakel: 'mandaat' }] });
  assert.strictEqual(b.mutatiesMetEffect, 0, 'plan is een gereedschap en verandert niets aan de wereld');
  assert.strictEqual(b.buitenMandaat, 0, 'en dus is er geen bypass om te melden');
  assert.strictEqual(b.gereedschapsaanroepen, 1, 'maar hij wordt wel apart geteld, niet weggelaten');
});

test('een echte mutatie zonder mandaat IS een bypass', () => {
  const b = M.bypass([{
    stand: 't', ingang: 'fluister', geval: 'mut', schakels: ['executor', 'plan'],
    weging: { geslaagdeActies: [{ pad: '/api/agenda/bewaar', soort: 'mutatie' }], mutaties: 1, onbekendeActies: 0 }
  }], { geinstrumenteerd: [{ schakel: 'mandaat' }] });
  assert.strictEqual(b.mutatiesMetEffect, 1);
  assert.strictEqual(b.buitenMandaat, 1, 'executor geraakt, mandaat niet: dat is de bevinding waar deze meter voor bestaat');
  assert.match(b.uitspraak, /BYPASS GEVONDEN/);
});

test('een mutatie die mandaat wel passeert telt als langsMandaat', () => {
  const b = M.bypass([{
    stand: 't', ingang: 'fluister', geval: 'mut', schakels: ['mandaat', 'executor'],
    weging: { geslaagdeActies: [{ pad: '/api/agenda/bewaar', soort: 'mutatie' }], mutaties: 1, onbekendeActies: 0 }
  }], { geinstrumenteerd: [{ schakel: 'mandaat' }] });
  assert.strictEqual(b.langsMandaat, 1);
  assert.strictEqual(b.buitenMandaat, 0);
  assert.match(b.uitspraak, /^BEPROEFD/);
});

/* ---- de tweede fout: nul is geen veiligheidsbewijs ----------------------- */

test('nul mutaties levert NIET_BEPROEFD en geen geruststelling', () => {
  const b = M.bypass([], { geinstrumenteerd: [{ schakel: 'mandaat' }] });
  assert.strictEqual(b.mutatiesMetEffect, 0);
  assert.strictEqual(b.buitenMandaat, 0);
  assert.match(b.uitspraak, /NIET_BEPROEFD/,
    'zonder mutatie is de vraag niet gesteld; nul bypasses is dan geen uitslag maar een stilte');
  assert.match(b.uitspraak, /NIET als "mandaat is onomzeilbaar"/,
    'de uitslag moet zelf zeggen hoe hij NIET gelezen mag worden');
});

test('zonder meetdekking op mandaat is elke mutatie onbekendSpoor', () => {
  const zin = {
    stand: 't', ingang: 'fluister', geval: 'mut', schakels: ['executor'],
    weging: { geslaagdeActies: [{ pad: '/api/agenda/bewaar', soort: 'mutatie' }], mutaties: 1, onbekendeActies: 0 }
  };
  const b = M.bypass([zin], { geinstrumenteerd: [] });   // mandaat NIET gewikkeld
  assert.strictEqual(b.onbekendSpoor, 1);
  assert.strictEqual(b.buitenMandaat, 0,
    'zonder meetdekking bestaat er geen recht op de bewering dat er langs mandaat heen wordt gegaan');
});

/* ---- een niet te wikkelen schakel is nooit "niet bereikt" ---------------- */

test('NIET_GEINSTRUMENTEERD verdringt elke andere stand, met de reden erbij', () => {
  const haak = { geinstrumenteerd: [], nietGeinstrumenteerd: [{ schakel: 'mandaat', reden: 'kon niet laden' }] };
  const s = M.standVan('mandaat', haak, false, false);
  assert.strictEqual(s.stand, 'NIET_GEINSTRUMENTEERD');
  assert.match(s.waarom, /kon niet laden/, 'de reden reist mee, anders is het een stille nul');

  /* En ook als hij WEL geraakt lijkt: een kapotte haak mag geen bewijs worden. */
  assert.strictEqual(M.standVan('mandaat', haak, true, true).stand, 'NIET_GEINSTRUMENTEERD');
});

test('de vier gewone standen zeggen elk iets anders', () => {
  const haak = { geinstrumenteerd: [{ schakel: 'plan' }], nietGeinstrumenteerd: [] };
  assert.strictEqual(M.standVan('plan', haak, true, true).stand, 'BEWEZEN');
  assert.strictEqual(M.standVan('plan', haak, false, true).stand, 'BEREIKBAAR');
  assert.strictEqual(M.standVan('plan', haak, false, false).stand, 'AANWEZIG');
  assert.notStrictEqual(M.standVan('plan', haak, false, true).waarom,
    M.standVan('plan', haak, false, false).waarom, 'BEREIKBAAR en AANWEZIG mogen niet dezelfde reden dragen');
});

/* ---- het corpus is geen gelukkig pad ------------------------------------- */

test('het corpus dwingt de keten op verschillende plekken te stoppen', () => {
  const ids = M.CORPUS.map(c => c.id);
  for (const nodig of ['lezen', 'mutatie-toegestaan', 'mutatie-zonder-bevoegdheid',
    'ambigu', 'onbekende-capability']) {
    assert.ok(ids.includes(nodig), 'het corpus mist het geval "' + nodig + '"');
  }
  for (const c of M.CORPUS) {
    assert.ok(c.verwacht && c.verwacht.length > 10,
      'elk geval zegt WAAROM het erin staat; anders is het corpus een verzameling zinnen');
  }
});

/* ---- DE RATEL: het bereik van de METER, niet de uitslag ------------------- */

/* WAAROM HIER GEEN UITSLAG WORDT VASTGEZET. Deze meting bestaat om te BEWEGEN:
   vandaag raakt geen enkele zin `mandaat`, en de hele bedoeling van het register
   is dat dat verandert. Een ratel op de uitslag zou het repareren bestraffen.

   Wat wel alleen een kant op mag, is hoeveel de meter KAN ZIEN. Valt een schakel
   uit de haak (iemand hernoemt kern/stuur/mandaat.js, een export wordt bevroren),
   dan meldt dit register exact dezelfde conclusie -- "mandaat wordt door geen
   enkele zin geraakt" -- over minder bewijs. Dat is dezelfde faalvorm als een
   schuld die daalt doordat het instrument blind wordt, en dat is precies waar
   een ratel voor bestaat. Het besluit staat ook in scripts/lib/metingen.js,
   naast dat van CARRIEREVORM.json, dat om dezelfde reden het BEREIK ratelt.

   MUTATIE GEZIEN ZAKKEN: een schakel uit SCHAKELS in scripts/lib/ketenspoor.js
   gehaald -> toets zakt op de vloer van negen, met de naam van de schakel erbij.
   En andersom: een schakel in `nietGeinstrumenteerd` gezet -> zakt daarop. */
const REGISTER = path.join(WORTEL, 'KETENBEREIK.json');

test('de haak verklaart negen schakels, en die vloer mag niet dalen', () => {
  const ruw = fs.readFileSync(HAAK, 'utf8');
  const namen = [...ruw.matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map(m => m[1]);
  assert.ok(namen.length >= 9,
    'de haak verklaart nog ' + namen.length + ' schakels van de negen; een keten met minder schakels ' +
    'meet minder en concludeert hetzelfde. Wat eraf ging: ' + namen.join(', '));
  for (const nodig of ['menscontext', 'resolver', 'beleid', 'plan', 'gevolg', 'mandaat',
    'executor', 'lus', 'nacontrole'])
    assert.ok(namen.includes(nodig), 'de schakel "' + nodig + '" staat niet meer in de haak');
});

test('KETENBEREIK.json bestaat, en elke stand zag alle negen schakels', () => {
  assert.ok(fs.existsSync(REGISTER),
    'KETENBEREIK.json ontbreekt. Draai `npm run ketenbereik:vast`; een ratel zonder register ' +
    'is geen ratel maar een toets die altijd groen staat');
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));

  assert.ok(Array.isArray(j.haakstand) && j.haakstand.length >= 3,
    'het register meet minder dan drie standen; met minder standen is BEREIKBAAR niet vast te stellen');

  for (const s of j.haakstand) {
    assert.strictEqual(s.nietGeinstrumenteerd.length, 0,
      'in de stand "' + s.stand + '" kon de haak een schakel niet wikkelen: ' +
      s.nietGeinstrumenteerd.map(n => n.schakel + ' (' + n.reden + ')').join('; ') +
      ' -- die schakel staat daardoor als NIET_GEINSTRUMENTEERD en niet als "niet bereikt". ' +
      'Repareer de haak; een lege schakel zonder meetdekking leest als een gat in de architectuur.');
    assert.ok(s.geinstrumenteerd.length >= 9,
      'de stand "' + s.stand + '" zag ' + s.geinstrumenteerd.length + ' schakels in plaats van negen');
  }

  /* En de uitspraak draagt altijd haar eigen leesaanwijzing -- of er nu wel of
     niet iets is uitgevoerd. Zonder die zin is `buitenMandaat: 0` een
     geruststelling over een vraag die niemand heeft gesteld. */
  const u = j.onomzeilbaarheid.uitspraak;
  assert.ok(/^(NIET_BEPROEFD|BEPROEFD|BYPASS GEVONDEN)/.test(u),
    'de uitspraak opent niet met een van de drie standen: ' + u);
  if (u.startsWith('NIET_BEPROEFD'))
    assert.match(u, /NIET als "mandaat is onomzeilbaar"/,
      'de NIET_BEPROEFD-uitslag moet zelf zeggen hoe hij niet gelezen mag worden');
});
