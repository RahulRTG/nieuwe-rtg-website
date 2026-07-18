/* De eigen boardroom van elk lid (kern/lidboard.js + routes):
   1. een lid ziet zijn bord met vier groepen en zet er functies aan/uit; de
      stand blijft server-side bewaard.
   2. privacy by design: gevoelige deel-functies staan standaard uit.
   3. een ouder/beheerder stuurt de boardroom van zijn beschermde kind bij; de
      voogd-check houdt een vreemde ouder buiten, en kind-functies (paspoort,
      Pay, Care) horen niet op een kinder-bord.
   Draai los: node --experimental-sqlite --test test/lidboard.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, BASE;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidboard-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  BASE = srv.base;
});
test.after(() => stop(srv && srv.child));

const json = r => r.json();
function api(pad, body) { return fetch(BASE + '/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
function soc(pad, body) { return fetch(BASE + '/api/rtf/social' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
async function lid(naam) {
  const reg = await json(await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: naam, email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233', password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' })
  }));
  const call = (pad, body) => fetch(BASE + '/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: JSON.stringify(body || {}) });
  return { token: reg.token, call };
}
async function gezinMetKind(naam) {
  const g = await json(await api('/gezin/maak', { gezinsnaam: naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tiener', rol: 'gezinslid', groep: 'tiener' }));
  const kidToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const conn = await json(await soc('/connections', { code: g.code, token: kidToken }));
  return { g, kidHandle: conn.me };
}

test('een lid ziet zijn boardroom met vier groepen en de juiste standaarden', async () => {
  const l = await lid('Board Lid');
  const r = await json(await l.call('/member/boardroom', {}));
  const cats = r.bord.categorieen.map(c => c.id);
  assert.deepEqual(cats, ['app', 'privacy', 'ai', 'verbinding'], 'vier groepen in de juiste volgorde');
  const alle = r.bord.categorieen.flatMap(c => c.functies);
  const vind = id => alle.find(f => f.id === id);
  assert.equal(vind('salon').aan, true, 'De Salon staat standaard aan');
  assert.equal(vind('locatie').aan, false, 'Locatie delen staat standaard uit (privacy by design)');
  assert.equal(vind('gps').aan, false, 'GPS staat standaard uit');
  assert.equal(vind('rahul').aan, true, 'Rahul staat standaard aan');
});

test('een lid zet een functie uit en de stand blijft bewaard', async () => {
  const l = await lid('Schakel Lid');
  const zet = await json(await l.call('/member/boardroom/zet', { id: 'spelen', aan: false }));
  assert.equal(zet.ok, true);
  const na = await json(await l.call('/member/boardroom', {}));
  const spelen = na.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'spelen');
  assert.equal(spelen.aan, false, 'Spelen blijft uit na opnieuw ophalen');
});

test('de boardroom is niet voor gasten (geen account, geen toegang)', async () => {
  const r = await fetch(BASE + '/api/member/boardroom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.notEqual(r.status, 200, 'zonder geldig lid-account geen boardroom');
});

test('handhaving: een uitgezette functie zet ook de API dicht', async () => {
  const l = await lid('Handhaaf Lid');
  // standaard aan: de handhaving grijpt niet in (geen functieUit-markering)
  const voor = await (await l.call('/pay', {})).json().catch(() => ({}));
  assert.notEqual(voor.functieUit, 'pay', 'pay is standaard toegestaan');
  // uitzetten in de eigen boardroom
  await l.call('/member/boardroom/zet', { id: 'pay', aan: false });
  const dicht = await l.call('/pay', {});
  assert.equal(dicht.status, 403, 'pay is nu dicht');
  assert.equal((await dicht.json().catch(() => ({}))).functieUit, 'pay', 'met de juiste reden');
  // de boardroom zelf blijft altijd bereikbaar (niet gemapt)
  assert.equal((await l.call('/member/boardroom', {})).status, 200, 'je bord blijft bereikbaar');
  // weer aanzetten: weer toegankelijk
  await l.call('/member/boardroom/zet', { id: 'pay', aan: true });
  const weer = await (await l.call('/pay', {})).json().catch(() => ({}));
  assert.notEqual(weer.functieUit, 'pay', 'pay is weer toegestaan');
});

test('een ouder stuurt de boardroom van zijn beschermde kind bij', async () => {
  const fam = await gezinMetKind('Schild');
  const bord = await json(await soc('/kind/boardroom', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle }));
  const ids = bord.bord.categorieen.flatMap(c => c.functies.map(f => f.id));
  assert.ok(ids.includes('salon'), 'het kinder-bord toont De Salon');
  assert.ok(!ids.includes('paspoort'), 'paspoort delen hoort niet op een kinder-bord');
  assert.ok(!ids.includes('pay'), 'RTG Pay hoort niet op een kinder-bord');
  // de ouder zet Spelen uit voor het kind
  const zet = await json(await soc('/kind/boardroom/zet', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle, id: 'spelen', aan: false }));
  assert.equal(zet.ok, true, 'de ouder mag schakelen voor het eigen kind');
  const na = await json(await soc('/kind/boardroom', { code: fam.g.code, token: fam.g.token, kindHandle: fam.kidHandle }));
  assert.equal(na.bord.categorieen.flatMap(c => c.functies).find(f => f.id === 'spelen').aan, false);
});

test('een vreemde ouder kan de boardroom van andermans kind niet aanraken', async () => {
  const famA = await gezinMetKind('Noord');
  const famB = await gezinMetKind('Zuid');
  // ouder B probeert het kind van gezin A te beheren
  const r = await soc('/kind/boardroom', { code: famB.g.code, token: famB.g.token, kindHandle: famA.kidHandle });
  assert.equal(r.status, 403, 'geen toegang tot een kind van een ander gezin');
  const zet = await soc('/kind/boardroom/zet', { code: famB.g.code, token: famB.g.token, kindHandle: famA.kidHandle, id: 'salon', aan: false });
  assert.equal(zet.status, 403, 'ook schakelen wordt geweigerd');
});
