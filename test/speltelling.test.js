/* Telemetrie van de spellen: geaggregeerd, zonder personen.

   Deze toets bewaakt vooral wat er NIET in mag staan. Een teller is de plek
   waar een persoon het gemakkelijkst binnenglipt: eerst "even de winnaar erbij
   voor de topspelers", dan "even de sleutel erbij om dubbeltellingen te
   voorkomen", en dan is het een profiel geworden. Daarom kijkt de toets niet
   naar veldnamen maar naar INHOUD: er mag geen sleutel en geen codenaam in de
   opslag of in het antwoord voorkomen.

   Het tweede punt is minder voor de hand liggend: deze teller telt WEL de
   partijen van spelers onder de 18+-grens. De uitslagenlog doet dat niet (daar
   staan personen in), dus een teller die daaruit zou lezen ziet De Arena
   systematisch niet. Omdat hier geen persoon in staat, mag hij alles tellen --
   de privacyregel maakt de cijfers hier beter en niet slechter.

   Draai los: node --experimental-sqlite --test test/speltelling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakTelling = require('../server/kern/spellen/telling');
const maakUitslagen = require('../server/kern/spellen/uitslagen');
const { BELEID } = require('../server/bewaarbeleid');

const volwassen = (h) => !String(h).startsWith('kind');
function maak(vandaag) {
  const db = { data: {} };
  const nu = () => (vandaag || '2026-08-09') + 'T12:00:00.000Z';
  const t = maakTelling({ db, save() {}, nu, SOORTEN: { schaak: 'Schaken', dam: 'Dammen' } });
  const u = maakUitslagen({ db, save() {}, nu, codenaamVan: (k) => 'CN-' + k, progressieMag: volwassen, telPotje: t.telPotje });
  return { db, ...t, ...u };
}
const potje = (id, soort, spelers, winnaar) => ({ id, soort, modus: 'vrij', status: 'klaar', spelers, winnaar, gelijk: false });

test('een afgelopen potje wordt geteld, per dag en per spel', () => {
  const h = maak();
  h.noteerUitslag(potje('p1', 'schaak', ['anna', 'boris'], 'CN-anna'));
  h.noteerUitslag(potje('p2', 'schaak', ['anna', 'boris'], 'CN-boris'));
  h.noteerUitslag(potje('p3', 'dam', ['anna', 'boris'], 'CN-anna'));

  assert.deepEqual(h.db.data.spelTelling, [
    { dag: '2026-08-09', at: '2026-08-09T00:00:00.000Z', spel: 'schaak', potjes: 2, spelers: 4 },
    { dag: '2026-08-09', at: '2026-08-09T00:00:00.000Z', spel: 'dam', potjes: 1, spelers: 2 }
  ]);
});

test('er staat geen persoon in de telling -- niet in de opslag en niet in het antwoord', () => {
  const h = maak();
  h.noteerUitslag(potje('p1', 'schaak', ['user-1234', 'rtf:GEZ1:7'], 'CN-user-1234'));
  const opslag = JSON.stringify(h.db.data.spelTelling);
  const antwoord = JSON.stringify(h.spelTelemetrie(30));
  for (const plat of [opslag, antwoord]) {
    assert.equal(/user-|rtf:|CN-/.test(plat), false, 'er zit een sleutel of codenaam in: ' + plat);
    assert.equal(/winnaar|speler"|key|codenaam/.test(plat.replace(/"spelers":/g, '')), false, 'een persoonsveld: ' + plat);
  }
  // en de uitslagenlog draagt ze WEL: dit is echt een andere tak, geen kopie
  assert.match(JSON.stringify(h.db.data.spelUitslagen), /user-1234/);
});

test('partijen onder de 18+-grens tellen gewoon mee, ook als er geen uitslag van bestaat', () => {
  /* Het punt van een aparte tak. Twee tieners onderling laten in de
     uitslagenlog met opzet geen spoor na; als de teller daaruit zou lezen was
     De Arena onzichtbaar in de cijfers. */
  const h = maak();
  h.noteerUitslag(potje('p1', 'schaak', ['kind-a', 'kind-b'], 'CN-kind-a'));
  assert.deepEqual(h.db.data.spelUitslagen || [], [], 'geen uitslag: niemand binnen de grens');
  assert.equal(h.db.data.spelTelling[0].potjes, 1, 'maar het potje is wel geteld');
  assert.equal(h.spelTelemetrie(30).totaal.potjes, 1);
});

test('een potje wordt niet dubbel geteld', () => {
  const h = maak();
  const p = potje('p1', 'schaak', ['anna', 'boris'], 'CN-anna');
  h.noteerUitslag(p);
  h.noteerUitslag(p);   // een herhaalde zet, een retry
  h.noteerUitslag(p);
  assert.equal(h.db.data.spelTelling[0].potjes, 1);
});

test('een potje dat nog loopt telt niet', () => {
  const h = maak();
  h.noteerUitslag(Object.assign(potje('p1', 'schaak', ['anna', 'boris'], null), { status: 'bezig' }));
  assert.equal(h.db.data.spelTelling, undefined);
});

test('de cijfers tellen op per spel en per dag, met de spelnaam erbij', () => {
  const gisteren = maak('2026-08-08');
  gisteren.noteerUitslag(potje('p1', 'dam', ['a', 'b'], 'CN-a'));
  // dezelfde db doorgeven aan een "volgende dag": de rijen stapelen, niet overschrijven
  const db = gisteren.db;
  const t2 = maakTelling({ db, save() {}, nu: () => '2026-08-09T09:00:00.000Z', SOORTEN: { schaak: 'Schaken', dam: 'Dammen' } });
  t2.telPotje({ id: 'p2', soort: 'schaak', spelers: ['a', 'b', 'c', 'd'] });
  t2.telPotje({ id: 'p3', soort: 'dam', spelers: ['a', 'b'] });

  const r = t2.spelTelemetrie(30);
  assert.equal(r.totaal.potjes, 3);
  assert.equal(r.totaal.spelers, 8);
  assert.equal(r.totaal.spellen, 2);
  assert.deepEqual(r.perSpel.map(s => [s.spel, s.naam, s.potjes]), [['dam', 'Dammen', 2], ['schaak', 'Schaken', 1]],
    'op aantal gesorteerd, met de naam uit het register');
  assert.deepEqual(r.perDag, [{ dag: '2026-08-08', potjes: 1 }, { dag: '2026-08-09', potjes: 2 }],
    'en op datum voor een grafiek');
});

test('het venster snijdt oude dagen af en is begrensd', () => {
  const db = { data: { spelTelling: [
    { dag: '2020-01-01', at: '2020-01-01T00:00:00.000Z', spel: 'dam', potjes: 9, spelers: 18 }
  ] } };
  const t = maakTelling({ db, save() {}, nu: () => new Date().toISOString(), SOORTEN: {} });
  assert.equal(t.spelTelemetrie(30).totaal.potjes, 0, 'een dag van jaren terug valt buiten een venster van 30 dagen');
  assert.equal(t.spelTelemetrie(999999).dagen, 400, 'en het venster zelf heeft een bovengrens');
  assert.equal(t.spelTelemetrie(0).dagen, 30, 'zonder opgave dertig dagen');
});

/* ================= over de route, met een echte server =================
   De cijfers staan op het techniekbord, achter dezelfde poort als de rest
   daarvan. Twee dingen die hierboven niet te zien zijn: dat de teller ook
   echt meeloopt als er over de gewone weg wordt gespeeld, en dat een lid dat
   geen toegang heeft er niet bij kan. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const OWNER = 'rahul@rahultravelgroup.test';
let BASE, child, teller = 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-telling-'));
const json = r => r.json();
function raw(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}
test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_OWNER_EMAIL: OWNER } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een echt gespeeld potje komt op het techniekbord terecht, zonder personen', async () => {
  const t = Date.now() + '' + (teller++);
  const a = await json(await raw('/auth/register', { name: 'Tel A' + t, email: 'ta' + t + '@v.test', phone: '0666' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const b = await json(await raw('/auth/register', { name: 'Tel B' + t, email: 'tb' + t + '@v.test', phone: '0667' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1991-01-01', tier: 'rtg' }));
  await raw('/member/connections', {}, a.token); await raw('/member/connections', {}, b.token);
  const zoek = await json(await raw('/member/find', { q: b.state.user.codename }, a.token));
  const bKey = (zoek.results.find(r => r.codename === b.state.user.codename) || {}).key;
  await raw('/member/connect', { key: bKey }, a.token);
  const vz = await json(await raw('/member/connections', {}, b.token));
  await raw('/member/connect/respond', { key: (vz.requests || [])[0].key, action: 'accept' }, b.token);

  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'schaak', vrienden: [bKey] }, a.token));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.token);
  await raw('/member/spel/opgeven', { id: nieuw.id }, a.token);   // een potje dat afloopt

  // het lid zelf komt er niet bij: dit is geen ledenfunctie
  assert.equal((await raw('/techniek/spelcijfers', {}, a.token)).status, 403);

  const li = await json(await raw('/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' }));
  assert.ok(li.token, 'de eigenaar komt op het bord: ' + JSON.stringify(li).slice(0, 160));
  const cijfers = await json(await raw('/techniek/spelcijfers', { dagen: 7 }, li.token));
  const schaak = (cijfers.perSpel || []).find(s => s.spel === 'schaak');
  assert.ok(schaak && schaak.potjes >= 1, 'het potje is geteld: ' + JSON.stringify(cijfers).slice(0, 300));
  assert.equal(schaak.naam, 'Schaken');
  assert.equal(/user-|rtf:|codenaam/.test(JSON.stringify(cijfers)), false, 'en er staat geen persoon in');
});

test('de telling staat in het bewaarbeleid en verloopt dus vanzelf', () => {
  /* Een tak zonder bewaartermijn staat op `zonderBeleid()` en blijft eeuwig
     staan. "Er zit geen persoon in dus het mag blijven" is precies de
     redenering waarmee tellingen onsterfelijk worden. */
  const regel = BELEID.find(r => r.tak === 'spelTelling');
  assert.ok(regel, 'spelTelling hoort in server/bewaarbeleid.js te staan');
  assert.equal(regel.vorm, 'lijst');
  assert.equal(regel.datum, 'at', 'de motor leest dit veld; zonder datum verloopt er niets');
  assert.ok(regel.dagen > 0 && regel.dagen <= 1100, 'een termijn die ook echt een termijn is: ' + regel.dagen);

  // en het datumveld dat het beleid verwacht staat er ook echt in
  const h = maak();
  h.noteerUitslag(potje('p1', 'schaak', ['anna', 'boris'], 'CN-anna'));
  assert.match(h.db.data.spelTelling[0].at, /^\d{4}-\d{2}-\d{2}T/);
});
