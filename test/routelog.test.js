/* ============================================================================
   HET ROUTEJOURNAAL (server/routelog.js) -- de bron onder de waargenomen dekking.

   Waarom dit er is: de dekkingsteller in de keuring zoekt routenamen in de
   TEKST van de tests. Dat cijfer is op te poetsen met een zoek-en-vervang, en
   het telt tegelijk hele suites niet mee die hun routes via een hulpje
   aanroepen. Het journaal vervangt die tekstzoektocht door waarneming: de
   server schrijft zelf op wat hij heeft afgehandeld.

   Een meting die je vertrouwt, hoort zelf ook getoetst te zijn. Deze test
   bewijst de vier eigenschappen waar scripts/dekking.js op leunt:

     1. uit tenzij RTG_ROUTELOG staat (het hoort in de testrun, niet in productie)
     2. het schrijft het PATROON, niet het pad met waarden erin
     3. het overleeft een SIGKILL -- de tests stoppen hun servers zo
     4. een 4xx telt mee: "aangeraakt" is niet hetzelfde als "ging goed"

   Draai los: node --experimental-sqlite --test test/routelog.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-routelog-'));
const routelog = require('../server/routelog');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. zonder RTG_ROUTELOG schrijft het journaal niets', () => {
  routelog.begin(null);
  assert.equal(routelog.aan(), false);
  routelog.noteer('POST', '/api/iets');   // mag geen fout geven en nergens landen
  assert.equal(routelog.lees(path.join(TMP, 'bestaat-niet.log')).size, 0,
    'een ontbrekend journaal leest als leeg, niet als een crash');
});

test('2. elk patroon staat er precies een keer in, ook na duizend aanroepen', () => {
  const f = path.join(TMP, 'dedup.log');
  routelog.begin(f);
  for (let i = 0; i < 1000; i++) routelog.noteer('POST', '/api/leden/:id');
  routelog.noteer('GET', '/api/leden/:id');           // andere methode = eigen regel
  const regels = fs.readFileSync(f, 'utf8').trim().split('\n');
  assert.equal(regels.length, 2, 'duizend aanroepen, twee regels: ' + regels.join(' | '));
  assert.deepEqual([...routelog.lees(f)].sort(), ['GET /api/leden/:id', 'POST /api/leden/:id']);
  routelog.begin(null);
});

test('3. een kapot journaal legt de server nooit stil', () => {
  /* Een map bestaat wel maar is niet te beschrijven als bestand. De append
     faalt dus, en dat mag hooguit het journaal kosten -- nooit het verzoek. */
  routelog.begin(TMP);
  assert.doesNotThrow(() => routelog.noteer('POST', '/api/iets'));
  routelog.begin(null);
});

test('4. een echte server schrijft patronen weg en overleeft een SIGKILL', async () => {
  const f = path.join(TMP, 'server.log');
  fs.writeFileSync(f, '');
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: path.join(TMP, 'data'), RTG_ROUTELOG: f } });
  try {
    // een geslaagd verzoek
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Journaal Lid', email: 'rl' + Date.now() + '@x.nl',
        phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })
    });
    assert.equal(reg.status, 200);
    // en een geweigerd verzoek: dat endpoint is even goed aangeraakt
    const dicht = await fetch(srv.base + '/api/member/rechterhand/cellier', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer onzin' }, body: '{}'
    });
    assert.equal(dicht.status, 401);
  } finally { stop(srv && srv.child); }

  /* Met opzet NA de SIGKILL lezen. Een journaal dat pas bij het afsluiten zou
     wegschrijven, zou hier leeg zijn -- en dan zou de hele dekkingsmeting op
     een lege verzameling draaien zonder dat iemand het merkt. */
  const gezien = routelog.lees(f);
  assert.ok(gezien.has('POST /api/auth/register'), 'geslaagd verzoek genoteerd: ' + [...gezien].join(', '));
  assert.ok(gezien.has('POST /api/member/rechterhand/cellier'), 'een 401 telt ook als aangeraakt');
  assert.ok(!/[?]/.test([...gezien].join(' ')), 'geen querystrings in het journaal');
});

test('5. het journaal noteert het patroon, niet de ingevulde waarde', async () => {
  /* Dit is dezelfde regel als bij de meting: op het pad zou elk lid-id een
     eigen regel worden. Voor de dekking is dat bovendien onbruikbaar, want de
     routekaart kent alleen het patroon. */
  const f = path.join(TMP, 'patroon.log');
  fs.writeFileSync(f, '');
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: path.join(TMP, 'data2'), RTG_ROUTELOG: f } });
  try {
    await fetch(srv.base + '/api/foundation/bord/ZZ99');
    await fetch(srv.base + '/api/foundation/bord/YY11');
  } finally { stop(srv && srv.child); }

  const gezien = [...routelog.lees(f)];
  assert.ok(gezien.includes('GET /api/foundation/bord/:code'),
    'het patroon met :code, met het mount-voorvoegsel erbij: ' + gezien.join(', '));
  assert.equal(gezien.some(r => /ZZ99|YY11/.test(r)), false, 'geen ingevulde waarden');
});
