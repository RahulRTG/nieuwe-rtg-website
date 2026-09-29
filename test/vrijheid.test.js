'use strict';
/* VRIJHEID.md: de verticale V1-lus op een teambeeld. Gouden bewijzen A-G,
   de negatieve bewijzen en de gelijktijdigheid. Het beleid hieronder is een
   PROEFBELEID: het staat er om de lus te kunnen lopen, en is nadrukkelijk geen
   vastgesteld arbeidsvoorwaardenbesluit. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakVrijheid } = require('../server/kern/vrijheid');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');
const C = require('../server/kern/vrijheid/categorieen');
const D = require('../server/kern/vrijheid/dekking');
const T = require('../server/kern/vrijheid/tijd');
const S = require('../server/kern/vrijheid/standen');
const { werkstand } = require('../server/kern/vrijheid/werkstand');
const { rotatie } = require('../server/kern/vrijheid/eerlijkheid');

const ORG = 'RTGTEAM';
const PROEF = 'proefbeleid: geen vastgesteld arbeidsvoorwaardenbesluit';
const w = (waarde) => ({ waarde, bron: PROEF });
const beleid = maakBeleid({
  LEGAL_BASELINE: { 'rust.minUurTussenDiensten': { waarde: 11, bron: 'Arbeidstijdenwet art. 5:3 (nog juridisch te valideren)' } },
  ORGANIZATION_POLICY: { 'vroegVertrek.autoTotMinuten': w(180), 'eerlijkheid.vensterDagen': w(28), 'eerlijkheid.maxExtraDekking': w(2),
    'eerlijkheid.maxOpenSchaars': w(3), 'herstel.maxUren14Dagen': w(80), 'herstel.maxDagenAchterElkaar': w(6),
    'capaciteit.minAantal': w(3), 'capaciteit.minAandeel': w(0.3),
    'verjaardag.weekend': w('vorige-werkdag'), 'verjaardag.feestdag': w('volgende-werkdag'), 'verjaardag.geenWerkdag': w('vervalt'),
    'verjaardag.nachtdienst': w('dienst-die-begint'), 'verjaardag.schrikkeldag': w('28-februari') },
  RTG_ADDITIONAL_BENEFIT: { 'rtgDag.perJaar': w(3) }
});
const leeg = maakBeleid({});

function dagen(van, tot) { const uit = []; for (let d = van; d <= tot; d = T.plusDagen(d, 1)) if (![0, 6].includes(T.weekdag(d))) uit.push(d); return uit; }
function team(extra) {
  const mensen = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, inDienst: { van: '2024-01-01', tot: null } }));
  mensen.find(m => m.id === 'e').verjaardag = '10-01';
  mensen.find(m => m.id === 'd').verjaardag = '05-30';
  const ds = dagen('2026-05-25', '2026-10-16');
  const t = {
    organisatie: ORG, rosterVersie: 'r1', managers: ['m'],
    mensen,
    diensten: ds.flatMap(datum => mensen.map(m => ({ persoon: m.id, datum, van: '09:00', tot: '17:00' }))),
    eisen: ds.map(datum => ({ datum, van: '09:00', tot: '17:00', minBezetting: 3, vereist: { PAYMENT_L3: 1 } })),
    kwalificaties: [{ persoon: 'a', code: 'PAYMENT_L3', geldigTot: '2027-12-31', afgetekendDoor: 'kantoor' }],
    feestdagen: ['2026-12-25'], verantwoordelijkheden: [], schaars: []
  };
  return Object.assign(t, extra || {});
}
function motor(extra) {
  const bak = {}; const events = []; const rooster = { log: [], faal: false, staat: new Set() };
  const m = maakVrijheid({ opslag: { bak: (n) => bak[n] || (bak[n] = {}) }, nu: () => '2026-09-27T10:00:00.000Z',
    meld: (type, data) => events.push({ type, ...data }),
    rooster: { pas: (code, wz) => { if (rooster.faal) throw new Error('rooster weg'); rooster.staat.add(wz.bron); rooster.log.push(wz); },
      heeft: (code, wz) => rooster.weet === false ? undefined : rooster.staat.has(wz.bron) }, ...(extra || {}) });
  return { m, bak, events, rooster };
}
const opts = (door, x) => ({ door, beleid, rechten: { wettelijk: 160 }, ...(x || {}) });

test('categorieen schrijven nooit van elkaars saldo af', () => {
  for (const cat of Object.keys(C.CATEGORIEEN)) {
    const b = C.boeking({ categorie: cat, uren: 8, datum: '2026-10-02', persoon: 'a' });
    if (C.CATEGORIEEN[cat].aanvullend) assert.notEqual(b.teller, 'wettelijk', cat);
  }
  const goed = ['BIRTHDAY_LEAVE', 'FREEDOM_RELEASE', 'RTG_DAY', 'RECOVERY_RELEASE'].map(categorie => C.boeking({ categorie, uren: 8, datum: '2026-10-02', persoon: 'a' }));
  assert.deepEqual(C.invarianten(goed, { 'a|2026-10-02': 8 }), []);
  assert.equal(goed.find(b => b.categorie === 'RTG_DAY').afschrijving, 1, 'een RTG Day telt als dag');
  /* Mutatie: een vervalste boeking die een benefit van het vakantiesaldo haalt, moet worden gezien. */
  const vals = [{ categorie: 'FREEDOM_RELEASE', teller: 'wettelijk', afschrijving: 3, betaaldeUren: 5, persoon: 'a', datum: '2026-10-02' }];
  const regels = C.invarianten(vals, { 'a|2026-10-02': 8 }).map(f => f.regel);
  for (const r of ['NO_RTG_BENEFIT_DEDUCTS_STATUTORY_LEAVE', 'NO_FREEDOM_RELEASE_DEDUCTS_NORMAL_LEAVE', 'NO_FREEDOM_RELEASE_REDUCES_PAY']) assert.ok(regels.includes(r), r);
  assert.ok(C.invarianten([{ categorie: 'BIRTHDAY_LEAVE', teller: null, afschrijving: 8, betaaldeUren: 8, persoon: 'a', datum: 'x' }]).some(f => f.regel === 'NO_BIRTHDAY_LEAVE_DEDUCTS_NORMAL_LEAVE'));
});

test('een hoger recht wordt nooit verminderd', () => {
  const b = maakBeleid({ LEGAL_BASELINE: { 'rust.minUurTussenDiensten': w(11) }, RTG_ADDITIONAL_BENEFIT: { 'rust.minUurTussenDiensten': w(9) } });
  assert.equal(b.waarde('rust.minUurTussenDiensten').waarde, 11);
  assert.equal(b.conflicten.length, 1);
  assert.match(b.conflicten[0].reden, /verminderen/);
  const hoger = maakBeleid({ LEGAL_BASELINE: { 'rust.minUurTussenDiensten': w(11) }, COLLECTIVE_AGREEMENT: { 'rust.minUurTussenDiensten': w(12) } });
  assert.equal(hoger.waarde('rust.minUurTussenDiensten').waarde, 12);
  assert.throws(() => maakBeleid({ VERZONNEN: {} }));
});

test('open beleid blijft open en wordt nooit stil ingevuld', () => {
  assert.ok(leeg.open().includes('rtgDag.perJaar'));
  const { m } = motor();
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-05' }, { door: 'b', beleid: leeg });
  assert.equal(r.verzoek.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.match(r.verzoek.stappen.find(s => s.stap === 'RIGHTS_POLICY').uitleg, /Nog niet vastgesteld/);
  const vj = m.planVerjaardagen(ORG, team(), 2026, { beleid: leeg }).verjaardagen.find(j => j.persoon === 'd');
  assert.equal(vj.stand, 'NEEDS_REVIEW', 'weekendverjaardag zonder beleid wordt niet stil geschrapt');
});

test('vier aanwezigen zijn te weinig zonder de specialist', () => {
  const t = team();
  const afw = { persoon: 'a', van: T.punt('2026-10-02', '14:00'), tot: T.punt('2026-10-02', '17:00') };
  const r = D.toets(t, afw, []);
  assert.equal(r.stand, 'GAP');
  assert.equal(r.gaten[0].ontbreekt, 'PAYMENT_L3');
  assert.match(r.uitleg, /PAYMENT_L3-dekking zou tussen 14:00 en 17:00 ontbreken/);
  assert.equal(D.toets({ ...t, eisen: [] }, afw, []).stand, 'UNKNOWN', 'zonder eis is er geen SAFE');
});

test('uit dienst telt niet mee', () => {
  const t = team();
  t.mensen.find(m => m.id === 'a').inDienst.tot = '2026-09-30';
  assert.equal(D.toets(t, { persoon: 'x', van: T.punt('2026-10-02', '09:00'), tot: T.punt('2026-10-02', '10:00') }, []).stand, 'GAP');
  const { m } = motor();
  const r = m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: 'a', datum: '2026-10-05' }, opts('a'));
  assert.equal(r.verzoek.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
});

test('verlopen of zelf afgetekende bevoegdheid telt niet als dekking', () => {
  const t = team({ kwalificaties: [{ persoon: 'a', code: 'PAYMENT_L3', geldigTot: '2026-10-01', afgetekendDoor: 'kantoor' },
    { persoon: 'b', code: 'PAYMENT_L3', geldigTot: '2027-01-01', afgetekendDoor: 'b' }] });
  const r = D.toets(t, { persoon: 'x', van: T.punt('2026-10-02', '09:00'), tot: T.punt('2026-10-02', '10:00') }, []);
  assert.equal(r.stand, 'GAP');
  assert.deepEqual(D.geldigeKwalificaties(t, 'b', '2026-10-02').nietGeteld, [{ code: 'PAYMENT_L3', reden: 'niet-afgetekend' }]);
});

test('zelf afvinken is geen WORK_COMPLETE', () => {
  assert.equal(werkstand(team(), 'b', '2026-10-02').stand, 'UNKNOWN', 'een lege lijst is geen klaar');
  const t = team({ verantwoordelijkheden: [{ id: 'kas', naam: 'Kas sluiten', persoon: 'b', kritiek: true, klaar: true, bevestigdDoor: 'b' }] });
  assert.equal(werkstand(t, 'b', '2026-10-02').stand, 'UNKNOWN');
  t.verantwoordelijkheden[0].bevestigdDoor = 'c';
  assert.equal(werkstand(t, 'b', '2026-10-02').stand, 'WORK_COMPLETE');
  t.verantwoordelijkheden.push({ id: 'post', persoon: 'b', kritiek: true, klaar: false });
  assert.equal(werkstand(t, 'b', '2026-10-02').stand, 'CRITICAL_WORK_REMAINS');
});

test('gouden bewijs A: verjaardag vooraf vrij, zonder afschrijving', () => {
  const { m, bak, events } = motor();
  const r = m.planVerjaardagen(ORG, team(), 2026, { beleid });
  const e = r.verjaardagen.find(j => j.persoon === 'e');
  assert.equal(e.stand, 'SCHEDULED'); assert.equal(e.datum, '2026-10-01'); assert.equal(e.dekking, 'SAFE');
  const d = r.verjaardagen.find(j => j.persoon === 'd');
  assert.equal(d.datum, '2026-05-29', 'zaterdag schuift volgens proefbeleid naar de vrijdag ervoor');
  const boek = bak.vrijheid[ORG].boekingen.filter(b => b.categorie === 'BIRTHDAY_LEAVE');
  assert.equal(boek.length, 2);
  assert.ok(boek.every(b => b.afschrijving === 0 && b.betaaldeUren === 8));
  assert.deepEqual(C.invarianten(boek), []);
  assert.ok(events.some(x => x.type === 'BIRTHDAY_LEAVE_SCHEDULED'));
  const mijn = m.mijnTijd(ORG, 'e', { beleid, rechten: { wettelijk: 160 }, jaar: 2026 });
  assert.match(mijn.verjaardag.tekst, /Deze dag is voor u/);
  assert.equal(mijn.vakantie.over, 160, 'normale verlofsaldo verandert niet');
  assert.equal(m.planVerjaardagen(ORG, team(), 2026, { beleid }).verjaardagen.length, 5, 'idempotent');
  assert.equal(bak.vrijheid[ORG].boekingen.filter(b => b.categorie === 'BIRTHDAY_LEAVE').length, 2);
  assert.equal(m.werkOpVerjaardag(ORG, e.id, 'm').status, 403, 'alleen de jarige kiest om te werken');
  assert.equal(m.werkOpVerjaardag(ORG, e.id, 'e').verjaardag.stand, 'WORKED_BY_CHOICE');
  const nieuw = team(); nieuw.mensen.find(x => x.id === 'e').inDienst.van = '2026-11-01';
  assert.equal(motor().m.planVerjaardagen(ORG, nieuw, 2026, { beleid }).verjaardagen.find(j => j.persoon === 'e').stand, 'NOT_APPLICABLE');
});

test('gouden bewijs B: eerder naar huis, betaald en zonder verlof', () => {
  const t = team({ verantwoordelijkheden: [
    { id: 'rap', persoon: 'b', kritiek: true, klaar: true, bron: 'systeem' },
    { id: 'kas', persoon: 'c', kritiek: true, klaar: true, bevestigdDoor: 'c' },
    { id: 'a1', persoon: 'a', kritiek: true, klaar: true, bron: 'systeem' }] });
  const { m, bak, events, rooster } = motor();
  const k = m.vrijheidsKansen(ORG, t, { datum: '2026-10-02', vanaf: '14:15', beleid });
  assert.deepEqual(k.aangeboden.map(a => a.persoon), ['b'], 'c vinkte zelf af; a is de enige specialist');
  const a = k.aangeboden[0];
  assert.match(a.tekst, /salaris en verlofsaldo veranderen niet/);
  assert.equal(m.aanvaardVrijheid(ORG, t, a.id, 'c').status, 403);
  const r = m.aanvaardVrijheid(ORG, t, a.id, 'b');
  assert.equal(r.aanbod.stand, 'ROSTER_RECONCILED');
  const b = bak.vrijheid[ORG].boekingen.find(x => x.categorie === 'FREEDOM_RELEASE');
  assert.equal(b.afschrijving, 0); assert.equal(b.betaaldeUren, 2.75);
  assert.deepEqual(C.invarianten([b], { 'b|2026-10-02': 2.75 }), []);
  assert.equal(rooster.log.length, 1);
  assert.ok(events.some(x => x.type === 'FREEDOM_RELEASE_ACCEPTED'));
  assert.equal(bak.vrijheid[ORG].grootboek.filter(g => g.soort === 'FREEDOM_RELEASE_GRANTED').length, 1);
});

test('eerder naar huis: bij te weinig ruimte gaat wie het minst vaak mocht', () => {
  const t = team({ verantwoordelijkheden: ['b', 'c', 'd'].map(p => ({ id: 'x' + p, persoon: p, kritiek: true, klaar: true, bron: 'systeem' })) });
  const { m, bak } = motor();
  bak.vrijheid = { [ORG]: { verzoeken: {}, sleutels: {}, grootboek: [
    { soort: 'FREEDOM_RELEASE_GRANTED', persoon: 'b', datum: '2026-09-25' }, { soort: 'FREEDOM_RELEASE_GRANTED', persoon: 'c', datum: '2026-09-18' }],
    boekingen: [], aanbiedingen: {}, verjaardagen: {}, signalen: [], behoeften: [], vertrouwelijk: {} } };
  const k = m.vrijheidsKansen(ORG, t, { datum: '2026-10-02', vanaf: '14:00', beleid });
  assert.equal(k.aangeboden.length, 2, 'vijf aanwezig, minimum drie');
  assert.equal(k.aangeboden[0].persoon, 'd', 'd mocht in het venster nog niet eerder weg');
});

test('gouden bewijs C: eerder weg aangevraagd', () => {
  const { m } = motor();
  const r = m.vraag(ORG, team(), { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'b', datum: '2026-10-02', vanaf: '15:00' }, opts('b'));
  assert.equal(r.verzoek.uitkomst, 'AUTO_APPROVED');
  assert.equal(r.verzoek.stand, 'SCHEDULED');
  assert.deepEqual(r.verzoek.stappen.map(s => s.stap), ['ELIGIBILITY', 'RIGHTS_POLICY', 'WORK_STATE', 'COVERAGE', 'QUALIFICATION_COVERAGE', 'TEAM_IMPACT', 'REST', 'FAIRNESS', 'DECISION']);
  const specialist = m.vraag(ORG, team(), { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'a', datum: '2026-10-02', vanaf: '14:00' }, opts('a'));
  assert.equal(specialist.verzoek.uitkomst, 'DECLINED', 'geen alternatief: a is elke dag de enige');
  assert.match(specialist.verzoek.stappen.find(s => s.stap === 'QUALIFICATION_COVERAGE').uitleg, /PAYMENT_L3/);
});

test('gouden bewijs D: schaars moment eerlijk verdeeld', () => {
  const kerst = '2026-12-24';
  const t = team({ schaars: [{ datum: kerst, moment: 'kerst' }],
    diensten: ['a', 'b', 'c', 'd', 'e'].map(p => ({ persoon: p, datum: kerst, van: '09:00', tot: '17:00' })),
    eisen: [{ datum: kerst, van: '09:00', tot: '17:00', minBezetting: 3 }] });
  const { m, bak } = motor();
  bak.vrijheid = { [ORG]: { verzoeken: {}, sleutels: {}, grootboek: [
    { soort: 'POPULAR_SLOT_GRANTED', persoon: 'b', datum: '2025-12-24', moment: 'kerst' }, { soort: 'POPULAR_SLOT_GRANTED', persoon: 'c', datum: '2025-12-24', moment: 'kerst' }],
    boekingen: [], aanbiedingen: {}, verjaardagen: {}, signalen: [], behoeften: [], vertrouwelijk: {} } };
  const vraag = (p) => m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: p, datum: kerst }, opts(p)).verzoek;
  const eerste = vraag('b'); vraag('c'); vraag('d'); vraag('e');
  assert.equal(eerste.stand, 'CHECKING', 'wachten op de rotatie, niet wie het snelst drukt');
  m.trekIn(ORG, eerste.id, 'b'); vraag('b');
  assert.equal(m.verdeelSchaars(ORG, t, 'kerst', { door: 'b' }).status, 403);
  const r = m.verdeelSchaars(ORG, t, 'kerst', { door: 'm' });
  const wie = (ids) => ids.map(i => bak.vrijheid[ORG].verzoeken[i].persoon).sort();
  assert.deepEqual(wie(r.toegekend), ['d', 'e']);
  assert.deepEqual(wie(r.afgewezen), ['b', 'c']);
  const af = bak.vrijheid[ORG].verzoeken[r.afgewezen[0]];
  assert.match(m.verzoekUitleg(ORG, af.id, af.persoon).rotatie, /minder vaak of langer geleden/);
  assert.doesNotMatch(af.rotatieUitleg, /\b[de]\b.*kreeg/, 'de uitleg noemt geen collega');
  const opnieuw = rotatie(['e', 'd', 'c', 'b'], { moment: 'kerst', plekken: 2, zaad: ORG + '|kerst' }, bak.vrijheid[ORG].grootboek.filter(g => g.datum < '2026'));
  assert.deepEqual(opnieuw.filter(x => x.toegekend).map(x => x.persoon).sort(), ['d', 'e'], 'volgorde van aanvragen doet niet mee');
});

test('gouden bewijs E: NO_UNFAIR_TRANSFER', () => {
  const t = team();
  const { m, bak } = motor();
  const vraag = (vervanger, sleutel) => m.vraag(ORG, t, { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'a', datum: '2026-10-05', vanaf: '15:00', vervanger },
    opts('a', { sleutel })).verzoek;
  const kw = { persoon: 'x', code: 'PAYMENT_L3', geldigTot: '2027-01-01', afgetekendDoor: 'kantoor' };
  t.mensen.push({ id: 'x', inDienst: { van: '2024-01-01' } }); t.kwalificaties.push(kw);
  const zonder = vraag({ persoon: 'x', instemming: false }, 's1');
  assert.notEqual(zonder.uitkomst, 'AUTO_APPROVED', 'zonder instemming geen vervanging');
  bak.vrijheid[ORG].grootboek.push({ soort: 'EXTRA_COVERAGE', persoon: 'x', datum: '2026-09-20' }, { soort: 'EXTRA_COVERAGE', persoon: 'x', datum: '2026-09-28' });
  const structureel = vraag({ persoon: 'x', instemming: true }, 's2');
  assert.equal(structureel.uitkomst, 'ALTERNATIVE_AVAILABLE');
  assert.equal(structureel.code, 'NO_UNFAIR_TRANSFER');
  assert.match(structureel.stappen.find(s => s.stap === 'FAIRNESS').uitleg, /al 2 keer extra/);
  bak.vrijheid[ORG].grootboek.length = 0;
  const eerlijk = vraag({ persoon: 'x', instemming: true }, 's3');
  assert.equal(eerlijk.uitkomst, 'AUTO_APPROVED');
  assert.ok(bak.vrijheid[ORG].grootboek.some(g => g.soort === 'EXTRA_COVERAGE' && g.persoon === 'x'), 'extra dekking wordt geteld voor de volgende keer');
});

test('gouden bewijs F: capaciteit leert en de lus sluit', () => {
  const t = team();
  const { m, events } = motor();
  for (const datum of ['2026-10-02', '2026-10-09', '2026-10-16'])
    m.vraag(ORG, t, { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'a', datum, vanaf: '14:00' }, opts('a'));
  m.vraag(ORG, t, { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'b', datum: '2026-10-02', vanaf: '14:00' }, opts('b'));
  const c = m.capaciteit(ORG, t, { beleid, datum: '2026-10-01' });
  const gat = c.analyse.gaten.find(g => g.code === 'PAYMENT_L3');
  assert.match(gat.zin, /75% van de verzoeken \(3 van 4\) werd geblokkeerd door PAYMENT_L3-dekking/);
  assert.equal(gat.duiding, 'CAPABILITY_CAPACITY_PROBLEM');
  assert.ok(events.some(e => e.type === 'CAPABILITY_GAP_DETECTED'));
  assert.equal(c.behoeften[0].stand, 'OPEN');
  t.kwalificaties.push({ persoon: 'c', code: 'PAYMENT_L3', geldigTot: '2027-12-31', afgetekendDoor: 'c' });
  assert.equal(m.capaciteit(ORG, t, { beleid, datum: '2026-10-01' }).behoeften[0].stand, 'OPEN', 'een zelf afgetekend certificaat sluit niets');
  t.kwalificaties[1].afgetekendDoor = 'kantoor';
  assert.equal(m.capaciteit(ORG, t, { beleid, datum: '2026-10-01' }).behoeften[0].stand, 'VERVULD');
  const nu = m.vraag(ORG, t, { soort: 'EERDER_WEG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'a', datum: '2026-10-14', vanaf: '14:00' }, opts('a'));
  assert.notEqual(nu.verzoek.uitkomst, 'DECLINED');
});

test('gouden bewijs G: hersteltijd uit het rooster, door een mens toegekend', () => {
  const t = team();
  t.diensten.push(...['2026-10-03', '2026-10-04'].map(datum => ({ persoon: 'b', datum, van: '09:00', tot: '17:00' })));
  const { m, bak, events } = motor();
  const s = m.herstelSignalen(ORG, t, { beleid, datum: '2026-10-09' });
  const b = s.signalen.find(x => x.persoon === 'b');
  assert.match(b.uitleg, /^Volgens het rooster is onvoldoende herstelruimte gepland/);
  assert.doesNotMatch(b.uitleg, /burn-?out|ziek|stress/i);
  assert.ok(events.some(e => e.type === 'REST_RISK_DETECTED'));
  assert.equal(m.herstelRelease(ORG, t, { persoon: 'b', datum: '2026-10-12', door: 'b', beleid }).status, 403);
  assert.equal(m.herstelRelease(ORG, t, { persoon: 'c', datum: '2026-10-12', door: 'm', beleid }).status, 409, 'geen signaal, geen automatische beloning');
  const r = m.herstelRelease(ORG, t, { persoon: 'b', datum: '2026-10-09', door: 'm', beleid });
  assert.ok(r.ok);
  const bk = bak.vrijheid[ORG].boekingen.find(x => x.categorie === 'RECOVERY_RELEASE');
  assert.equal(bk.afschrijving, 0); assert.equal(bk.betaaldeUren, 8);
  assert.equal(m.herstelSignalen(ORG, t, { beleid: leeg, datum: '2026-10-09' }).stand, 'NIET_GEMETEN');
});

test('privacy: geen reden bij het team, geen reden bij de manager buiten de beoordeling', () => {
  const { m } = motor();
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'SPECIAL_LEAVE', persoon: 'b', datum: '2026-10-06', reden: 'uitvaart van mijn oom' }, opts('b'));
  assert.equal(r.verzoek.stand, 'HUMAN_REVIEW');
  assert.doesNotMatch(JSON.stringify(r.verzoek), /oom/);
  const mb = m.managerBeeld(ORG, team(), r.verzoek.id, 'm');
  assert.equal(mb.soort, 'afwezig'); assert.equal(mb.reden, 'uitvaart van mijn oom');
  assert.equal(m.managerBeeld(ORG, team(), r.verzoek.id, 'c').status, 403);
  m.beoordeelMens(ORG, team(), r.verzoek.id, { door: 'm', besluit: 'APPROVED' });
  assert.equal(m.managerBeeld(ORG, team(), r.verzoek.id, 'm').reden, undefined, 'na het besluit niet meer');
  const tb = JSON.stringify(m.teamBeeld(ORG, team()));
  assert.doesNotMatch(tb, /oom|SPECIAL|Bijzonder/);
  assert.match(tb, /afwezig/);
});

test('isolatie tussen organisaties', () => {
  const { m } = motor();
  const ander = team({ organisatie: 'ANDERE' });
  assert.equal(m.vraag(ORG, ander, { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: 'b', datum: '2026-10-05' }, opts('b')).status, 403);
  m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: 'b', datum: '2026-10-05' }, opts('b'));
  assert.equal(m.teamBeeld('ANDERE', ander).afwezig.length, 0);
  assert.equal(m.teamBeeld('ANDERE', team()).status, 403);
});

test('gezag: niemand keurt zijn eigen verzoek goed, en een uitzondering tekent geen bevoegdheid weg', () => {
  const { m } = motor();
  const t = team({ managers: ['m', 'b'] });
  const r = m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'UNPAID_LEAVE', persoon: 'b', datum: '2026-10-06' }, opts('b'));
  assert.equal(m.beoordeelMens(ORG, t, r.verzoek.id, { door: 'b', besluit: 'APPROVED' }).status, 403);
  assert.equal(m.beoordeelMens(ORG, t, r.verzoek.id, { door: 'm', besluit: 'DECLINED' }).status, 422, 'een nee draagt een reden');
  assert.equal(m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'BIRTHDAY_LEAVE', persoon: 'b', datum: '2026-10-07' }, opts('m')).status, 403, 'niet namens een ander');
});

test('gelijktijdig: twee managers kunnen samen de dekking niet breken', () => {
  const { m } = motor();
  const t = team({ managers: ['m', 'n'] });
  const ids = ['b', 'c', 'd'].map(p => m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'UNPAID_LEAVE', persoon: p, datum: '2026-10-06' }, opts(p)).verzoek.id);
  assert.ok(m.beoordeelMens(ORG, t, ids[0], { door: 'm', besluit: 'APPROVED' }).ok);
  assert.ok(m.beoordeelMens(ORG, t, ids[1], { door: 'n', besluit: 'APPROVED' }).ok);
  const derde = m.beoordeelMens(ORG, t, ids[2], { door: 'm', besluit: 'APPROVED' });
  assert.equal(derde.status, 409);
  assert.match(derde.error, /dekking veranderd/);
});

test('gelijktijdig: de laatste vrije plek gaat maar een keer weg', async () => {
  const { m } = motor();
  const t = team();
  const [x, y, z] = await Promise.all(['b', 'c', 'd'].map(async p => m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: p, datum: '2026-10-07' }, opts(p))));
  const ja = [x, y, z].filter(r => r.verzoek.stand === 'SCHEDULED');
  assert.equal(ja.length, 2, 'vijf aanwezig, minimum drie: twee plekken');
});

test('idempotent en geen dubbele aanvraag', () => {
  const { m, bak } = motor();
  const v = { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: 'b', datum: '2026-10-08' };
  const r1 = m.vraag(ORG, team(), v, opts('b', { sleutel: 'k1' }));
  const r2 = m.vraag(ORG, team(), v, opts('b', { sleutel: 'k1' }));
  assert.equal(r2.herhaling, true); assert.equal(r2.verzoek.id, r1.verzoek.id);
  assert.equal(m.vraag(ORG, team(), { ...v, datum: '2026-10-09' }, opts('b', { sleutel: 'k1' })).status, 409);
  assert.equal(m.vraag(ORG, team(), v, opts('b')).status, 409);
  assert.equal(bak.vrijheid[ORG].boekingen.filter(b => b.categorie === 'RTG_DAY').length, 1, 'een RTG Day, niet twee');
});

test('herkeuring: verlopen bevoegdheid na goedkeuring wordt een signaal, geen stille intrekking', () => {
  const { m, events } = motor();
  const t = team({ kwalificaties: [{ persoon: 'a', code: 'PAYMENT_L3', geldigTot: '2027-12-31', afgetekendDoor: 'kantoor' },
    { persoon: 'b', code: 'PAYMENT_L3', geldigTot: '2027-12-31', afgetekendDoor: 'kantoor' }] });
  const r = m.vraag(ORG, t, { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: 'a', datum: '2026-10-08' }, opts('a'));
  assert.equal(r.verzoek.stand, 'SCHEDULED');
  t.kwalificaties[1].geldigTot = '2026-10-05';
  const h = m.herkeur(ORG, t);
  assert.equal(h.gevonden[0].wat, 'dekking');
  assert.equal(r.verzoek.stand, 'SCHEDULED', 'vrije tijd wordt niet stil ingetrokken');
  assert.ok(events.filter(e => e.type === 'COVERAGE_GAP_DETECTED').length >= 1);
  t.mensen.find(x => x.id === 'a').inDienst.tot = '2026-10-01';
  assert.equal(m.herkeur(ORG, t).gevonden[0].wat, 'uit-dienst');
  assert.equal(r.verzoek.stand, 'CANCELLED');
});

test('onbekende rooster-uitkomst wordt eerst afgestemd', () => {
  const { m, rooster } = motor();
  rooster.faal = true;
  const r = m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  assert.equal(r.verzoek.rooster, 'ONBEKEND');
  rooster.faal = false;
  rooster.staat.add(r.verzoek.id); /* de wijziging kwam toch aan */
  const log = rooster.log.length;
  m.reconcile(ORG);
  assert.equal(r.verzoek.rooster, 'BIJGEWERKT');
  assert.equal(rooster.log.length, log, 'niet opnieuw geprobeerd: eerst gekeken');
});

test('standmachines laten geen verboden overgang toe', () => {
  assert.throws(() => S.zet({ stand: 'DECLINED' }, 'verzoek', 'APPROVED'));
  assert.throws(() => S.zet({ stand: 'OFFERED' }, 'vrijgaveAanbod', 'COMPLETED'));
  assert.ok(S.mag('ruil', 'PROPOSED', 'COUNTERPART_ACCEPTED'));
});

test('geen verborgen score en geen AI in de beslisweg', () => {
  const map = path.join(__dirname, '..', 'server', 'kern', 'vrijheid');
  for (const f of fs.readdirSync(map)) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(bron, /require\([^)]*(ai|anthropic|model)[^)]*\)/i, f + ' laadt geen model');
    assert.doesNotMatch(bron, /\b(loyal|dedication|commitment|flexibiliteitsscore|productiviteit)\w*/i, f);
    assert.doesNotMatch(bron, /\bscore\s*[:=]/, f + ' zet geen score');
  }
  const { m } = motor();
  m.vraag(ORG, team(), { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', persoon: 'b', datum: '2026-10-08' }, opts('b'));
  assert.ok(Object.isFrozen(motor().m) === false);
  assert.doesNotMatch(JSON.stringify(m.gezondheid(ORG)), /"(persoon|b)"/, 'gezondheid is per systeem, niet per mens');
});

test('rotatie: vaker gekregen weegt zwaarder dan langer geleden', () => {
  const g = [{ soort: 'POPULAR_SLOT_GRANTED', persoon: 'p', moment: 'oud-nieuw', datum: '2022-12-31' },
    { soort: 'POPULAR_SLOT_GRANTED', persoon: 'p', moment: 'oud-nieuw', datum: '2023-12-31' },
    { soort: 'POPULAR_SLOT_GRANTED', persoon: 'q', moment: 'oud-nieuw', datum: '2025-12-31' },
    { soort: 'POPULAR_SLOT_GRANTED', persoon: 'q', moment: 'kerst', datum: '2025-12-24' }];
  const r = rotatie(['p', 'q'], { moment: 'oud-nieuw', plekken: 1, zaad: 'z' }, g);
  assert.equal(r.find(x => x.toegekend).persoon, 'q', 'q kreeg het een keer, p twee keer; een ander moment telt niet mee');
});

test('eerder naar huis na overdracht: eerst overdragen, dan pas weg', () => {
  const t = team({ verantwoordelijkheden: [{ id: 'mail', naam: 'Klantmail', persoon: 'b', kritiek: false, klaar: false, overdraagbaar: true }] });
  const { m, events } = motor();
  const a = m.vrijheidsKansen(ORG, t, { datum: '2026-10-02', vanaf: '15:00', beleid }).aangeboden.find(x => x.persoon === 'b');
  assert.equal(a.werkstand, 'HANDOVER_POSSIBLE');
  assert.ok(events.some(e => e.type === 'HANDOVER_REQUIRED'));
  const te = m.aanvaardVrijheid(ORG, t, a.id, 'b');
  assert.equal(te.status, 409); assert.match(te.error, /overdracht/);
  Object.assign(t.verantwoordelijkheden[0], { overgedragenAan: 'c', aanvaard: true });
  assert.ok(m.aanvaardVrijheid(ORG, t, a.id, 'b').ok);
});

test('het besluit van de eigenaar staat, en de rest blijft open', () => {
  const { rtgBeleid, STAND } = require('../server/kern/vrijheid/rtgbeleid');
  const b = rtgBeleid();
  assert.equal(b.waarde('rtgDag.perJaar').waarde, 10);
  assert.match(b.waarde('rtgDag.perJaar').bron, /besluit eigenaar RTG, 27 september 2026/);
  for (const p of ['verjaardag.weekend', 'verjaardag.feestdag', 'verjaardag.geenWerkdag']) assert.equal(b.waarde(p).waarde, 'vorige-werkdag', p);
  for (const p of ['verjaardag.nachtdienst', 'verjaardag.schrikkeldag', 'vroegVertrek.autoTotMinuten', 'capaciteit.minAantal']) assert.ok(b.waarde(p).open, p + ' is niet besloten');
  assert.equal(STAND.juridischGevalideerd, false);
  /* Een wet of cao eronder blijft gelden; het RTG-beleid verdringt geen recht. */
  const met = rtgBeleid({ LEGAL_BASELINE: { 'rust.minUurTussenDiensten': { waarde: 11, bron: 'ATW' } } });
  assert.equal(met.waarde('rust.minUurTussenDiensten').waarde, 11);
  /* Een parttimer die op zijn vrije woensdag jarig is, krijgt zijn vorige werkdag. */
  const t = team();
  const d = t.mensen.find(m => m.id === 'd'); d.verjaardag = '10-07';
  t.diensten = t.diensten.filter(x => !(x.persoon === 'd' && x.datum === '2026-10-07'));
  const { m } = motor();
  const vj = m.planVerjaardagen(ORG, t, 2026, { beleid: b }).verjaardagen.find(j => j.persoon === 'd');
  assert.equal(vj.datum, '2026-10-06');
  const mijn = m.mijnTijd(ORG, 'b', { beleid: b, rechten: { wettelijk: 160 }, jaar: 2026 });
  assert.equal(mijn.rtgDagen.over, 10);
});

test('een eis van een kamer telt alleen de mensen van die kamer', () => {
  const t = team();
  t.mensen.forEach(m => { m.kamers = ['a', 'b'].includes(m.id) ? ['financien'] : ['klantenservice']; });
  const datum = '2026-10-06';
  t.eisen = [{ datum, van: '09:00', tot: '17:00', minBezetting: 2, kamer: 'financien' }];
  const afw = { persoon: 'b', van: T.punt(datum, '09:00'), tot: T.punt(datum, '17:00') };
  const r = D.toets(t, afw, []);
  assert.equal(r.stand, 'GAP', 'drie van klantenservice dekken financien niet');
  assert.equal(r.gaten[0].kamer, 'financien');
  assert.match(r.uitleg, /in financien/);
  assert.equal(D.toets(t, { ...afw, persoon: 'c' }, []).stand, 'SAFE', 'klantenservice mag weg: financien blijft op twee');
});
