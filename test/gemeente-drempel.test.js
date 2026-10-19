/* HET GEMEENTEPORTAAL NOEMT GEEN KLEIN GETAL, OOK NIET PER SOORT OF PER PROJECT.

   Gevonden bij de domeinkaart van FoundationOS (RTF Portaal, 19 oktober 2026):
   de buurten gingen door de queryveilige drempel (./buurtdrempel.js, K = 5),
   maar de hulpvragen PER SOORT en de tellingen PER PROJECT (unieke deelnemers,
   bereikt, doorgestroomd, uitgevallen) gingen er zonder drempel langs. "1
   hulpvraag huiselijk geweld" in een kleine stad, of een project met twee
   deelnemers waarvan een uitviel, is een aanwijzing en geen statistiek
   (LEVEN.md par. 2.6, VERDER.md par. 6 besluit B1).

   Draai los: node --test test/gemeente-drempel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakGemeente = require('../server/kern/rtfos/gemeente');
const { K } = maakGemeente;

function wereld({ perSoort, projecten }) {
  const st = { gemeenten: [{ id: 'g1', stad: 's1', naam: 'Gemeente Klein', code: 'RTFG-TOETS01', opdrachten: [] }], projecten };
  const ctx = { S: () => st, stadVan: (id) => (id === 's1' ? { id: 's1', naam: 'Klein' } : null),
    nu: () => '2026-10-19', rid: () => 'x', schoon: (v) => String(v || ''), euro: (c) => c / 100 };
  const cijfersVan = () => ({ mensen: { gemeten: true, uniekGeholpen: 40, herhaaldGeholpen: 5, vrijwilligers: 6, vrijwilligersuren: 90 },
    hulpvragen: { totaal: 40, open: 3, perSoort, perWijk: { Noord: 20, Zuid: 20 } },
    geld: { binnen: 0, besteed: 0, kostenPerPersoon: null }, doelen: { gemeten: false } });
  return maakGemeente(ctx, { cijfersVan }).portaal('RTFG-TOETS01');
}

test('een soort met minder dan K hulpvragen staat niet apart in het portaal', () => {
  const r = wereld({ perSoort: { voedsel: 30, schulden: 8, 'huiselijk geweld': 1, eenzaamheid: 1 }, projecten: [] });
  const ps = r.bereik.perSoort;
  assert.equal(ps.voedsel, 30);
  /* Queryveilig, net als de buurten: twee soorten van 1 zijn samen 2 en dus
     allebei af te leiden, daarom gaat de kleinste grote soort (8) mee in de
     samenvoeging, en het totaal van de samengevoegde rij is 10. */
  const overig = Object.entries(ps).find(([s]) => /overige soorten/.test(s));
  assert.ok(overig && overig[1] === 10, 'de samengevoegde soorten: ' + JSON.stringify(ps));
  for (const [soort, n] of Object.entries(ps)) {
    assert.ok(n === null || n >= K, 'soort "' + soort + '" staat er met ' + n + ' (onder de drempel ' + K + ')');
  }
  assert.equal(Object.prototype.hasOwnProperty.call(ps, 'huiselijk geweld'), false, 'een kleine soort staat er bij naam');
  assert.ok(Object.keys(ps).some((s) => /overige/.test(s)), 'de kleine soorten staan samengevoegd, met hun aantal soorten erbij');
});

test('een project noemt geen telling onder K, en zegt waarom', () => {
  const r = wereld({ perSoort: {}, projecten: [
    { stad: 's1', status: 'actief', naam: 'Klein project', soort: 'taal', deelnemersUniek: 2,
      indicatoren: [{ naam: 'taalniveau', doel: 10, bereikt: 2, doorgestroomd: 1, uitgevallen: 1 }] },
    { stad: 's1', status: 'actief', naam: 'Groot project', soort: 'taal', deelnemersUniek: 25,
      indicatoren: [{ naam: 'werk', doel: 20, bereikt: 18, doorgestroomd: 12, uitgevallen: 2 }] }] });
  const klein = r.projecten.find((p) => p.naam === 'Klein project');
  const groot = r.projecten.find((p) => p.naam === 'Groot project');
  assert.equal(klein.deelnemersUniek, null, 'twee deelnemers staan er als getal');
  assert.match(klein.onderDrempel || '', /minder dan 5/i, 'de reden ontbreekt');
  for (const v of ['bereikt', 'doorgestroomd', 'uitgevallen']) assert.equal(klein.indicatoren[0][v], null, 'klein project: ' + v + ' staat er als getal');
  assert.equal(groot.deelnemersUniek, 25);
  assert.equal(groot.indicatoren[0].bereikt, 18);
  assert.equal(groot.indicatoren[0].doorgestroomd, 12);
  assert.equal(groot.indicatoren[0].uitgevallen, null, 'twee uitvallers in een groot project staan er als getal');
  assert.equal(groot.indicatoren[0].doel, 20, 'een doel is een afspraak en geen telling van mensen');
});
