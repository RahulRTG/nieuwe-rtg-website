/* EEN STUK DELEN IN EEN GESPREK -- en waarom er alleen een ID meegaat.

   Een gesprek tussen twee leden kon al een Salon-post meedragen. Een nummer,
   een video of een korte clip kon dat niet: die woonden in vier apps die van
   elkaar niets wisten. Nu draagt een bericht ook een stuk-id uit de Media OS.

   WAT HIER BEWEZEN MOET WORDEN is dat delen geen ACHTERDEUR is:
     - er gaat alleen een id mee, geen kopie van het stuk;
     - de ONTVANGER lost het op met zijn eigen sessie, dus zijn eigen deuren
       gelden -- wat de maker weghaalt, is via een gesprek niet alsnog te zien;
     - de VERZENDER kan alleen delen wat hij zelf op dit moment ziet, zodat een
       gesprek geen manier wordt om te toetsen welke id's bestaan;
     - en een bericht zonder tekst maar met een stuk is een geldig bericht.

   Draai los: node --test test/mediadelen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mediadelen-'));
let srv, base, maker, vriend, office;
let makerKey, vriendKey, clipId, trackId, uitgaveId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: naam, email: 'md' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, naam + ' is aangemeld');
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  maker = await lid('Deler'); vriend = await lid('Ontvanger');

  // twee stukken van de maker: een korte clip en een uitgegeven nummer
  clipId = (await api('/api/clips/maak', { titel: 'Haven', duurS: 20, mbGeschat: 4 }, maker.token)).body.id;
  trackId = (await api('/api/muziek/maak', {}, maker.token)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true }, maker.token);
  uitgaveId = (await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'Eerste' }, maker.token)).body.uitgave.id;
  assert.ok(clipId && uitgaveId, 'er staat werk klaar');

  // en de twee zijn verbonden, want zonder vriendschap is er geen gesprek
  const zoek = await api('/api/member/find', { q: vriend.codenaam }, maker.token);
  vriendKey = (zoek.body.results || [])[0] && zoek.body.results[0].key;
  assert.ok(vriendKey, 'de vriend is te vinden op codenaam');
  assert.equal((await api('/api/member/connect', { key: vriendKey }, maker.token)).status, 200);
  const terug = await api('/api/member/find', { q: maker.codenaam }, vriend.token);
  makerKey = terug.body.results[0].key;
  assert.equal((await api('/api/member/connect/respond', { key: makerKey, action: 'accept' }, vriend.token)).status, 200);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een stuk delen: alleen het id gaat mee, geen kopie', async () => {
  const r = await api('/api/member/dm/send', { toKey: vriendKey, stukId: 'track:' + uitgaveId }, maker.token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.message.stuk.id, 'track:' + uitgaveId, 'het bericht draagt het id');
  assert.equal(r.body.message.stuk.vorm, 'track', 'en de vorm, voor een leesbare regel');
  /* De titel staat er NIET in. Dat is met opzet: een bevroren titel klopt niet
     meer zodra de maker hem verandert, en een bevroren stuk blijft staan
     nadat hij het heeft weggehaald. */
  assert.equal(r.body.message.stuk.titel, undefined, 'geen bevroren titel');
  assert.equal(JSON.stringify(r.body.message.stuk).includes('Middernacht'), false, 'en geen kopie van het stuk');

  const gesprek = await api('/api/member/dm', { withKey: makerKey }, vriend.token);
  const laatste = gesprek.body.messages[gesprek.body.messages.length - 1];
  assert.equal(laatste.stuk.id, 'track:' + uitgaveId, 'de ontvanger ziet het stuk in het gesprek');

  const lijst = await api('/api/member/connections', {}, vriend.token);
  const rij = lijst.body.connections.find(c => c.key === makerKey);
  assert.equal(rij.last, '↗ stuk', 'en de gesprekslijst zegt dat er een stuk in staat');
});

test('2. een bericht met alleen een stuk is een geldig bericht', async () => {
  const leeg = await api('/api/member/dm/send', { toKey: vriendKey }, maker.token);
  assert.equal(leeg.status, 400, 'helemaal leeg is niets');
  const met = await api('/api/member/dm/send', { toKey: vriendKey, stukId: 'clip:' + clipId }, maker.token);
  assert.equal(met.status, 200, 'een stuk zonder tekst mag wel');
});

test('3. u deelt alleen wat u zelf ziet', async () => {
  const verzonnen = await api('/api/member/dm/send', { toKey: vriendKey, stukId: 'track:bestaatniet' }, maker.token);
  assert.ok([403, 404].includes(verzonnen.status), 'een verzonnen id gaat de deur niet uit');
  const onzin = await api('/api/member/dm/send', { toKey: vriendKey, stukId: 'geenvorm:123' }, maker.token);
  assert.ok([403, 404].includes(onzin.status), 'en een id dat geen stuk-id is evenmin');

  /* En het gesprek is er niet vuiler van geworden: een geweigerde deling
     hoort geen half bericht achter te laten. */
  const gesprek = await api('/api/member/dm', { withKey: makerKey }, vriend.token);
  assert.equal(gesprek.body.messages.filter(m => m.stuk && m.stuk.id === 'track:bestaatniet').length, 0);
});

test('4. de deur van de ONTVANGER geldt, niet die van de verzender', async () => {
  /* Dit is de toets die telt. Het bericht blijft staan -- een gesprek is
     geschiedenis en die wordt niet herschreven -- maar het stuk zelf lost bij
     de ontvanger niet meer op zodra de maker het weghaalt. Zat er een kopie in
     het bericht, dan zou hij het na de verwijdering nog steeds kunnen spelen. */
  const gedeeld = await api('/api/member/dm/send', { toKey: vriendKey, stukId: 'clip:' + clipId, text: 'Kijk deze' }, maker.token);
  assert.equal(gedeeld.status, 200);

  const voor = await api('/api/mediaos/stuk', { id: 'clip:' + clipId }, vriend.token);
  assert.equal(voor.status, 200, 'nu kan de ontvanger hem nog openen');

  assert.equal((await api('/api/clips/weg', { id: clipId }, maker.token)).status, 200, 'de maker haalt hem weg');

  const na = await api('/api/mediaos/stuk', { id: 'clip:' + clipId }, vriend.token);
  assert.equal(na.status, 404, 'daarna niet meer -- het gesprek is geen achterdeur');
  const gesprek = await api('/api/member/dm', { withKey: makerKey }, vriend.token);
  const regel = gesprek.body.messages.filter(m => m.stuk && m.stuk.id === 'clip:' + clipId).pop();
  assert.ok(regel, 'het bericht staat er nog wel');
  assert.equal(regel.text, 'Kijk deze', 'met de tekst die erbij hoorde');
});
