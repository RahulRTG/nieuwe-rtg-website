/* DE BUSINESS PROOF MAP: kan hij zakken?

   ONDERNEMERBEWIJS.json is een PROJECTIE over zeven bestaande registers. Zo'n
   kaart heeft een eigen faalvorm die je niet ziet: hij blijft groen omdat hij
   niets leest. Vandaag staat er nergens ROOD, en dat is precies de toestand
   waarin een kapotte meter er goed uitziet (LAT-regel 11 -- een toets die je
   niet hebt zien zakken is geen toets).

   Dit bestand voert de projectie daarom uit op GEMUTEERDE registers, in een
   tijdelijke map, en eist dat de uitslag meebeweegt. Vier tegenproeven:

     1. een gezakte rechtenmeting maakt haar capability GEBLOKKEERD
     2. een geschorst bewijs doet hetzelfde via een andere laag
     3. een ontbrekende bron laat het script ZAKKEN en niet stil doorlopen
     4. de twaalf lagen dragen allemaal een bron of een uitgeschreven reden

   Draai los: node --test test/ondernemerbewijs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const BRONNEN = ['VERTROUWEN.json', 'AUDITPROEF.json', 'ROLPROEF.json', 'IDEMPROEF.json',
                 'HERSTELPROEF.json', 'APPWERKT.json', 'EXECUTION_MAP.json', 'IDOR.json',
                 'TAFELPROEF.json', 'RITPROEF.json', 'TOELATINGSPROEF.json'];

/* Een wegwerpmap met kopieen van de registers. De mutatie gebeurt daar, nooit
   in de repo -- een toets die het ingecheckte register aanraakt, laat een
   spoor achter dat de volgende meting als echt leest. */
function wereld(muteer) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'ondernemerbewijs-'));
  for (const b of BRONNEN) {
    const bron = path.join(WORTEL, b);
    if (fs.existsSync(bron)) fs.copyFileSync(bron, path.join(map, b));
  }
  if (muteer) muteer(map);
  execFileSync(process.execPath, [path.join(WORTEL, 'scripts/ondernemerbewijs.js'), '--vastleggen'],
    { env: { ...process.env, RTG_BEWIJS_BRON: map, RTG_BEWIJS_DOEL: map }, stdio: 'pipe' });
  const uit = JSON.parse(fs.readFileSync(path.join(map, 'ONDERNEMERBEWIJS.json'), 'utf8'));
  fs.rmSync(map, { recursive: true, force: true });
  return uit;
}
function pas(map, bestand, fn) {
  const p = path.join(map, bestand);
  const a = JSON.parse(fs.readFileSync(p, 'utf8'));
  fn(a);
  fs.writeFileSync(p, JSON.stringify(a));
}
const cap = (uit, id) => uit.capabilities.find(c => c.id === id);

test('0. de ongemuteerde kaart staat en kent de kassa', () => {
  const uit = wereld(null);
  assert.ok(uit.capabilities.length > 100, 'te weinig capabilities gevonden');
  const pos = cap(uit, 'supplier-pos');
  assert.ok(pos, 'de capability supplier-pos (Kassa) hoort in de kaart te staan');
  assert.equal(pos.stand, 'ONBEWEZEN');
});

test('1. een gezakte rechtenmeting maakt haar capability GEBLOKKEERD', () => {
  const uit = wereld(map => pas(map, 'ROLPROEF.json', a => {
    for (const r of Object.values(a.perRoute)) if (r.pad && r.pad.startsWith('/api/supplier/pos')) r.acl = 'open';
  }));
  const pos = cap(uit, 'supplier-pos');
  assert.equal(pos.stand, 'GEBLOKKEERD', 'een open ACL hoort de capability te blokkeren');
  assert.equal(pos.lagen.bevoegd.stand, 'ROOD');
  assert.match(pos.lagen.bevoegd.reden, /zakt op \d+ route/);
  assert.equal(uit.telling.geblokkeerd, 1);
});

test('2. een geschorst bewijs blokkeert via de laag autonoomVeilig', () => {
  const uit = wereld(map => pas(map, 'VERTROUWEN.json', a => {
    for (const k of Object.keys(a.perRoute))
      if (k.includes('/api/supplier/pos')) a.perRoute[k].staat = 'geschorst';
  }));
  const pos = cap(uit, 'supplier-pos');
  assert.equal(pos.lagen.autonoomVeilig.stand, 'ROOD');
  assert.equal(pos.stand, 'GEBLOKKEERD');
});

test('3. een ontbrekende bron laat het script zakken in plaats van stil groen', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'ondernemerbewijs-leeg-'));
  for (const b of BRONNEN) {
    if (b === 'ROLPROEF.json') continue; // met opzet weggelaten
    const bron = path.join(WORTEL, b);
    if (fs.existsSync(bron)) fs.copyFileSync(bron, path.join(map, b));
  }
  assert.throws(() => execFileSync(process.execPath, [path.join(WORTEL, 'scripts/ondernemerbewijs.js')],
    { env: { ...process.env, RTG_BEWIJS_BRON: map }, stdio: 'pipe' }),
    'een ontbrekend register hoort het script te laten zakken (lat-regel 3)');
  fs.rmSync(map, { recursive: true, force: true });
});

test('4. elke laag draagt een bron of een uitgeschreven reden waarom niet', () => {
  const uit = wereld(null);
  assert.equal(uit.lagen.length, 12, 'de norm telt twaalf lagen');
  for (const l of uit.lagen) {
    if (!l.bron) assert.ok(l.reden && l.reden.length > 40,
      'laag ' + l.id + ' heeft geen bron en hoort dan uit te leggen waarom niet');
    assert.ok(l.graad, 'laag ' + l.id + ' draagt geen bewijsgraad');
  }
});

test('5. VERKOOPBAAR 0 staat er met de reden, niet als kale nul', () => {
  const uit = wereld(null);
  assert.equal(uit.telling.verkoopbaar, 0);
  const o = uit.standenStructureelOnbereikbaar;
  assert.ok(o && o.lagen.length > 0,
    'als er nul verkoopbare capabilities zijn, hoort erbij te staan welke lagen dat structureel onmogelijk maken');
  assert.match(o.let, /niet meetbaar|niet doordat de software zakt/);
});

test('6. de ketens tellen alleen als hun proef werkelijk sluit', () => {
  /* De ketenproeven zetten hun cijfers in `telling`, niet in `gemeten` -- deze
     toets heeft dat verschil gevonden toen de projectie `sluit` toekende op een
     leeg object. Hij muteert daarom precies het veld dat de projectie leest. */
  const uit = wereld(map => pas(map, 'RITPROEF.json', a => { a.telling.open = 1; a.telling.gesloten -= 1; }));
  const rit = uit.ketens.lijst.find(k => k.id === 'rit');
  assert.equal(rit.dekt, 'geen', 'een keten met een open schakel dekt niets');
  assert.ok(uit.ketens.telling.sluit < 2);
});

test('7. een ketenproef zonder leesbare telling dekt niets', () => {
  const uit = wereld(map => pas(map, 'TOELATINGSPROEF.json', a => { delete a.telling; delete a.gemeten; }));
  const t = uit.ketens.lijst.find(k => k.id === 'toelating');
  assert.equal(t.dekt, 'geen', 'zonder telling is er niets om op te sluiten');
  assert.match(t.bewijs.let, /geen leesbare schakeltelling/);
});

test('8. een sluitende keten draagt de datum waarop hij gemeten is', () => {
  const uit = wereld(null);
  for (const k of uit.ketens.lijst.filter(x => x.dekt !== 'geen'))
    assert.match(String(k.bewijs.stempel), /^\d{4}-\d{2}-\d{2}$/,
      'keten ' + k.id + ' sluit maar zegt niet wanneer dat gemeten is');
});
