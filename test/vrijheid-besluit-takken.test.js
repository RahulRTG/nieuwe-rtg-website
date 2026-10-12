'use strict';
/* VRIJHEID: de besluitweg van server/kern/vrijheid/besluit.js, stap voor stap
   en rechtstreeks aangeroepen met een klein teambeeld van vier mensen. Elke
   weigering moet de zin van de stap dragen die nee zei, en elke uitkomst uit
   UITKOMSTEN moet hier minstens een keer langskomen. Het beleid is een
   PROEFBELEID, nadrukkelijk geen vastgesteld arbeidsvoorwaardenbesluit. */
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../server/kern/vrijheid/besluit');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');

const PROEF = 'proefbeleid';
const w = (waarde) => ({ waarde, bron: PROEF });
const VOL = {
  LEGAL_BASELINE: { 'rust.minUurTussenDiensten': w(11) },
  ORGANIZATION_POLICY: { 'vroegVertrek.autoTotMinuten': w(120), 'eerlijkheid.vensterDagen': w(28), 'eerlijkheid.maxExtraDekking': w(2) },
  RTG_ADDITIONAL_BENEFIT: { 'rtgDag.perJaar': w(3) }
};
const beleid = maakBeleid(VOL);
const zonderEerlijkheid = maakBeleid({ LEGAL_BASELINE: VOL.LEGAL_BASELINE, RTG_ADDITIONAL_BENEFIT: VOL.RTG_ADDITIONAL_BENEFIT });
const zonderGrens = maakBeleid({ LEGAL_BASELINE: VOL.LEGAL_BASELINE, ORGANIZATION_POLICY: { 'eerlijkheid.vensterDagen': w(28), 'eerlijkheid.maxExtraDekking': w(2) } });
const leeg = maakBeleid({});

const DAG = '2026-10-05';
const MORGEN = '2026-10-06';
function team(o = {}) {
  const mensen = ['a', 'b', 'c', 'd'].map(id => ({ id, inDienst: { van: '2024-01-01', tot: null } }));
  if (o.extraMens) mensen.push(o.extraMens);
  const diensten = (o.dagen || [DAG]).flatMap(datum => ['a', 'b', 'c', 'd'].map(p => ({ persoon: p, datum, van: '09:00', tot: '17:00' })));
  const t = {
    organisatie: 'ORG', mensen, diensten,
    eisen: [{ datum: DAG, van: '09:00', tot: '17:00', minBezetting: o.min != null ? o.min : 2, vereist: o.vereist || {} }],
    kwalificaties: [
      { persoon: 'a', code: 'KAS', geldigTot: '2030-01-01', afgetekendDoor: 'kantoor' },
      { persoon: 'b', code: 'KAS', geldigTot: '2030-01-01', afgetekendDoor: 'kantoor' },
      { persoon: 'x', code: 'KAS', geldigTot: '2030-01-01', afgetekendDoor: 'kantoor' }
    ],
    verantwoordelijkheden: o.verantwoordelijkheden || [], schaars: o.schaars || []
  };
  if (o.rosterVersie !== null) t.rosterVersie = o.rosterVersie || 'r7';
  if (o.zonderEisen) t.eisen = [];
  if (o.extraEisen) t.eisen = t.eisen.concat(o.extraEisen);
  return t;
}
const VOLLE_SALDI = { wettelijk: { recht: 160, over: 100 }, contractueel: { recht: 16, over: 16 }, rtgDag: { recht: 3, over: 2 } };
function oordeel(verzoek, o = {}) {
  return B.beoordeel({ team: o.team || team(), beleid: o.beleid || beleid, verzoek: { persoon: 'c', datum: DAG, soort: 'VRIJE_DAG', categorie: 'SCHEDULE_FLEXIBILITY', ...verzoek },
    afwezig: o.afwezig || [], grootboek: o.grootboek || [], saldi: o.saldi === undefined ? VOLLE_SALDI : o.saldi, vandaag: o.vandaag });
}
const stap = (r, naam) => r.stappen.find(s => s.stap === naam);

test('de uitkomsten en het aanvraagbare zijn vaste lijsten', () => {
  assert.ok(B.UITKOMSTEN.includes('ROTATION'));
  assert.equal(B.AANVRAAGBAAR.length, 6);
  assert.ok(!B.AANVRAAGBAAR.includes('BIRTHDAY_LEAVE'));
  assert.ok(Object.isFrozen(B.UITKOMSTEN));
});

test('ELIGIBILITY: wie niet in het team staat of uit dienst is, wordt geblokkeerd met de datum in de zin', () => {
  const vreemd = oordeel({ persoon: 'zz' });
  assert.equal(vreemd.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.match(stap(vreemd, 'ELIGIBILITY').uitleg, /2026-10-05 loopt er geen dienstverband/);
  assert.equal(vreemd.stappen.length, 1);
  const t = team({ extraMens: { id: 'e', inDienst: { van: '2024-01-01', tot: '2026-09-30' } } });
  t.diensten.push({ persoon: 'e', datum: DAG, van: '09:00', tot: '17:00' });
  assert.equal(oordeel({ persoon: 'e' }, { team: t }).uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.equal(oordeel({ persoon: 'c' }, { team: t }).uitkomst, 'AUTO_APPROVED');
});

test('RIGHTS_POLICY: een geplande categorie en een onbekende categorie hebben elk hun eigen zin', () => {
  const jarig = oordeel({ categorie: 'BIRTHDAY_LEAVE' });
  assert.equal(jarig.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.match(stap(jarig, 'RIGHTS_POLICY').uitleg, /^Uw verjaardag wordt niet aangevraagd/);
  const raar = oordeel({ categorie: 'VERZONNEN' });
  assert.equal(stap(raar, 'RIGHTS_POLICY').uitleg, 'Onbekende categorie.');
});

test('zonder dienst op die dag is er niets vrij te maken: DECLINED met code geen-dienst', () => {
  const r = oordeel({ datum: '2026-10-07' });
  assert.equal(r.uitkomst, 'DECLINED');
  assert.equal(r.code, 'geen-dienst');
  assert.equal(stap(r, 'RIGHTS_POLICY').stand, 'NIET_NODIG');
  /* eerder weg op een tijdstip buiten de dienst is ook geen dienst */
  assert.equal(oordeel({ soort: 'EERDER_WEG', vanaf: '18:00' }).code, 'geen-dienst');
});

test('een RTG Day zonder vastgesteld recht is geblokkeerd met de reden uit het beleid', () => {
  const r = oordeel({ categorie: 'RTG_DAY' }, { beleid: leeg });
  assert.equal(r.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.match(stap(r, 'RIGHTS_POLICY').uitleg, /Nog niet vastgesteld: Aantal RTG Days/);
});

test('saldo: onbekend wordt UNKNOWN met de doorgereisde reden, te weinig is DECLINED met code saldo', () => {
  const geen = oordeel({ categorie: 'STATUTORY_LEAVE' }, { saldi: null });
  assert.equal(geen.uitkomst, 'UNKNOWN');
  assert.equal(stap(geen, 'RIGHTS_POLICY').uitleg, 'Het saldo voor Vakantie is niet bekend.');
  const metReden = oordeel({ categorie: 'STATUTORY_LEAVE' }, { saldi: { wettelijk: { recht: null, reden: 'De cao is niet geladen.' } } });
  assert.match(stap(metReden, 'RIGHTS_POLICY').uitleg, /niet bekend\. De cao is niet geladen\.$/);
  const krap = oordeel({ categorie: 'STATUTORY_LEAVE' }, { saldi: { wettelijk: { recht: 160, over: 7.5 } } });
  assert.equal(krap.uitkomst, 'DECLINED');
  assert.equal(krap.code, 'saldo');
  assert.equal(stap(krap, 'RIGHTS_POLICY').uitleg, 'Er staat nog 7.5 over; nodig is 8.');
  /* een RTG Day kost een dag, niet acht uur */
  const rtg = oordeel({ categorie: 'RTG_DAY' }, { saldi: { rtgDag: { recht: 3, over: 1 } } });
  assert.equal(rtg.uitkomst, 'AUTO_APPROVED');
  assert.match(stap(rtg, 'RIGHTS_POLICY').uitleg, /^RTG Day past binnen de rechten\.$/);
  const rtgOp = oordeel({ categorie: 'RTG_DAY' }, { saldi: { rtgDag: { recht: 3, over: 0 } } });
  assert.equal(rtgOp.code, 'saldo');
});

test('een categorie zonder teller schrijft nergens van af, en draagt de versies mee', () => {
  const r = oordeel({});
  assert.equal(r.uitkomst, 'AUTO_APPROVED');
  assert.match(stap(r, 'RIGHTS_POLICY').uitleg, /wordt van geen saldo afgeschreven/);
  assert.equal(r.rosterVersie, 'r7');
  assert.equal(r.beleidVersie, beleid.versie);
  assert.equal(r.uren, 8);
  assert.equal(r.vervanger, null);
  assert.equal(stap(r, 'WORK_STATE').stand, 'NVT');
  assert.equal(stap(r, 'REST').uitleg, 'Niemand krijgt een andere dienst.');
  assert.equal(oordeel({}, { team: team({ rosterVersie: null }) }).rosterVersie, null);
});

test('zonder bezettingseis is dekking niet aan te tonen: HUMAN_REVIEW_REQUIRED', () => {
  const r = oordeel({}, { team: team({ zonderEisen: true }) });
  assert.equal(r.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(stap(r, 'COVERAGE').stand, 'UNKNOWN');
  assert.equal(stap(r, 'QUALIFICATION_COVERAGE').stand, 'UNKNOWN');
  assert.deepEqual(r.blokkades, []);
  assert.equal(oordeel({}, { team: team({ min: 4 }) }).blokkades.length, 1, 'met een eis die knelt is er wel een blokkade');
});

test('teamimpact in woorden: boven het minimum is LOW, precies erop is AT_MINIMUM', () => {
  assert.equal(stap(oordeel({}), 'TEAM_IMPACT').stand, 'LOW');
  const krap = oordeel({}, { team: team({ min: 3 }) });
  assert.equal(stap(krap, 'TEAM_IMPACT').stand, 'AT_MINIMUM');
  assert.equal(krap.uitkomst, 'AUTO_APPROVED');
});

test('een gat in de bezetting zonder uitweg is DECLINED, met een andere dag is het een alternatief', () => {
  const geen = oordeel({}, { team: team({ min: 4 }) });
  assert.equal(geen.uitkomst, 'DECLINED');
  assert.equal(geen.code, 'geen-alternatief');
  assert.deepEqual(geen.blokkades, ['bezetting']);
  assert.equal(stap(geen, 'COVERAGE').stand, 'GAP');
  assert.equal(stap(geen, 'QUALIFICATION_COVERAGE').stand, 'SAFE');
  assert.equal(stap(geen, 'TEAM_IMPACT').stand, 'NVT');
  const t = team({ min: 4, dagen: [DAG, MORGEN], extraEisen: [{ datum: MORGEN, van: '09:00', tot: '17:00', minBezetting: 2 }] });
  const wel = oordeel({}, { team: t });
  assert.equal(wel.uitkomst, 'ALTERNATIVE_AVAILABLE');
  assert.equal(wel.code, null);
  assert.deepEqual(wel.alternatieven.map(a => [a.soort, a.datum]), [['andere-dag', MORGEN]]);
});

test('een ontbrekende bevoegdheid is een eigen gat, en een vrijwillige vervanger die instemt dekt hem', () => {
  /* b gaat weg; dan heeft alleen a nog KAS, en er zijn er twee nodig */
  const gat = oordeel({ persoon: 'b' }, { team: team({ vereist: { KAS: 2 }, extraMens: { id: 'x', inDienst: { van: '2024-01-01', tot: null } } }) });
  assert.equal(gat.uitkomst, 'ALTERNATIVE_AVAILABLE');
  assert.deepEqual(gat.blokkades, ['KAS']);
  assert.equal(stap(gat, 'QUALIFICATION_COVERAGE').stand, 'GAP');
  assert.match(stap(gat, 'QUALIFICATION_COVERAGE').uitleg, /KAS-dekking/);
  const vrijwillig = gat.alternatieven.find(a => a.soort === 'vrijwillige-vervanging');
  assert.deepEqual(vrijwillig.namen, ['x']);

  const t = team({ vereist: { KAS: 2 }, extraMens: { id: 'x', inDienst: { van: '2024-01-01', tot: null } } });
  const gedekt = oordeel({ persoon: 'b', vervanger: { persoon: 'x', instemming: true } }, { team: t });
  assert.equal(gedekt.uitkomst, 'AUTO_APPROVED');
  assert.equal(gedekt.vervanger, 'x');
  assert.equal(stap(gedekt, 'REST').stand, 'SAFE');
  assert.equal(stap(gedekt, 'FAIRNESS').stand, 'FAIR');
  /* zonder instemming telt de vervanger niet voor de dekking */
  const nee = oordeel({ persoon: 'b', vervanger: { persoon: 'x', instemming: false } }, { team: t });
  assert.equal(nee.uitkomst, 'ALTERNATIVE_AVAILABLE');
});

test('eerlijkheid: wie al te vaak extra dekte maakt het UNFAIR, en zonder eerlijkheidsbeleid kijkt een mens', () => {
  const t = team({ extraMens: { id: 'x', inDienst: { van: '2024-01-01', tot: null } } });
  const grootboek = [{ soort: 'EXTRA_COVERAGE', persoon: 'x', datum: '2026-09-20' }, { soort: 'EXTRA_COVERAGE', persoon: 'x', datum: '2026-09-28' }];
  const oneerlijk = oordeel({ vervanger: { persoon: 'x', instemming: true } }, { team: t, grootboek });
  assert.equal(oneerlijk.uitkomst, 'ALTERNATIVE_AVAILABLE');
  assert.equal(oneerlijk.code, 'NO_UNFAIR_TRANSFER');
  assert.equal(stap(oneerlijk, 'FAIRNESS').stand, 'UNFAIR');
  assert.match(stap(oneerlijk, 'FAIRNESS').uitleg, /al 2 keer extra/);
  assert.ok(Array.isArray(oneerlijk.alternatieven));
  const open = oordeel({ vervanger: { persoon: 'x', instemming: true } }, { team: t, beleid: zonderEerlijkheid });
  assert.equal(open.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(stap(open, 'FAIRNESS').stand, 'UNKNOWN');
});

test('een schaars moment gaat via de rotatie en niet op volgorde van aanvragen', () => {
  const r = oordeel({}, { team: team({ schaars: [{ datum: DAG, moment: 'herfstvakantie' }] }) });
  assert.equal(r.uitkomst, 'ROTATION');
  assert.equal(r.moment, 'herfstvakantie');
  assert.match(stap(r, 'FAIRNESS').uitleg, /schaars moment \(herfstvakantie\)/);
});

test('een ruil: rust wordt getoetst bij wie de nieuwe dienst krijgt', () => {
  const t = team({ extraMens: { id: 'x', inDienst: { van: '2024-01-01', tot: null } } });
  const veilig = oordeel({ soort: 'SHIFT_SWAP', ruilMet: 'x', nieuweDienst: { persoon: 'x', datum: DAG, van: '09:00', tot: '17:00' } }, { team: t });
  assert.equal(veilig.uitkomst, 'AUTO_APPROVED');
  assert.equal(stap(veilig, 'REST').stand, 'SAFE');
  /* d werkt die dag al; een tweede dienst op hetzelfde moment is geen rust */
  const dubbel = oordeel({ soort: 'SHIFT_SWAP', ruilMet: 'd', nieuweDienst: { persoon: 'd', datum: DAG, van: '09:00', tot: '17:00' } });
  assert.equal(dubbel.uitkomst, 'DECLINED');
  assert.equal(dubbel.code, 'rust');
  assert.equal(stap(dubbel, 'REST').stand, 'REST_RISK');
  const onbekend = oordeel({ soort: 'SHIFT_SWAP', ruilMet: 'x', nieuweDienst: { persoon: 'x', datum: DAG, van: '09:00', tot: '17:00' } },
    { team: t, beleid: maakBeleid({ ORGANIZATION_POLICY: VOL.ORGANIZATION_POLICY }) });
  assert.equal(onbekend.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(onbekend.code, 'rust');
});

test('bijzonder en onbetaald verlof gaan altijd langs een mens', () => {
  for (const categorie of ['SPECIAL_LEAVE', 'UNPAID_LEAVE']) {
    const r = oordeel({ categorie });
    assert.equal(r.uitkomst, 'HUMAN_REVIEW_REQUIRED');
    assert.equal(stap(r, 'DECISION').stand, 'HUMAN');
  }
});

test('eerder weg op de dag zelf: de werkstand beslist mee', () => {
  const kort = { soort: 'EERDER_WEG', vanaf: '16:00' };
  /* zonder vastgelegde verantwoordelijkheden is de werkstand onbekend */
  const leegLijst = oordeel(kort, { vandaag: DAG });
  assert.equal(stap(leegLijst, 'WORK_STATE').stand, 'UNKNOWN');
  assert.equal(leegLijst.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  assert.match(stap(leegLijst, 'DECISION').uitleg, /De werkstand is UNKNOWN/);
  /* kritiek werk open: het gevraagde moment kan niet */
  const kritiek = oordeel(kort, { vandaag: DAG, team: team({ verantwoordelijkheden: [{ id: 'kas', persoon: 'c', kritiek: true }] }) });
  assert.equal(stap(kritiek, 'WORK_STATE').stand, 'CRITICAL_WORK_REMAINS');
  assert.ok(['ALTERNATIVE_AVAILABLE', 'DECLINED'].includes(kritiek.uitkomst));
  assert.equal(stap(kritiek, 'TEAM_IMPACT').stand, 'NVT');
  /* door het systeem afgerond: binnen de grens automatisch */
  const af = team({ verantwoordelijkheden: [{ id: 'kas', persoon: 'c', kritiek: true, klaar: true, bron: 'systeem' }] });
  const klaar = oordeel(kort, { vandaag: DAG, team: af });
  assert.equal(stap(klaar, 'WORK_STATE').stand, 'WORK_COMPLETE');
  assert.equal(klaar.uitkomst, 'AUTO_APPROVED');
  assert.equal(klaar.uren, 1);
  /* drie uur eerder weg ligt boven de grens van 120 minuten */
  const lang = oordeel({ soort: 'EERDER_WEG', vanaf: '14:00' }, { vandaag: DAG, team: af });
  assert.equal(lang.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  assert.match(stap(lang, 'DECISION').uitleg, /Meer dan 120 minuten/);
  /* zonder vastgestelde grens beslist ook een mens */
  const open = oordeel(kort, { vandaag: DAG, team: af, beleid: zonderGrens });
  assert.equal(open.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  assert.match(stap(open, 'DECISION').uitleg, /Nog niet vastgesteld: Tot hoeveel minuten/);
  /* vooraf gevraagd is er nog geen werkstand */
  assert.equal(stap(oordeel(kort, { vandaag: '2026-10-01', team: af }), 'WORK_STATE').stand, 'NVT');
});

test('later beginnen telt de uren vanaf de dienst en valt onder dezelfde grens', () => {
  const r = oordeel({ soort: 'LATER_BEGINNEN', tot: '10:30' });
  assert.equal(r.uitkomst, 'AUTO_APPROVED');
  assert.equal(r.uren, 1.5);
  const lang = oordeel({ soort: 'LATER_BEGINNEN', tot: '13:00' });
  assert.equal(lang.uitkomst, 'HUMAN_REVIEW_REQUIRED');
});

test('een teambeeld zonder mensen of diensten kent niemand en blokkeert', () => {
  const r = oordeel({}, { team: { organisatie: 'ORG' } });
  assert.equal(r.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.equal(r.rosterVersie, null);
  const t = team({ extraMens: { id: 'x', inDienst: { van: '2024-01-01', tot: null } } });
  const zonderDiensten = { ...t, diensten: undefined };
  assert.equal(oordeel({ vervanger: { persoon: 'x', instemming: true } }, { team: zonderDiensten }).code, 'geen-dienst');
});
