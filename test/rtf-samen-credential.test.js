'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sessie = (letter, gezin = 'GEZIN-A') => ({
  handle: 'rtf:' + gezin + ':' + letter,
  codenaam: 'Profiel ' + letter,
  g: { code: gezin }
});

function bouw(begin = {}, vrienden = new Set()) {
  const db = { data: { samenRtfKamers: JSON.parse(JSON.stringify(begin)) } };
  let rij = Promise.resolve();
  const bewerkCollectie = (naam, werk) => {
    assert.equal(naam, 'samenRtfKamers');
    const beurt = rij.then(() => {
      const kopie = JSON.parse(JSON.stringify(db.data.samenRtfKamers));
      const r = werk(kopie);
      db.data.samenRtfKamers = kopie;
      return r;
    });
    rij = beurt.then(() => undefined, () => undefined);
    return beurt;
  };
  const zijnVrienden = (a, b) => vrienden.has([a, b].sort().join('|'));
  const samen = require('../server/kern/samenrtf')({ db, save() {},
    bewerkCollectie, crypto, schoon: (v, n) => String(v || '').trim().slice(0, n),
    zijnVrienden }).samenRtf;
  return { db, samen, vrienden };
}

test('Foundation Samen geeft 128 bits eenmaal uit en bewaart alleen lifecycle-hash', async () => {
  const { db, samen } = bouw();
  const a = sessie('ouder');
  const uit = await samen.maak(a, 'rtf-samen-maak-0001');
  assert.match(uit.deelcode, /^RTFSAMEN\.[A-F0-9]{32}$/);
  assert.match(uit.kamer.id, /^rsk[a-f0-9]{32}$/);
  assert.equal(uit.kamer.code, undefined);
  assert.equal(uit.eenmalig, true);
  const opslag = JSON.stringify(db.data.samenRtfKamers);
  assert.equal(opslag.includes(uit.deelcode), false);
  assert.equal(opslag.includes('"gastheerGezin"'), false);
  assert.equal(opslag.includes('"gezin"'), false);
  assert.match(opslag, /"code_hash":"[a-f0-9]{64}"/);
  const t = Object.values(db.data.samenRtfKamers)[0].toegang;
  assert.equal(t.doel, 'foundationos-samen-kamer');
  assert.deepEqual(t.scope, ['rtf.samen.join']);
  assert.equal(t.max_gebruik, 11);

  const retry = await samen.maak(a, 'rtf-samen-maak-0001');
  assert.equal(retry.status, 409);
  assert.equal(retry.deelcode, undefined);
  assert.equal(Object.keys(db.data.samenRtfKamers).length, 1);
});

test('gezinspoort en teller claimen gelijktijdig precies elf plaatsen', async () => {
  const { db, samen } = bouw();
  const host = sessie('host');
  const uit = await samen.maak(host, 'rtf-samen-race-0001');
  const kandidaten = 'BCDEFGHIJKLM'.split('').map(x => sessie(x));
  const race = await Promise.all(kandidaten.map(s =>
    samen.doeMee(s, uit.deelcode)));
  assert.equal(race.filter(r => r.status === 200).length, 11);
  assert.equal(race.filter(r => r.status === 404).length, 1);
  const k = db.data.samenRtfKamers[uit.kamer.id];
  assert.equal(k.leden.length, 12);
  assert.equal(k.toegang.gebruik, 11);
  const winnaar = kandidaten.find(s => k.leden.some(l => l.handle === s.handle));
  const retry = await samen.doeMee(winnaar, uit.deelcode);
  assert.equal(retry.status, 200, 'een verloren succesantwoord kan veilig worden herhaald');
  assert.equal(retry.al, true);
  assert.equal(k.toegang.gebruik, 11);
});

test('vreemd gezin ziet geen codebestaan en ingetrokken vriendschap verliest toegang', async () => {
  const vrienden = new Set();
  const { samen } = bouw({}, vrienden);
  const host = sessie('host'), vreemd = sessie('vreemd', 'GEZIN-B');
  const uit = await samen.maak(host, 'rtf-samen-vriend-0001');
  assert.equal((await samen.doeMee(vreemd, uit.deelcode)).status, 404);
  vrienden.add([host.handle, vreemd.handle].sort().join('|'));
  const mee = await samen.doeMee(vreemd, uit.deelcode);
  assert.equal(mee.status, 200);
  vrienden.clear();
  assert.equal((await samen.staat(vreemd, uit.kamer.id)).status, 404,
    'de oude kamerlidmaatschap omzeilt een ingetrokken vriendschap niet');
  assert.equal((await samen.chat(vreemd, uit.kamer.id, 'mag niet',
    'rtf-samen-vreemd-chat')).status, 404);
});

test('rotatie, sluiting en veilige paden werken uitsluitend op kamer-id', async () => {
  const { db, samen } = bouw();
  const host = sessie('host'), kind = sessie('kind');
  const uit = await samen.maak(host, 'rtf-samen-pad-0001');
  await samen.doeMee(kind, uit.deelcode);
  assert.equal((await samen.zet(host, uit.kamer.id,
    '/apps/foundation/leren.html?token=geheim', 'Leren',
    'rtf-samen-zet-fout')).status, 400);
  assert.equal((await samen.zet(host, uit.kamer.id,
    '/apps/foundation/leren.html', 'Leren', 'rtf-samen-zet-0001')).status, 200);
  const zetRetry = await samen.zet(host, uit.kamer.id,
    '/apps/foundation/leren.html', 'Leren', 'rtf-samen-zet-0001');
  assert.equal(zetRetry.herhaald, true);
  assert.equal((await samen.zet(host, uit.kamer.id,
    '/apps/foundation/leren.html', 'Anders', 'rtf-samen-zet-0001')).status, 409,
    'dezelfde idem-sleutel kan niet aan andere inhoud worden gehangen');
  const chat = await samen.chat(kind, uit.kamer.id, 'Een bericht',
    'rtf-samen-chat-0001');
  assert.equal(chat.status, 200);
  const chatRetry = await samen.chat(kind, uit.kamer.id, 'Een bericht',
    'rtf-samen-chat-0001');
  assert.equal(chatRetry.herhaald, true);
  assert.equal(db.data.samenRtfKamers[uit.kamer.id].chat.length, 1);
  const nieuw = await samen.roteer(host, uit.kamer.id, 'rtf-samen-code-0001');
  assert.match(nieuw.deelcode, /^RTFSAMEN\.[A-F0-9]{32}$/);
  assert.notEqual(nieuw.deelcode, uit.deelcode);
  assert.equal((await samen.doeMee(sessie('laat'), uit.deelcode)).status, 404);
  const retry = await samen.roteer(host, uit.kamer.id, 'rtf-samen-code-0001');
  assert.equal(retry.status, 409);
  assert.equal(retry.deelcode, undefined);
  assert.equal((await samen.sluit(kind, uit.kamer.id)).status, 403);
  assert.equal((await samen.sluit(host, uit.kamer.id)).status, 200);
  assert.ok(db.data.samenRtfKamers[uit.kamer.id].toegang.ingetrokken_at);
  assert.equal((await samen.staat(kind, uit.kamer.id)).status, 404);
  assert.equal((await samen.doeMee(sessie('nieuw'), nieuw.deelcode)).status, 404);
});

test('zwakke legacykamers worden hash-only gemigreerd en hard gesloten', async () => {
  const oud = { ABC234: { code: 'ABC234', gastheer: 'rtf:GEZIN-A:oud',
    gastheerGezin: 'GEZIN-A', gastheerNaam: 'Oud', leden: [
      { handle: 'rtf:GEZIN-A:oud', gezin: 'GEZIN-A', codenaam: 'Oud' }
    ], chat: [], at: Date.now() } };
  const { db, samen } = bouw(oud);
  await samen.ruimOp();
  const tekst = JSON.stringify(db.data.samenRtfKamers);
  assert.equal(tekst.includes('ABC234'), false);
  assert.equal(tekst.includes('"gastheerGezin"'), false);
  assert.match(tekst, /"code_hash":"[a-f0-9]{64}"/);
  const k = Object.values(db.data.samenRtfKamers)[0];
  assert.match(k.id, /^rsk[a-f0-9]{32}$/);
  assert.ok(k.gesloten_at);
  assert.equal((await samen.doeMee(sessie('kind'), 'ABC234')).status, 404);
});

test('Foundation-browser bewaart alleen kamer-id en deelt nooit querycredentials', () => {
  const root = path.join(__dirname, '..');
  const bron = fs.readFileSync(path.join(root,
    'public/apps/foundation/samen/samen-01.js'), 'utf8');
  assert.match(bron, /localStorage\.setItem\(KAMERKEY, id\)/);
  assert.doesNotMatch(bron, /localStorage\.setItem\([^\n]*(?:deel)?[cC]ode/);
  assert.doesNotMatch(bron, /kamer\.code|k\.code|kamercode/);
  assert.doesNotMatch(bron, /location\.pathname\s*\+\s*location\.search/);
  assert.match(bron, /api\('mee', \{ deelcode: c \}\)/);
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  for (const route of ['/api/rtf/samen/maak', '/api/rtf/samen/code'])
    assert.equal(geheim.isEenmalig('POST', route), true);
});

test('startup houdt verkeer dicht tot de autoritatieve Samen-migratie committe', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'server.js'), 'utf8');
  assert.match(bron, /opslagMotorKlaar\(\) && accounts\.postgresKlaar\(\) &&\s*salonMigratieKlaar && rtfSamenMigratieKlaar && boardingPassMigratieKlaar/);
  const dicht = bron.indexOf('rtfSamenMigratieKlaar = false', bron.indexOf('const startPostgresMetSalon'));
  const migratie = bron.indexOf('samenRtf.migreerAlles()', dicht);
  const open = bron.indexOf('rtfSamenMigratieKlaar = true', migratie);
  assert.ok(dicht >= 0 && migratie > dicht && open > migratie,
    'Samen migreert binnen de pre-ready PostgreSQL-fase en opent pas na haar commit');
  const lokaalBegin = bron.lastIndexOf("if (STORE !== 'postgres') {");
  const lokaalEinde = bron.indexOf('\n}\n\n/* DE TWEE SLOTEN', lokaalBegin);
  const lokaal = bron.slice(lokaalBegin, lokaalEinde);
  const rtfMigreer = lokaal.indexOf('kern.samenRtf.migreerAlles()');
  const rtfOpen = lokaal.indexOf('rtfSamenMigratieKlaar = true', rtfMigreer);
  const passMigreer = lokaal.indexOf('kern.lucht.migreerBoardingPasses()', rtfOpen);
  const passOpen = lokaal.indexOf('boardingPassMigratieKlaar = true', passMigreer);
  assert.ok(lokaalBegin >= 0 && lokaalEinde > lokaalBegin && rtfMigreer >= 0 &&
    rtfOpen > rtfMigreer && passMigreer > rtfOpen && passOpen > passMigreer,
  'de lokale pre-ready-tak committeert Samen en boarding-pass in volgorde vóór hij beide open zet');
  assert.match(bron, /startPostgres:\s*startPostgresMetSalon/);
});
