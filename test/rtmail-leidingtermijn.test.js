/* DE BEWAARTERMIJN VAN DE LEIDINGSPLEK (besluit 584A,
   kern/rtmail-leidingtermijn.js), op een echte server.

   Vier weken na binnenkomst; verlengen per bericht, alleen door een manager van
   deze zaak, met grondslag en noodzaak, tot hoogstens een jaar en in te
   trekken; een ronde zonder knop die een vernietigingsbewijs op de dag schrijft;
   een bewaring van een ander houdt niets vast; en oude post gaat pas weg na de
   juridische toets van de eigenaar, voor precies de set die hij vooraf zag.

   DE TIJD IS INGESTELD EN NIET AFGEWACHT: de toets zet `at` in de opslag terug en
   herstart. De bewaarveger draait ook bij de START, dus een herstart IS een
   ronde. De juridische hold staat in test/rtmail-leidinghold.test.js.

   Draai: node --test test/rtmail-leidingtermijn.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const crypto = require('crypto');
const { startServer, stopNet, kantoorKoppelBody } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

let srv, TMP, sleutel, teller = 10;
const id = {};
const env = () => ({ RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1', RTG_STORE: 'json' });
const api = (pad, body, token) => fetch(srv.base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function zaak(code) {
  const staff = (await api('/api/supplier/roster', { code })).body.staff;
  const tok = async (rol, pin) => {
    const s = staff.find(x => x.role === rol);
    return s ? { id: s.id, tok: (await api('/api/supplier/login', { code, staffId: s.id, pin })).body.token } : null;
  };
  return { m: await tok('manager', '1234'), w: await tok('staff', '5678') };
}
async function solliciteer(n, code) {
  const lid = (await api('/api/auth/register', { name: 'Termijn Proef' + n, email: 'termijn' + n + '@x.nl', phone: '06123499' + String(n).padStart(2, '0'),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  assert.equal((await api('/api/cv/save', { name: 'Termijn Proef', contact: 't@x.nl', skills: 'koken', experience: 'horeca' }, lid)).status, 200);
  assert.equal((await api('/api/member/apply', { supplierCode: code, func: 'Kok' }, lid)).status, 200);
}
const leidingIds = (db, code) => db.rtmail.leiding.filter(m => m.naar.startsWith(code.toLowerCase() + '@')).map(m => m.id);
async function herstart(pas) {
  await stopNet(srv.child);
  const pad = path.join(TMP, 'db.json');
  const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
  if (pas) pas(db);
  fs.writeFileSync(pad, JSON.stringify(db));
  srv = await startServer({ env: env() });
}
const inbox = async (tok) => (await api('/api/supplier/rtmail/inbox', {}, tok)).body.berichten.map(m => m.id);
const oud = (dagen) => new Date(Date.now() - dagen * 86400e3).toISOString();
const eigenaar = async () => (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
async function vinger(eig, actie) {
  const o = await api('/api/office/boardroom/bevestig/opties', { actie }, eig);
  assert.equal(o.status, 200, 'ceremonie voor ' + actie + ': ' + JSON.stringify(o.body).slice(0, 160));
  return { ceremonie: o.body.ceremonie, antwoord: sleutel.loginAntwoord(o.body.opties.challenge, new URL(srv.base).origin, ++teller) };
}

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leidingtermijn-'));
  srv = await startServer({ env: env() });
  for (const n of [1, 2, 3, 4]) await solliciteer(n, 'KIKUNOI');
  await solliciteer(5, 'LUZ');
  await herstart((db) => {
    [id.A, id.B, id.C, id.E] = leidingIds(db, 'KIKUNOI');
    id.D = leidingIds(db, 'LUZ')[0];
    assert.ok(id.A && id.B && id.C && id.E && id.D, 'vijf sollicitaties op de leidingsplek');
  });
});
test.after(async () => {
  try { await stopNet(srv.child); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. verlengen: per bericht, alleen een manager van deze zaak, met grondslag en noodzaak, hoogstens een jaar, in te trekken', async () => {
  const k = await zaak('KIKUNOI');
  const luz = await zaak('LUZ');
  const v = (body, tok) => api('/api/supplier/rtmail/leiding/verleng', body, tok);
  const goed = { ids: [id.B], dagen: 60, grondslag: 'lopende-procedure', noodzaak: 'tweede gesprek staat gepland' };
  const met = (x) => Object.assign({}, goed, x);
  assert.equal((await v(met({ ids: undefined }), k.m.tok)).status, 400, 'per zaak (zonder berichten) bestaat niet');
  const zonder = await v(met({ grondslag: '' }), k.m.tok);
  assert.equal(zonder.status, 400); assert.match(zonder.body.error, /grondslag/);
  assert.equal((await v(met({ grondslag: 'omdat het kan' }), k.m.tok)).status, 400, 'een grondslag buiten de lijst');
  assert.equal((await v(met({ grondslag: ['geschil'] }), k.m.tok)).status, 400, 'een grondslag is een tekst');
  assert.equal((await v(met({ dagen: '60' }), k.m.tok)).status, 400, 'dagen is een getal');
  assert.equal((await v(met({ dagen: 60.5 }), k.m.tok)).status, 400, 'dagen is een geheel getal');
  assert.equal((await v(met({ noodzaak: '' }), k.m.tok)).status, 400, 'zonder noodzaak');
  const jaar = await v(met({ dagen: 366 }), k.m.tok);
  assert.equal(jaar.status, 400); assert.match(jaar.body.error, /jaar/);
  const col = await v(goed, k.w.tok);
  assert.equal(col.status, 403); assert.match(col.body.error, /manager/);
  assert.equal((await v(met({ postvak: 'kikunoi@partner.rtg' }), luz.m.tok)).status, 403, 'een manager van een andere zaak');
  assert.equal((await v(goed, luz.m.tok)).status, 404, 'een bericht van een andere zaak verlengt hij niet');
  const ok = await v(goed, k.m.tok);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.verlenging.door, k.m.id, 'wie verlengt komt uit de inlog');
  assert.equal((await v(goed, k.m.tok)).status, 200, 'een tweede verlenging is een tweede besluit');
  // intrekken: terug naar 28 dagen, met een spoor
  assert.equal((await v(met({ ids: [id.E] }), k.m.tok)).status, 200);
  const terug = await v(met({ ids: [id.E], dagen: 28, noodzaak: 'gesprek afgezegd' }), k.m.tok);
  assert.equal(terug.status, 200, JSON.stringify(terug.body)); assert.equal(terug.body.verlenging, null);
  const bb = (await api('/api/supplier/rtmail/bewaarbeleid', {}, k.m.tok)).body;
  assert.equal(bb.leiding.termijnDagen, 28);
  assert.deepEqual(bb.leiding.verlengingen.map(x => x.id), [id.B], 'de ingetrokken verlenging staat er niet meer');
  assert.equal(bb.leiding.spoor.filter(x => x.id === id.B && x.door === k.m.id).length, 2, 'elke verlenging staat in het spoor');
  assert.ok(bb.leiding.spoor.some(x => x.id === id.E && x.actie === 'ingetrokken'), 'het intrekken staat in het spoor');
  assert.doesNotMatch(bb.let, /zodra iemand/);
  assert.equal((await api('/api/supplier/rtmail/bewaarbeleid', {}, k.w.tok)).body.leiding, undefined, 'een collega ziet de leidingsplek niet');
  // de juridische bewaring van een collega en van een andere zaak raakt de leidingsplek niet
  assert.equal((await api('/api/supplier/rtmail/bewaring', { aan: true, zaak: 'Z-8', reden: 'collega' }, k.w.tok)).status, 200);
  assert.equal((await api('/api/supplier/rtmail/bewaring', { aan: true, zaak: 'Z-9', reden: 'geschil' }, luz.m.tok)).status, 200);
});

test('2. de ronde: na vier weken weg met een bewijs op de dag; verlengd en oud blijft, een bewaring van een ander niet', async () => {
  await herstart((db) => {
    const zet = (x, dagen, f) => { const m = db.rtmail.leiding.find(r => r.id === x); m.at = oud(dagen); if (f) f(m); };
    zet(id.A, 29); zet(id.B, 29); zet(id.E, 10); zet(id.D, 40);
    zet(id.C, 60, (m) => { delete m.regel; });   // van voor de termijnregel
  });
  const k = await zaak('KIKUNOI');
  const ids = await inbox(k.m.tok);
  assert.ok(!ids.includes(id.A), 'na vier weken is sollicitatiepost weg, ook onder de bewaring van een collega');
  assert.ok(ids.includes(id.B), 'een verlenging houdt hem vast');
  assert.ok(ids.includes(id.E), 'binnen de vier weken blijft hij');
  assert.ok(ids.includes(id.C), 'bestaande post gaat niet weg zonder juridische toets');
  assert.ok(!(await inbox((await zaak('LUZ')).m.tok)).includes(id.D), 'de bewaring van het gedeelde postvak houdt de leidingsplek niet vast');
  const bewijs = (await api('/api/supplier/rtmail/vernietigingen', {}, k.m.tok)).body.bewijs;
  const r = bewijs.find(v => v.plek === 'leiding');
  assert.ok(r, 'de ronde schrijft een vernietigingsbewijs');
  assert.equal(r.aantal, 1); assert.equal(r.door, 'systeem: dagelijkse ronde'); assert.equal(r.postvak, 'kikunoi');
  assert.match(r.van, /^\d{4}-\d{2}-\d{2}$/, 'op de dag afgerond'); assert.match(r.tot, /^\d{4}-\d{2}-\d{2}$/);
  assert.doesNotMatch(JSON.stringify(r), /codenaam|Nieuwe sollicitatie|Kok|"(tekst|onderwerp|naar)"/, 'geen inhoud en geen sollicitant in het bewijs');
  assert.ok(!(await api('/api/supplier/rtmail/vernietigingen', {}, k.w.tok)).body.bewijs.some(v => v.plek === 'leiding'));
  const wacht = await api('/api/supplier/rtmail/leiding/verleng', { ids: [id.C], dagen: 60, grondslag: 'geschil', noodzaak: 'x' }, k.m.tok);
  assert.equal(wacht.status, 409); assert.match(wacht.body.error, /juridische toets/, 'oude post verlengen kan niet: de toets beslist');
  const mig = (await api('/api/supplier/rtmail/bewaarbeleid', {}, k.m.tok)).body.leiding.migratie;
  assert.equal(mig.getoetst, false); assert.equal(mig.wachtOpToets, 1);
});

test('3. de juridische toets: de eigenaar op naam, met een verse passkey, voor precies de getoonde set', async () => {
  const kantoor = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.notEqual((await api('/api/office/rtmail/leiding/toets', { stap: 'omvang' }, kantoor)).status, 200, 'de gedeelde kantoorcode');
  const eig = await eigenaar();
  // een vertrouweling met een boardroomsleutel is niet de eigenaar
  const v = (await api('/api/auth/register', { name: 'Vertrouweling Toets', email: 'vtoets@x.nl', phone: '0612349977',
    password: 'geheim123', geboortedatum: '1991-02-02', tier: 'business', pasApp: 'business' })).body.token;
  const cn = (await api('/api/auth/me', {}, v)).body.user.codename;
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: cn }, eig)).status, 200);
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, v), v)).status, 200);
  const vk = (await api('/api/account/start', { rol: 'kantoor' }, v)).body.token;
  const nee = await api('/api/office/rtmail/leiding/toets', { stap: 'omvang' }, vk);
  assert.equal(nee.status, 403, JSON.stringify(nee.body)); assert.match(nee.body.error, /eigenaar/);
  // de omvang: per zaak, op de dag, met een vingerafdruk
  const o1 = (await api('/api/office/rtmail/leiding/toets', { stap: 'omvang' }, eig)).body;
  assert.deepEqual(o1.ids, [id.C]); assert.equal(o1.perZaak.kikunoi.aantal, 1);
  assert.match(o1.perZaak.kikunoi.oudste, /^\d{4}-\d{2}-\d{2}$/);
  // zonder passkey: 403, ook voor de eigenaar
  const kaal = await api('/api/office/rtmail/leiding/toets', { getoetst: true, vingerafdruk: o1.vingerafdruk }, eig);
  assert.equal(kaal.status, 403, JSON.stringify(kaal.body)); assert.match(kaal.body.error, /passkey/);
  sleutel = maakAuthenticator(new URL(srv.base).hostname);
  const opt = await api('/api/webauthn/registreer/opties', { huidig: 'Imran' }, eig);
  assert.equal((await api('/api/webauthn/registreer', { antwoord: sleutel.registratieAntwoord(opt.body.opties.challenge, new URL(srv.base).origin),
    naam: 'Toestel eigenaar' }, eig)).status, 200, 'de passkey staat');
  // de set verandert (een verdwaald oud bericht komt binnen) en de oude vingerafdruk weigert
  const vreemd = { id: 'oud-verdwaald', van: 'rtg@rtmail', naar: 'kikunoi@partner.rtg', soort: 'personeel', onderwerp: 'Nieuwe sollicitatie',
    tekst: 'x', at: oud(5), gelezen: false, bron: 'systeem', draad: 'oud-verdwaald' };
  await herstart((db) => { db.rtmail.berichten.unshift(vreemd); });
  const eig2 = await eigenaar();
  const oudeSet = await api('/api/office/rtmail/leiding/toets', Object.assign({ getoetst: true, vingerafdruk: o1.vingerafdruk },
    await vinger(eig2, 'eigenaar-leidingtoets')), eig2);
  assert.equal(oudeSet.status, 409, JSON.stringify(oudeSet.body)); assert.match(oudeSet.body.error, /veranderd/);
  const o2 = (await api('/api/office/rtmail/leiding/toets', { stap: 'omvang' }, eig2)).body;
  assert.deepEqual(o2.ids, [id.C, 'oud-verdwaald'].sort());
  const t = await api('/api/office/rtmail/leiding/toets', Object.assign({ getoetst: true, vingerafdruk: o2.vingerafdruk, notitie: 'nagelopen' },
    await vinger(eig2, 'eigenaar-leidingtoets')), eig2);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.ok(t.body.toets.getoetst && t.body.toets.door, 'op naam');
  await herstart();
  const k = await zaak('KIKUNOI');
  const ids = await inbox(k.m.tok);
  assert.ok(!ids.includes(id.C), 'met de toets ruimt de ronde oude post uit de set op');
  assert.ok(ids.includes('oud-verdwaald'), 'binnen de termijn blijft ook goedgekeurde oude post');
  assert.ok(ids.includes(id.B) && ids.includes(id.E));
  const mig = (await api('/api/supplier/rtmail/bewaarbeleid', {}, k.m.tok)).body.leiding.migratie;
  assert.equal(mig.wachtOpToets, 0); assert.equal(mig.toets.door, 'de eigenaar', 'een label en geen accountsleutel');
});

test('4. de leidingsplek is vol: weigeren, nooit stil wegkappen', () => {
  const data = { berichten: [], leiding: [] };
  const fabriek = require('../server/kern/rtmail-leiding');
  const l = fabriek({ ruw: () => data, heeft: () => true, save: () => {}, crypto, klokDatum: () => new Date(),
    normAdres: (a) => a + '@partner.rtg', zelfdeBus: (a, b) => a === b, zegel: () => {}, scanLinks: () => [],
    pub: (m) => m, kap: (s, n) => String(s || '').slice(0, n), MAX: 2 });
  for (const n of [1, 2]) assert.ok(!l.leg({ naar: 'kik', onderwerp: 'Nieuwe sollicitatie', tekst: 'x' + n, soort: 'personeel', beperkt: 'werving' }).error);
  const vol = l.leg({ naar: 'kik', onderwerp: 'Nieuwe sollicitatie', tekst: 'x3', soort: 'personeel', beperkt: 'werving' });
  assert.match(vol.error || '', /vol/);
  assert.equal(data.leiding.length, 2, 'er is niets stil weggegooid');
  assert.deepEqual(data.leiding.map(m => m.tekst), ['x2', 'x1']);
});
