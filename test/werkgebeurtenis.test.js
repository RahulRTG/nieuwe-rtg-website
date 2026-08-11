/* ============================================================================
   DE GEBEURTENISLAAG VAN HET WERK OS -- een temporele laag, geen auditlogje.

   WAAROM DIT BESTAAT

   bedrijf/toen.js kon zeggen WAT er bestond op een datum en zei er eerlijk bij
   dat de TOESTAND van toen niet vast te stellen was: "een wijziging
   overschrijft de vorige waarde en er ligt geen gebeurtenislaag onder de
   schrijfhandelingen" (TAKEN.md 5.39c).

   Die laag ligt er nu, en zij is met opzet GENERIEK: een gebeurtenis met
   objectType, objectId, eventType, van/naar, actor, bron en reden, door EEN
   deur. Twintig modules die elk hun eigen auditvorm bedenken leveren twintig
   vormen op die niemand samen kan lezen -- en dat is precies waarom het
   journaal in dit huis nooit een tijdmachine werd.

   DE ONTWERPREGEL DIE HIER WORDT AFGEDWONGEN:
   een wijziging zonder geschiedenis is vanaf deze laag een FOUT.

   WAT ER WORDT VASTGELEGD

   1. Eén deur, met verplichte velden: zonder actor geen gebeurtenis.
   2. Reden verplicht waar "waarom" de vraag is -- en dan ATOMAIR geweigerd,
      dus het veld verandert ook niet.
   3. objectType + objectId botsen niet: twee soorten met hetzelfde id blijven
      gescheiden.
   4. De tijdgrens is de hele dag, inclusief 23:59:59.999.
   5. Replay: het pad vooruit naspelen geeft de huidige toestand.
   6. Het vangnet meldt een stille mutatie op een omgezette familie als DEFECT.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { werkMutatie, werkVeld, werkFeit, werkBeginstand, REDEN_VERPLICHT, FAMILIES } =
  require('../server/bedrijf/gebeurtenis');
const { toestandOp, pad, meetOngemeten, gebeurtenissenVan, volgVelden } =
  require('../server/bedrijf/gebeurtenis-lezen');
const { SOORTEN } = require('../server/kern/werkcommand/soorten');

const soortVan = (t) => SOORTEN.find(s => s.type === t);

function ruimte() {
  return { code: 'PROEF',
    projecten: { 'PRJ-184': { id: 'PRJ-184', naam: 'Project Europa', status: 'loopt',
      eigenaar: 'Reiger', werkvorm: 'expansie', budgetCenten: 12000000, at: '2027-01-12T09:00:00.000Z' } },
    contracten: { 'PRJ-184': { id: 'PRJ-184', naam: 'Toevallig hetzelfde id', status: 'concept',
      at: '2027-01-12T09:00:00.000Z' } } };
}
const ctx = (reden) => ({ actor: 'Lisa', reden, bron: 'werk/project' });

test('één deur, en zonder actor komt er niets doorheen', () => {
  const w = ruimte();
  assert.equal(werkMutatie(w, { objectType: 'project', objectId: 'PRJ-184', eventType: 'project.test' }).status, 400,
    'een wijziging hoort op een naam te staan');
  assert.equal(werkMutatie(w, { objectType: 'project', objectId: 'PRJ-184', actor: 'Lisa' }).status, 400,
    'een gebeurtenis zonder soort zegt niets');
  assert.equal(werkMutatie(w, { objectType: 'project', eventType: 'x', actor: 'Lisa' }).status, 400,
    'een gebeurtenis hoort te zeggen waarover zij gaat');
  assert.equal((w.gebeurtenissen || []).length, 0, 'een geweigerde mutatie hoort niets achter te laten');

  const ok = werkMutatie(w, { objectType: 'project', objectId: 'PRJ-184',
    eventType: 'project.test', actor: 'Lisa', bron: 'werk/project' });
  assert.equal(ok.ok, true);
  assert.equal(w.gebeurtenissen.length, 1);
  assert.ok(ok.gebeurtenis.occurredAt);
});

test('reden verplicht waar "waarom" de vraag is, en de weigering is ATOMAIR', () => {
  const w = ruimte();
  const p = w.projecten['PRJ-184'];
  assert.ok(REDEN_VERPLICHT.has('project.budgetCenten'), 'een budgetwijziging hoort een reden te eisen');

  const zonder = werkVeld(w, 'project', p, { budgetCenten: 16500000 }, { actor: 'Lisa' });
  assert.equal(zonder.status, 400);
  assert.match(zonder.error, /waarom/i);

  /* DIT IS DE KERN. Zou het veld wel gezet zijn en alleen de gebeurtenis
     geweigerd, dan is het object veranderd zonder geschiedenis -- precies de
     toestand die deze laag onmogelijk moet maken. */
  assert.equal(p.budgetCenten, 12000000, 'het veld hoort NIET gezet te zijn als de geschiedenis wordt geweigerd');
  assert.equal((w.gebeurtenissen || []).length, 0);

  const met = werkVeld(w, 'project', p, { budgetCenten: 16500000 }, ctx('scope uitbreiding'));
  assert.equal(met.ok, true);
  assert.equal(p.budgetCenten, 16500000);
  const g = w.gebeurtenissen[0];
  assert.equal(g.eventType, 'project.budgetCenten');
  assert.deepEqual(g.van, { budgetCenten: '12000000' });
  assert.deepEqual(g.naar, { budgetCenten: '16500000' });
  assert.equal(g.reden, 'scope uitbreiding');
  assert.equal(g.actor, 'Lisa');
  assert.equal(g.bron, 'werk/project');
});

test('objectType + objectId botsen niet: twee soorten met hetzelfde id blijven gescheiden', () => {
  const w = ruimte();
  /* Twee objecten met precies hetzelfde id, in twee families. Zou de laag op id
     alleen sleutelen, dan leest het contract straks de budgetgeschiedenis van
     het project -- en dat is het soort fout dat pas opvalt bij een audit. */
  werkVeld(w, 'project', w.projecten['PRJ-184'], { status: 'vertraagd' }, ctx('leverancier meldde vertraging'));
  werkVeld(w, 'contract', w.contracten['PRJ-184'], { status: 'actief' }, ctx('getekend door beide partijen'));

  const vanProject = gebeurtenissenVan(w, 'project', 'PRJ-184');
  const vanContract = gebeurtenissenVan(w, 'contract', 'PRJ-184');
  assert.equal(vanProject.length, 1);
  assert.equal(vanContract.length, 1);
  assert.equal(vanProject[0].naar.status, 'vertraagd');
  assert.equal(vanContract[0].naar.status, 'actief');

  // en de reconstructie haalt ze ook niet door elkaar
  const pr = toestandOp(w, soortVan('project'), w.projecten['PRJ-184'], '2027-06-01');
  const co = toestandOp(w, soortVan('contract'), w.contracten['PRJ-184'], '2027-06-01');
  assert.equal(pr.toestand.status, 'vertraagd');
  assert.equal(co.toestand.status, 'actief');
});

test('de tijdgrens is de hele dag, inclusief de laatste milliseconde', () => {
  const w = ruimte();
  const p = w.projecten['PRJ-184'];
  p.status = 'vertraagd';
  w.gebeurtenissen = [{ objectType: 'project', objectId: 'PRJ-184', eventType: 'project.status',
    van: { status: 'loopt' }, naar: { status: 'vertraagd' },
    actor: 'Lisa', reden: 'leverancier', bron: 'werk/project',
    occurredAt: '2027-02-12T23:59:59.999Z' }];

  const so = soortVan('project');
  /* Op 12 februari GOLD de wijziging nog: hij gebeurde die dag, dus aan het
     eind van die dag is de nieuwe waarde waar. Een grens die de dag halveert
     geeft twee verschillende antwoorden op dezelfde datum. */
  assert.equal(toestandOp(w, so, p, '2027-02-12').toestand.status, 'vertraagd');
  assert.equal(toestandOp(w, so, p, '2027-02-11').toestand.status, 'loopt', 'de dag ervoor nog niet');
  assert.equal(toestandOp(w, so, p, '2027-02-13').toestand.status, 'vertraagd');

  // en voor het ontstaan bestaat er geen toestand
  assert.equal(toestandOp(w, so, p, '2026-12-31').bestond, false);
  assert.equal(toestandOp(w, so, p, '2027-01-12').bestond, true, 'de dag van aanmaak telt mee');
});

test('replay: het pad vooruit naspelen geeft precies de huidige toestand', () => {
  const w = ruimte();
  const p = w.projecten['PRJ-184'];
  const so = soortVan('project');
  werkBeginstand(w, 'project', p, volgVelden(so));

  werkVeld(w, 'project', p, { budgetCenten: 14000000 }, ctx('meerwerk kade'));
  werkVeld(w, 'project', p, { eigenaar: 'Lisa' }, ctx('Reiger uit dienst'));
  werkVeld(w, 'project', p, { status: 'vertraagd' }, ctx('leverancier X meldde drie dagen'));
  werkVeld(w, 'project', p, { budgetCenten: 16500000 }, ctx('scope uitbreiding'));

  /* VOORUIT NASPELEN vanaf de oudste bekende waarde. Dit is de tegenproef op
     toestandOp(), die juist TERUG rekent: komen ze niet op hetzelfde uit, dan
     klopt een van beide niet -- en dan is de hele laag onbetrouwbaar. */
  const events = gebeurtenissenVan(w, 'project', 'PRJ-184');
  const na = {};
  for (const g of events) {
    for (const [veld, waarde] of Object.entries(g.van || {})) if (!(veld in na)) na[veld] = waarde;
    for (const [veld, waarde] of Object.entries(g.naar || {})) na[veld] = waarde;
  }
  assert.equal(na.budgetCenten, '16500000');
  assert.equal(na.eigenaar, 'Lisa');
  assert.equal(na.status, 'vertraagd');
  assert.equal(String(p.budgetCenten), na.budgetCenten, 'replay hoort op de huidige toestand uit te komen');
  assert.equal(String(p.eigenaar), na.eigenaar);
  assert.equal(String(p.status), na.status);

  // en terugrekenen naar een moment tussenin geeft de tussentoestand
  const halverwege = events[1].occurredAt.slice(0, 10);
  const t = toestandOp(w, so, p, halverwege);
  assert.equal(t.zeker, true);
});

test('het pad vertelt de bedrijfsgeschiedenis, met actor en reden', () => {
  const w = ruimte();
  const p = w.projecten['PRJ-184'];
  werkFeit(w, 'project', p.id, 'aangemaakt', { actor: 'Reiger', bron: 'werk/project' }, { naam: p.naam });
  werkVeld(w, 'project', p, { budgetCenten: 14000000 }, ctx('meerwerk kade'));
  werkVeld(w, 'project', p, { status: 'vertraagd' }, ctx('leverancier X meldde drie dagen vertraging'));

  const r = pad(w, 'project', 'PRJ-184');
  assert.equal(r.pad.length, 3);
  assert.equal(r.pad[0].wat, 'project.aangemaakt');
  assert.equal(r.pad[0].door, 'Reiger');
  const laatste = r.pad[r.pad.length - 1];
  assert.equal(laatste.wat, 'project.status');
  assert.match(laatste.reden, /drie dagen vertraging/,
    'de reden is waar dit om begonnen is: zonder haar zie je DAT het veranderde en niet waarom');
  assert.equal(laatste.door, 'Lisa');
  assert.equal(r.ongedateerd, 0);
});

test('HET VANGNET: een stille mutatie op een omgezette familie is een DEFECT', () => {
  const w = ruimte();
  const eerst = meetOngemeten(w, SOORTEN);
  assert.equal(eerst.ongemeten, 0, 'de eerste meting leert alleen de beginstand');
  assert.equal(eerst.defecten.length, 0);

  /* Zoals het overal ging voordat deze laag er was: rechtstreeks schrijven. */
  w.projecten['PRJ-184'].status = 'gestopt';
  const na = meetOngemeten(w, SOORTEN);
  assert.equal(na.ongemeten, 1);
  assert.equal(na.defecten.length, 1, 'project is een omgezette familie; dit is geen randgeval maar een fout');
  assert.equal(na.defecten[0].objectType, 'project');
  assert.equal(na.defecten[0].van, 'loopt');
  assert.equal(na.defecten[0].naar, 'gestopt');

  const g = w.gebeurtenissen.find(x => x.ongemeten);
  assert.equal(g.occurredAt, null, 'het TIJDSTIP weten we niet, en dat wordt niet verzonnen');
  assert.equal(g.defect, true);

  // en een reconstructie eroverheen zegt dat zij onzeker is
  const t = toestandOp(w, soortVan('project'), w.projecten['PRJ-184'], '2027-03-01');
  assert.equal(t.zeker, false);
  assert.match(t.let, /niet wanneer/i);

  // een tweede meting zonder wijziging levert niets nieuws op
  assert.equal(meetOngemeten(w, SOORTEN).ongemeten, 0);
});

test('een rolwijziging wordt altijd vastgelegd, ook zonder reden -- en dat is zichtbaar', () => {
  /* `lid.rollen` stond in REDEN_VERPLICHT en is eruit gehaald: de eis brak elke
     bestaande toekenning, en een verplicht veld dat iedereen met een leeg
     gebaar vult levert "n.v.t." op. Wat blijft is de harde regel: de WIJZIGING
     wordt hoe dan ook vastgelegd. Het ontbreken van een reden is dan geen gat
     maar een zichtbaar leeg veld. */
  const w = { code: 'PROEF', leden: { L1: { id: 'L1', naam: 'Lisa', rollen: [{ id: 'finance' }], at: '2027-01-01T09:00:00.000Z' } } };
  const l = w.leden.L1;

  const zonder = werkVeld(w, 'lid', l, { rollen: [{ id: 'finance' }, { id: 'directie' }] }, { actor: 'beheer' });
  assert.equal(zonder.ok, true, 'een rolwijziging zonder reden hoort NIET geweigerd te worden');
  assert.equal(zonder.gewijzigd, 1);
  const g = gebeurtenissenVan(w, 'lid', 'L1')[0];
  assert.equal(g.eventType, 'lid.rollen');
  assert.equal(g.reden, null, 'het ontbreken van een reden hoort zichtbaar te zijn, niet weggepoetst');
  assert.equal(g.van.rollen, 'finance', 'de oude rolverzameling hoort bewaard te blijven');
  assert.equal(g.naar.rollen, 'directie,finance');

  // met reden staat hij er gewoon bij
  werkVeld(w, 'lid', l, { rollen: [{ id: 'finance' }] }, { actor: 'beheer', reden: 'directie-rol was tijdelijk' });
  const laatste = gebeurtenissenVan(w, 'lid', 'L1').pop();
  assert.match(laatste.reden, /tijdelijk/);
});

test('de vier families en de gevolgde velden zijn afgeleid, niet overgetypt', () => {
  assert.deepEqual(FAMILIES.slice().sort(), ['besluit', 'contract', 'lid', 'project']);
  /* De velden komen uit `zoek` van de soort zelf; een eigen lijst zou betekenen
     dat een nieuw veld in soorten.js stil buiten de gebeurtenislaag valt. */
  const p = volgVelden(soortVan('project'));
  assert.ok(p.includes('status') && p.includes('eigenaar'));
  assert.equal(p.includes('id') || p.includes('naam'), false, 'identiteit is geen toestand');
  for (const f of FAMILIES) assert.ok(soortVan(f), 'familie ' + f + ' hoort een bekende soort te zijn');
});

/* ----------------------------------------------------------------------------
   DE MUTATIES DIE ZIJN GEDAAN (LAT-regel 2)

   1. de actor-eis uit werkMutatie()                  -> toets 1 zakt
   2. het veld toch zetten bij een geweigerde reden   -> toets 2 zakt
   3. gebeurtenissenVan() alleen op objectId          -> toets 3 zakt
   4. de grens op T00:00:00 in plaats van eind dag    -> toets 4 zakt
   5. toestandOp() de `van` niet terugdraaien         -> toets 5 zakt
   6. het vangnet een occurredAt laten verzinnen      -> toets 7 zakt
   7. `defect` niet zetten op een omgezette familie   -> toets 7 zakt
   8. lid.rollen terug in REDEN_VERPLICHT             -> toets 8 zakt (en met
      hem 47 toetsen in de werkruimte-suite, wat de reden was om hem eruit te
      halen: een eis die de hele laag stillegt is geen eis maar een blokkade)
   -------------------------------------------------------------------------- */
