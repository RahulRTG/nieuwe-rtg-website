'use strict';
/* VRIJHEID: het vakantiesaldo en het dienstverband uit de BESTAANDE bronnen
   (kern/vrijheid/saldobron.js, kern/vrijheid/teambeeld.js).

   Twee helften. De eerste draait de echte contractversies
   (kern/payroll/contracten.js) en het echte verzuimregister
   (kern/payroll/verzuim.js) en laat zien dat het recht alleen gerekend wordt
   in het ene geval dat geen open rekenregel raakt -- en dan alleen met een
   PROEFBELEID dat de wettelijke regel zet, want niemand anders zet hem. De
   tweede loopt tegen een ECHTE server langs de gewone routes: een ondernemer
   hangt zijn zaak aan zijn entiteit, haalt het dienstverband van een
   medewerker in, legt diens contract vast -- en de medewerker ziet in Mijn
   tijd dat hij in dienst is, waar zijn recht uit gerekend wordt, en waarom het
   getal er nog niet staat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');
const { rtgBeleid } = require('../server/kern/vrijheid/rtgbeleid');
const { maakVrijheid } = require('../server/kern/vrijheid');
const C = require('../server/kern/vrijheid/categorieen');
const maakSaldobron = require('../server/kern/vrijheid/saldobron');
const { maakContracten } = require('../server/kern/payroll/contracten');
const { maakVerzuim } = require('../server/kern/payroll/verzuim');

const ORG = 'SALDOTEAM';
/* Een PROEFBELEID, met die naam als bron: het is geen besluit en geen voorstel. */
const proef = maakBeleid({ LEGAL_BASELINE: { 'verlof.wettelijkWekenPerJaar': { waarde: 4, bron: 'proefbeleid' } } });
const leeg = maakBeleid({});

function wereld() {
  const bak = {};
  const opslag = { bak: (n) => bak[n] || (bak[n] = {}) };
  const contracten = maakContracten({ opslag, save: () => {}, nu: () => '2026-01-01T08:00:00.000Z' });
  const verzuim = maakVerzuim({ opslag, save: () => {}, nu: () => '2026-01-01T08:00:00.000Z' });
  const bron = maakSaldobron({ bronnen: () => ({ payrollOS: { contracten, verzuim } }) });
  return { contracten, verzuim, bron, opslag };
}
const heelJaar = { id: '7', inDienst: { van: '2024-03-01', tot: null } };
const vast32 = { vanaf: '2025-01-01', soort: 'vast', uurloonCenten: 1600, urenPerWeek: 32 };

test('de wettelijke rekenregel is open: geen getal, wel de bron en de reden', () => {
  const { contracten, bron } = wereld();
  contracten.leg(ORG, '7', vast32, 'manager');
  const r = bron.verlofrechten(ORG, heelJaar, 2026, leeg);
  assert.equal(r.wettelijk, null);
  assert.match(r.waarom.wettelijk, /niet juridisch getoetst/);
  assert.deepEqual(r.bron.contract, { soort: 'vast', urenPerWeek: 32, vanaf: '2025-01-01', tot: null }, 'de aansluiting op het contract staat');
  assert.deepEqual(r.bron.dienstverband, { van: '2024-03-01', tot: null });
  assert.equal(r.contractueel, null);
  assert.match(r.waarom.contractueel, /geen bovenwettelijk verlof/);
  /* Ook het besloten beleid van RTG zet de regel niet. */
  assert.ok(rtgBeleid().open().includes('verlof.wettelijkWekenPerJaar'));
  assert.ok(leeg.open().includes('verlof.wettelijkWekenPerJaar'));
});

test('het recht wordt alleen gerekend in het geval dat geen open regel raakt', () => {
  const { contracten, verzuim, bron } = wereld();
  contracten.leg(ORG, '7', vast32, 'manager');
  const r = bron.verlofrechten(ORG, heelJaar, 2026, proef);
  assert.equal(r.waarom.wettelijk, null, r.waarom.wettelijk);
  assert.equal(r.wettelijk, 128, 'vier keer 32 uur, met het proefbeleid');
  assert.equal(r.bron.regel.laag, 'LEGAL_BASELINE');

  /* Elk ander geval zegt waarom niet, en noemt nooit een getal. */
  const deel = bron.verlofrechten(ORG, { id: '7', inDienst: { van: '2026-06-01', tot: null } }, 2026, proef);
  assert.equal(deel.wettelijk, null); assert.match(deel.waarom.wettelijk, /naar rato/);
  assert.equal(bron.verlofrechten(ORG, { id: '7', inDienst: null }, 2026, proef).wettelijk, null);
  assert.match(bron.verlofrechten(ORG, { id: '8', inDienst: heelJaar.inDienst }, 2026, proef).waarom.wettelijk, /geen arbeidscontract/);
  contracten.leg(ORG, '9', { vanaf: '2025-01-01', soort: 'oproep', uurloonCenten: 1400 }, 'manager');
  assert.match(bron.verlofrechten(ORG, { id: '9', inDienst: heelJaar.inDienst }, 2026, proef).waarom.wettelijk, /geen vaste arbeidsduur/);
  contracten.leg(ORG, '7', { ...vast32, vanaf: '2026-07-01', urenPerWeek: 24 }, 'manager');
  assert.match(bron.verlofrechten(ORG, heelJaar, 2026, proef).waarom.wettelijk, /verandert/);
  contracten.leg(ORG, '7', { ...vast32, vanaf: '2025-01-01' }, 'manager', 2);
  assert.match(bron.verlofrechten(ORG, heelJaar, 2027, proef).waarom.wettelijk, /2 contracten/);

  /* Vakantie die langs de verlofroute in DAGEN is gemeld, wordt niet stil
     genegeerd: dan is het saldo niet te rekenen. Een dag uit RTG Vrijheid zelf
     (met bron) telt al als boeking en blokkeert niet. */
  const w2 = wereld();
  w2.contracten.leg(ORG, '7', vast32, 'manager');
  w2.verzuim.meld(ORG, '7', { soort: 'rtgdag', van: '2026-03-03', tot: '2026-03-03', bron: 'vv_1' }, 'vrijheid');
  w2.verzuim.meld(ORG, '7', { soort: 'vakantie', van: '2026-04-06', tot: '2026-04-10', bron: 'vv_2' }, 'vrijheid');
  assert.equal(w2.bron.verlofrechten(ORG, heelJaar, 2026, proef).wettelijk, 128);
  w2.verzuim.meld(ORG, '7', { soort: 'vakantie', van: '2026-05-04', tot: '2026-05-05' }, 'oude verlofroute');
  const ander = w2.bron.verlofrechten(ORG, heelJaar, 2026, proef);
  assert.equal(ander.wettelijk, null);
  assert.match(ander.waarom.wettelijk, /langs de verlofroute/);
});

test('een open saldo maakt een vakantieverzoek UNKNOWN met de reden, en een RTG Day raakt het saldo nooit', () => {
  const { contracten, bron, opslag } = wereld();
  contracten.leg(ORG, '7', vast32, 'manager');
  const team = { organisatie: ORG, rosterVersie: 'r', managers: ['m'], mensen: [heelJaar, { id: '8', inDienst: heelJaar.inDienst }],
    diensten: ['7', '8'].map(p => ({ persoon: p, datum: '2026-10-14', van: '09:00', tot: '17:00' })),
    eisen: [], kwalificaties: [], feestdagen: [], verantwoordelijkheden: [], schaars: [] };
  const m = maakVrijheid({ opslag, nu: () => '2026-10-11T08:00:00.000Z' });
  const open = m.vraag(ORG, team, { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: '7', datum: '2026-10-14' },
    { door: '7', beleid: leeg, rechten: bron.verlofrechten(ORG, heelJaar, 2026, leeg), vandaag: '2026-10-11' });
  assert.equal(open.verzoek.uitkomst, 'UNKNOWN');
  const s = open.verzoek.stappen.find(x => x.stap === 'RIGHTS_POLICY');
  assert.match(s.uitleg, /niet bekend.*niet juridisch getoetst/, 'de reden reist mee tot in het besluit');

  /* Met het proefbeleid en een RTG Day: die schrijft van de eigen teller af,
     nooit van de wettelijke. */
  const rtg = maakBeleid({ LEGAL_BASELINE: { 'verlof.wettelijkWekenPerJaar': { waarde: 4, bron: 'proefbeleid' } },
    RTG_ADDITIONAL_BENEFIT: { 'rtgDag.perJaar': { waarde: 2, bron: 'proefbeleid' } } });
  const rechten = bron.verlofrechten(ORG, heelJaar, 2026, rtg);
  const d = m.vraag(ORG, { ...team, eisen: [{ datum: '2026-10-14', van: '09:00', tot: '17:00', minBezetting: 1, vereist: {} }] }, { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: '7', datum: '2026-10-14' },
    { door: '7', beleid: rtg, rechten, vandaag: '2026-10-11' });
  assert.equal(d.verzoek.stand, 'SCHEDULED', JSON.stringify(d.verzoek.stappen));
  const tijd = m.mijnTijd(ORG, '7', { beleid: rtg, rechten, jaar: 2026 });
  assert.equal(tijd.vakantie.over, 128, 'een RTG Day kost geen vakantie-uur');
  assert.equal(tijd.rtgDagen.over, 1);
  assert.deepEqual(C.invarianten(opslag.bak('vrijheid')[ORG].boekingen), []);
});

/* ---------------- tegen een echte server ---------------- */
const { startServer, stop } = require('./helper');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijheid-saldo-'));
let srv, base;
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => { let b = {}; try { b = JSON.parse(await r.text()); } catch (e) {} return { status: r.status, body: b }; });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: '' } });
  base = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function lidWordtPersoneel(zaakToken, naam, rol, u) {
  const login = naam.toLowerCase().replace(/\W/g, '') + u + '@e.test';
  const reg = await api('auth/register', { name: naam, email: login, phone: '06' + u, password: 'geheim123',
    geboortedatum: '1988-02-02', tier: rol === 'manager' ? 'business' : 'rtg', pasApp: rol === 'manager' ? 'business' : 'rtg' });
  assert.ok(reg.body.token, 'account ' + naam + ': ' + JSON.stringify(reg.body).slice(0, 160));
  const inv = await api('supplier/staff/invite', { name: naam, role: rol, func: rol === 'manager' ? 'Eigenaar' : 'Bediening' }, zaakToken);
  assert.equal(inv.status, 200, JSON.stringify(inv.body).slice(0, 200));
  const join = await api('supplier/staff/join', { bedrijf: inv.body.bedrijf, kassacode: inv.body.invite.kassacode, login, password: 'geheim123' });
  assert.equal(join.status, 200, JSON.stringify(join.body).slice(0, 200));
  const sessie = await api('supplier/mijn/login', { login, password: 'geheim123' });
  assert.ok(sessie.body.token, 'werkplek van ' + naam + ': ' + JSON.stringify(sessie.body).slice(0, 160));
  const team = (await api('supplier/roster', { code: 'KIKUNOI' })).body.staff || [];
  const ik = team.find(x => x.name === naam);
  assert.ok(ik, naam + ' staat in het team');
  return { lid: reg.body.token, zaak: sessie.body.token, staffId: String(ik.id) };
}

test('het teambeeld en het saldo uit de echte bronnen: dienstverband, contract, en de regel die open blijft', async () => {
  const rooster = await api('supplier/roster', { code: 'KIKUNOI' });
  const seedBaas = (rooster.body.staff || []).find(x => x.role === 'manager');
  const z = (await api('supplier/login', { code: 'KIKUNOI', staffId: seedBaas.id, pin: '1234' })).body.token;
  assert.ok(z, 'de zaak is binnen');
  const u = String(Date.now()).slice(-8);
  const baas = await lidWordtPersoneel(z, 'Saldo Baas', 'manager', u);
  const mw = await lidWordtPersoneel(z, 'Saldo Mira', 'staff', String(Number(u) + 1).padStart(8, '0'));

  /* Vóór het dienstverband: niet in dienst, en het verzoek eindigt daar. */
  const voor = await api('staff/tijd', {}, mw.zaak);
  assert.equal(voor.status, 200, JSON.stringify(voor.body));
  assert.equal(voor.body.ikInDienst, false);
  assert.match(voor.body.tijd.vakantie.reden, /geen dienstverband/);

  /* De ondernemer hangt de zaak aan zijn entiteit en haalt het dienstverband in. */
  const ent = await api('concern/entiteit/nieuw', { naam: 'Saldo BV', land: 'NL' }, baas.lid);
  const entId = ent.body.entiteit && ent.body.entiteit.id;
  assert.ok(entId, JSON.stringify(ent.body).slice(0, 200));
  const ves = await api('concern/vestiging/nieuw', { entiteit: entId, naam: 'Kyoto', plaats: 'Kyoto' }, baas.lid);
  const vesId = ves.body.vestiging && ves.body.vestiging.id;
  assert.equal((await api('concern/vestiging/zaak', { vestiging: vesId, code: 'KIKUNOI' }, baas.lid)).status, 200);
  const inhaal = await api('concern/vestiging/inhaal/bevestig', { vestiging: vesId, code: 'KIKUNOI', keuze: [Number(mw.staffId)] }, baas.lid);
  assert.equal(inhaal.status, 200, JSON.stringify(inhaal.body).slice(0, 300));
  assert.equal((inhaal.body.gemaakt || []).length, 1, 'een dienstverband, op keuze van de werkgever: ' + JSON.stringify(inhaal.body).slice(0, 400));

  /* De leidinggevende legt het contract vast, op eigen naam. */
  const jaar = new Date().toISOString().slice(0, 4);
  const c = await api('supplier/payroll/contract', { staffId: Number(mw.staffId), vanaf: jaar + '-01-01', soort: 'vast',
    uurloonCenten: 1600, urenPerWeek: 32, functie: 'Bediening' }, baas.zaak);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));

  const na = await api('staff/tijd', {}, mw.zaak);
  assert.equal(na.status, 200);
  assert.equal(na.body.ikInDienst, true, 'het teambeeld leest het dienstverband bij de entiteit van de zaak');
  const b = na.body.tijd.vakantieBron;
  assert.equal(b.contract.urenPerWeek, 32, 'het saldo leest het contract uit de payroll');
  assert.equal(b.contract.soort, 'vast');
  assert.ok(b.dienstverband && b.dienstverband.van, 'en het dienstverband');
  assert.equal(na.body.tijd.vakantie.recht, null, 'de rekenregel is open, dus er staat geen getal');
  assert.match(na.body.tijd.vakantie.reden, /niet juridisch getoetst/);
  assert.ok(!/uurloon|1600/.test(JSON.stringify(b)), 'het uurloon reist niet mee');
  assert.ok(na.body.beleidOpen.includes('verlof.wettelijkWekenPerJaar'));

  /* Een vakantieverzoek komt nu langs ELIGIBILITY, en eindigt bij de open regel. */
  let datum = new Date(Date.now() + 86400000);
  const r = await api('staff/tijd/verzoek', { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', datum: datum.toISOString().slice(0, 10) }, mw.zaak);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const st = r.body.verzoek.stappen;
  assert.equal(st[0].stap, 'ELIGIBILITY'); assert.equal(st[0].stand, 'OK', 'in dienst: de eerste stap houdt niet meer tegen');
  if (r.body.verzoek.uitkomst === 'UNKNOWN') assert.match(st[1].uitleg, /niet juridisch getoetst/);
  else assert.equal(r.body.verzoek.code, 'geen-dienst', 'geen dienst op die dag: er hoeft niets vrij');
});
