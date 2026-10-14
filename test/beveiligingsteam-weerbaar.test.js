/* HET COMMANDOCENTRUM VAN EEN BEVEILIGINGSTEAM, WEERBAAR
   (server/kern/beveiliging.js met rooster/planning.js, rooster/aanvragen.js en
   pda/index.js + pda/patrouille.js).

   Dit is de POS van de beveiligingsteams die met RTG werken: posten, het
   budget, het rooster en de autoplanner, de inzetaanvragen van klanten, en de
   PDA van de bewaker (in- en uitklokken, rondes, incidenten, SOS). De
   bestaande toetsen raken de rustregel, het verzuim, de SOS-posities en de
   rondes; de randen die hier staan waren ongetoetst: wat er geweigerd wordt
   (verkeerd team, functie uit, onbekende post/shift/bewaker, een dubbele
   dienst, een ronde van een ander) en wat het budget en het commandocentrum
   werkelijk zeggen.

   Wat hier niet mag sneuvelen:
   1. een team zet zijn eigen functies aan en uit, en een functie die uit staat
      WEIGERT (409) in plaats van stil door te gaan; een onbekende functie
      bestaat niet;
   2. een post vraagt een naam, en invoer wordt geschoond (geen < >, begrensd,
      coordinaten binnen de wereld);
   3. het budget rekent geplande uren x tarief, telt een geschrapte dienst NIET
      mee, en zegt bij 85% en bij 100% dat het krap of op is;
   4. zetDienst weigert een onbekende post, shift, datum of bewaker en een
      dubbele dienst op dezelfde shift; schrappen kan niet bij een ingeklokte
      bewaker;
   5. de autoplanner verdeelt eerlijk (minste uren eerst), zegt wat open
      bleef, en plant nooit buiten zijn team;
   6. een aanvraag die is afgerond, kan niet nog eens beslist worden, en een
      onbekende actie verandert niets;
   7. de PDA van een bewaker werkt alleen op zijn EIGEN dienst en ronde en
      alleen binnen een beveiligingsteam; een afgeronde dienst klokt niet
      opnieuw in;
   8. een incidentfoto komt alleen binnen als hij een afbeelding is, klein
      genoeg, EN de bodycam aan staat; kritiek en hoog gaan ook naar
      RTG-kantoor;
   9. het commandocentrum telt open incidenten, SOS, lopende rondes en open
      aanvragen, en laat het budget weg als die functie uit staat;
  10. een MENS mag een afwezige of te weinig uitgeruste bewaker zetten maar
      krijgt de waarschuwing erbij; de automaat nooit; een afwezige bewaker
      vult de post niet, en het bericht dat zijn dienst vervalt zegt DAT en
      WELKE post, nooit waarom, en maar een keer per verzuimregel;
  11. de bewaarveger start de klok van een al afgehandeld incident nu (niet
      met terugwerkende kracht) en haalt GPS van oude controlepunten af;
  12. oude of onvolledige gegevens (een verdwenen post of shift, een dienst
      van voor een veld) laten niets omvallen.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - planning.js budget: `d.status !== 'geannuleerd'` weggehaald uit het filter
     -> "3. het budget" ZAKT (RAAK): de geschrapte dienst telt dan mee.
   - aanvragen.js beslisAanvraag: `if (AANVR_KLAAR[a.status]) return {409}`
     weggehaald
     -> "6. een afgeronde aanvraag" ZAKT (RAAK).
   - pda/index.js meldIncident: `&& functieAan(s, 'bodycam')` weggehaald
     -> "8. een incidentfoto" ZAKT (RAAK).

   Draai: node --test test/beveiligingsteam-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakBeveiliging, BEVEILIGING_FUNCTIES } = require('../server/kern/beveiliging');

const MORGEN = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const LATER = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const VANDAAG = new Date().toISOString().slice(0, 10);

function bouw(opties) {
  const o = opties || {};
  const db = { data: {} };
  const zaak = { code: 'BEV', type: 'beveiliging', name: 'Wacht BV' };
  const ander = { code: 'BAR', type: 'horeca' };
  const team = o.team || [{ id: 1, name: 'Anna' }, { id: 2, name: 'Bram' }, { id: 3, name: 'Cees' }];
  const sporen = { naarZaak: [], sse: [], kantoor: [], log: [] };
  const bev = maakBeveiliging({
    db, save: () => {}, crypto,
    accounts: { listStaff: (c) => { if (o.kapotTeam) throw new Error('kluis dicht'); return c === 'BEV' ? team : []; }, publicStaff: x => x },
    findSupplier: c => (c === 'BEV' ? zaak : c === 'BAR' ? ander : null),
    notify: () => {}, notifySupplier: (c, n) => sporen.naarZaak.push(n),
    sseToSupplier: (c, e, d) => sporen.sse.push(d), sseToOffice: (e, d) => sporen.kantoor.push(d),
    logActivity: (c, wie, wat) => sporen.log.push(wat), haversine: () => 0,
    afwezigOp: o.afwezigOp || (() => null)
  });
  return { db, zaak, ander, bev, sporen };
}

test('1. functies: aan/uit per team, een functie die uit staat weigert, een onbekende bestaat niet', () => {
  const { bev, zaak } = bouw();
  const lijst = bev.bevFunctieLijst(zaak);
  assert.equal(lijst.length, BEVEILIGING_FUNCTIES.length);
  assert.ok(lijst.every(f => f.aan), 'standaard staat alles aan');
  assert.deepEqual(bev.bevZetFunctie(zaak, 'raketten', false), { status: 400, error: 'Onbekende functie.' });
  for (const id of ['rooster', 'autoplan', 'aanvragen', 'incidenten', 'sos', 'patrouille']) {
    const r = bev.bevZetFunctie(zaak, id, false);
    assert.equal(r.ok, true);
    assert.equal(r.functies.find(f => f.id === id).aan, false);
  }
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  assert.equal(bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: MORGEN, guardId: 1 }).status, 409);
  assert.match(bev.bevPlanAuto(zaak, MORGEN).error, /AI-planning staat uit/);
  assert.match(bev.bevAanvraag(zaak, { object: 'x', datum: MORGEN }).error, /Aanvragen staan uit/);
  assert.match(bev.bevMeldIncident('BEV', 1, { tekst: 'x' }).error, /Incidenten melden staat uit/);
  assert.match(bev.bevSos('BEV', 1).error, /SOS-knop staat uit/);
  assert.match(bev.bevRondeStart('BEV', 1, p.id).error, /Patrouillerondes staan uit/);
  // alleen precies false zet uit; alles anders is aan
  assert.equal(bev.bevZetFunctie(zaak, 'sos', undefined).functies.find(f => f.id === 'sos').aan, true);
  assert.equal(bev.bevFunctieAan(zaak, 'sos'), true);
  assert.equal(bev.bevIsBeveiliging({ type: 'horeca' }), false);
  assert.ok(!bev.bevIsBeveiliging(null));
  // een kapotte beveiliging-tak wordt hersteld in plaats van om te vallen
  const kapot = { code: 'BEV', type: 'beveiliging', beveiliging: 'rommel' };
  assert.equal(bev.bevDefaults(kapot).budget.tariefUur, 45);
  kapot.beveiliging = { functies: 'x', posten: 'y', budget: 7 };
  assert.deepEqual(bev.bevPosten(kapot), []);
});

test('2. een post vraagt een naam, en invoer wordt geschoond en begrensd', () => {
  const { bev, zaak } = bouw();
  assert.deepEqual(bev.bevZetPost(zaak, { naam: '  <>  ' }), { status: 400, error: 'Geef een postnaam.' });
  const p = bev.bevZetPost(zaak, { naam: '<b>Hoofdingang</b>', adres: 'Dam 1', klant: 'Bank', lat: '52.37', lng: 999,
    minMan: 500, shifts: ['dag', 'ruimte', 'nacht'], orders: 'o'.repeat(500) }).post;
  assert.equal(p.naam, 'bHoofdingang/b', 'geen < en > in een postnaam');
  assert.equal(p.lat, 52.37);
  assert.equal(p.lng, null, 'een lengte buiten de wereld wordt niet bewaard');
  assert.equal(p.minMan, 50, 'hooguit vijftig man');
  assert.deepEqual(p.shifts, ['dag', 'nacht'], 'een onbekende shift valt weg');
  assert.equal(p.orders.length, 400);
  assert.equal(p.actief, true);
  // bijwerken houdt wat niet opnieuw is meegegeven
  const p2 = bev.bevZetPost(zaak, { id: p.id, naam: 'Hoofdingang', minMan: 'x', actief: false }).post;
  assert.equal(p2.id, p.id);
  assert.equal(p2.adres, 'Dam 1'); assert.equal(p2.klant, 'Bank'); assert.equal(p2.lat, 52.37);
  assert.equal(p2.minMan, 50); assert.deepEqual(p2.shifts, ['dag', 'nacht']);
  assert.equal(p2.actief, false);
  // een onbekend id maakt een nieuwe post; zonder shifts krijgt hij alle drie
  const p3 = bev.bevZetPost(zaak, { id: 'bestaat-niet', naam: 'Achterom' }).post;
  assert.notEqual(p3.id, 'bestaat-niet');
  assert.deepEqual(p3.shifts, ['dag', 'avond', 'nacht']);
  assert.equal(p3.minMan, 1);
  assert.deepEqual(bev.bevVerwijderPost(zaak, 'nee'), { status: 404, error: 'Post niet gevonden.' });
  assert.equal(bev.bevVerwijderPost(zaak, p3.id).ok, true);
  assert.equal(bev.bevPosten(zaak).length, 1);
});

test('3. het budget: uren x tarief, een geschrapte dienst telt niet, en het zegt wanneer het krap of op is', () => {
  const { bev, zaak, db } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  const q = bev.bevZetPost(zaak, { naam: 'Hal' }).post;
  const maand = '2099-03';
  const b0 = bev.bevBudget(zaak, { maand });
  assert.equal(b0.budgetUren, 480); assert.equal(b0.tariefUur, 45); assert.equal(b0.budgetBedrag, 21600);
  assert.equal(b0.urenGepland, 0); assert.match(b0.advies, /Ruimte in het budget: nog 480 uur \(100%\)/);
  assert.equal(bev.bevBudget(zaak).maand, VANDAAG.slice(0, 7), 'zonder maand de lopende maand');

  const zb = bev.bevZetBudget(zaak, { periodeUren: 20, tariefUur: 'veel' });
  assert.equal(zb.budget.budgetUren, 20);
  assert.equal(zb.budget.tariefUur, 45, 'een onzin-tarief laat het oude staan');
  bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: '2099-03-01', guardId: 1 });
  const d2 = bev.bevZetDienst(zaak, { postId: q.id, shiftId: 'avond', datum: '2099-03-02', guardId: 2 });
  const b1 = bev.bevBudget(zaak, { maand });
  assert.equal(b1.urenGepland, 16); assert.equal(b1.pct, 80); assert.equal(b1.bestedBedrag, 720);
  assert.equal(b1.overschrijding, false);
  assert.deepEqual(b1.perPost.map(x => x.naam).sort(), ['Hal', 'Poort']);
  bev.bevZetBudget(zaak, { periodeUren: 18 });
  assert.match(bev.bevBudget(zaak, { maand }).advies, /^Bijna aan het budget \(89%\)/);
  bev.bevZetBudget(zaak, { periodeUren: 16 });
  const op = bev.bevBudget(zaak, { maand });
  assert.match(op.advies, /^Het budget is op: 16 van 16 uur/);
  assert.equal(op.overschrijding, false, 'precies op is nog geen overschrijding');
  bev.bevZetBudget(zaak, { periodeUren: 8 });
  assert.equal(bev.bevBudget(zaak, { maand }).overschrijding, true);

  // schrappen haalt hem uit het budget
  assert.equal(bev.bevSchrapDienst(zaak, d2.dienst.id).ok, true);
  assert.equal(bev.bevBudget(zaak, { maand }).urenGepland, 8, 'een geschrapte dienst kost niets');
  // een dienst op een verdwenen post en een onbekende shift valt niet om
  db.data.bevDiensten.push({ id: 'x', supplierCode: 'BEV', datum: '2099-03-09', shiftId: 'weg', postId: 'weg', guardId: 1, status: 'gepland' });
  const b2 = bev.bevBudget(zaak, { maand });
  assert.ok(b2.perPost.some(x => x.naam === 'Onbekende post' && x.uren === 0));
  bev.bevZetBudget(zaak, { periodeUren: 0 });
  assert.equal(bev.bevBudget(zaak, { maand }).pct, 0, 'zonder budget geen deling door nul');
});

test('4. zetDienst weigert onbekend en dubbel; schrappen niet bij een ingeklokte bewaker', () => {
  const { bev, zaak, sporen } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  const goed = { postId: p.id, shiftId: 'dag', datum: LATER, guardId: 1 };
  assert.deepEqual(bev.bevZetDienst(zaak, { ...goed, postId: 'nee' }), { status: 404, error: 'Post niet gevonden.' });
  assert.deepEqual(bev.bevZetDienst(zaak, { ...goed, shiftId: 'middag' }), { status: 400, error: 'Onbekende shift.' });
  assert.deepEqual(bev.bevZetDienst(zaak, { ...goed, datum: 'morgen' }), { status: 400, error: 'Kies een datum.' });
  assert.deepEqual(bev.bevZetDienst(zaak, { ...goed, guardId: 99 }), { status: 404, error: 'Beveiliger niet in het team.' });
  assert.deepEqual(bev.bevZetDienst(zaak, {}), { status: 404, error: 'Post niet gevonden.' });
  const r = bev.bevZetDienst(zaak, goed);
  assert.equal(r.ok, true);
  assert.equal(r.dienst.door, 'mens');
  assert.equal(r.dienst.guardNaam, 'Anna');
  assert.equal(r.verzuimNagekeken, true);
  const dubbel = bev.bevZetDienst(zaak, goed);
  assert.equal(dubbel.status, 409);
  assert.equal(dubbel.error, 'Anna staat al op deze shift.');
  assert.ok(sporen.sse.some(x => x.scope === 'beveiliging'));
  assert.deepEqual(bev.bevSchrapDienst(zaak, 'nee'), { status: 404, error: 'Dienst niet gevonden.' });
  bev.bevInklok('BEV', 1, r.dienst.id);
  assert.equal(bev.bevSchrapDienst(zaak, r.dienst.id).status, 409, 'wie ingeklokt staat, wordt niet weggeschrapt');
  bev.bevUitklok('BEV', 1, r.dienst.id);
  assert.equal(bev.bevSchrapDienst(zaak, r.dienst.id).ok, true);
  // een geschrapte dienst blokkeert de shift niet meer
  assert.equal(bev.bevZetDienst(zaak, goed).ok, true);
  // een kapotte kluis is een leeg team, geen crash
  const kapot = bouw({ kapotTeam: true });
  const kp = kapot.bev.bevZetPost(kapot.zaak, { naam: 'P' }).post;
  assert.equal(kapot.bev.bevZetDienst(kapot.zaak, { ...goed, postId: kp.id }).status, 404);
  assert.match(kapot.bev.bevPlanAuto(kapot.zaak, LATER).error, /Nog geen beveiligers/);
});

test('5. de autoplanner verdeelt eerlijk, zegt wat open bleef, en meldt een onleesbaar verzuimregister', () => {
  const { bev, zaak, db } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort', minMan: 2, shifts: ['dag'] }).post;
  // Anna heeft deze maand al uren (ver genoeg terug om geen rust te raken); dan gaan Bram en Cees voor
  assert.equal(bev.bevDienstVervalt('BEV', 1, null), 0, 'zonder verzuimmelding vervalt er niets');
  db.data.bevDiensten = [{ id: 'oud', supplierCode: 'BEV', datum: '2099-05-01', shiftId: 'avond', postId: p.id, guardId: 1, status: 'afgerond' }];
  const DAG = '2099-05-15';
  const r = bev.bevPlanAuto(zaak, DAG);
  assert.equal(r.ok, true);
  assert.equal(r.gemaakt.length, 2);
  assert.deepEqual(r.gemaakt.map(d => d.guardId).sort(), [2, 3], 'wie het minst heeft gedraaid, gaat voor');
  assert.ok(r.gemaakt.every(d => d.door === 'autoplan'));
  assert.match(r.uitleg, /Alle posten gedekt\./);
  const nog = bev.bevPlanAuto(zaak, DAG);
  assert.equal(nog.gemaakt.length, 0);
  assert.match(nog.uitleg, /Er stonden geen open diensten op 2099-05-15/);

  // te weinig mensen: een plek blijft open, en dat staat er
  const p2 = bev.bevZetPost(zaak, { naam: 'Hal', minMan: 4, shifts: ['nacht'] }).post;
  const krap = bev.bevPlanAuto(zaak, '2099-05-15');
  assert.ok(krap.onvervuld > 0);
  assert.ok(krap.gemaakt.every(d => d.postId === p2.id));
  assert.match(krap.uitleg, /bleven open/);
  // een onzin-datum valt terug op vandaag
  assert.equal(bev.bevPlanAuto(zaak, 'gisteren').datum, VANDAAG);

  // niemand beschikbaar: alles open
  const leeg = bouw({ afwezigOp: () => ({ wat: 'afwezig', inzetbaarheid: 'geen' }) });
  leeg.bev.bevZetPost(leeg.zaak, { naam: 'X', shifts: ['dag'] });
  const niets = leeg.bev.bevPlanAuto(leeg.zaak, LATER);
  assert.equal(niets.gemaakt.length, 0);
  assert.match(niets.uitleg, /^Geen dienst kon ingevuld worden/);
  assert.match(niets.uitleg, /3 bewaker\(s\) afwezig en niet ingepland/);
  // een register dat gooit, is geen "niemand afwezig": de planner zegt het erbij
  const stuk = bouw({ afwezigOp: () => { throw new Error('register weg'); } });
  stuk.bev.bevZetPost(stuk.zaak, { naam: 'X', shifts: ['dag'] });
  assert.match(stuk.bev.bevPlanAuto(stuk.zaak, LATER).uitleg, /NIET meegewogen/);
});

test('6. aanvragen: geldige invoer, een afgeronde aanvraag beslis je niet nog eens, een onbekende actie doet niets', () => {
  const { bev, zaak, sporen } = bouw();
  assert.deepEqual(bev.bevAanvraag(zaak, { datum: MORGEN }), { status: 400, error: 'Geef het object/de locatie.' });
  assert.deepEqual(bev.bevAanvraag(zaak, { object: 'Hal', datum: '1-1' }), { status: 400, error: 'Kies een datum.' });
  const a = bev.bevAanvraag(zaak, { object: 'Festivalterrein', datum: MORGEN, shiftId: 'onzin', soort: 'stiekem', aantal: 99, uren: 0 }).aanvraag;
  assert.equal(a.shiftId, 'dag', 'een onbekende shift wordt de eerste');
  assert.equal(a.soort, 'inzet'); assert.equal(a.klant, 'Klant');
  assert.equal(a.aantal, 50); assert.equal(a.uren, 1);
  assert.match(a.ref, /^AV[0-9A-F]{8}$/);
  assert.match(sporen.naarZaak[0].body, /Festivalterrein/);
  assert.ok(sporen.kantoor.length >= 1, 'RTG-kantoor ziet de aanvraag ook');
  const b = bev.bevAanvraag(zaak, { object: 'Loods', datum: MORGEN, soort: 'verlof', shiftId: 'nacht' }).aanvraag;
  assert.equal(b.soort, 'verlof'); assert.equal(b.uren, 8);

  assert.deepEqual(bev.bevBeslisAanvraag(zaak, 'AVNEE', 'plan'), { status: 404, error: 'Aanvraag niet gevonden.' });
  assert.deepEqual(bev.bevBeslisAanvraag(zaak, a.ref, 'doe-iets'), { status: 400, error: 'Onbekende actie.' });
  assert.equal(bev.bevAanvraagLijst(zaak).open.length, 2, 'een onbekende actie verandert niets');
  assert.equal(bev.bevBeslisAanvraag(zaak, b.ref, 'afwijzen').status2, 'afgewezen');
  assert.deepEqual(bev.bevBeslisAanvraag(zaak, b.ref, 'plan'), { status: 409, error: 'Deze aanvraag is al afgerond.' });

  // plannen zonder autoplan: een post erbij met de gevraagde mankracht, geen diensten
  const r = bev.bevBeslisAanvraag(zaak, a.ref, 'plan', { autoPlan: false });
  assert.equal(r.status2, 'gepland');
  const post = bev.bevPosten(zaak).find(p => p.naam === 'Festivalterrein');
  assert.equal(post.minMan, 50);
  assert.deepEqual(post.shifts, ['dag']);
  const lijst = bev.bevAanvraagLijst(zaak);
  assert.equal(lijst.open.length, 0); assert.equal(lijst.afgerond.length, 2);
  // een tweede aanvraag op dezelfde (bestaande) post tilt de minMan en voegt de shift toe; autoplan vult
  bev.bevZetPost(zaak, { id: post.id, naam: 'Festivalterrein', minMan: 1 });
  const c = bev.bevAanvraag(zaak, { object: 'festivalTERREIN', datum: LATER, shiftId: 'avond', aantal: 2 }).aanvraag;
  bev.bevBeslisAanvraag(zaak, c.ref, 'plan');
  assert.equal(post.minMan, 2);
  assert.deepEqual(post.shifts, ['dag', 'avond']);
  assert.ok(bev.bevRooster(zaak, LATER, 1).dagen[0].posten.find(p => p.postId === post.id).shifts
    .find(s => s.shiftId === 'avond').bezet.length >= 1, 'de autoplanner vulde de nieuwe plekken');
});

test('7. de PDA werkt alleen op de eigen dienst en ronde, en alleen binnen een beveiligingsteam', () => {
  const { bev, zaak, sporen } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  const d = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: MORGEN, guardId: 1 }).dienst;
  for (const code of ['BAR', 'NIEMAND']) {
    assert.equal(bev.bevInklok(code, 1, d.id).status, 404);
    assert.equal(bev.bevUitklok(code, 1, d.id).status, 404);
    assert.equal(bev.bevRondeStart(code, 1, p.id).status, 404);
    assert.equal(bev.bevRondeCheckpoint(code, 1, 'r', 'x').status, 404);
    assert.equal(bev.bevRondeKlaar(code, 1, 'r').status, 404);
    assert.equal(bev.bevMeldIncident(code, 1, { tekst: 'x' }).status, 404);
    assert.equal(bev.bevSos(code, 1).status, 404);
    assert.deepEqual(bev.bevMijnDiensten(code, 1), { diensten: [], ronde: null });
  }
  assert.deepEqual(bev.bevInklok('BEV', 2, d.id), { status: 404, error: 'Dienst niet gevonden.' }, 'Bram klokt niet in op de dienst van Anna');
  assert.equal(bev.bevUitklok('BEV', 2, d.id).status, 404);
  const in1 = bev.bevInklok('BEV', 1, d.id);
  assert.equal(in1.dienst.status, 'ingeklokt');
  assert.equal(in1.dienst.plekIn, null, 'zonder plaatslaag is er niets te zeggen, niet "buiten"');
  assert.match(sporen.log.at(-1), /klokte in op Poort/);
  bev.bevUitklok('BEV', 1, d.id);
  assert.deepEqual(bev.bevInklok('BEV', 1, d.id), { status: 409, error: 'Deze dienst is al afgerond.' });

  const md = bev.bevMijnDiensten('BEV', 1);
  assert.equal(md.diensten.length, 1); assert.equal(md.ronde, null); assert.equal(md.walkie, true);
  assert.deepEqual(bev.bevRondeStart('BEV', 1, 'nee'), { status: 404, error: 'Post niet gevonden.' });
  const r = bev.bevRondeStart('BEV', 1, p.id).ronde;
  assert.match(bev.bevRondeStart('BEV', 1, p.id).error, /al een lopende ronde/);
  assert.equal(bev.bevRondeCheckpoint('BEV', 2, r.id, 'x').status, 404, 'een ander zet geen controlepunt in mijn ronde');
  assert.equal(bev.bevRondeCheckpoint('BEV', 1, r.id, '').ronde.checkpoints[0].naam, 'Checkpoint 1');
  assert.equal(bev.bevRondeCheckpoint('BEV', 1, r.id, '<Achterhek>').ronde.checkpoints[1].naam, 'Achterhek');
  assert.equal(bev.bevMijnDiensten('BEV', 1).ronde.id, r.id);
  assert.equal(bev.bevRondeKlaar('BEV', 2, r.id).status, 404);
  const klaar = bev.bevRondeKlaar('BEV', 1, r.id);
  assert.ok(klaar.ronde.klaar);
  assert.equal(bev.bevRondeKlaar('BEV', 1, r.id).status, 404, 'een afgeronde ronde rond je niet nog eens af');
  assert.equal(bev.bevRondeCheckpoint('BEV', 1, r.id, 'laat').status, 404);
});

test('7b. aanwezigheid bij de post: drie uitkomsten, nooit een coordinaat', () => {
  const { bev, zaak } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  const dienst = (gid) => bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: MORGEN, guardId: gid }).dienst;
  const gevraagd = [];
  bev.bevKoppelPlaats({ plaatsAanwezig: (c, doel, plek) => { gevraagd.push(plek); return c === 'C1' ? { bekend: true, binnen: true, sinds: 't0' } : { bekend: false }; } },
    (s, gid) => (gid === 1 ? 'C1' : gid === 2 ? 'C2' : null));
  assert.deepEqual(bev.bevInklok('BEV', 1, dienst(1).id).dienst.plekIn, { bevestigd: true, gemeten: true, sinds: 't0', reden: null });
  assert.equal(gevraagd[0], 'bevpost:BEV:' + p.id);
  assert.deepEqual(bev.bevInklok('BEV', 2, dienst(2).id).dienst.plekIn, { bevestigd: false, gemeten: false, sinds: null, reden: 'niets waargenomen' });
  assert.deepEqual(bev.bevInklok('BEV', 3, dienst(3).id).dienst.plekIn, { bevestigd: false, gemeten: false, sinds: null, reden: 'geen ledenaccount' },
    'een bewaker zonder ledenaccount is "niet gemeten", geen verdachte');
  bev.bevKoppelPlaats({ plaatsAanwezig: 'geen functie' }, () => 'C1');
  const p2 = bev.bevZetPost(zaak, { naam: 'Hal' }).post;
  const d4 = bev.bevZetDienst(zaak, { postId: p2.id, shiftId: 'avond', datum: LATER, guardId: 1 }).dienst;
  assert.equal(bev.bevInklok('BEV', 1, d4.id).dienst.plekIn, null);
});

test('8. incidentfoto alleen als afbeelding, klein genoeg en met bodycam aan; kritiek en hoog gaan naar kantoor', () => {
  const { bev, zaak, sporen } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  assert.deepEqual(bev.bevMeldIncident('BEV', 1, { tekst: '  ' }), { status: 400, error: 'Beschrijf het incident.' });
  const foto = 'data:image/png;base64,AAAA';
  const a = bev.bevMeldIncident('BEV', 1, { tekst: 'Ruit', postId: p.id, foto, ernst: 'hoog', lat: '52.1', lng: 'oost' }).incident;
  assert.equal(a.foto, foto); assert.equal(a.post, 'Poort'); assert.equal(a.ernst, 'hoog');
  assert.equal(a.lat, 52.1); assert.equal(a.lng, null);
  assert.equal(sporen.kantoor.length, 1, 'hoog gaat ook naar RTG-kantoor');
  assert.equal(sporen.naarZaak.at(-1).icon, 'megafoon');
  const b = bev.bevMeldIncident('BEV', 1, { tekst: 'x', foto: 'data:text/html,<script>', ernst: 'apocalyps', post: 'Ergens' }).incident;
  assert.equal(b.foto, null, 'geen afbeelding, geen foto');
  assert.equal(b.ernst, 'midden'); assert.equal(b.post, 'Ergens');
  assert.equal(sporen.naarZaak.at(-1).icon, 'logboek');
  assert.equal(sporen.kantoor.length, 1, 'midden blijft bij het team');
  const groot = bev.bevMeldIncident('BEV', 1, { tekst: 'x', foto: 'data:image/png;base64,' + 'A'.repeat(2 * 1024 * 1024) }).incident;
  assert.equal(groot.foto, null, 'te groot');
  bev.bevZetFunctie(zaak, 'bodycam', false);
  const zonder = bev.bevMeldIncident('BEV', 1, { tekst: 'x', foto, ernst: 'kritiek' }).incident;
  assert.equal(zonder.foto, null, 'met de bodycam uit komt er geen beeld binnen');
  assert.equal(zonder.post, 'Onbekend');
  assert.equal(sporen.kantoor.length, 2);

  assert.deepEqual(bev.bevBeslisIncident(zaak, 'nee'), { status: 404, error: 'Incident niet gevonden.' });
  assert.equal(bev.bevBeslisIncident(zaak, a.id).status2, 'afgehandeld');
  assert.equal(bev.bevBeslisIncident(zaak, a.id).status2, 'open', 'heropenen kan');
  const s = bev.bevSos('BEV', 42, 'n', 4.9);
  assert.equal(s.incident.guardNaam, 'Bewaker', 'een onbekende bewaker heet gewoon Bewaker');
  assert.equal(s.incident.lat, null); assert.equal(s.incident.lng, 4.9);
  assert.equal(s.incident.sos, true);
  assert.match(sporen.log.at(-1), /SOS-noodknop/);
});

test('9. het commandocentrum telt wat open is en laat het budget weg als die functie uit staat', () => {
  const { bev, zaak, db } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort', minMan: 2, shifts: ['dag'] }).post;
  bev.bevZetPost(zaak, { naam: 'Oud', actief: false });
  const d = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: VANDAAG, guardId: 1 }).dienst;
  bev.bevInklok('BEV', 1, d.id);
  bev.bevRondeStart('BEV', 2, p.id);
  bev.bevAanvraag(zaak, { object: 'Hal', datum: MORGEN });
  bev.bevSos('BEV', 3);
  const c = bev.bevCommand(zaak);
  assert.equal(c.team, 3);
  assert.equal(c.posten, 1, 'een inactieve post telt niet');
  assert.equal(c.postenLijst.length, 2);
  assert.equal(c.opDienst.length, 1);
  assert.equal(c.openVandaag, 1, 'twee nodig, een gedekt');
  assert.deepEqual(c.postenStatus[0], { post: 'Poort', klant: '', open: 1, gedekt: 1, nodig: 2 });
  assert.equal(c.openAanvragen, 1);
  assert.equal(c.sosActief, true);
  assert.equal(c.incidentenOpen, 1);
  assert.equal(c.rondesActief.length, 1);
  assert.equal(c.rondesActief[0].post, 'Poort');
  assert.ok(c.budget && c.budget.urenGepland === 8);
  bev.bevZetFunctie(zaak, 'budget', false);
  db.data.bevRondes[0].postId = 'weg';
  const c2 = bev.bevCommand(zaak);
  assert.equal(c2.budget, null);
  assert.equal(c2.rondesActief[0].post, 'Post', 'een ronde op een verdwenen post valt niet om');
  // het rooster: een onzin-startdatum en -lengte vallen terug op vandaag en zeven dagen
  const r = bev.bevRooster(zaak, 'ooit', 'x');
  assert.equal(r.van, VANDAAG);
  assert.equal(r.dagen.length, 7);
  assert.equal(bev.bevRooster(zaak, VANDAAG, 99).dagen.length, 31);
});

test('10. een afwezige of uitgeputte bewaker: de mens mag, ziet het erbij; het rooster telt de plek als open', () => {
  const afwezig = new Set(['1|2099-06-10', '1|2099-06-11']);
  const { bev, zaak, db, sporen } = bouw({ afwezigOp: (c, gid, datum) => (afwezig.has(gid + '|' + datum) ? { wat: 'afwezig', inzetbaarheid: 'deels' } : null) });
  const p = bev.bevZetPost(zaak, { naam: 'Poort', shifts: ['dag', 'nacht'] }).post;
  const r = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: '2099-06-10', guardId: 1 });
  assert.equal(r.ok, true, 'een mens mag een afwezige bewaker zetten');
  assert.equal(r.verzuimWaarschuwing, 'Anna staat op 2099-06-10 als afwezig (inzetbaar: deels) in de verzuimlaag.');
  assert.equal(r.rustWaarschuwing, undefined);
  const autom = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'nacht', datum: '2099-06-11', guardId: 1 }, { door: 'autoplan' });
  assert.equal(autom.status, 409, 'de automaat plant nooit wie afwezig is');
  // rust: Bram draait de nacht, een mens zet hem de ochtend erna toch op dag
  bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'nacht', datum: '2099-06-12', guardId: 2 });
  const moe = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: '2099-06-13', guardId: 2 });
  assert.equal(moe.ok, true);
  assert.match(moe.rustWaarschuwing, /Bram heeft dan geen 11 uur rust: nachtdienst op 2099-06-12/);
  assert.equal(bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: '2099-06-13', guardId: 2 }, { door: 'autoplan' }).status, 409);

  // het rooster: de afwezige dienst vult de post niet, een geschrapte dienst staat er niet in
  const dag = bev.bevRooster(zaak, '2099-06-10', 1).dagen[0];
  const dagShift = dag.posten[0].shifts.find(s => s.shiftId === 'dag');
  assert.equal(dagShift.afwezig, 1);
  assert.equal(dagShift.open, 1, 'een afwezige bewaker vult de post niet');
  assert.equal(dagShift.bezet[0].afwezig, 'afwezig, deels inzetbaar: plan dit zelf in.');
  const geschrapt = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'nacht', datum: '2099-06-10', guardId: 3 });
  bev.bevSchrapDienst(zaak, geschrapt.dienst.id);
  assert.equal(bev.bevRooster(zaak, '2099-06-10', 1).dagen[0].posten[0].shifts.find(s => s.shiftId === 'nacht').bezet.length, 0);
  // een dienst van een ander team staat niet in mijn rooster
  db.data.bevDiensten.push({ id: 'vreemd', supplierCode: 'BAR', datum: '2099-06-10', shiftId: 'dag', postId: p.id, guardId: 9, status: 'gepland' });
  assert.equal(bev.bevRooster(zaak, '2099-06-10', 1).dagen[0].posten[0].shifts[0].bezet.length, 1);
  // een post met een lege shiftlijst toont alle drie
  bev.bevPosten(zaak)[0].shifts = [];
  assert.equal(bev.bevRooster(zaak, '2099-06-10', 1).dagen[0].posten[0].shifts.length, 3);

  // de dienst vervalt: het team krijgt bericht DAT en WELKE post, en maar een keer per verzuimregel
  bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'avond', datum: '2099-06-11', guardId: 1 });
  const melding = { id: 'vz-1', van: '2099-06-10', tot: '2099-06-11' };
  assert.equal(bev.bevDienstVervalt('BEV', 1, melding), 2);
  const bericht = sporen.naarZaak.at(-1);
  assert.equal(bericht.title, 'Dienst vervalt');
  assert.match(bericht.body, /Anna is afwezig\. Deze posten liggen weer open: Poort, Dag · 07:00-15:00 op 2099-06-10; Poort, Avond/);
  assert.equal(/deels|ziek/.test(bericht.body), false, 'nooit waarom');
  assert.equal(bev.bevDienstVervalt('BEV', 1, melding), 0, 'dezelfde regel geeft geen tweede bericht');
  assert.equal(bev.bevDienstVervalt('BAR', 1, melding), 0);
  assert.equal(bev.bevDienstVervalt('BEV', 1, { id: 'x' }), 0, 'een melding zonder begin is geen melding');
});

test('11. de bewaarveger: afgehandelde incidenten krijgen een klok, oude rondes verliezen hun GPS', () => {
  const { bev, zaak, db } = bouw();
  const p = bev.bevZetPost(zaak, { naam: 'Poort' }).post;
  const inc = bev.bevMeldIncident('BEV', 1, { tekst: 'Ruit', lat: 52, lng: 4 }).incident;
  assert.equal(bev.bevVergeetSosPosities(Date.now()), 0, 'open houdt zijn plek');
  // een incident dat al dicht was voor de klokregel: de klok start nu, de plek blijft nog
  const rauw = db.data.bevIncidenten.find(x => x.id === inc.id);
  rauw.status = 'afgehandeld';
  assert.equal(bev.bevVergeetSosPosities(Date.now()), 0);
  assert.ok(rauw.afgehandeldAt, 'de klok is gestart, niet met terugwerkende kracht');
  assert.equal(rauw.lat, 52);
  assert.ok(bev.bevVergeetSosPosities(Date.now() + 400 * 86400000) >= 1, 'na de termijn gaat de plek eraf');
  assert.equal(rauw.lat, null);
  const r = bev.bevRondeStart('BEV', 1, p.id).ronde;
  db.data.bevRondes[0].checkpoints.push({ naam: 'Oud', at: 't', lat: 1, lng: 2 }, { naam: 'Nieuw', at: 't' });
  assert.equal(bev.bevVergeetRondePosities(), 1);
  assert.deepEqual(db.data.bevRondes[0].checkpoints, [{ naam: 'Oud', at: 't' }, { naam: 'Nieuw', at: 't' }],
    'het controlepunt en zijn tijd blijven: dat IS de ronde');
  assert.equal(bev.bevVergeetRondePosities(), 0);
  delete db.data.bevRondes[0].checkpoints;
  assert.equal(bev.bevMijnDiensten('BEV', 1).ronde.checkpoints.length, 0, 'een ronde zonder lijst valt niet om');
  assert.equal(r.post, 'Poort');
});

test('12. oude en onvolledige gegevens: een dienst van voor een veld, een verdwenen post of shift, valt nergens om', () => {
  const { bev, zaak, db, sporen } = bouw({ afwezigOp: (c, gid) => (gid === 3 ? { wat: 'verlof' } : null) });
  const p = bev.bevZetPost(zaak, { naam: 'Poort', shifts: ['dag'] }).post;
  db.data.bevDiensten = [];
  db.data.bevDiensten.push(
    { id: 'legacy', supplierCode: 'BEV', datum: '2099-07-01', shiftId: 'middag', postId: 'weg', guardId: 2, status: 'gepland' },
    { id: 'vreemd', supplierCode: 'BAR', datum: '2099-07-01', shiftId: 'dag', postId: 'x', guardId: 1, status: 'gepland' },
    { id: 'ver', supplierCode: 'BEV', datum: '2099-06-20', shiftId: 'dag', postId: p.id, guardId: 1, status: 'gepland' });
  const legacy = bev.bevMijnDiensten('BEV', 2).diensten.find(d => d.id === 'legacy');
  assert.deepEqual([legacy.shift, legacy.uren, legacy.post, legacy.klant, legacy.guardNaam, legacy.door, legacy.inklokAt],
    ['middag', 0, 'Post', '', 'Bram', null, null], 'een dienst van voor de velden toont eerlijk wat er is');
  // de rustregel slaat een onbekende shift, een ander team en een verre dag over
  const r = bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'dag', datum: '2099-07-01', guardId: 1 }, { door: 'autoplan' });
  assert.equal(r.ok, true, 'de dienst van een ander team en die van drie weken eerder botsen niet');
  assert.equal(bev.bevZetDienst(zaak, { postId: p.id, shiftId: 'avond', datum: '2099-07-01', guardId: 2 }, { door: 'autoplan' }).ok, true,
    'een oude dienst met een onbekende shift telt niet als botsing');
  // een post met een onbekende shift in zijn lijst en zonder minMan
  bev.bevPosten(zaak)[0].shifts = ['dag', 'middag'];
  delete bev.bevPosten(zaak)[0].minMan;
  const dag = bev.bevRooster(zaak, '2099-07-01', 1).dagen[0];
  const middag = dag.posten[0].shifts.find(s => s.shiftId === 'middag');
  assert.equal(middag.shift, 'middag');
  assert.equal(middag.minMan, 1);
  assert.equal(middag.open, 1);
  // een aanvraag zonder shift is een dagdienst; zonder datum geweigerd
  assert.equal(bev.bevAanvraag(zaak, { object: 'Hal' }).status, 400);
  const a = bev.bevAanvraag(zaak, { object: 'Poort', datum: '2099-07-02', aantal: 1 }).aanvraag;
  assert.equal(a.shiftId, 'dag');
  bev.bevBeslisAanvraag(zaak, a.ref, 'plan', { autoPlan: false });
  assert.deepEqual(bev.bevPosten(zaak)[0].shifts, ['dag', 'middag'], 'een shift die er al was, komt er niet twee keer in');
  // de autoplanner telt de uren van een dienst met een onbekende shift als nul
  const plan = bev.bevPlanAuto(zaak, '2099-07-01');
  assert.ok(plan.gemaakt.every(d => d.guardId !== 3), 'wie met verlof is, wordt niet ingepland');
  assert.match(plan.uitleg, /1 bewaker\(s\) afwezig en niet ingepland/);
  // budget met tarief nul, en zetBudget op een lege budgetregel
  zaak.beveiliging.budget = {};
  const b = bev.bevZetBudget(zaak, {}).budget;
  assert.equal(b.tariefUur, 0); assert.equal(b.budgetUren, 0); assert.equal(b.bestedBedrag, 0);
  // vervallen: een melding die in de toekomst begint en geen einde heeft kijkt twee weken vooruit
  const vz = bouw({ afwezigOp: (c, gid, datum) => (gid === 1 && datum >= '2099-08-01' ? { wat: 'afwezig' } : null) });
  const vp = vz.bev.bevZetPost(vz.zaak, { naam: 'Kade' }).post;
  vz.bev.bevZetDienst(vz.zaak, { postId: vp.id, shiftId: 'dag', datum: '2099-08-10', guardId: 1 });
  vz.bev.bevZetDienst(vz.zaak, { postId: vp.id, shiftId: 'dag', datum: '2099-08-20', guardId: 1 });
  vz.db.data.bevDiensten.push({ id: 'z', supplierCode: 'BEV', datum: '2099-08-11', shiftId: 'weg', postId: 'weg', guardId: 1, status: 'gepland' });
  assert.equal(vz.bev.bevDienstVervalt('BEV', '1', { id: 'm1', van: '2099-08-01' }), 2, 'binnen twee weken, en de 20e valt erbuiten');
  assert.match(vz.sporen.naarZaak.at(-1).body, /Kade, Dag · 07:00-15:00 op 2099-08-10; Post, weg op 2099-08-11/);
  assert.equal(vz.bev.bevDienstVervalt('BEV', 1, { id: 'm2', van: '2099-08-20', tot: '2099-08-20' }), 1);
  assert.match(vz.sporen.naarZaak.at(-1).body, /Deze post ligt weer open/);
  assert.equal(sporen.naarZaak.length >= 1, true);
});
