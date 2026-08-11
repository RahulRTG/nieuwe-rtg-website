/* DE TWEE POORTEN VAN HET SPELDOMEIN.

   Elke spelactie hangt onder twee routes: `/api/member/spel/<actie>` met een
   Bearer-token, en `/api/rtf/spel/<actie>` met een gezinscode plus profieltoken
   (server/routes/spellen.js). De ACTIE erachter is voor allebei dezelfde
   functie; wat verschilt is de identiteitsbepaling, en dat is precies het stuk
   dat je niet ziet als je alleen de spelregels toetst.

   Die poorten werden tot nu toe per toeval geraakt: een handvol acties kwam in
   een toets voorbij, de rest niet -- terwijl het om DEZELFDE twee wachters gaat
   en een nieuwe actie er stilzwijgend onder valt. Deze toets loopt ze allemaal
   langs, met een verzonnen sessie, en eist dat er niets doorheen komt.

   DE ACTIES STAAN VOLUIT en niet als lus over een tabel uit de bron. Dat is
   geen omhaal maar het punt: zo merkt wie een actie TOEVOEGT dat hij hem hier
   niet heeft bijgezet (de tweede toets houdt de lijst tegen de bron), en zo kan
   de dekkingsmeter -- die letterlijke paden in de toetstekst zoekt -- zien dat
   deze routes geraakt worden.

   Draai los: node --experimental-sqlite --test test/spelpoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spelpoort-'));
test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const LEDEN_SPELACTIES = [
  '/api/member/spel/nieuw', '/api/member/spel/antwoord', '/api/member/spel/random', '/api/member/spel/mijn',
  '/api/member/spel/staat', '/api/member/spel/zet', '/api/member/spel/opgeven', '/api/member/spel/toewijzen', '/api/member/spel/replay', '/api/member/spel/nabespreking', '/api/member/spel/naspelen', '/api/member/spel/projectie-open', '/api/member/spel/projectie-sluit',
  '/api/member/spel/kijk', '/api/member/spel/rahul', '/api/member/spel/klasgenoten', '/api/member/spel/online',
  '/api/member/spel/uitslagen', '/api/member/spel/stand', '/api/member/spel/prestaties',
  '/api/member/spel/toernooi-nieuw', '/api/member/spel/toernooi-antwoord', '/api/member/spel/toernooi-mijn',
  '/api/member/spel/toernooi-staat', '/api/member/spel/zichtbaar', '/api/member/spel/zichtbaar-zet',
  '/api/member/spel/sneek-score', '/api/member/spel/sneek-bord',
  '/api/member/spel/team-nieuw', '/api/member/spel/team-nodig', '/api/member/spel/team-antwoord',
  '/api/member/spel/team-verlaat', '/api/member/spel/team-mijn',
  '/api/member/spel/praat', '/api/member/spel/praat-stuur',
  '/api/member/spel/sudoku-nieuw', '/api/member/spel/sudoku-klaar',
  '/api/member/spel/arcade-score', '/api/member/spel/arcade-bord'
];

test('elke ledeningang van het speldomein vraagt een token', async () => {
  const uit = [];
  for (const pad of LEDEN_SPELACTIES) {
    const r = await fetch(BASE + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'x', soort: 'schaak', naam: 'x', spel: 'tetris', punten: 1 })
    });
    uit.push(r.status === 401 ? pad : pad + ' -> ' + r.status);
  }
  assert.deepEqual(uit, LEDEN_SPELACTIES, 'elke ingang hoort 401 te geven zonder token');
});

const RTF_SPELACTIES = [
  '/api/rtf/spel/nieuw', '/api/rtf/spel/antwoord', '/api/rtf/spel/random', '/api/rtf/spel/mijn',
  '/api/rtf/spel/staat', '/api/rtf/spel/zet', '/api/rtf/spel/opgeven', '/api/rtf/spel/toewijzen', '/api/rtf/spel/replay', '/api/rtf/spel/nabespreking', '/api/rtf/spel/naspelen', '/api/rtf/spel/projectie-open', '/api/rtf/spel/projectie-sluit',
  '/api/rtf/spel/kijk', '/api/rtf/spel/rahul', '/api/rtf/spel/klasgenoten', '/api/rtf/spel/online',
  '/api/rtf/spel/uitslagen', '/api/rtf/spel/stand', '/api/rtf/spel/prestaties',
  '/api/rtf/spel/toernooi-nieuw', '/api/rtf/spel/toernooi-antwoord', '/api/rtf/spel/toernooi-mijn',
  '/api/rtf/spel/toernooi-staat', '/api/rtf/spel/zichtbaar', '/api/rtf/spel/zichtbaar-zet',
  '/api/rtf/spel/sneek-score', '/api/rtf/spel/sneek-bord',
  '/api/rtf/spel/team-nieuw', '/api/rtf/spel/team-nodig', '/api/rtf/spel/team-antwoord',
  '/api/rtf/spel/team-verlaat', '/api/rtf/spel/team-mijn',
  '/api/rtf/spel/praat', '/api/rtf/spel/praat-stuur',
  '/api/rtf/spel/sudoku-nieuw', '/api/rtf/spel/sudoku-klaar',
  '/api/rtf/spel/arcade-score', '/api/rtf/spel/arcade-bord'
];

test('elke RTF-spelingang weigert een verzonnen gezinssessie', async () => {
  const geweigerd = [];
  for (const pad of RTF_SPELACTIES) {
    const r = await fetch(BASE + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BESTAATNIET', token: 'ook-niet', id: 'x', soort: 'dam', naam: 'x' })
    });
    if (r.status === 403) geweigerd.push(pad);
    else geweigerd.push(pad + ' -> ' + r.status);
  }
  assert.deepEqual(geweigerd, RTF_SPELACTIES,
    'elke ingang hoort 403 te geven op een sessie die niet bestaat');
});

test('de lijst met RTF-spelingangen loopt niet achter op de server', async () => {
  /* Een nieuwe actie komt er via de tabel vanzelf bij, en zou dan stil buiten
     de toets hierboven vallen. Deze toets leest de tabellen uit de bron en houdt
     ze tegen de lijst.

     TWEE bestanden sinds de tabel gesplitst is (routes/spellen.js en
     routes/spellen-rondom.js): een actie die in het tweede bestand belandt en
     hier niet gelezen wordt, zou ongemerkt buiten de poorttoets vallen -- en
     dat is precies wat deze toets moet uitsluiten. */
  const lees = (bestand, van, tot) => {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', bestand), 'utf8');
    const blok = bron.slice(bron.indexOf(van), tot ? bron.indexOf(tot) : undefined);
    return [...blok.matchAll(/^\s{4}'?([a-z][a-z0-9-]*)'?\s*:\s*\(/gm)].map(m => m[1]);
  };
  const namen = lees('spellen.js', 'const ACTIES = {', 'async function veilig')
    .concat(lees('spellen-rondom.js', '  return {', null));
  assert.ok(namen.length > 20, 'de acties zijn uit de bron gelezen: ' + namen.length);
  assert.deepEqual(namen.map(n => '/api/rtf/spel/' + n).sort(), RTF_SPELACTIES.slice().sort(),
    'er is een spelactie bijgekomen of verdwenen; zet hem ook in RTF_SPELACTIES hierboven');
  assert.deepEqual(namen.map(n => '/api/member/spel/' + n).sort(), LEDEN_SPELACTIES.slice().sort(),
    'idem voor LEDEN_SPELACTIES');
});
