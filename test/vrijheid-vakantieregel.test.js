'use strict';
/* VRIJHEID: DE NEDERLANDSE REKENREGEL VOOR VAKANTIEDAGEN, en de productiepoort
   die hem tegenhoudt tot de juridische toets is afgerond (besluit B1, 11 oktober
   2026; kern/vrijheid/vakantieregel.js, vakantiepoort.js, saldobron.js).

   Drie helften. De regel rekent (art. 7:634 BW, naar rato, wisselende
   arbeidsduur, art. 7:635 BW bij ziekte) en zegt waar de bron ontbreekt -- nooit
   nul. De poort staat DICHT zonder handeling van een mens, en dan wordt geen
   verlof toegekend op de berekening. En tegen een echte server: alleen de
   eigenaar zet de poort, openen vraagt een toets, en een medewerker ziet het
   berekende getal pas als recht wanneer de poort open is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../server/kern/vrijheid/vakantieregel');
const maakPoort = require('../server/kern/vrijheid/vakantiepoort');
const maakSaldobron = require('../server/kern/vrijheid/saldobron');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');
const { rtgBeleid } = require('../server/kern/vrijheid/rtgbeleid');
const { maakVrijheid } = require('../server/kern/vrijheid');
const { maakContracten } = require('../server/kern/payroll/contracten');
const { maakVerzuim, SOORTEN: VERZUIMSOORTEN } = require('../server/kern/payroll/verzuim');

const dv = { van: '2020-01-01', tot: null };
const vast = (uren, vanaf, extra) => ({ vanaf: vanaf || '2020-01-01', soort: 'vast', urenPerWeek: uren, ...(extra || {}) });

test('art. 7:634 BW: viermaal de arbeidsduur per week, naar rato over een deel van het jaar', () => {
  const heel = R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(32)], verzuim: [], weken: 4 });
  assert.deepEqual(heel.open, []);
  assert.equal(heel.uren, 128);
  const half = R.reken({ jaar: 2026, dienstverband: { van: '2026-07-01', tot: null }, versies: [vast(32, '2026-07-01')], verzuim: [], weken: 4 });
  assert.equal(half.uren, Math.round(4 * 32 * 184 / 365 * 100) / 100, 'naar rato per kalenderdag: 184 van 365 dagen');
  const uit = R.reken({ jaar: 2026, dienstverband: { van: '2020-01-01', tot: '2026-03-31' }, versies: [vast(40)], verzuim: [], weken: 4 });
  assert.equal(uit.uren, Math.round(4 * 40 * 90 / 365 * 100) / 100, 'uit dienst op 31 maart');
  assert.equal(R.reken({ jaar: 2028, dienstverband: dv, versies: [vast(32)], verzuim: [], weken: 4 }).dagenInJaar, 366, 'een schrikkeljaar telt 366 dagen');
});

test('wisselende arbeidsduur: naar rato per periode van de contractversies', () => {
  const r = R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(40), vast(20, '2026-07-01')], verzuim: [], weken: 4 });
  assert.equal(r.uren, Math.round(4 * (40 * 181 + 20 * 184) / 365 * 100) / 100);
  assert.deepEqual(r.perioden.map(p => [p.van, p.tot, p.urenPerWeek]), [['2026-01-01', '2026-06-30', 40], ['2026-07-01', '2026-12-31', 20]]);
  /* Een loonsverhoging met dezelfde uren verandert niets aan het recht. */
  assert.equal(R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(32), vast(32, '2026-05-01', { uurloonCenten: 1900 })], verzuim: [], weken: 4 }).uren, 128);
});

test('art. 7:635 BW: tijdens ziekte loopt de opbouw door; onbetaald verlof bouwt niet op; deels betaald verlof is open', () => {
  const ziek = R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(32)], verzuim: [{ van: '2026-02-01', tot: '2026-03-31', soort: 'ziek' }], weken: 4 });
  assert.equal(ziek.uren, 128, 'ziekte verlaagt het recht niet');
  const onb = R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(32)], verzuim: [{ van: '2026-05-01', tot: '2026-05-10', soort: 'onbetaald' }], weken: 4 });
  assert.equal(onb.uren, Math.round((128 - 4 * 32 * 10 / 365) * 100) / 100);
  assert.equal(onb.zonderOpbouw.length, 1);
  assert.equal(onb.zonderOpbouw[0].dagen, 10);
  const ouder = R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(32)], verzuim: [{ van: '2026-05-01', tot: '2026-05-10', soort: 'ouderschap' }], weken: 4 });
  assert.equal(ouder.uren, null, 'geen geraden aftrek');
  assert.match(ouder.open.join(' '), /ouderschap.*niet vastgesteld/);
  /* Elke soort uit het verzuimregister staat in de opbouwtabel: een nieuwe soort
     zonder besluit laat deze toets zakken in plaats van stil mee te tellen. */
  assert.deepEqual(Object.keys(VERZUIMSOORTEN).filter(s => !R.OPBOUW[s]), []);
});

test('broncontrole: ontbrekend dienstverband, contract of uren geeft een reden en nooit nul', () => {
  const zonder = (x) => R.reken({ jaar: 2026, dienstverband: dv, versies: [vast(32)], verzuim: [], weken: 4, ...x });
  assert.match(zonder({ dienstverband: null }).open.join(' '), /ingangsdatum/);
  assert.match(zonder({ weken: undefined }).open.join(' '), /factor/);
  const gat = zonder({ versies: [vast(32, '2026-04-01')] });
  assert.equal(gat.uren, null);
  assert.match(gat.open.join(' '), /2026-01-01 tot en met 2026-03-31.*zonder contractversie/);
  const geenUren = zonder({ versies: [{ vanaf: '2020-01-01', soort: 'vast' }] });
  assert.equal(geenUren.uren, null);
  assert.match(geenUren.open.join(' '), /geen arbeidsduur per week; die ontbreekt in de bron en is geen nul/);
  assert.match(zonder({ versies: [{ vanaf: '2020-01-01', soort: 'oproep' }] }).open.join(' '), /gewerkte uren/);
  for (const x of [{ dienstverband: null }, { versies: [] }, { versies: [{ vanaf: '2020-01-01', soort: 'vast' }] }])
    assert.equal(zonder(x).uren, null, 'nooit nul: ' + JSON.stringify(x));
});

/* ---------------- de productiepoort ---------------- */
function eigenOpslag() {
  const s = {};
  return { kijk: (n) => s[n], bak: (n) => s[n] || (s[n] = {}), s };
}
const toets = { door: 'Proefjurist (toets, geen echt dossier)', datum: '2026-10-10', kenmerk: 'PROEF-1' };

test('de poort staat DICHT zonder handeling van een mens, en opent alleen met een toets', () => {
  const eigen = eigenOpslag();
  const p = maakPoort({ eigen, save: () => {}, nu: () => '2026-10-11T09:00:00.000Z' });
  const leeg = p.stand();
  assert.equal(leeg.open, false, 'een ontbrekende stand is nooit open');
  assert.match(leeg.reden, /juridische toets.*niet afgerond/);
  assert.equal(p.zet({ stand: 'open', door: '', toets }).status, 403, 'de gedeelde kantoorcode is geen naam');
  assert.equal(p.zet({ stand: 'open', door: 'Eigenaar' }).status, 422, 'zonder toets niet open');
  assert.equal(p.zet({ stand: 'open', door: 'Eigenaar', toets: { ...toets, datum: '2026-12-01' } }).status, 422, 'een toets in de toekomst is niet afgerond');
  assert.equal(p.stand().open, false);
  /* Met de hand op open zetten, zonder toets: leest nog steeds als dicht. */
  eigen.bak('vrijheidVakantiepoort').stand = 'open';
  assert.equal(p.stand().open, false, 'een open stand zonder toets en versie is geen open poort');
  const ok = p.zet({ stand: 'open', door: 'Eigenaar', toets });
  assert.equal(ok.open, true, JSON.stringify(ok));
  assert.equal(p.zet({ stand: 'open', door: 'Eigenaar', toets }).open, true, 'twee keer openen is een toestand');
  /* Een andere regelversie: de toets geldt niet meer. */
  const later = maakPoort({ eigen, save: () => {}, versie: 'vr1-anders' });
  assert.equal(later.stand().open, false);
  assert.match(later.stand().reden, /veranderd sinds de toets/);
  assert.equal(p.zet({ stand: 'gesloten', door: 'Eigenaar' }).open, false, 'dichtzetten vraagt geen toets');
});

const ORG = 'REGELTEAM';
function wereld(poort) {
  const bak = {};
  const opslag = { bak: (n) => bak[n] || (bak[n] = {}) };
  const contracten = maakContracten({ opslag, save: () => {}, nu: () => '2026-01-01T08:00:00.000Z' });
  const verzuim = maakVerzuim({ opslag, save: () => {}, nu: () => '2026-01-01T08:00:00.000Z' });
  const bron = maakSaldobron({ bronnen: () => ({ payrollOS: { contracten, verzuim }, vestigingVanUnit: () => ({ land: 'NL' }) }), poort });
  return { contracten, verzuim, bron, opslag };
}
const mens = { id: '7', inDienst: { van: '2024-03-01', tot: null } };
const wet = maakBeleid(R.WETTELIJKE_LAAG);

test('poort dicht: de regel rekent met graad vermoed, het recht blijft null en het verlofbesluit UNKNOWN', () => {
  const eigen = eigenOpslag();
  const p = maakPoort({ eigen, save: () => {}, nu: () => '2026-10-11T09:00:00.000Z' });
  const w = wereld(() => p.stand());
  w.contracten.leg(ORG, '7', { vanaf: '2025-01-01', soort: 'vast', uurloonCenten: 1600, urenPerWeek: 32 }, 'manager');
  w.contracten.leg(ORG, '7', { vanaf: '2026-07-01', soort: 'vast', uurloonCenten: 1600, urenPerWeek: 24 }, 'manager');
  w.verzuim.meld(ORG, '7', { soort: 'ziek', van: '2026-03-02', tot: '2026-03-20' }, 'manager');
  const r = w.bron.verlofrechten(ORG, mens, 2026, wet);
  const verwacht = Math.round(4 * (32 * 181 + 24 * 184) / 365 * 100) / 100;
  assert.equal(r.wettelijk, null, 'geen recht zolang de poort dicht is');
  assert.equal(r.bron.berekening.uren, verwacht, 'wisselende arbeidsduur, ziekte telt door');
  assert.equal(r.bron.berekening.graad, 'vermoed');
  assert.deepEqual(r.bron.poort, { open: false, reden: p.stand().reden });
  assert.match(r.waarom.wettelijk, /juridische toets.*niet afgerond.*Geen verlofbesluit/);
  assert.equal(r.contractueel, null);
  assert.match(r.waarom.contractueel, /geen bovenwettelijk verlof/);
  /* Zonder poort is hij ook dicht: een ontbrekende grendel is geen open grendel. */
  assert.equal(wereld(undefined).bron.verlofrechten(ORG, mens, 2026, wet).wettelijk, null);

  const team = { organisatie: ORG, rosterVersie: 'r', managers: ['m'], mensen: [mens, { id: '8', inDienst: mens.inDienst }],
    diensten: ['7', '8'].map(x => ({ persoon: x, datum: '2026-10-14', van: '09:00', tot: '17:00' })),
    eisen: [{ datum: '2026-10-14', van: '09:00', tot: '17:00', minBezetting: 1, vereist: {} }], kwalificaties: [], feestdagen: [], verantwoordelijkheden: [], schaars: [] };
  const m = maakVrijheid({ opslag: w.opslag, nu: () => '2026-10-11T08:00:00.000Z' });
  const verzoek = { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: '7', datum: '2026-10-14' };
  const dicht = m.vraag(ORG, team, verzoek, { door: '7', beleid: rtgBeleid(R.WETTELIJKE_LAAG), rechten: r, vandaag: '2026-10-11' });
  assert.equal(dicht.verzoek.uitkomst, 'UNKNOWN', 'geen toekenning op een berekening achter een dichte poort');
  assert.match(dicht.verzoek.stappen.find(s => s.stap === 'RIGHTS_POLICY').uitleg, /juridische toets.*niet afgerond/);

  /* Na de handeling van een mens: dezelfde berekening is een recht. */
  p.zet({ stand: 'open', door: 'Eigenaar', toets });
  const open = w.bron.verlofrechten(ORG, mens, 2026, wet);
  assert.equal(open.wettelijk, verwacht);
  assert.equal(open.bron.berekening.graad, 'gemeten');
  /* Een eigen motor: het eerste verzoek loopt nog (HUMAN_REVIEW) en een tweede gelijk verzoek is dan 409. */
  const m2 = maakVrijheid({ opslag: { bak: ((b) => (n) => b[n] || (b[n] = {}))({}) }, nu: () => '2026-10-11T08:00:00.000Z' });
  const toe = m2.vraag(ORG, team, verzoek, { door: '7', beleid: rtgBeleid(R.WETTELIJKE_LAAG), rechten: open, vandaag: '2026-10-11' });
  assert.equal(toe.verzoek.stand, 'SCHEDULED', JSON.stringify(toe.verzoek.stappen));
});

test('een zaak buiten Nederland krijgt de Nederlandse regel niet', () => {
  const w = wereld(() => ({ open: true }));
  const bron = maakSaldobron({ bronnen: () => ({ payrollOS: { contracten: w.contracten, verzuim: w.verzuim }, vestigingVanUnit: () => ({ land: 'ES' }) }), poort: () => ({ open: true }) });
  w.contracten.leg(ORG, '7', { vanaf: '2025-01-01', soort: 'vast', uurloonCenten: 1600, urenPerWeek: 32 }, 'manager');
  const r = bron.verlofrechten(ORG, mens, 2026, wet);
  assert.equal(r.wettelijk, null);
  assert.match(r.waarom.wettelijk, /staat in ES.*Nederlands recht/);
});

/* ---------------- tegen een echte server ---------------- */
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakantieregel-'));
let srv, base;
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => { let b = {}; try { b = JSON.parse(await r.text()); } catch (e) {} return { status: r.status, body: b }; });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
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

test('de poort op een echte server: dicht vanaf de start, alleen de eigenaar zet hem, en pas open wordt het een recht', async () => {
  const eig = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  assert.ok(eig, 'de eigenaar en zijn kantoorsessie');
  const lees = await api('office/vrijheid/vakantieregel', {}, eig);
  assert.equal(lees.status, 200, JSON.stringify(lees.body));
  assert.equal(lees.body.open, false, 'een verse server heeft de poort dicht');
  assert.match(lees.body.reden, /juridische toets.*niet afgerond/);
  assert.deepEqual((await api('office/vrijheid/vakantieregel', {}, eig)).body.stand, 'gesloten', 'lezen schept niets');
  assert.ok(lees.body.artikelen.some(a => a.artikel === 'art. 7:635 BW'));
  assert.ok([401, 403].includes((await api('office/vrijheid/vakantieregel/stand', { stand: 'open', toets })).status), 'zonder sessie niet');

  /* De medewerker, met dienstverband en contract bij een Nederlandse zaak. */
  const rooster = await api('supplier/roster', { code: 'KIKUNOI' });
  const seedBaas = (rooster.body.staff || []).find(x => x.role === 'manager');
  const z = (await api('supplier/login', { code: 'KIKUNOI', staffId: seedBaas.id, pin: '1234' })).body.token;
  assert.ok(z, 'de zaak is binnen');
  const u = String(Date.now()).slice(-8);
  const baas = await lidWordtPersoneel(z, 'Regel Baas', 'manager', u);
  const mw = await lidWordtPersoneel(z, 'Regel Noor', 'staff', String(Number(u) + 1).padStart(8, '0'));
  const ent = await api('concern/entiteit/nieuw', { naam: 'Regel BV', land: 'NL' }, baas.lid);
  const entId = ent.body.entiteit && ent.body.entiteit.id;
  assert.ok(entId, JSON.stringify(ent.body).slice(0, 200));
  const ves = await api('concern/vestiging/nieuw', { entiteit: entId, naam: 'Kyoto', plaats: 'Kyoto' }, baas.lid);
  const vesId = ves.body.vestiging && ves.body.vestiging.id;
  assert.equal((await api('concern/vestiging/zaak', { vestiging: vesId, code: 'KIKUNOI' }, baas.lid)).status, 200);
  const inhaal = await api('concern/vestiging/inhaal/bevestig', { vestiging: vesId, code: 'KIKUNOI', keuze: [Number(mw.staffId)] }, baas.lid);
  assert.equal(inhaal.status, 200, JSON.stringify(inhaal.body).slice(0, 300));
  const jaar = new Date().toISOString().slice(0, 4);
  const c = await api('supplier/payroll/contract', { staffId: Number(mw.staffId), vanaf: jaar + '-01-01', soort: 'vast',
    uurloonCenten: 1600, urenPerWeek: 32, functie: 'Bediening' }, baas.zaak);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));

  const dicht = await api('staff/tijd', {}, mw.zaak);
  assert.equal(dicht.status, 200, JSON.stringify(dicht.body));
  assert.equal(dicht.body.tijd.vakantie.recht, null, 'poort dicht: geen recht');
  assert.match(dicht.body.tijd.vakantie.reden, /graad vermoed.*juridische toets.*niet afgerond/);
  const ber = dicht.body.tijd.vakantieBron.berekening;
  assert.ok(ber && ber.uren > 0 && ber.graad === 'vermoed', JSON.stringify(dicht.body.tijd.vakantieBron));
  assert.ok(!dicht.body.beleidOpen.includes('verlof.wettelijkWekenPerJaar'), 'de wet staat onder het beleid van een Nederlandse zaak');

  /* Openen zonder toets: 422. Een niet-eigenaar komt er niet aan (het lid heeft geen kantoor). */
  const zonder = await api('office/vrijheid/vakantieregel/stand', { stand: 'open' }, eig);
  assert.equal(zonder.status, 422, JSON.stringify(zonder.body));
  assert.equal((await api('office/vrijheid/vakantieregel', {}, eig)).body.open, false);

  const open1 = await api('office/vrijheid/vakantieregel/stand', { stand: 'open', toets }, eig);
  assert.equal(open1.status, 200, JSON.stringify(open1.body));
  assert.equal(open1.body.open, true);
  const open2 = await api('office/vrijheid/vakantieregel/stand', { stand: 'open', toets }, eig);
  assert.equal(open2.status, 200); assert.equal(open2.body.open, true, 'twee keer openen is een toestand');
  const na = await api('staff/tijd', {}, mw.zaak);
  assert.equal(na.body.tijd.vakantie.recht, ber.uren, 'na de handeling van de eigenaar is de berekening het recht');

  const d1 = await api('office/vrijheid/vakantieregel/stand', { stand: 'gesloten' }, eig);
  const d2 = await api('office/vrijheid/vakantieregel/stand', { stand: 'gesloten' }, eig);
  assert.equal(d1.body.open, false); assert.equal(d2.status, 200); assert.equal(d2.body.open, false);
  assert.equal((await api('staff/tijd', {}, mw.zaak)).body.tijd.vakantie.recht, null, 'weer dicht, weer geen recht');
});
