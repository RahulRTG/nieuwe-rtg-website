/* EEN LIJST DELEN -- en de vraag die daar onder ligt.

   Bij het bouwen van de lijsten stond in TAKEN.md dat delen een antwoord vroeg
   op EEN vraag, en dat die vraag de kern was en niet de bijzaak: wat gebeurt er
   met een stuk dat voor de EEN wel en voor de ANDER niet open staat?

   Het antwoord is hetzelfde als overal in dit huis: de lijst draagt alleen
   id's, en IEDERE lezer lost ze op met ZIJN EIGEN sessie. Een gedeelde lijst is
   dus geen doorgeefluik. Wat de ander niet mag zien, ziet hij niet -- hij leest
   dat er iets stond en dat het er voor hem niet is.

   WAT HIER BEWEZEN MOET WORDEN:
     - delen kan alleen met iemand met wie u verbonden bent;
     - de ander LEEST de lijst en kan hem niet wijzigen of weggooien;
     - een stuk dat alleen de eigenaar mag zien (een evenementkanaal zonder
       kaartje) staat bij de eigenaar als kaart en bij de ander als verdwenen;
     - delen terugdraaien sluit de deur echt.

   Draai los: node --experimental-sqlite --test test/medialijstdelen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lijstdelen-'));
let srv, base, office;
let eigenaar, vriend, vreemde;
let uitgaveId, kanaalId, lijstId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: naam, email: 'ld' + u + '@x.nl', phone: '06' + u,
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
  assert.equal((await api('/api/member/connect/respond', { key: terug.body.results[0].key, action: 'accept' }, b.token)).status, 200);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  eigenaar = await lid('Eigenaar'); vriend = await lid('Vriend'); vreemde = await lid('Vreemde');
  await verbind(eigenaar, vriend);

  const trackId = (await api('/api/muziek/maak', {}, eigenaar.token)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true }, eigenaar.token);
  uitgaveId = (await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'Eerste' }, eigenaar.token)).body.uitgave.id;

  /* Een evenementkanaal van de eigenaar: dat staat in de GEDEELDE index van
     het Podium (dus het kan in een mediawereld staan) maar gaat alleen open
     met een kaartje. De maker ziet zijn eigen kanaal altijd. Dat is precies de
     asymmetrie die deze toets nodig heeft -- en hij is echt, niet gemaakt. */
  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'Concert', zone: 'evenement' }, eigenaar.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  kanaalId = aan.body.kanaal.id;
  assert.equal((await api('/api/office/podium/beslis', { id: kanaalId, besluit: 'goedgekeurd' }, office)).status, 200);

  const m = await api('/api/mediaos/lijst/maak', { naam: 'Voor de vrijdag' }, eigenaar.token);
  lijstId = m.body.lijst.id;
  assert.equal((await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'track:' + uitgaveId }, eigenaar.token)).status, 200);
  assert.equal((await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'live:' + kanaalId }, eigenaar.token)).status, 200);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. delen kan alleen met wie u verbonden bent', async () => {
  const vreemd = await api('/api/mediaos/lijst/deel', { id: lijstId, codenaam: vreemde.codenaam }, eigenaar.token);
  assert.equal(vreemd.status, 403);
  assert.match(vreemd.body.error, /verbonden/);
  const nep = await api('/api/mediaos/lijst/deel', { id: lijstId, codenaam: 'BestaatNiet' }, eigenaar.token);
  assert.equal(nep.status, 404);

  const goed = await api('/api/mediaos/lijst/deel', { id: lijstId, codenaam: vriend.codenaam }, eigenaar.token);
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  assert.deepEqual(goed.body.lijst.gedeeldMet, [vriend.codenaam], 'de eigenaar ziet met wie hij deelt');

  // en een ander kan niet zichzelf toevoegen
  const zelf = await api('/api/mediaos/lijst/deel', { id: lijstId, codenaam: vreemde.codenaam }, vreemde.token);
  assert.equal(zelf.status, 404, 'wie de lijst niet heeft, deelt hem ook niet');
});

test('2. de ander leest de lijst -- en lost hem op met ZIJN eigen sessie', async () => {
  const mijne = await api('/api/mediaos/lijsten', {}, vriend.token);
  assert.deepEqual(mijne.body.lijsten, [], 'het is niet zijn lijst');
  assert.equal((mijne.body.metMij || []).length, 1, 'maar hij staat wel onder "met mij gedeeld"');
  assert.equal(mijne.body.metMij[0].van, eigenaar.codenaam, 'met de naam van wie hem deelde');

  const bij = await api('/api/mediaos/lijst', { id: lijstId }, vriend.token);
  assert.equal(bij.status, 200, 'hij kan hem openen');
  assert.equal(bij.body.ikEigenaar, false);
  assert.equal(bij.body.stukken.length, 1, 'de muziek ziet hij');
  assert.equal(bij.body.stukken[0].id, 'track:' + uitgaveId);

  /* DE KERN. Het evenementkanaal staat wel in de lijst, maar niet in de wereld
     van deze lezer: zonder kaartje gaat die deur niet open. Hij ziet dus dat er
     iets stond en dat het er voor hem niet is -- geen kaart, geen kopie. */
  assert.equal(bij.body.verdwenen.length, 1, 'en het kanaal niet');
  assert.equal(bij.body.verdwenen[0].id, 'live:' + kanaalId);

  const eigen = await api('/api/mediaos/lijst', { id: lijstId }, eigenaar.token);
  assert.equal(eigen.body.stukken.length, 2, 'terwijl de eigenaar ze allebei ziet');
  assert.deepEqual(eigen.body.verdwenen, [], 'en bij hem is er niets verdwenen');
});

test('3. gedeeld is LEZEN, niet meeschrijven', async () => {
  const erin = await api('/api/mediaos/lijst/stuk', { id: lijstId, stukId: 'track:' + uitgaveId }, vriend.token);
  assert.equal(erin.status, 403, 'hij zet er niets in');
  assert.match(erin.body.error, /eigenaar/);
  const her = await api('/api/mediaos/lijst/zet', { id: lijstId, naam: 'Van mij nu' }, vriend.token);
  assert.equal(her.status, 403, 'hernoemt hem niet');
  const weg = await api('/api/mediaos/lijst/zet', { id: lijstId, weg: true }, vriend.token);
  assert.equal(weg.status, 403, 'en gooit hem niet weg');
  const nogSteeds = await api('/api/mediaos/lijst', { id: lijstId }, eigenaar.token);
  assert.equal(nogSteeds.body.lijst.naam, 'Voor de vrijdag', 'de lijst is onaangeroerd');
});

test('4. delen terugdraaien sluit de deur echt', async () => {
  const uit = await api('/api/mediaos/lijst/deel', { id: lijstId, codenaam: vriend.codenaam, aan: false }, eigenaar.token);
  assert.equal(uit.status, 200);
  assert.deepEqual(uit.body.lijst.gedeeldMet, []);

  const na = await api('/api/mediaos/lijst', { id: lijstId }, vriend.token);
  assert.equal(na.status, 404, 'daarna komt hij er niet meer in, ook niet met het id');
  const lijstjes = await api('/api/mediaos/lijsten', {}, vriend.token);
  assert.deepEqual(lijstjes.body.metMij, [], 'en de lijst staat niet meer bij hem');
});
