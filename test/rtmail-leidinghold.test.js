/* DE JURIDISCHE HOLD OP SOLLICITATIEPOST (besluit 584A, aanscherping van de
   eigenaar; kern/rtmail-leidinghold.js), op een echte server.

   Een manager van de zaak vraagt aan, met grondslag, doel en
   herbeoordelingsdatum; pas na een beoordeling door een tweede, bevoegde mens met
   een verse passkey houdt de hold iets vast -- dan ook voorbij een jaar en ook
   na de juridische toets. Een verlopen herbeoordeling laat de post staan
   (besluit van de eigenaar: vasthouden) maar escaleert elke ronde, tot iemand
   herbeoordeelt.

   De tijd is INGESTELD: de toets zet `at` en de herbeoordelingsdatum in de
   opslag terug en herstart; een herstart is een ronde van de bewaarveger.

   Draai: node --test test/rtmail-leidinghold.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const crypto = require('crypto');
const { startServer, stopNet, kantoorKoppelBody } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

let srv, TMP, sleutel, teller = 10, hold1, hold2;
const id = {};
const env = () => ({ RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1', RTG_STORE: 'json' });
const api = (pad, body, token) => fetch(srv.base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function zaak(code = 'KIKUNOI') {
  const staff = (await api('/api/supplier/roster', { code })).body.staff;
  const tok = async (rol, pin) => {
    const s = staff.find(x => x.role === rol);
    return { id: s.id, tok: (await api('/api/supplier/login', { code, staffId: s.id, pin })).body.token };
  };
  return { m: await tok('manager', '1234'), w: await tok('staff', '5678') };
}
async function herstart(pas, sql) {
  await stopNet(srv.child);
  const pad = path.join(TMP, 'db.json');
  const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
  if (pas) pas(db);
  fs.writeFileSync(pad, JSON.stringify(db));
  if (sql) { const { DatabaseSync } = require('node:sqlite'); const d = new DatabaseSync(path.join(TMP, 'rtg.db')); sql(d); d.close(); }
  srv = await startServer({ env: env() });
}
const oud = (dagen) => new Date(Date.now() - dagen * 86400e3).toISOString();
const datum = (dagen) => new Date(Date.now() + dagen * 86400e3).toISOString().slice(0, 10);
const inbox = async (tok) => (await api('/api/supplier/rtmail/inbox', {}, tok)).body.berichten.map(m => m.id);
const eigenaar = async () => (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
async function vinger(eig, actie, s = sleutel) {
  const o = await api('/api/office/boardroom/bevestig/opties', { actie }, eig);
  assert.equal(o.status, 200, 'ceremonie voor ' + actie + ': ' + JSON.stringify(o.body).slice(0, 160));
  return { ceremonie: o.body.ceremonie, antwoord: s.loginAntwoord(o.body.opties.challenge, new URL(srv.base).origin, ++teller) };
}
const beoordeel = async (eig, body, s = sleutel) => api('/api/office/rtmail/leiding/hold', Object.assign(body, await vinger(eig, 'eigenaar-leidinghold', s)), eig);
let tweede, tweedeLid, tweedeSleutel, luzPost, twee, tweeSleutel;   // de manager van KIKUNOI met een eigen account, die ook een boardroomsleutel heeft

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leidinghold-'));
  srv = await startServer({ env: env() });
  for (const n of [1, 2, 3]) {
    const lid = (await api('/api/auth/register', { name: 'Hold Proef' + n, email: 'hold' + n + '@x.nl', phone: '06123488' + String(n).padStart(2, '0'),
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    assert.equal((await api('/api/cv/save', { name: 'Hold Proef', contact: 'h@x.nl', skills: 'koken', experience: 'horeca' }, lid)).status, 200);
    assert.equal((await api('/api/member/apply', { supplierCode: 'KIKUNOI', func: 'Kok' }, lid)).status, 200);
  }
  [id.H1, id.H2, id.H3] = (await api('/api/supplier/rtmail/inbox', {}, (await zaak()).m.tok)).body.berichten
    .filter(m => m.onderwerp === 'Nieuwe sollicitatie').map(m => m.id);
  assert.ok(id.H1 && id.H2 && id.H3);
  // een sollicitatie bij LUZ, waarvan de manager met een PIN inlogt (geen account)
  const l4 = (await api('/api/auth/register', { name: 'Hold Proef4', email: 'hold4@x.nl', phone: '0612348804',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
  await api('/api/cv/save', { name: 'Hold Proef', contact: 'h@x.nl', skills: 'koken', experience: 'horeca' }, l4);
  assert.equal((await api('/api/member/apply', { supplierCode: 'LUZ', func: 'Kok' }, l4)).status, 200);
  luzPost = (await api('/api/supplier/rtmail/inbox', {}, (await zaak('LUZ')).m.tok)).body.berichten.find(m => m.onderwerp === 'Nieuwe sollicitatie').id;
  /* De manager van KIKUNOI krijgt een eigen account, en dat account krijgt ook een
     boardroomsleutel: een persoon die aanvraagt en zou kunnen beoordelen. */
  const t = (await api('/api/auth/register', { name: 'Manager Tweede', email: 'mtweede@x.nl', phone: '0612348899',
    password: 'geheim123', geboortedatum: '1988-03-03', tier: 'business', pasApp: 'business' })).body.token;
  const me = (await api('/api/auth/me', {}, t)).body.user;
  const eig = await eigenaar();
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: me.codename }, eig)).status, 200);
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, t), t)).status, 200);
  const mgr = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body.staff.find(x => x.role === 'manager');
  await herstart(null, (d) => d.prepare('UPDATE supplier_staff SET member_id = ? WHERE id = ?').run(Number(me.id), Number(mgr.id)));
  tweedeLid = t;
  const st = await api('/api/account/start', { rol: 'kantoor' }, t);
  tweede = st.body.token;
  assert.ok(tweede, 'de manager komt ook het kantoor in: ' + JSON.stringify(st.body).slice(0, 300));
  tweedeSleutel = maakAuthenticator(new URL(srv.base).hostname);
  const o = await api('/api/webauthn/registreer/opties', {}, t);
  assert.equal((await api('/api/webauthn/registreer', { antwoord: tweedeSleutel.registratieAntwoord(o.body.opties.challenge, new URL(srv.base).origin),
    naam: 'Toestel tweede' }, t)).status, 200, 'de passkey van de tweede staat');
  /* Een TWEEDE account van dezelfde mens: hetzelfde telefoonnummer, dus de kluis
     koppelt ze. Ook dat account krijgt een boardroomsleutel. */
  const tw = await api('/api/auth/register', { name: 'Manager Tweeling', email: 'mtweeling@x.nl', phone: '0612348899',
    password: 'geheim123', geboortedatum: '1988-03-03', tier: 'business', pasApp: 'business' });
  assert.equal(tw.status, 200, 'een tweede account met hetzelfde nummer: ' + JSON.stringify(tw.body).slice(0, 200));
  const cn2 = (await api('/api/auth/me', {}, tw.body.token)).body.user.codename;
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: cn2 }, await eigenaar())).status, 200);
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, tw.body.token), tw.body.token)).status, 200);
  twee = (await api('/api/account/start', { rol: 'kantoor' }, tw.body.token)).body.token;
  tweeSleutel = maakAuthenticator(new URL(srv.base).hostname);
  const o2 = await api('/api/webauthn/registreer/opties', {}, tw.body.token);
  assert.equal((await api('/api/webauthn/registreer', { antwoord: tweeSleutel.registratieAntwoord(o2.body.opties.challenge, new URL(srv.base).origin),
    naam: 'Toestel tweeling' }, tw.body.token)).status, 200);
});
test.after(async () => {
  try { await stopNet(srv.child); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. aanvragen: alleen een manager van de zaak, met grondslag, doel en een herbeoordeling in de toekomst', async () => {
  const k = await zaak();
  const vraag = (body, tok) => api('/api/supplier/rtmail/leiding/hold', body, tok);
  const goed = { ids: [id.H1], grondslag: 'geschil', doel: 'procedure bij de geschillencommissie', herbeoordeling: datum(30) };
  const met = (x) => Object.assign({}, goed, x);
  assert.equal((await vraag(goed, k.w.tok)).status, 403, 'een collega');
  assert.equal((await vraag(met({ grondslag: 'lopende-procedure' }), k.m.tok)).status, 400, 'een grondslag buiten de lijst van de hold');
  assert.equal((await vraag(met({ doel: '' }), k.m.tok)).status, 400, 'zonder doel');
  assert.equal((await vraag(met({ herbeoordeling: datum(-1) }), k.m.tok)).status, 400, 'een herbeoordeling in het verleden');
  assert.equal((await vraag(met({ herbeoordeling: '2027-02-31' }), k.m.tok)).status, 400, 'een dag die niet bestaat');
  assert.equal((await vraag(met({ herbeoordeling: datum(400) }), k.m.tok)).status, 400, 'meer dan twaalf maanden vooruit');
  assert.equal((await vraag(met({ ids: [] }), k.m.tok)).status, 400, 'nooit voor post die nog moet komen');
  const h1 = await vraag(goed, k.m.tok);
  assert.equal(h1.status, 200, JSON.stringify(h1.body)); assert.equal(h1.body.hold.stand, 'aangevraagd'); hold1 = h1.body.hold.id;
  assert.equal(h1.body.hold.aangevraagdDoor, k.m.id, 'de aanvrager komt uit de inlog');
  assert.match(String(h1.body.hold.aanvragerSleutel), /^user-\d+$/, 'en zijn account ook');
  const h2 = await vraag(met({ ids: [id.H2], grondslag: 'wettelijke-plicht', doel: 'fiscale bewaarplicht' }), k.m.tok);
  assert.equal(h2.status, 200); hold2 = h2.body.hold.id;
});

test('2. beoordelen: een verse passkey, en dan houdt alleen de BEOORDEELDE hold vast -- ook voorbij een jaar', async () => {
  const eig = await eigenaar();
  const kaal = await api('/api/office/rtmail/leiding/hold', { id: hold2, actie: 'goedkeuren' }, eig);
  assert.equal(kaal.status, 403, 'zonder passkey: ' + JSON.stringify(kaal.body)); assert.match(kaal.body.error, /passkey/);
  sleutel = maakAuthenticator(new URL(srv.base).hostname);
  const opt = await api('/api/webauthn/registreer/opties', {}, eig);
  assert.equal((await api('/api/webauthn/registreer', { antwoord: sleutel.registratieAntwoord(opt.body.opties.challenge, new URL(srv.base).origin),
    naam: 'Toestel eigenaar' }, eig)).status, 200);
  // de manager die aanvroeg, met een boardroomsleutel en een verse passkey: zijn eigen hold niet
  const zelf = await beoordeel(tweede, { id: hold1, actie: 'goedkeuren' }, tweedeSleutel);
  assert.equal(zelf.status, 403, 'zelfbeoordeling: ' + JSON.stringify(zelf.body)); assert.match(zelf.body.error, /ander account/);
  // en ook niet vanaf een ander account dat volgens de kluis dezelfde mens is
  const tweeling = await beoordeel(twee, { id: hold1, actie: 'goedkeuren' }, tweeSleutel);
  assert.equal(tweeling.status, 403, 'zelfde mens: ' + JSON.stringify(tweeling.body)); assert.match(tweeling.body.error, /dezelfde mens/);
  const ok = await beoordeel(eig, { id: hold2, actie: 'goedkeuren' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.body.hold.stand, 'beoordeeld');
  assert.equal(ok.body.hold.onafhankelijkheid, 'ander-account', 'twee accounts, niet bewezen twee mensen');
  // een hold van een manager die met een PIN inlogt: niet vast te stellen wie aanvroeg
  const luz = await zaak('LUZ');
  const pin = await api('/api/supplier/rtmail/leiding/hold', { ids: [luzPost], grondslag: 'geschil', doel: 'x', herbeoordeling: datum(30) }, luz.m.tok);
  assert.equal(pin.status, 200, JSON.stringify(pin.body)); assert.equal(pin.body.hold.aanvragerSleutel, null);
  const pinB = await beoordeel(eig, { id: pin.body.hold.id, actie: 'goedkeuren' });
  assert.equal(pinB.status, 409, 'een ontbrekende sleutel valt dicht: ' + JSON.stringify(pinB.body)); assert.match(pinB.body.error, /inlog zonder account/);
  // de tijd: H1 (hold niet beoordeeld) en H3 (geen hold) 29 dagen, H2 (beoordeeld) 400 dagen
  await herstart((db) => {
    const zet = (x, dagen) => { db.rtmail.leiding.find(r => r.id === x).at = oud(dagen); };
    zet(id.H1, 29); zet(id.H3, 29); zet(id.H2, 400);
  });
  const ids = await inbox((await zaak()).m.tok);
  assert.ok(!ids.includes(id.H1), 'een hold zonder beoordeling houdt niets vast');
  assert.ok(!ids.includes(id.H3));
  assert.ok(ids.includes(id.H2), 'een beoordeelde hold houdt vast, ook voorbij een jaar');
  const v = await api('/api/supplier/rtmail/leiding/verleng', { ids: [id.H2], dagen: 60, grondslag: 'geschil', noodzaak: 'x' }, (await zaak()).m.tok);
  assert.equal(v.status, 409); assert.match(v.body.error, /al verlopen/, 'een verlenging na verloop kan niet');
});

test('3. de toets laat post onder een hold staan, en een verlopen herbeoordeling escaleert tot iemand herbeoordeelt', async () => {
  // H2 is van voor de regel, en de herbeoordelingsdatum ligt achter ons
  await herstart((db) => {
    delete db.rtmail.leiding.find(r => r.id === id.H2).regel;
    db.rtmailBewaar.leiding.holds.find(h => h.id === hold2).herbeoordeling = datum(-2);
  });
  const eig = await eigenaar();
  const o = (await api('/api/office/rtmail/leiding/toets', { stap: 'omvang' }, eig)).body;
  assert.ok(!o.ids.includes(id.H2), 'post onder een beoordeelde hold valt niet onder de toets');
  assert.equal((await api('/api/office/rtmail/leiding/toets', Object.assign({ getoetst: true, vingerafdruk: o.vingerafdruk },
    await vinger(eig, 'eigenaar-leidingtoets')), eig)).status, 200);
  await herstart();
  const k = await zaak();
  assert.ok((await inbox(k.m.tok)).includes(id.H2), 'na de toets en de ronde staat hij er nog: vasthouden');
  const eig2 = await eigenaar();
  const lijst = (await api('/api/office/rtmail/leiding/hold', {}, eig2)).body.holds;
  const h = lijst.find(x => x.id === hold2);
  assert.ok(h.verlopen && h.escalatie && h.escalatie.aantal >= 1, 'een verlopen herbeoordeling escaleert: ' + JSON.stringify(h));
  const bb = (await api('/api/supplier/rtmail/bewaarbeleid', {}, k.m.tok)).body.leiding;
  assert.match(bb.holds.find(x => x.id === hold2).let, /herbeoordeling verlopen sinds \d{4}-\d{2}-\d{2}/);
  // een kale nieuwe datum, een datum verder dan twaalf maanden, of de aanvrager zelf: geen herbeoordeling
  const kaal = await beoordeel(eig2, { id: hold2, actie: 'herbeoordeel', herbeoordeling: datum(90) });
  assert.equal(kaal.status, 400, 'zonder grondslag en doel: ' + JSON.stringify(kaal.body));
  assert.equal((await beoordeel(eig2, { id: hold2, actie: 'herbeoordeel', grondslag: 'wettelijke-plicht', herbeoordeling: datum(90) })).status, 400, 'zonder doel');
  assert.equal((await beoordeel(eig2, { id: hold2, actie: 'herbeoordeel', doel: 'fiscaal', herbeoordeling: datum(90) })).status, 400, 'zonder grondslag');
  assert.equal((await beoordeel(eig2, { id: hold2, actie: 'herbeoordeel', grondslag: 'wettelijke-plicht', doel: 'fiscaal',
    herbeoordeling: datum(400) })).status, 400, 'verder dan twaalf maanden na deze beoordeling');
  const tw2 = (await api('/api/account/start', { rol: 'kantoor' }, tweedeLid)).body.token;
  const zelfHer = await beoordeel(tw2, { id: hold2, actie: 'herbeoordeel', grondslag: 'wettelijke-plicht', doel: 'fiscaal', herbeoordeling: datum(90) }, tweedeSleutel);
  assert.equal(zelfHer.status, 403, 'de aanvrager herbeoordeelt niet zelf: ' + JSON.stringify(zelfHer.body));
  // zonder herbeoordeling blijft hij staan en blijft hij geescaleerd
  await herstart();
  const nog = (await api('/api/office/rtmail/leiding/hold', {}, await eigenaar())).body.holds.find(x => x.id === hold2);
  assert.ok(nog.verlopen && nog.escalatie.aantal > h.escalatie.aantal, 'de escalatie herhaalt zich: ' + JSON.stringify(nog.escalatie));
  assert.ok((await inbox((await zaak()).m.tok)).includes(id.H2), 'en de post staat er nog');
  // een volledige herbeoordeling: grondslag en doel opnieuw, binnen twaalf maanden -- geen escalatie meer
  const eig3 = await eigenaar();
  const her = await beoordeel(eig3, { id: hold2, actie: 'herbeoordeel', grondslag: 'wettelijke-plicht', doel: 'fiscale bewaarplicht, nagelopen', herbeoordeling: datum(90) });
  assert.equal(her.status, 200, JSON.stringify(her.body));
  assert.equal(her.body.hold.doel, 'fiscale bewaarplicht, nagelopen');
  await herstart();
  const na = (await api('/api/office/rtmail/leiding/hold', {}, await eigenaar())).body.holds.find(x => x.id === hold2);
  assert.ok(!na.verlopen && !na.escalatie, 'na herbeoordeling geen escalatie meer');
  assert.ok((await inbox((await zaak()).m.tok)).includes(id.H2));
});

test('4. de aanvrager beoordeelt zijn eigen hold niet', () => {
  const B = { leiding: { spoor: [] }, vernietigingen: [] };
  const h = require('../server/kern/rtmail-leidinghold')({ L: () => B.leiding, lees: () => B.leiding,
    plek: () => [{ id: 'm1', naar: 'kik@partner.rtg' }], save: () => {}, busVan: (a) => String(a).split('@')[0],
    kap: (s, n) => String(s || '').slice(0, n), nu: () => new Date().toISOString(), crypto });
  const a = h.aanvraag({ adres: 'kik@partner.rtg', ids: ['m1'], grondslag: 'geschil', doel: 'd', herbeoordeling: datum(10), door: 7, sleutel: 'user-5' });
  assert.ok(a.ok);
  const zelf = h.beoordeel({ id: a.hold.id, actie: 'goedkeuren', wie: 'user-5' });
  assert.equal(zelf.status, 403); assert.match(zelf.error, /ander account/);
  assert.equal(h.beoordeel({ id: a.hold.id, actie: 'goedkeuren', wie: 'user-1', zelfdeMens: () => 'onbekend' }).status, 409, 'niet vast te stellen: dicht');
  assert.equal(h.beoordeel({ id: a.hold.id, actie: 'goedkeuren', wie: 'user-1' }).status, 409, 'zonder kluisvraag: dicht');
  assert.equal(h.beoordeel({ id: a.hold.id, actie: 'goedkeuren', wie: 'user-1', zelfdeMens: () => 'zelfde' }).status, 403, 'dezelfde mens');
  assert.equal(h.beoordeel({ id: a.hold.id, actie: 'goedkeuren', wie: 'user-1', zelfdeMens: () => 'ander' }).hold.onafhankelijkheid, 'ander-account', 'een ander account wel');
  // datums: een dag die niet bestaat, en verder dan twaalf maanden
  for (const d of ['2027-02-31', '2026-13-01', datum(400)])
    assert.equal(h.aanvraag({ adres: 'kik@partner.rtg', ids: ['m1'], grondslag: 'geschil', doel: 'd', herbeoordeling: d, door: 7, sleutel: 'user-5' }).status, 400, d);
});

test('5. de bewaarveger logt verlopen holds, ook als er niets verdwijnt', () => {
  const regels = [];
  const { maakBewaarveger } = require('../server/bewaarveger');
  const v = maakBewaarveger({ db: { data: { live: {} } }, save: () => {}, accounts: { listByVerification: () => [] },
    identiteitsmap: { wisAllesVan: () => {} }, nu: () => Date.now(),
    log: { schrijf: (niveau, wat, velden) => regels.push({ niveau, wat, velden }) },
    leidingVeeg: () => ({ verwijderd: 0, wachtOpToets: 0, vastgehouden: 1, holdsVerlopen: 1, let: 'x' }) });
  assert.equal(v.veeg().leidingpost.holdsVerlopen, 1);
  const r = regels.find(x => x.wat === 'bewaarveger-leidingpost');
  assert.ok(r && r.velden.holdsVerlopen === 1, 'een verlopen hold staat in de log: ' + JSON.stringify(regels));
});
