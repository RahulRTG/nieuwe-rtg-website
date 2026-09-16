/* DE PAKTE-METING (scripts/paktebetekenis.js).

   Deze toets bewaakt niet de UITSLAG -- die hoort te veranderen zodra `pakte`
   wordt gesplitst. Hij bewaakt de manier waarop de uitslag tot stand komt, en
   dat is precies waar deze meter tijdens het bouwen twee keer op zijn bek ging:

     1. EFFECT_BEREIKT werd afgeleid door een opslagVLOER af te trekken (wat een
        kaal antwoord kost). Dat was fout: `wat weet je over mij` keert terug
        zonder klaar() en schrijft dus MINDER dan de ijkzin, en `onthoud` schrijft
        er precies evenveel terwijl het een weetje vastlegt. Een basislijn die per
        codepad verschilt, is geen basislijn.
     2. Daarna werd EFFECT_BEREIKT tweewaardig op COLLECTIENAAM, en toen meldde
        `vergeet alles` doodleuk "geen effect". `fluister` draagt namelijk het
        gespreksgeheugen EN de weetjes in EEN collectie. `false` daarop is een
        bewering die de meting niet draagt, en wel in het voordeel van het huis. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const M = require('../scripts/paktebetekenis.js');
const R = require('../scripts/lib/pakteronde.js');
const REGISTER = path.join(WORTEL, 'PAKTEBETEKENIS.json');

/* ---- de derde uitkomst is de hele les ------------------------------------ */

test('EFFECT_BEREIKT kent drie uitkomsten, en onbepaald is er een van', () => {
  const basis = ['apiSpoor', 'fluister'];
  const w = (veranderd) => ({ id: 'x', lijf: { pakte: true, antwoord: 'ja' }, schakels: [], veranderd });

  assert.strictEqual(M.lagen(w(['orders']), basis).EFFECT_BEREIKT, true,
    'een collectie BUITEN de basislijn is bewezen effect');
  assert.strictEqual(M.lagen(w([]), basis).EFFECT_BEREIKT, false,
    'er veranderde niets: dat is bewezen GEEN effect');
  assert.strictEqual(M.lagen(w(['fluister']), basis).EFFECT_BEREIKT, null,
    'alleen een collectie UIT de basislijn -- `fluister` draagt het gespreksgeheugen en de weetjes ' +
    'samen, dus hier hoort onbepaald en niet `false`; dat laatste is een bewering in het voordeel van het huis');
  assert.strictEqual(M.lagen(w(null), basis).EFFECT_BEREIKT, null,
    'niet waargenomen is ook onbepaald');
});

/* MUTATIE GEZIEN ZAKKEN: de `null`-tak vervangen door `false`; deze toets zakte
   op de derde bewering, met de reden erbij. */
test('een onbepaald effect telt nooit als bewezen', () => {
  const basis = ['fluister'];
  const l = M.lagen({ id: 'x', lijf: { pakte: true, antwoord: 'a' }, schakels: [], veranderd: ['fluister'] }, basis);
  assert.notStrictEqual(l.EFFECT_BEREIKT, true);
  assert.notStrictEqual(l.EFFECT_BEREIKT, false);
  assert.match(M.SLEUTEL(l), /EFFECT_BEREIKT=\?/, 'de sleutel moet onbepaald als `?` dragen en niet als `n`');
});

/* ---- het verschil dat de meter moet kunnen zien -------------------------- */

test('twee uitkomsten met een ander niveau krijgen een andere sleutel', () => {
  const basis = [];
  const praat = M.lagen({ id: 'a', lijf: { pakte: true, antwoord: 'tekst' }, schakels: [], veranderd: [] }, basis);
  const doet = M.lagen({ id: 'b', lijf: { pakte: true, antwoord: 'tekst', gedaan: true }, schakels: [], veranderd: ['orders'] }, basis);
  assert.notStrictEqual(M.SLEUTEL(praat), M.SLEUTEL(doet),
    'een instrument dat praten en doen dezelfde sleutel geeft, meet het tegenovergestelde van wat het moet meten');
});

test('de telling groepeert alleen waarnemingen MET pakte', () => {
  const basis = { t: [] };
  const t = M.tel([
    { id: 'a', stand: 't', plek: 'p', lijf: { pakte: true, antwoord: 'x' }, schakels: [], veranderd: [] },
    { id: 'b', stand: 't', plek: 'p', lijf: { pakte: false, antwoord: 'x' }, schakels: [], veranderd: [] }
  ], basis);
  assert.strictEqual(t.waarnemingenMetPakte, 1, 'een `pakte: false` hoort niet in de telling van pakte-betekenissen');
  assert.strictEqual(t.onderscheiden, 1);
});

/* ---- het corpus dekt de schrijfplekken ----------------------------------- */

test('elk geval noemt de schrijfplek die het raakt', () => {
  for (const c of M.CORPUS) {
    assert.ok(c.plek && c.plek.length > 10,
      'geval "' + c.id + '" noemt geen schrijfplek; dan is het corpus een steekproef die je voor een inventaris aanziet');
    assert.ok(c.zin && c.zin.trim(), 'geval "' + c.id + '" heeft geen zin');
  }
  const ids = M.CORPUS.map(c => c.id);
  for (const nodig of ['ijk0', 'ijk', 'onthoud', 'bestellen', 'bevestig'])
    assert.ok(ids.includes(nodig), 'het corpus mist "' + nodig + '"');
  assert.ok(ids.indexOf('bestellen') < ids.indexOf('bevestig'),
    '`ja` bevestigt wat `bestel` klaarzette; omgedraaid meet je iets anders');
  assert.ok(ids.indexOf('ijk0') < ids.indexOf('ijk'),
    'de eerste ijkzin zet de basislijn, de tweede meet pas wat een kaal antwoord raakt');
});

/* ---- de ronde verandert niets aan productie ------------------------------ */

test('de ronde meet met stand 2, want stand 1 ziet een wijziging BINNEN een rij niet', () => {
  const ruw = fs.readFileSync(path.join(WORTEL, 'scripts/lib/pakteronde.js'), 'utf8');
  assert.match(ruw, /RTG_STAATLOG: '2'/,
    'met stand 1 geeft de kop alleen lengtes, en dan is "de weetjes veranderden" onzichtbaar');
});

test('het verschil tussen twee standen gaat op NAAM en niet op een getal', () => {
  assert.deepStrictEqual(R.verschil({ a: '1:x', b: '2:y' }, { a: '1:x', b: '3:z', c: '1:q' }), ['b', 'c']);
  assert.deepStrictEqual(R.verschil({ a: '1:x' }, { a: '1:x' }), []);
  assert.strictEqual(R.ontleedStaat(null), null, 'een ontbrekende kop is niet hetzelfde als een lege stand');
});

/* ---- de ratel: het BEREIK van de meter, niet de uitslag ------------------ */

/* Zelfde besluit als bij KETENBEREIK.json en CARRIEREVORM.json: de uitslag HOORT
   te bewegen zodra `pakte` wordt gesplitst -- dat is de bedoeling. Wat maar een
   kant op mag is hoeveel de meter kan ZIEN. */
test('PAKTEBETEKENIS.json bestaat en de meter zag alle standen en gevallen', () => {
  assert.ok(fs.existsSync(REGISTER),
    'PAKTEBETEKENIS.json ontbreekt. Draai `npm run paktebetekenis:vast`; een ratel zonder register staat altijd groen');
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));

  const standen = [...new Set(j.waarnemingen.map(w => w.stand))];
  assert.ok(standen.length >= 2,
    'de meter zag ' + standen.length + ' stand(en); met minder dan twee is het verschil met en zonder model niet te zien');
  assert.ok(j.waarnemingen.length >= M.CORPUS.length * standen.length,
    'niet elk geval is in elke stand gemeten: ' + j.waarnemingen.length + ' waarnemingen');

  for (const w of j.waarnemingen)
    assert.strictEqual(w.status, 200, 'geval "' + w.id + '" in stand "' + w.stand + '" gaf ' + w.status +
      '; een zin die niet eens door de route komt, meet niets over `pakte`');

  assert.ok(Object.values(j.basislijn).every(b => Array.isArray(b) && b.length),
    'de basislijn is leeg; dan is elke collectiewijziging ten onrechte "effect"');
  assert.ok(j.grens && j.grens.length > 200, 'het register draagt geen uitgeschreven grens');
});
