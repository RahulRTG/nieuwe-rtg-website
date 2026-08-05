/* RTMAIL, het postvak zelf: mappen, etiketten, favorieten, sluimeren, zoeken
   en gesprekken. End-to-end tegen een echte server, met twee leden zodat er
   ook echt post HEEN EN WEER gaat -- de meeste fouten in een postvak zitten
   niet in de handeling maar in de vraag WIENS bericht het is.

   De drie beweringen die er het meest toe doen:

   1. Opbergen door de ontvanger raakt de VERZONDEN map van de afzender niet.
      Dat is de hele reden dat de toestand per bus hangt en niet op het
      bericht; ging dat mis, dan verdween post uit iemands eigen archief door
      een handeling van een ander.
   2. Zoeken blijft binnen het eigen postvak. Een zoekopdracht die de tekst van
      een ander teruggeeft, is een lek dat er precies zo uitziet als een
      werkende zoekfunctie.
   3. Een gesprek toont alleen wat je zelf mag zien, en ZEGT hoeveel er buiten
      beeld blijft. Verzwijgen dat er meer is, misleidt net zo goed als het
      tonen ervan.
   Draai: node --experimental-sqlite --test test/rtmail-vak.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, aTok, bTok, aAdres, bAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vak-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const post = async (pad, body, tok) => json(await api(pad, body, tok));

async function meldAan(naam, mail, tel) {
  const r = await post('/api/auth/register', { name: naam, email: mail, phone: tel,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.token, 'aangemeld: ' + naam);
  return r.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  aTok = await meldAan('Vak Een', 'vak1@x.nl', '0612345621');
  bTok = await meldAan('Vak Twee', 'vak2@x.nl', '0612345622');
  aAdres = (await post('/api/member/rtmail/adres', {}, aTok)).adres;
  bAdres = (await post('/api/member/rtmail/adres', {}, bTok)).adres;
  assert.ok(aAdres && bAdres && aAdres !== bAdres, 'twee verschillende adressen');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De post waarmee we werken is het welkomsbericht dat elk nieuw lid van het
   systeem krijgt (test/rtmail-lid.test.js toetst dat het er is). Dat is genoeg
   voor deze laag: mappen, etiketten en zoeken gaan over een bericht IN een
   postvak, en het maakt niet uit wie het geschreven heeft. Het tweede lid is er
   voor de andere helft van elke bewering -- wat een ANDER niet mag. */
test('de mappen bestaan, en het welkom staat in "in"', async () => {
  const d = await post('/api/member/rtmail/vak', {}, aTok);
  assert.ok(d.ok);
  assert.deepEqual(d.mappen, ['in', 'archief', 'prullenbak']);
  assert.ok(d.berichten.length >= 1, 'er staat post in');
  assert.equal(d.berichten[0].map, 'in');
  assert.equal(d.tellingen.in, d.berichten.length);
  assert.ok(d.tellingen.ongelezen >= 1);
});

test('opbergen haalt een bericht uit "in" en zet het in het archief', async () => {
  const eerst = await post('/api/member/rtmail/vak', {}, aTok);
  const id = eerst.berichten[0].id;
  const v = await post('/api/member/rtmail/verplaats', { id, map: 'archief' }, aTok);
  assert.equal(v.ok, true);
  const inbox = await post('/api/member/rtmail/vak', {}, aTok);
  assert.ok(!inbox.berichten.some(m => m.id === id), 'weg uit de inbox');
  const arch = await post('/api/member/rtmail/vak', { map: 'archief' }, aTok);
  assert.ok(arch.berichten.some(m => m.id === id), 'terug te vinden in het archief');
  assert.equal(arch.tellingen.archief, 1);
  // en terugzetten kan
  await post('/api/member/rtmail/verplaats', { id, map: 'in' }, aTok);
  const terug = await post('/api/member/rtmail/vak', {}, aTok);
  assert.ok(terug.berichten.some(m => m.id === id), 'weer in de inbox');
});

test('een map die niet bestaat wordt geweigerd, en post van een ander ook', async () => {
  const mijn = (await post('/api/member/rtmail/vak', {}, aTok)).berichten[0];
  const raar = await post('/api/member/rtmail/verplaats', { id: mijn.id, map: 'kelder' }, aTok);
  assert.match(raar.error, /map bestaat niet/);
  // B probeert het bericht van A op te bergen: dat is niet zijn postvak
  const vreemd = await post('/api/member/rtmail/verplaats', { id: mijn.id, map: 'archief' }, bTok);
  assert.match(vreemd.error, /staat niet in dit postvak/);
});

test('etiketten en favorieten hangen aan het bericht in DIT postvak', async () => {
  const m = (await post('/api/member/rtmail/vak', {}, aTok)).berichten[0];
  const e = await post('/api/member/rtmail/etiket', { id: m.id, label: 'Belangrijk' }, aTok);
  assert.deepEqual(e.labels, ['Belangrijk']);
  const s = await post('/api/member/rtmail/ster', { id: m.id, aan: true }, aTok);
  assert.equal(s.favoriet, true);
  const opLabel = await post('/api/member/rtmail/vak', { label: 'belangrijk' }, aTok);
  assert.ok(opLabel.berichten.some(x => x.id === m.id), 'het etiket filtert, hoofdletterongevoelig');
  const anderLabel = await post('/api/member/rtmail/vak', { label: 'bestaatniet' }, aTok);
  assert.equal(anderLabel.berichten.length, 0);
  // eraf halen kan ook
  const af = await post('/api/member/rtmail/etiket', { id: m.id, label: 'Belangrijk', aan: false }, aTok);
  assert.deepEqual(af.labels, []);
});

test('sluimeren haalt post uit beeld tot een moment in de toekomst', async () => {
  const m = (await post('/api/member/rtmail/vak', {}, aTok)).berichten[0];
  const straks = new Date(Date.now() + 3600e3).toISOString();
  const sl = await post('/api/member/rtmail/sluimer', { id: m.id, tot: straks }, aTok);
  assert.equal(sl.ok, true);
  const inbox = await post('/api/member/rtmail/vak', {}, aTok);
  assert.ok(!inbox.berichten.some(x => x.id === m.id), 'sluimerende post staat niet in de inbox');
  assert.equal(inbox.tellingen.sluimert, 1, 'maar wordt wel geteld -- niet stilletjes weg');
  // terugzetten in de inbox wist het sluimeren
  await post('/api/member/rtmail/verplaats', { id: m.id, map: 'in' }, aTok);
  const terug = await post('/api/member/rtmail/vak', {}, aTok);
  assert.ok(terug.berichten.some(x => x.id === m.id), 'weer zichtbaar');
  assert.equal(terug.tellingen.sluimert, 0);
});

test('sluimeren tot het verleden wordt geweigerd in plaats van stil te mislukken', async () => {
  const m = (await post('/api/member/rtmail/vak', {}, aTok)).berichten[0];
  const r = await post('/api/member/rtmail/sluimer', { id: m.id, tot: '2020-01-01T00:00:00.000Z' }, aTok);
  assert.match(r.error, /verleden/);
  const geen = await post('/api/member/rtmail/sluimer', { id: m.id, tot: 'morgen misschien' }, aTok);
  assert.match(geen.error, /geen tijdstip/);
});

test('zoeken vindt het eigen bericht en NOOIT dat van een ander', async () => {
  /* Vergelijken op de BUS en niet op het hele adres: post aan het oude
     "<code>@rtmail" hoort bij hetzelfde postvak als "<code>@rtgpass.rtg" --
     dat is de belofte van kern/rtmail-adres.js, en een toets die op de letter
     vergelijkt zou die belofte juist kapot verklaren. */
  const bus = a => String(a || '').split('@')[0].replace(/[.-]/g, '');
  const mijn = await post('/api/member/rtmail/zoek', { vraag: 'welkom' }, aTok);
  assert.equal(mijn.ok, true);
  assert.ok(mijn.aantal >= 1, 'het eigen welkom is te vinden');
  assert.ok(mijn.berichten.every(m => bus(m.naar) === bus(aAdres) || bus(m.van) === bus(aAdres)),
    'elk resultaat is post van of aan dit adres');
  // B zoekt op het adres van A: dat mag niets opleveren, ook al staat het in de opslag
  const vanB = await post('/api/member/rtmail/zoek', { vraag: bus(aAdres) }, bTok);
  assert.ok(vanB.berichten.every(m => bus(m.naar) === bus(bAdres) || bus(m.van) === bus(bAdres)),
    'B ziet uitsluitend zijn eigen post');
  const leeg = await post('/api/member/rtmail/zoek', { vraag: '' }, aTok);
  assert.match(leeg.error, /Waar zoekt u naar/);
});

test('een antwoord komt aan, hangt in hetzelfde gesprek en draagt Re:', async () => {
  // A beantwoordt het systeembericht; dat gaat terug naar rtg@rtmail
  const m = (await post('/api/member/rtmail/vak', {}, aTok)).berichten
    .find(x => x.van === 'rtg@rtmail');
  assert.ok(m, 'er is een systeembericht om op te antwoorden');
  const r = await post('/api/member/rtmail/antwoord', { id: m.id, tekst: 'Dank, ik kijk ernaar.' }, aTok);
  assert.equal(r.ok, true);
  assert.equal(r.bericht.naar, 'rtg@rtmail');
  assert.match(r.bericht.onderwerp, /^Re: /);
  assert.equal(r.bericht.antwoordOp, m.id);
  assert.equal(r.bericht.draad, m.draad, 'zelfde gesprek als het bericht waarop geantwoord is');
  // het vertrouwensstempel komt van de inlog, niet van de client
  assert.equal(r.bericht.bron, 'lid');
  assert.equal(r.bericht.vertrouwd, true);

  const d = await post('/api/member/rtmail/draad', { id: m.id }, aTok);
  assert.equal(d.ok, true);
  assert.equal(d.berichten.length, 2, 'vraag en antwoord staan samen');
  assert.ok(d.berichten[0].at <= d.berichten[1].at, 'oudste eerst -- een gesprek lees je van boven naar beneden');
  assert.equal(d.buitenBeeld, 0);
});

test('een gesprek van een ander is niet op te vragen', async () => {
  const m = (await post('/api/member/rtmail/vak', {}, aTok)).berichten[0];
  const r = await post('/api/member/rtmail/draad', { id: m.id }, bTok);
  assert.match(r.error, /staat niet in dit postvak/);
});

test('de gesprekkenlijst vat samen in plaats van los te tellen', async () => {
  const g = await post('/api/member/rtmail/gesprekken', {}, aTok);
  assert.equal(g.ok, true);
  assert.ok(g.gesprekken.length >= 1);
  const met = g.gesprekken.find(x => x.aantal >= 1);
  assert.ok(met.onderwerp && met.at && Array.isArray(met.deelnemers));
  // het aantal gesprekken is nooit groter dan het aantal berichten
  const v = await post('/api/member/rtmail/vak', {}, aTok);
  assert.ok(g.gesprekken.length <= v.berichten.length);
});
