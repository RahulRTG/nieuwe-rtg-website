/* DE MIGRATIE NAAR HET BEARERCODE-ZEGEL, WEERBAAR GEMAAKT VOOR DE UITROL
   (server/kern/bearercode-migratie.js en scripts/bearercode-herseal.js).

   Drie voorwaarden van de eigenaar voor productie: (1+3) geen onbedoelde
   sleutelwissel -- de migratie schrijft alleen met een expliciet gezette
   RTG_BEARER_RING, nooit met de van RTG_SECRET_KEY afgeleide terugval; (3)
   het rapport zegt WELKE records opnieuw uitgegeven moeten worden, zonder
   geheimen; (6) een controle na de migratie bevestigt dat er niets meer te
   doen is en dat geen dood record een geldig zegel draagt.

   Wat hier niet mag sneuvelen:
   1. twee keer migreren is een keer migreren: de tweede ronde zegelt niets
      en de zegels blijven dezelfde;
   2. een uitval halverwege (collectie A geschreven, B niet) wordt door
      opnieuw draaien afgemaakt, en A blijft ongemoeid;
   3. verlopen en ingetrokken records worden nooit gezegeld en staan niet in
      de opnieuw-uitgeven-lijst; `controleer` slaat uit zodra er toch een
      geldig zegel op staat, en ook als er nog iets te migreren is;
   4. een gemanipuleerd record blijft dicht en staat in de lijst;
   5. --uitvoeren zonder RTG_BEARER_RING weigert met 65 en schrijft niets;
      de proef noemt de kid; er staat nooit sleutelmateriaal in de uitvoer;
   6. de lijst bevat nooit code_hash, contracthash of een andere zegelwaarde,
      ook niet als de collectie op code_hash is geindexeerd.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in herzegel() `t.ingetrokken_at ||` weggehaald
     -> "3. dode records" en "5." ZAKKEN: het ingetrokken record werd
     gezegeld (RAAK)
   - in het script de weigering `if (uitvoeren && !expliciet)` uitgezet
     -> "5. geen onbedoelde sleutelwissel" ZAKT: exit 0 en db.json
     herschreven met de afgeleide sleutel (RAAK)
   - in regel() altijd `wortel + pad`, en toonbaar() altijd true
     -> "6. geen geheimen" ZAKT: de code_hash stond in het pad (RAAK)
   - in controleer() de afwijking voor een dood record met zegel weggehaald
     -> "3. dode records" en "5." ZAKKEN: de controle gaf exit 0 (RAAK)
   - in migreer() de bewerker op een kopie laten werken
     -> "2. uitval halverwege" en "5." ZAKKEN: niets werd geschreven (RAAK)

   Alle gegevens zijn synthetisch en staan in een mkdtemp-map; sleutels maakt
   deze toets zelf in het geheugen.

   Draai: node --test test/bearercode-migratie-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const maakLaag = require('../server/kern/bearercode');
const { kaleHash, maakContractzegel } = require('../server/kern/bearercode-zegel');
const { metLijst, controleer } = require('../server/kern/bearercode-migratie');
const { migreer } = require('../scripts/bearercode-herseal');
const bewerker = require('../server/db/collectie-bewerken');

const DAG = 86400000;
const NS = 'pay.kascode';                         // staat in de kandidatenlijst van het script
const nu = () => new Date().toISOString();
const SLEUTEL = crypto.randomBytes(32);
const RING = { actief: 'k1', sleutels: new Map([['k1', SLEUTEL]]) };
const opties = extra => Object.assign({ crypto, namespaces: ['iets-anders', NS], sleutelring: RING, nu }, extra);
const laag = maakLaag({ crypto, namespace: NS, nu, sleutelring: () => RING });
const basis = { prefix: 'H', issuer: 'zaak:H', doel: 'deur', scope: ['openen'],
  geldigheid: { duurMs: 7 * DAG }, gebruik: { max: 3 }, afgeleid: 'geen' };
const verwacht = { doel: 'deur', scope: ['openen'] };
let volgnummer = 0;
/* Een record zoals het voor het zegel werd uitgegeven: kale sha256, geen kid. */
function oud(extra = {}) {
  const t = Object.assign(laag.maak(basis).toegang, { id: 'r' + (volgnummer += 1) }, extra);
  delete t.contractkid;
  t.contracthash = kaleHash(crypto, NS, t);
  return t;
}
const kopie = x => JSON.parse(JSON.stringify(x));
const geheimen = data => { const g = []; JSON.stringify(data, (k, v) => {
  if (['code_hash', 'contracthash', 'bron_toegang'].includes(k) && typeof v === 'string') g.push(v); return v; }); return g; };

test('1. herhaalbaar: de tweede ronde zegelt niets en verandert niets', () => {
  const data = { a: [oud(), oud(), oud()] };
  assert.equal(metLijst(data, opties()).gemigreerd, 3);
  const na = kopie(data);
  const tweede = metLijst(data, opties());
  assert.equal(tweede.gemigreerd, 0);
  assert.equal(tweede.inOrde, 3);
  assert.deepEqual(data, na, 'dezelfde zegels');
  for (const t of data.a) assert.equal(laag.reden(t, verwacht), null);
});

test('2. uitval halverwege: opnieuw draaien maakt B af en laat A ongemoeid', async () => {
  const db = { writable: true, data: { A: { codes: [oud(), oud()] }, B: { codes: [oud()] } } };
  let crash = true;
  const save = () => { if (crash && db.data.B.codes[0].contractkid) throw new Error('stroom weg'); };
  const opslag = { db, bewerkCollectie: bewerker({ store: 'json', db, save }) };
  await assert.rejects(migreer({ opslag, opties: opties(), uitvoeren: true }), /stroom weg/);
  assert.equal(db.data.A.codes[0].contractkid, 'k1', 'A is geschreven');
  assert.equal(db.data.B.codes[0].contractkid, undefined, 'B niet, en ook niet half');
  const A = kopie(db.data.A);
  crash = false;
  const rapport = await migreer({ opslag, opties: opties(), uitvoeren: true });
  assert.equal(rapport.collecties.A.gemigreerd, 0);
  assert.equal(rapport.collecties.A.inOrde, 2);
  assert.equal(rapport.collecties.B.gemigreerd, 1);
  assert.deepEqual(db.data.A, A, 'A ongemoeid');
  assert.equal(laag.reden(db.data.B.codes[0], verwacht), null);
});

test('3. dode records: nooit gezegeld, en controleer slaat uit als er toch een zegel op staat', () => {
  const verlopen = oud({ expires_at: new Date(Date.now() - DAG).toISOString() });
  const ingetrokken = oud({ ingetrokken_at: nu() });
  const data = { codes: [oud(), verlopen, ingetrokken] };
  assert.deepEqual(controleer(data, opties()).afwijkingen, ['1 record(s) nog te migreren']);
  const r = metLijst(data, opties({ wortel: 'kas' }));
  assert.equal(r.gemigreerd, 1);
  assert.equal(r.nietLevend, 2);
  assert.equal(verlopen.contractkid, undefined);
  assert.equal(ingetrokken.contractkid, undefined);
  assert.deepEqual(r.opnieuwUitgeven, [], 'een dood record hoeft niet opnieuw uitgegeven');
  assert.deepEqual(controleer(data, opties()).afwijkingen, []);

  Object.assign(ingetrokken, maakContractzegel({ crypto, ns: NS, sleutelring: RING }).zegel(ingetrokken));
  const c = controleer(data, opties({ wortel: 'kas' }));
  assert.equal(c.afwijkingen.length, 1);
  assert.deepEqual(c.doodMetZegel.map(x => x.pad), ['kas.codes[2]']);
  /* Ingetrokken NA het migratiemoment, of uitgegeven nadat het zegel live ging: normaal. */
  assert.deepEqual(controleer(data, opties({ moment: new Date(Date.now() - 60000).toISOString() })).afwijkingen, []);
  assert.deepEqual(controleer(data, opties({ zegelSinds: new Date(Date.now() - DAG).toISOString() })).afwijkingen, []);
});

test('4. een gemanipuleerd record blijft dicht en staat in de lijst', () => {
  const kaal = oud(); kaal.max_gebruik = 9999;            // niet herrekend
  const echt = oud();
  const gezegeld = laag.maak(basis).toegang; gezegeld.scope = ['openen', 'beheren'];
  const data = { leden: [{ toegang: [kaal] }, { toegang: [echt, gezegeld] }] };
  const r = metLijst(data, opties({ wortel: 'kas' }));
  assert.equal(r.gemigreerd, 1);
  assert.equal(laag.reden(kaal, verwacht), 'ongezegeld');
  assert.equal(laag.reden(gezegeld, verwacht), 'gemanipuleerd');
  assert.deepEqual(r.opnieuwUitgeven.map(x => [x.reden, x.pad, x.id]), [
    ['kaleHashKloptNiet', 'kas.leden[0].toegang[0]', kaal.id],
    ['gemanipuleerd', 'kas.leden[1].toegang[1]', undefined]]);
  const kapot = () => Object.assign(oud(), { scope: ['breder'] });
  const begrensd = metLijst({ x: [kapot(), kapot(), kapot()] }, opties({ max: 2 }));
  assert.equal(begrensd.opnieuwUitgeven.length, 2);
  assert.equal(begrensd.nietInLijst, 1);
});

function draai(map, env, ...args) {
  const schoon = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
    !/^(RTG_|DATABASE_URL|PG_URL|REDIS_URL|NODE_ENV)/.test(k)));
  const u = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'bearercode-herseal.js'), ...args],
    { env: Object.assign(schoon, { RTG_DATA_DIR: map, RTG_STORE: 'json' }, env), encoding: 'utf8', timeout: 60000 });
  return { code: u.status, uit: u.stdout + u.stderr, rapport: u.status === 0 || args.includes('--controleer') ? JSON.parse(u.stdout || '{}') : null };
}

test('5. geen onbedoelde sleutelwissel, en geen sleutel in de uitvoer', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herseal-'));
  try {
    const geheim = crypto.randomBytes(32).toString('hex');
    const afgeleid = require('../server/kern/bearercode-sleutelring').uitGeheim(Buffer.from(geheim, 'hex'));
    const dood = oud({ ingetrokken_at: nu() });
    fs.writeFileSync(path.join(map, 'db.json'), JSON.stringify({ kas: { codes: [oud(), dood] } }));
    const voor = fs.readFileSync(path.join(map, 'db.json'));
    const zonder = { RTG_SECRET_KEY: geheim };
    const bevestig = '--bevestig=HERZEGEL-BEARERCODE-V2';

    const weiger = draai(map, zonder, '--uitvoeren', bevestig);
    assert.equal(weiger.code, 65, weiger.uit);
    assert.match(weiger.uit, /RTG_BEARER_RING is niet gezet/);
    assert.ok(fs.readFileSync(path.join(map, 'db.json')).equals(voor), 'er is niets geschreven');
    const proef = draai(map, zonder);
    assert.equal(proef.code, 0, proef.uit);
    assert.equal(proef.rapport.kid, afgeleid.kid);
    assert.match(proef.rapport.schrijven, /geweigerd/);
    assert.equal(proef.rapport.collecties.kas.gemigreerd, 1);

    const ringHex = SLEUTEL.toString('hex');
    const met = { RTG_SECRET_KEY: geheim, RTG_BEARER_RING: 'k1:' + ringHex };
    const uit = [weiger, proef, draai(map, met, '--uitvoeren', bevestig)];
    assert.equal(uit[2].code, 0, uit[2].uit);
    assert.equal(uit[2].rapport.collecties.kas.gemigreerd, 1);
    uit.push(draai(map, met, '--controleer'));
    assert.equal(uit[3].code, 0, uit[3].uit);
    assert.equal(uit[3].rapport.collecties.kas.inOrde, 1);

    const data = JSON.parse(fs.readFileSync(path.join(map, 'db.json'), 'utf8'));
    Object.assign(data.kas.codes[1], maakContractzegel({ crypto, ns: NS, sleutelring: RING }).zegel(data.kas.codes[1]));
    fs.writeFileSync(path.join(map, 'db.json'), JSON.stringify(data));
    uit.push(draai(map, met, '--controleer'));
    assert.equal(uit[4].code, 1, uit[4].uit);
    assert.deepEqual(uit[4].rapport.collecties.kas.doodMetZegel.map(x => x.pad), ['kas.codes[1]']);
    for (const u of uit) for (const s of [geheim, ringHex, afgeleid.sleutel.toString('hex')]) assert.ok(!u.uit.includes(s), 'geen sleutel in de uitvoer');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('6. de lijst bevat nooit een code_hash of zegelwaarde', () => {
  const kapot = oud(); kapot.doel = 'kluis';
  const gezegeld = laag.maak(basis).toegang; gezegeld.max_gebruik = 50;
  const hexId = oud({ id: crypto.randomBytes(20).toString('hex') }); hexId.scope = ['x'];
  const data = { [kapot.code_hash]: kapot, [gezegeld.contracthash]: gezegeld, lijst: [hexId] };
  const g = geheimen(data);
  const r = metLijst(data, opties({ wortel: 'kas' }));
  assert.equal(r.opnieuwUitgeven.length, 3);
  assert.deepEqual(r.opnieuwUitgeven.map(x => x.pad), ['kas[#0]', 'kas[#1]', 'kas.lijst[0]']);
  assert.equal(r.opnieuwUitgeven[2].id, undefined, 'een id dat op een hash lijkt valt weg');
  const tekst = JSON.stringify(r);
  for (const s of g) assert.ok(!tekst.includes(s), 'geen geheim in het rapport');
  assert.ok(!/code_hash|contracthash/.test(tekst));
});
