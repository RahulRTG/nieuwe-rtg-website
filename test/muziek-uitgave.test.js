/* RTG Klankwerk: zang, samen produceren en uitgeven.

   De zwaarste belofte die hier getoetst wordt: DE RTG-NAAM KOMT ER NOOIT
   VANZELF ONDER. Een lid kan hem aanvragen, maar alleen een mens bij het
   kantoor kan hem toekennen -- dezelfde regel als bij de Lifestyle- en
   Business Pass. En: de makers staan allemaal in de aftiteling, ook als er
   daarna iemand uit het stuk gehaald wordt.
   Draai: node --experimental-sqlite --test test/muziek-uitgave.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, baas, maat, kantoor, trackId, uitgaveId, maatCode;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitgave-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const t0 = Date.now();
let seq = 0;
async function lid(naam) {
  const u = String(t0 + (++seq)).slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'ug' + u + '@u.test', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1992-02-02', tier: 'rtg' })).body.token;
}
const codenaamVan = async (tok) => (await api('/api/state', {}, tok)).body.state.user.codename;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', OFFICE_CODE: 'KANTOOR123' } }));
  baas = await lid('Producer');
  maat = await lid('Zanger');
  maatCode = await codenaamVan(maat);
  const k = await api('/api/office/login', { code: 'KANTOOR123' });
  kantoor = k.body.token;
  assert.ok(baas && maat && kantoor, 'twee leden en een kantoorinlog');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een stemkanaal draagt lettergreepjes; een gewoon instrument niet', async () => {
  const r = await api('/api/muziek/maak', { naam: 'Eerste lied' }, baas);
  trackId = r.body.track.id;
  const b = await api('/api/muziek/bewaar', { id: trackId, maten: 2, kanalen: [
    { instrument: 'zang', noten: [
      { stap: 0, toon: 62, lengte: 4, tekst: 'zon' },
      { stap: 4, toon: 64, lengte: 4, tekst: 'lie' },
      { stap: 8, toon: 65, lengte: 8, tekst: 'ver' }
    ] },
    { instrument: 'koor', noten: [{ stap: 0, toon: 55, lengte: 16, tekst: 'aah' }] },
    { instrument: 'bas', noten: [{ stap: 0, toon: 38, lengte: 8, tekst: 'dit hoort hier niet' }] }
  ] }, baas);
  assert.equal(b.status, 200);
  const zang = b.body.track.kanalen.find(k => k.instrument === 'zang');
  assert.deepEqual(zang.noten.map(n => n.tekst), ['zon', 'lie', 'ver'], 'de tekst blijft bij de noot');
  const bas = b.body.track.kanalen.find(k => k.instrument === 'bas');
  assert.equal(bas.noten[0].tekst, undefined, 'tekst die nooit klinkt wordt niet bewaard');
});

test('secties maken van een lus een lied', async () => {
  const b = await api('/api/muziek/bewaar', { id: trackId, maten: 8, secties: [
    { naam: 'intro', van: 0, tot: 2 },
    { naam: 'couplet', van: 2, tot: 6 },
    { naam: 'refrein', van: 6, tot: 99 }
  ] }, baas);
  assert.deepEqual(b.body.track.secties.map(s => s.naam), ['intro', 'couplet', 'refrein']);
  assert.equal(b.body.track.secties[2].tot, 8, 'een sectie buiten het raster wordt bijgetrokken');
});

test('samen produceren: een medemaker mag echt mee, en staat er met zijn rol bij', async () => {
  // een vreemde komt er niet in
  assert.equal((await api('/api/muziek/open', { id: trackId }, maat)).status, 404);

  const n = await api('/api/muziek/samen/nodig', { id: trackId, codenaam: maatCode, rol: 'zang' }, baas);
  assert.equal(n.status, 200, JSON.stringify(n.body));
  assert.equal(n.body.makers.makers.length, 2);

  // en nu mag hij bewerken -- anders is het geen samenwerking maar een postbus
  const o = await api('/api/muziek/open', { id: trackId }, maat);
  assert.equal(o.status, 200);
  const b = await api('/api/muziek/bewaar', { id: trackId, naam: 'Eerste lied (met zang)' }, maat);
  assert.equal(b.status, 200);

  // het stuk staat ook in ZIJN lijst, anders is het onvindbaar
  const mijn = await api('/api/muziek/mijn', {}, maat);
  const rij = mijn.body.tracks.find(t => t.id === trackId);
  assert.ok(rij, 'het staat in zijn lijst');
  assert.equal(rij.vanMij, false, 'maar het is niet van hem');
  assert.ok(rij.laatste, 'en er staat wie er als laatste aan werkte');

  // een medemaker beheert de makerslijst niet
  assert.equal((await api('/api/muziek/samen/nodig', { id: trackId, codenaam: 'Wie Dan Ook 0000' }, maat)).status, 403);
  // een onbekende codenaam levert niets op
  assert.equal((await api('/api/muziek/samen/nodig', { id: trackId, codenaam: 'Bestaat Niet 9999' }, baas)).status, 404);
});

test('uitgeven kan pas als het klaar is, en gebeurt onder je codenaam', async () => {
  const teVroeg = await api('/api/muziek/uitgeven', { id: trackId, onder: 'codenaam' }, baas);
  assert.equal(teVroeg.status, 400, 'niet-klaar geef je niet uit');

  await api('/api/muziek/bewaar', { id: trackId, klaar: true }, baas);
  const u = await api('/api/muziek/uitgeven', { id: trackId, onder: 'codenaam',
    toelichting: 'Gemaakt op een regenachtige dinsdag.' }, baas);
  assert.equal(u.status, 200, JSON.stringify(u.body));
  uitgaveId = u.body.uitgave.id;
  assert.equal(u.body.uitgave.onder, 'codenaam');
  assert.notEqual(u.body.uitgave.naamOnder, 'Rahul Travel Group');
  assert.equal(u.body.uitgave.makers.length, 2, 'beide makers staan in de aftiteling');
  assert.ok(u.body.uitgave.makers.some(m => m.rol === 'zang'));

  // een medemaker geeft niet uit; dat doet de eigenaar
  assert.equal((await api('/api/muziek/uitgeven', { id: trackId }, maat)).status, 403);
  // en twee keer uitgeven kan niet
  assert.equal((await api('/api/muziek/uitgeven', { id: trackId }, baas)).status, 409);
});

test('de aftiteling ligt vast: wie eruit gehaald wordt, blijft in de uitgave staan', async () => {
  const eruit = await api('/api/muziek/samen/eruit', { id: trackId, codenaam: maatCode }, baas);
  assert.equal(eruit.status, 200);
  const zaal = await api('/api/muziek/zaal', {}, baas);
  const u = zaal.body.uitgaven.find(x => x.id === uitgaveId);
  assert.equal(u.makers.length, 2, 'de uitgave draagt nog steeds beide namen');
  assert.ok(u.makers.some(m => m.codenaam === maatCode), 'ook die van de zanger');
});

test('DE RTG-NAAM KOMT ER NOOIT VANZELF ONDER', async () => {
  // aanvragen mag; toekennen niet
  const v = await api('/api/muziek/uitgave/rtg', { id: uitgaveId }, baas);
  assert.equal(v.status, 200);
  assert.equal(v.body.uitgave.rtgAanvraag, 'gevraagd');
  assert.equal(v.body.uitgave.onder, 'codenaam', 'aanvragen verandert nog niets');
  assert.notEqual(v.body.uitgave.naamOnder, 'Rahul Travel Group');

  // ook wie meteen om de RTG-naam vraagt bij het uitgeven, krijgt hem niet
  const r2 = await api('/api/muziek/maak', { naam: 'Tweede' }, baas);
  await api('/api/muziek/bewaar', { id: r2.body.track.id, klaar: true }, baas);
  const u2 = await api('/api/muziek/uitgeven', { id: r2.body.track.id, onder: 'rtg' }, baas);
  assert.equal(u2.body.uitgave.onder, 'codenaam', 'de aanvraag staat open, de naam nog niet');
  assert.equal(u2.body.uitgave.rtgAanvraag, 'gevraagd');

  // een lid kan de kantoorbeslissing niet zelf nemen
  assert.equal((await api('/api/office/muziek/beslis', { id: uitgaveId, ja: true }, baas)).status, 401);

  // het kantoor ziet de aanvragen en beslist -- dat is de enige weg
  const lijst = await api('/api/office/muziek', {}, kantoor);
  assert.equal(lijst.status, 200);
  assert.ok(lijst.body.aanvragen.some(a => a.id === uitgaveId));

  const ja = await api('/api/office/muziek/beslis', { id: uitgaveId, ja: true }, kantoor);
  assert.equal(ja.status, 200);
  assert.equal(ja.body.onder, 'rtg');
  const zaal = await api('/api/muziek/zaal', {}, baas);
  const u = zaal.body.uitgaven.find(x => x.id === uitgaveId);
  assert.equal(u.naamOnder, 'Rahul Travel Group', 'nu pas staat de RTG-naam eronder');

  // afwijzen betekent "niet onder onze naam", niet "weg ermee"
  const nee = await api('/api/office/muziek/beslis', { id: u2.body.uitgave.id, ja: false, reden: 'Nog niet af.' }, kantoor);
  assert.equal(nee.body.onder, 'codenaam');
  const na = await api('/api/muziek/zaal', {}, baas);
  assert.ok(na.body.uitgaven.some(x => x.id === u2.body.uitgave.id), 'de uitgave staat er gewoon nog');
});

test('de zaal is chronologisch en heeft een bodem, zonder hitlijst', async () => {
  const z = await api('/api/muziek/zaal', {}, maat);
  assert.equal(z.status, 200);
  assert.ok(z.body.uitgaven.length >= 2);
  // op volgorde van uitkomen, nieuwste eerst -- niet op waardering
  const tijden = z.body.uitgaven.map(u => u.at);
  assert.deepEqual(tijden, tijden.slice().sort().reverse(), 'chronologisch');
  assert.ok(z.body.einde, 'er is een expliciet einde');
  const plat = JSON.stringify(z.body);
  assert.equal(/hitlijst|ranglijst|populair|trending|meest beluisterd/i.test(plat.replace(z.body.uitleg, '')), false);

  // "mooi" is een schouderklop, geen score: één per persoon, en terug te nemen
  const m1 = await api('/api/muziek/uitgave/mooi', { id: uitgaveId }, maat);
  assert.equal(m1.body.mooi, 1);
  assert.equal((await api('/api/muziek/uitgave/mooi', { id: uitgaveId }, maat)).body.mooi, 1, 'twee keer telt niet dubbel');
  assert.equal((await api('/api/muziek/uitgave/mooi', { id: uitgaveId, aan: false }, maat)).body.mooi, 0);
});

test('luisteren geeft de bevroren inhoud, niet wat er daarna in de studio gebeurde', async () => {
  const voor = await api('/api/muziek/uitgave', { id: uitgaveId }, maat);
  assert.equal(voor.status, 200);
  const kanalenVoor = voor.body.uitgave.kanalen.length;

  // de eigenaar sloopt zijn studioversie
  await api('/api/muziek/bewaar', { id: trackId, kanalen: [] }, baas);
  const na = await api('/api/muziek/uitgave', { id: uitgaveId }, maat);
  assert.equal(na.body.uitgave.kanalen.length, kanalenVoor, 'de uitgave ligt vast');
  assert.ok(kanalenVoor > 0);
});

test('reacties staan op codenaam, en zonder inlog is de zaal dicht', async () => {
  const r = await api('/api/muziek/uitgave/reageer', { id: uitgaveId, tekst: 'Dat refrein blijft hangen.' }, maat);
  assert.equal(r.status, 200);
  assert.equal(r.body.reactie.codenaam, maatCode);
  const lijst = await api('/api/muziek/uitgave/reacties', { id: uitgaveId }, baas);
  assert.equal(lijst.body.reacties.length, 1);
  assert.equal(/Zanger|u\.test/.test(JSON.stringify(lijst.body)), false, 'geen echte naam of e-mail');

  for (const pad of ['/api/muziek/zaal', '/api/muziek/uitgeven', '/api/muziek/samen']) {
    const uit = await fetch(BASE + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(uit.status, 401, pad);
  }
});
