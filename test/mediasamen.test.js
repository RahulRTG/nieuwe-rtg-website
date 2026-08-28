/* SAMEN LUISTEREN EN KIJKEN -- de kamer deelt de AANWIJZER, niet het geluid.

   Een luisterkamer zegt: dit stuk, op deze seconde, spelend of stil. Iedereen
   speelt dat af met zijn eigen middelen. Er gaan geen bytes door de kamer, en
   dat is niet een beperking maar de enige eerlijke vorm: bij twee van de vier
   vormen is de bron het toestel van de maker en niet RTG.

   WAT HIER BEWEZEN MOET WORDEN:
     - alleen wie de gastheer uitnodigt komt erin, en alleen wie hij kent;
     - alleen de gastheer verzet de aanwijzer;
     - een deelnemer die het stuk niet mag zien, hoort het ook niet -- hij
       krijgt de REDEN, geen stil zwart scherm;
     - gaat de gastheer weg, dan gaat de kamer dicht.

   Draai los: node --test test/mediasamen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mediasamen-'));
let srv, base, office;
let gastheer, vriend, vreemde;
let gastheerKey, vriendKey, clipId, uitgaveId, eventId, kamerId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: naam, email: 'ms' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, naam + ' is aangemeld');
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}
async function verbind(a, b) {
  const zoek = await api('/api/member/find', { q: b.codenaam }, a.token);
  const key = (zoek.body.results || [])[0] && zoek.body.results[0].key;
  assert.ok(key, b.codenaam + ' is te vinden');
  assert.equal((await api('/api/member/connect', { key }, a.token)).status, 200);
  const terug = await api('/api/member/find', { q: a.codenaam }, b.token);
  const aKey = terug.body.results[0].key;
  assert.equal((await api('/api/member/connect/respond', { key: aKey, action: 'accept' }, b.token)).status, 200);
  return { key, aKey };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  gastheer = await lid('Gastheer'); vriend = await lid('Vriend'); vreemde = await lid('Vreemde');

  // eigen werk van de gastheer: een uitgave en een korte clip
  const trackId = (await api('/api/muziek/maak', {}, gastheer.token)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true }, gastheer.token);
  uitgaveId = (await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'Eerste' }, gastheer.token)).body.uitgave.id;
  clipId = (await api('/api/clips/maak', { titel: 'Haven', duurS: 20, mbGeschat: 4 }, gastheer.token)).body.id;
  assert.ok(uitgaveId && clipId, 'er staat werk klaar');

  /* En een evenementkanaal van de gastheer. Dat staat in de GEDEELDE index van
     het Podium (dus het kan in een mediawereld staan) maar gaat alleen open met
     een kaartje; de maker ziet zijn eigen kanaal altijd. Dat is de asymmetrie
     die de kamer-toets nodig heeft, en hij is echt in plaats van gemaakt. */
  const kan = await api('/api/podium/kanaal/aanmeld', { naam: 'Concert', zone: 'evenement' }, gastheer.token);
  assert.equal(kan.status, 200, JSON.stringify(kan.body).slice(0, 160));
  eventId = kan.body.kanaal.id;
  assert.equal((await api('/api/office/podium/beslis', { id: eventId, besluit: 'goedgekeurd' }, office)).status, 200);

  const v = await verbind(gastheer, vriend);
  vriendKey = v.key; gastheerKey = v.aKey;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een kamer beginnen, en er komt niemand ongevraagd in', async () => {
  const s = await api('/api/mediaos/samen/start', {}, gastheer.token);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 160));
  kamerId = s.body.kamer.id;
  assert.equal(s.body.kamer.ikGastheer, true);
  assert.match(s.body.kamer.uitleg, /aanwijzer, niet het geluid/, 'de kamer zegt zelf wat hij is');

  const stiekem = await api('/api/mediaos/samen/in', { id: kamerId }, vriend.token);
  assert.equal(stiekem.status, 403, 'zonder uitnodiging kom je er niet in, ook niet met het id');
  assert.match(stiekem.body.error, /nodigt uit/);
});

test('2. uitnodigen kan alleen wie u kent', async () => {
  const vreemd = await api('/api/mediaos/samen/nodig', { id: kamerId, codenaam: vreemde.codenaam }, gastheer.token);
  assert.equal(vreemd.status, 403, 'een vreemde nodigt u niet uit');
  assert.match(vreemd.body.error, /verbonden/);

  const nep = await api('/api/mediaos/samen/nodig', { id: kamerId, codenaam: 'BestaatNiet' }, gastheer.token);
  assert.equal(nep.status, 404);

  const goed = await api('/api/mediaos/samen/nodig', { id: kamerId, codenaam: vriend.codenaam }, gastheer.token);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  const erin = await api('/api/mediaos/samen/in', { id: kamerId }, vriend.token);
  assert.equal(erin.status, 200, 'en daarna komt hij er wel in');
  assert.equal(erin.body.kamer.ikGastheer, false);
  assert.ok(erin.body.kamer.mensen.includes(vriend.codenaam), 'hij staat in de kamer');
});

test('3. alleen de gastheer verzet de aanwijzer', async () => {
  const niet = await api('/api/mediaos/samen/zet', { id: kamerId, stukId: 'track:' + uitgaveId }, vriend.token);
  assert.equal(niet.status, 403);
  assert.match(niet.body.error, /gastheer/);

  const onzin = await api('/api/mediaos/samen/zet', { id: kamerId, stukId: 'geenvorm:1' }, gastheer.token);
  assert.equal(onzin.status, 400, 'een id dat geen stuk-id is, wijst hij niet aan');
  const verzonnen = await api('/api/mediaos/samen/zet', { id: kamerId, stukId: 'track:bestaatniet' }, gastheer.token);
  assert.equal(verzonnen.status, 404, 'en een stuk buiten zijn eigen wereld ook niet');

  const zet = await api('/api/mediaos/samen/zet', { id: kamerId, stukId: 'track:' + uitgaveId, positieS: 42 }, gastheer.token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  assert.equal(zet.body.kamer.stand.positieS, 42);
  assert.equal(zet.body.kamer.stand.spelend, true);

  const bij = await api('/api/mediaos/samen/in', { id: kamerId }, vriend.token);
  assert.equal(bij.body.kamer.stand.stukId, 'track:' + uitgaveId, 'de ander wijst naar hetzelfde stuk');
  assert.equal(bij.body.kamer.stand.positieS, 42, 'op dezelfde seconde');
  assert.equal(bij.body.kamer.speelbaar, true, 'en hij kan het spelen');
  assert.equal(bij.body.kamer.stuk.titel, 'Middernacht');
});

test('4. wat u niet mag zien, hoort u ook in een kamer niet -- met de reden erbij', async () => {
  /* Dit is de toets die telt. De kamer deelt een AANWIJZER; elke deelnemer
     lost het stuk op met zijn eigen sessie. Zou de kamer het stuk van de
     gastheer meesturen, dan was een luisterkamer een manier om iemand iets te
     laten horen wat hij zelf niet mag openen. */
  const zet = await api('/api/mediaos/samen/zet', { id: kamerId, stukId: 'clip:' + clipId }, gastheer.token);
  assert.equal(zet.status, 200, 'de gastheer wijst zijn eigen clip aan');
  assert.equal(zet.body.kamer.speelbaar, true, 'voor hemzelf speelbaar');

  assert.equal((await api('/api/clips/weg', { id: clipId }, gastheer.token)).status, 200, 'en haalt hem daarna weg');

  const bij = await api('/api/mediaos/samen/in', { id: kamerId }, vriend.token);
  assert.equal(bij.status, 200, 'de ander is nog gewoon in de kamer');
  assert.equal(bij.body.kamer.speelbaar, false, 'maar dit stuk speelt voor hem niet');
  assert.match(bij.body.kamer.reden, /weggehaald door de maker|dicht/, 'en hij leest waarom, in plaats van zwart te kijken');
  assert.equal(bij.body.kamer.stuk, null, 'er komt geen kopie van het stuk mee');
});

test('4b. en dat geldt ook als het stuk gewoon BESTAAT -- maar niet voor hem', async () => {
  /* De vorige toets liet het stuk verdwijnen voor iedereen. Dat bewijst dat
     een weggehaald stuk niet blijft hangen, maar NIET dat elke deelnemer met
     zijn eigen ogen kijkt: bij de gastheer was het immers ook weg. Hier staat
     het stuk er nog gewoon -- het is alleen van de gastheer, achter een deur
     die voor de ander een kaartje vraagt. Zou de kamer oplossen met de wereld
     van de GASTHEER, dan zakt precies deze toets en geen andere.
     (Beproefd: beeld() met de sessie van de gastheer laten lezen -- RAAK.) */
  const zet = await api('/api/mediaos/samen/zet', { id: kamerId, stukId: 'live:' + eventId }, gastheer.token);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  assert.equal(zet.body.kamer.speelbaar, true, 'de gastheer ziet zijn eigen kanaal');

  const bij = await api('/api/mediaos/samen/in', { id: kamerId }, vriend.token);
  assert.equal(bij.body.kamer.stand.stukId, 'live:' + eventId, 'de ander wijst naar hetzelfde stuk');
  assert.equal(bij.body.kamer.speelbaar, false, 'maar het gaat voor hem niet open');
  assert.equal(bij.body.kamer.stuk, null, 'en er komt geen kopie mee');
  assert.match(bij.body.kamer.reden, /dicht|weggehaald/);
});

test('5. gaat de gastheer weg, dan gaat de kamer dicht', async () => {
  assert.equal((await api('/api/mediaos/samen/uit', { id: kamerId }, gastheer.token)).status, 200);
  const na = await api('/api/mediaos/samen/in', { id: kamerId }, vriend.token);
  assert.equal(na.status, 404, 'een kamer zonder gastheer blijft niet als lege wachtkamer staan');
  const mijn = await api('/api/mediaos/samen/mijn', {}, vriend.token);
  assert.deepEqual(mijn.body.kamers, [], 'en hij staat bij niemand meer in de lijst');
});
