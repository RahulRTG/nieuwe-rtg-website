/* ============================================================================
   DE BESLISVRAAG (server/kern/commercie/besluit.js), ELKE UITKOMST LANGS.

   test/besluit.test.js meet de grote beweringen (versmallen, ONBEKEND is geen
   WEIGEREN). Hier elke afslag van beslis() met concrete bedragen: geen
   handeling, een bron die gooit, geen bevoegdheid, BEPERKT tegen een hard
   bezwaar, uitstel per dag, de tweede handtekening (ook van de aanvrager
   zelf), de omkeerbaarheidsgrens met en zonder risicogoedkeuring, de verse
   bevestiging en het bewijstoken (gelukt, mislukt, leeg).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bev = require('../server/kern/commercie/bevoegdheid');
const { maakBesluit, UITKOMST, DOOR, BELEID, veiligeUitkomst } = require('../server/kern/commercie/besluit');

const NU = () => 4242;
const bevoegd = (grenzen, scope, capability) => bev.maakBevoegdheid({
  capability: capability || 'money.refund', scope: scope || '*', grenzen: grenzen || {}, door: 'directeur', nu: NU });

test('veiligeUitkomst: alleen ONBEKEND verandert, en voor geld valt het dicht', () => {
  assert.equal(veiligeUitkomst(UITKOMST.ONBEKEND, { raaktWaarde: true }), 'WEIGEREN');
  assert.equal(veiligeUitkomst(UITKOMST.ONBEKEND, { raaktWaarde: false }), 'TOESTAAN');
  assert.equal(veiligeUitkomst(UITKOMST.GOEDKEURING, { raaktWaarde: true }), 'GOEDKEURING');
  assert.equal(DOOR.has('BEPERKT'), true);
  assert.equal(DOOR.has('GOEDKEURING'), false);
});

test('zonder handeling ONBEKEND, met de basisvelden ingevuld', () => {
  const { beslis } = maakBesluit({ nu: NU });
  const r = beslis({ waardeCenten: '12.6', doel: 7 });
  assert.equal(r.uitkomst, 'ONBEKEND');
  assert.equal(r.actor, null);
  assert.equal(r.doel, '7');
  assert.equal(r.waardeCenten, 13);
  assert.equal(r.at, 4242);
  assert.equal(r.beleid, BELEID.versie);
});

test('zonder zoekfunctie of zonder treffer: WEIGEREN; een gooiende bron: ONBEKEND met de fout', () => {
  assert.equal(maakBesluit({ nu: NU }).beslis({ handeling: 'x' }).uitkomst, 'WEIGEREN');
  const leeg = maakBesluit({ nu: NU, zoekBevoegdheid: () => null }).beslis({ actor: 'a', handeling: 'x' });
  assert.match(leeg.reden, /hoort niet bij/);
  const fout = maakBesluit({ nu: NU, zoekBevoegdheid: () => { throw new Error('register weg'); } }).beslis({ handeling: 'x' });
  assert.equal(fout.uitkomst, 'ONBEKEND');
  assert.match(fout.reden, /register weg/);
  const kaal = maakBesluit({ nu: NU, zoekBevoegdheid: () => { throw 'tekst'; } }).beslis({ handeling: 'x' }); // eslint-disable-line no-throw-literal
  assert.match(kaal.reden, /tekst$/);
});

test('boven de grens BEPERKT tot de grens; een hard bezwaar blijft WEIGEREN', () => {
  const b = bevoegd({ maxCenten: 20000 });
  const { beslis } = maakBesluit({ nu: NU, zoekBevoegdheid: () => b });
  const r = beslis({ actor: 'm', handeling: 'refund', waardeCenten: 30000 });
  assert.equal(r.uitkomst, 'BEPERKT');
  assert.equal(r.totCenten, 20000);
  assert.deepEqual(r.bewijs.keten.map(k => k.door), ['directeur']);
  const hard = bevoegd({ maxCenten: 20000, apparaatVertrouwd: true });
  const h = maakBesluit({ nu: NU, zoekBevoegdheid: () => hard }).beslis({ handeling: 'refund', waardeCenten: 10000 });
  assert.equal(h.uitkomst, 'WEIGEREN');
  assert.match(h.reden, /vertrouwd apparaat/);
  const nul = bevoegd({ maxCenten: 0 });
  assert.equal(maakBesluit({ nu: NU, zoekBevoegdheid: () => nul }).beslis({ handeling: 'r', waardeCenten: 5 }).uitkomst, 'WEIGEREN',
    'een grens van nul kan niet tot iets beperken');
  const scoped = bevoegd({}, 'zaak:A');
  const s = maakBesluit({ nu: NU, zoekBevoegdheid: () => scoped }).beslis({ handeling: 'r', doel: 'zaak:B', waardeCenten: 5 });
  assert.equal(s.uitkomst, 'WEIGEREN');
  assert.match(s.reden, /niet voor zaak:B/);
});

test('een volle dag is UITSTELLEN; een dagbron die gooit of niets weet telt niet', () => {
  const b = bevoegd({ maxPerDagCenten: 10000 });
  const met = dag => maakBesluit({ nu: NU, zoekBevoegdheid: () => b, dagverbruik: dag });
  const vol = met(() => ({ vandaagCenten: 9000, vandaagAantal: 3 })).beslis({ handeling: 'r', waardeCenten: 2000 });
  assert.equal(vol.uitkomst, 'UITSTELLEN');
  assert.match(vol.reden, /dagtotaal/);
  assert.equal(met(() => ({ vandaagCenten: 1000 })).beslis({ handeling: 'r', waardeCenten: 2000 }).uitkomst, 'TOESTAAN');
  assert.equal(met(() => { throw new Error('x'); }).beslis({ handeling: 'r', waardeCenten: 2000 }).uitkomst, 'TOESTAAN');
  assert.equal(met(() => null).beslis({ handeling: 'r', waardeCenten: 2000 }).uitkomst, 'TOESTAAN');
});

test('vanaf duizend euro een tweede persoon, en de aanvrager zelf telt niet', () => {
  const b = bevoegd({});
  const { beslis } = maakBesluit({ nu: NU, zoekBevoegdheid: () => b });
  const zonder = beslis({ actor: 'm', handeling: 'r', waardeCenten: 100000 });
  assert.equal(zonder.uitkomst, 'GOEDKEURING');
  assert.match(zonder.reden, /tweede persoon/);
  const zelf = beslis({ actor: 'm', handeling: 'r', waardeCenten: 100000, context: { goedgekeurdDoor: 'm' } });
  assert.equal(zelf.uitkomst, 'GOEDKEURING');
  assert.match(zelf.reden, /eigen handeling/);
  const ander = beslis({ actor: 'm', handeling: 'r', waardeCenten: 100000, context: { goedgekeurdDoor: 'd', bevestigingVers: true } });
  assert.equal(ander.uitkomst, 'TOESTAAN');
  const geenActor = beslis({ handeling: 'r', waardeCenten: 100000, context: { goedgekeurdDoor: 'd', bevestigingVers: true } });
  assert.equal(geenActor.uitkomst, 'TOESTAAN');
});

test('vanaf vijfhonderd euro een verse bevestiging', () => {
  const { beslis } = maakBesluit({ nu: NU, zoekBevoegdheid: () => bevoegd({}) });
  const r = beslis({ handeling: 'r', waardeCenten: 50000 });
  assert.equal(r.uitkomst, 'EXTRA_BEWIJS');
  assert.match(r.reden, /verse bevestiging/);
  assert.equal(beslis({ handeling: 'r', waardeCenten: 49999 }).uitkomst, 'TOESTAAN');
  assert.equal(beslis({ handeling: 'r', waardeCenten: 50000, context: { bevestigingVers: true } }).uitkomst, 'TOESTAAN');
});

test('boven de omkeerbaarheidsgrens: dicht, tenzij omkeerbaar of een incassoronde met risicogoedkeuring', () => {
  const { beslis } = maakBesluit({ nu: NU, zoekBevoegdheid: () => bevoegd({}) });
  const ctx = (x) => Object.assign({ goedgekeurdDoor: 'tweede', bevestigingVers: true }, x);
  const dicht = beslis({ actor: 'm', handeling: 'refund', waardeCenten: 300000, context: ctx() });
  assert.equal(dicht.uitkomst, 'OMKEERBAAR');
  assert.equal(dicht.omkeerbaar, false);
  assert.match(dicht.reden, /staat voor deze handeling dicht/);
  assert.equal(beslis({ actor: 'm', handeling: 'refund', waardeCenten: 300000, context: ctx({ omkeerbaar: true }) }).uitkomst, 'TOESTAAN');
  const zonderRisico = beslis({ actor: 'm', handeling: 'GELD_INNEN', waardeCenten: 300000, context: ctx() });
  assert.equal(zonderRisico.uitkomst, 'OMKEERBAAR');
  assert.match(zonderRisico.reden, /risicogoedkeuring op naam/);
  const ok = beslis({ actor: 'm', handeling: 'GELD_INNEN', waardeCenten: 300000,
    context: ctx({ risicogoedkeuring: { door: 'risk-1', naam: 'Risico', reden: 'ronde van oktober, getoetst' } }) });
  assert.equal(ok.uitkomst, 'TOESTAAN');
  assert.equal(ok.omkeerbaar, false);
  assert.equal(ok.uitzondering.door, 'risk-1');
  assert.match(ok.reden, /Risico/);
});

test('het bewijstoken: meegegeven, een zichtbare fout, of niets', () => {
  const b = bevoegd({});
  const gezien = [];
  const munt = (bb, v) => { gezien.push(v); return v.waardeCenten === 100 ? { ok: true, token: 'tok-1' }
    : v.waardeCenten === 200 ? { ok: false, error: 'sleutel ontbreekt' } : null; };
  const { beslis } = maakBesluit({ nu: NU, zoekBevoegdheid: () => b, munt });
  const a = beslis({ actor: 'm', handeling: 'r', doel: 'x', waardeCenten: 100 });
  assert.equal(a.bewijstoken, 'tok-1');
  assert.equal(a.tokenFout, undefined);
  const f = beslis({ handeling: 'r', waardeCenten: 200 });
  assert.equal(f.tokenFout, 'sleutel ontbreekt');
  assert.equal(f.bewijstoken, undefined);
  const n = beslis({ handeling: 'r', waardeCenten: 0 });
  assert.equal(n.bewijstoken, undefined);
  assert.equal(n.tokenFout, undefined);
  assert.deepEqual(gezien.map(v => v.eenmalig), [true, true, false], 'eenmalig zodra er waarde verplaatst');
  assert.equal(gezien[0].doel, 'x');
});

test('een eigen beleid overschrijft de drempels', () => {
  const m = maakBesluit({ nu: NU, zoekBevoegdheid: () => bevoegd({}), beleid: { versie: 'proef', extraBewijsBovenCenten: 100 } });
  assert.equal(m.beleid.versie, 'proef');
  assert.equal(m.beleid.goedkeuringBovenCenten, 100000);
  assert.equal(m.beslis({ handeling: 'r', waardeCenten: 100 }).uitkomst, 'EXTRA_BEWIJS');
  assert.equal(typeof maakBesluit({}).beslis({ handeling: 'r' }).at, 'number', 'zonder nu de huisklok');
});
