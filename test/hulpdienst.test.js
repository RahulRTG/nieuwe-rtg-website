/* De hulpdiensten-toren: zes korpsen met een meldkamer, eenheden over land,
   water en door de lucht, bijstand tussen korpsen (special forces alleen via
   de politie), de keten ambulance -> ziekenhuis (beddenbord en opnames), de
   consulten van de huisarts en de meldkamer-AI. Draai los:
   node --experimental-sqlite --test test/hulpdienst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const tokens = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hulp-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function korpsLogin(code) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = roster.body.staff.find(m => m.role === 'manager');
  const login = await api('/api/supplier/login', { code, staffId: chef.id, pin: '1234' });
  assert.ok(login.body.token, code + ' is aangemeld');
  return login.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  for (const c of ['GUARDIA', 'BOMBERS', 'URGENCIA', 'CANMISSES', 'CONSULTA', 'FALCO'])
    tokens[c] = await korpsLogin(c);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. elk korps heeft een bord met eenheden over land, water en door de lucht', async () => {
  const p = await api('/api/supplier/hulp/overzicht', {}, tokens.GUARDIA);
  assert.equal(p.status, 200);
  const soorten = p.body.eenheden.map(e => e.soort);
  for (const s of ['land', 'heli', 'lucht', 'water']) assert.ok(soorten.includes(s), 'politie heeft een ' + s + '-eenheid');
  const b = await api('/api/supplier/hulp/overzicht', {}, tokens.BOMBERS);
  assert.ok(b.body.eenheden.some(e => e.soort === 'water'), 'de brandweer heeft een blusboot');
  assert.ok(b.body.eenheden.some(e => e.soort === 'lucht'), 'en een blusvliegtuig');
  // een gewone zaak heeft dit bord niet
  const kik = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal((await api('/api/supplier/hulp/overzicht', {}, kik.body.token)).status, 409, 'een restaurant is geen hulpdienst');
});

test('2. de meldkamer: aannemen, eenheid sturen, statusketen en het logboek', async () => {
  const m = await api('/api/supplier/hulp/melding/maak', { tekst: 'Vaartuig in nood bij Es Vedra', plek: 'Es Vedra', prio: 1 }, tokens.GUARDIA);
  assert.equal(m.status, 200);
  assert.equal(m.body.melding.prio, 1);
  const bord = await api('/api/supplier/hulp/overzicht', {}, tokens.GUARDIA);
  const boot = bord.body.eenheden.find(e => e.soort === 'water');
  const wijs = await api('/api/supplier/hulp/melding/wijs', { melding: m.body.melding.id, eenheid: boot.id }, tokens.GUARDIA);
  assert.equal(wijs.body.melding.status, 'toegewezen');
  // dezelfde eenheid kan niet twee keer tegelijk
  const m2 = await api('/api/supplier/hulp/melding/maak', { tekst: 'Tweede melding', prio: 3 }, tokens.GUARDIA);
  assert.equal((await api('/api/supplier/hulp/melding/wijs', { melding: m2.body.melding.id, eenheid: boot.id }, tokens.GUARDIA)).status, 409);
  await api('/api/supplier/hulp/melding/status', { melding: m.body.melding.id, status: 'ter-plaatse' }, tokens.GUARDIA);
  const af = await api('/api/supplier/hulp/melding/status', { melding: m.body.melding.id, status: 'afgerond' }, tokens.GUARDIA);
  assert.equal(af.body.melding.status, 'afgerond');
  assert.ok(af.body.melding.logboek.length >= 3, 'het logboek liep mee');
  const na = await api('/api/supplier/hulp/overzicht', {}, tokens.GUARDIA);
  assert.equal(na.body.eenheden.find(e => e.id === boot.id).status, 'vrij', 'na het afronden is de boot weer vrij');
});

test('3. bijstand: de brandweer vraagt de politie erbij; special forces alleen via de politie', async () => {
  const m = await api('/api/supplier/hulp/melding/maak', { tekst: 'Grote brand, ontruiming nodig', prio: 1 }, tokens.BOMBERS);
  const bij = await api('/api/supplier/hulp/bijstand', { melding: m.body.melding.id, korps: 'GUARDIA' }, tokens.BOMBERS);
  assert.equal(bij.status, 200);
  const pol = await api('/api/supplier/hulp/overzicht', {}, tokens.GUARDIA);
  assert.ok(pol.body.bijstand.some(x => x.id === m.body.melding.id), 'de politie ziet het bijstandsverzoek op het eigen bord');
  // de brandweer mag de special forces NIET rechtstreeks oproepen
  assert.equal((await api('/api/supplier/hulp/bijstand', { melding: m.body.melding.id, korps: 'FALCO' }, tokens.BOMBERS)).status, 403);
  // de politie wel, op een eigen melding
  const pm = await api('/api/supplier/hulp/melding/maak', { tekst: 'Dreiging, interventie nodig', prio: 1 }, tokens.GUARDIA);
  const naarFalco = await api('/api/supplier/hulp/bijstand', { melding: pm.body.melding.id, korps: 'FALCO' }, tokens.GUARDIA);
  assert.equal(naarFalco.status, 200);
  const falco = await api('/api/supplier/hulp/overzicht', {}, tokens.FALCO);
  assert.ok(falco.body.bijstand.some(x => x.id === pm.body.melding.id), 'Falco ziet de inzet via de politie');
  // en special forces nemen zelf niets aan
  assert.equal((await api('/api/supplier/hulp/melding/maak', { tekst: 'x' }, tokens.FALCO)).status, 403);
});

test('4. de zorgketen: ambulance kondigt aan, het ziekenhuis neemt op en het beddenbord telt mee', async () => {
  await api('/api/supplier/hulp/bedden', { totaal: 2 }, tokens.CANMISSES);
  const amb = await api('/api/supplier/hulp/overzicht', {}, tokens.URGENCIA);
  assert.ok(amb.body.ziekenhuizen.some(z => z.code === 'CANMISSES'), 'de ambulance ziet het beddenbord van het ziekenhuis');
  const o = await api('/api/supplier/hulp/overdracht', { ziekenhuis: 'CANMISSES', triage: 'Val van hoogte, stabiel, verdenking fractuur' }, tokens.URGENCIA);
  assert.equal(o.status, 200);
  const op = await api('/api/supplier/hulp/opname/zet', { id: o.body.opname.id, status: 'opgenomen' }, tokens.CANMISSES);
  assert.equal(op.body.bedden.bezet, 1, 'het bed telt mee');
  const ontslag = await api('/api/supplier/hulp/opname/zet', { id: o.body.opname.id, status: 'ontslagen' }, tokens.CANMISSES);
  assert.equal(ontslag.body.bedden.bezet, 0, 'en komt bij ontslag weer vrij');
  // de huisarts plant consulten en kan ook overdragen
  const c = await api('/api/supplier/hulp/consult/maak', { klacht: 'Aanhoudende hoofdpijn', urgentie: 'hoog', wanneer: 'ma 10:15' }, tokens.CONSULTA);
  assert.equal(c.status, 200);
  assert.equal((await api('/api/supplier/hulp/consult/zet', { id: c.body.consult.id, status: 'verwezen' }, tokens.CONSULTA)).status, 200);
  assert.equal((await api('/api/supplier/hulp/overdracht', { ziekenhuis: 'CANMISSES', triage: 'Verwijzing neurologie' }, tokens.CONSULTA)).status, 200);
  // de politie draagt niet over aan het ziekenhuis
  assert.equal((await api('/api/supplier/hulp/overdracht', { ziekenhuis: 'CANMISSES', triage: 'x' }, tokens.GUARDIA)).status, 403);
});

test('5. de meldkamer-AI antwoordt eerlijk, met de demo-disclaimer erbij', async () => {
  const r = await api('/api/supplier/hulp/ai', { q: 'Welke eenheid stuur ik naar een vaartuig in nood?' }, tokens.GUARDIA);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord.length > 20, 'een echt antwoord');
  assert.match(r.body.antwoord, /112/, 'de verwijzing naar 112 en het eigen protocol ontbreekt nooit');
});
