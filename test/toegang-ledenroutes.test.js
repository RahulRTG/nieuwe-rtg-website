/* ROUTES DIE "OPENBAAR" HETEN TERWIJL ALLEEN EEN INGELOGD SCHERM ZE AANROEPT
   (eigenaarsbesluit 19 oktober 2026, AGENTS.md: gebruiken vraagt een account).

   Gevonden door de bevoegdheidsmeting: de app-gids, de krant, de publieke
   pushsleutel, de rechtsvormentabel en de projectiedeur gingen open zonder
   sessie. Geen ervan hoort bij de landing of de inlog, dus ze vallen onder
   geen uitzondering. Wat hier vastligt:

     - zonder sessie: 401;
     - de app-gids en de pushsleutel horen bij ELK ingelogd scherm (lid, zaak,
       kantoor, gezinsprofiel), dus een zaaksessie komt erdoor;
     - de krant en de rechtsvormen vragen een ledenaccount;
     - de projectie (het tv-scherm) valt onder uitzondering 6: hij koppelt met
       de eenmalige code van een ingelogd lid, en zonder geldige code komt hij
       er niet in;
     - /api/ice gaf al 401 zonder sessie (alleen de openbare STUN-lijst), en
       dat blijft zo. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-ledenroutes-'));
const vraag = (methode, pad, body, token) => fetch(BASE + pad, {
  method: methode, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  ...(methode === 'GET' ? {} : { body: JSON.stringify(body || {}) })
}).then(r => r.status);

const LEDEN = [['POST', '/api/krant/gids', {}], ['POST', '/api/krant/open', { code: 'ONBEKEND' }],
  ['POST', '/api/krant/artikel', { code: 'ONBEKEND', id: 'x' }], ['GET', '/api/onderneming/rechtsvormen']];
const ELKE = [['POST', '/api/gids/app', { pad: '/apps/app.html' }], ['GET', '/api/push/key']];

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder sessie 401, met een gratis account door de deur', async () => {
  for (const [m, pad, lijf] of [...LEDEN, ...ELKE, ['POST', '/api/ice', {}], ['GET', '/api/ice']])
    assert.equal(await vraag(m, pad, lijf), 401, m + ' ' + pad + ' zonder sessie');
  const lid = await registreerGratis(BASE);
  for (const [m, pad, lijf] of [...LEDEN, ...ELKE])
    assert.notEqual(await vraag(m, pad, lijf, lid.token), 401, m + ' ' + pad + ' met een gratis account');
});

test('de app-gids en de pushsleutel horen ook bij een zaaksessie', async () => {
  const post = (pad, body) => fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const roster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const zaak = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).token;
  assert.ok(zaak, 'de zaak-inlog werkt');
  for (const [m, pad, lijf] of ELKE) assert.equal(await vraag(m, pad, lijf, zaak), 200, m + ' ' + pad + ' met een zaaksessie');
});

test('het tv-scherm: koppelen zonder geldige code wordt geweigerd, en een code maken vraagt een account', async () => {
  for (const code of ['', 'ONBEKEND', 'GAME.' + '0'.repeat(32)]) {
    const st = await vraag('POST', '/api/projectie/koppel', { code });
    assert.ok([400, 404].includes(st), 'koppelen met "' + code + '" gaf ' + st);
  }
  assert.ok([400, 401, 404].includes(await vraag('POST', '/api/projectie/kijk', { token: 'SCREEN.' + '0'.repeat(32) })),
    'een verzonnen schermsessie ziet niets');
  /* De code ontstaat alleen bij een ingelogd lid: projectie-open zonder sessie is 401. */
  assert.equal(await vraag('POST', '/api/member/spel/projectie-open', { id: 'x' }), 401);
});
