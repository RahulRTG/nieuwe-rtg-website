/* ============================================================================
   DE SOCIALE AFDRACHT: 30%, met een spoor per euro.

   Drie gaten uit de doorlichting van 20 augustus 2026 (PRIJZEN.md 4.8 en 4.9):

   1. De 20/10-splitsing stond nergens onderbouwd behalve in GAMEHALL.md par.
      12.5 -- over de SPELWERELD. De publieke voorwaarden noemden alleen de 30%.
   2. Wie "lokaal" is en waar dat geld landt, stond nergens.
   3. Er was geen spoor per bedrag, alleen een som. Achteraf aantonen waar een
      euro heen ging kon niet -- terwijl MARKT.md waarschuwt dat de 30% een
      handelspraktijk wordt zodra hij in marketing staat.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 4  een verandering van de regel herschrijft het verleden NIET
     toets 7  een teruggedraaide bijdrage laat geen afdracht achter

   Die tweede is de gevaarlijkste: zonder hem draagt RTG 30% af over geld dat
   het heeft teruggegeven.

   Draai los: node --experimental-sqlite --test test/allocatie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakAllocatie, verdeel, regelKlopt, REGELS, HUIDIGE_VERSIE, STATUS, magOvergaan } =
  require('../server/kern/commercie/allocatie');

function verse() {
  const db = { data: {} };
  return maakAllocatie({ db, save: () => {}, nu: () => 1000 });
}

test('1. de verdeling is 30%, gesplitst in 20 lokaal en 10 foundation', () => {
  const v = verdeel(6500);                       // een RTG Pass van 65 euro ex btw
  assert.equal(v.totaalCenten, 1950, '30% van 65 euro');
  assert.equal(v.delen.find(d => d.id === 'lokaal').centen, 1300, '20% blijft lokaal');
  assert.equal(v.delen.find(d => d.id === 'foundation').centen, 650, '10% naar de stichting');
  assert.equal(v.afrondingCenten, 0);
  assert.equal(v.regelVersie, HUIDIGE_VERSIE, 'elk bedrag draagt de regel waarmee het is gerekend');
});

test('2. de delen tellen op tot het totaal, en een afrondingsverschil is zichtbaar', () => {
  for (let c = 1; c <= 3000; c++) {
    const v = verdeel(c);
    const som = v.delen.reduce((s, d) => s + d.centen, 0);
    assert.equal(som + v.afrondingCenten, v.totaalCenten,
      'bij ' + c + ' centen loopt de verdeling niet rond');
    assert.ok(Math.abs(v.afrondingCenten) <= 1,
      'een afrondingsverschil van meer dan een cent is een rekenfout, geen afronding');
  }
});

test('3. de regel legt uit WAAROM elk deel bestaat', () => {
  const r = REGELS[HUIDIGE_VERSIE];
  assert.equal(r.totaalDeel, 0.30);
  assert.equal(r.exBtw, true, 'btw is geld van de Belastingdienst, geen omzet van RTG');
  for (const d of r.delen) {
    assert.ok(d.waarom && d.waarom.length > 20,
      d.id + ' hoort uit te leggen waar dat geld heen gaat; dat stond nergens behalve in GAMEHALL.md');
    assert.ok(d.label);
  }
  /* NIET rechtstreeks vergelijken: 0.20 + 0.10 is in JavaScript
     0.30000000000000004, dus `som === 0.30` faalt op een regel die gewoon
     klopt. Wie dat "oplost" door de controle weg te halen, verliest de enige
     bewaking op een verdeling die niet optelt. Vandaar regelKlopt(). */
  assert.equal(regelKlopt(r), null, 'de regel hoort met zichzelf te kloppen: ' + regelKlopt(r));
  for (const versie of Object.keys(REGELS))
    assert.equal(regelKlopt(REGELS[versie]), null, versie + ' klopt niet: ' + regelKlopt(REGELS[versie]));
});

test('3b. de regelcontrole wijst een verdeling af die niet optelt', () => {
  assert.ok(regelKlopt({ totaalDeel: 0.30, delen: [{ id: 'a', deel: 0.20, waarom: 'x' }] }),
    'delen die samen minder zijn dan het totaal: dan verdwijnt er geld');
  assert.match(regelKlopt({ totaalDeel: 0.30, delen: [{ id: 'a', deel: 0.20, waarom: 'x' }] }), /20% en het totaal is 30%/);
  assert.ok(regelKlopt({ totaalDeel: 0.30, delen: [{ id: 'a', deel: 0.20, waarom: 'x' }, { id: 'b', deel: 0.20, waarom: 'y' }] }),
    'en delen die samen meer zijn: dan wordt er meer verdeeld dan afgedragen');
  assert.ok(regelKlopt({ totaalDeel: 0.30, delen: [{ id: 'a', deel: 0.30 }] }),
    'een deel zonder uitleg hoort ook te zakken -- dat was gat 4.8');
  assert.ok(regelKlopt({ totaalDeel: 0.30, delen: [] }));
  assert.ok(regelKlopt(null));
});

/* DE BEWERING. Zonder regelversie zou een wijziging met terugwerkende kracht de
   geschiedenis herschrijven, en dan heeft "waar ging deze euro heen" twee
   antwoorden. */
test('4. een oud bedrag blijft leesbaar onder de regel die toen gold', () => {
  const a = verse();
  const oud = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', codenaam: 'Anemoon', bedragCenten: 6500 });
  assert.equal(oud.regelVersie, HUIDIGE_VERSIE);
  assert.equal(oud.centen, 1950);

  /* Een nieuwe verdeling komt erbij als NIEUWE versie; een bestaande wordt nooit
     gewijzigd. Dat is de reden dat REGELS een tabel is en geen constante. */
  REGELS['v2-toekomst'] = { versie: 'v2-toekomst', vanaf: '2027-01-01', totaalDeel: 0.40, exBtw: true,
    delen: [{ id: 'lokaal', deel: 0.25, label: 'Lokale impact', waarom: 'ruimer dan voorheen, zie het besluit' },
      { id: 'foundation', deel: 0.15, label: 'RTFoundation', waarom: 'ruimer dan voorheen, zie het besluit' }] };
  const nieuw = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't2', bedragCenten: 6500, versie: 'v2-toekomst' });

  assert.equal(nieuw.centen, 2600, 'het nieuwe bedrag volgt de nieuwe regel');
  assert.equal(oud.centen, 1950, 'en het oude bedrag is NIET meeveranderd');
  assert.equal(oud.regelVersie, HUIDIGE_VERSIE, 'met de regel er nog steeds bij');
  delete REGELS['v2-toekomst'];
});

test('5. de vier tijdstempels zijn niet hetzelfde moment', () => {
  const a = verse();
  const r = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', bedragCenten: 6500 });
  assert.equal(r.status, STATUS.GERESERVEERD);
  assert.ok(r.gereserveerdOp, 'gereserveerd: het bedrag staat apart');
  assert.equal(r.betaalbaarOp, null, 'maar het mag nog niet weg');
  assert.equal(r.afgewikkeldOp, null, 'en het is zeker niet overgemaakt');

  /* Zonder bestemming geen betaalbaar. Dit is precies de stand waarin de
     RTFoundation-afdracht staat zolang RTF_IBAN leeg is -- en die stand hoort
     een naam te hebben in plaats van een boolean die "nog niet" en "niet nodig"
     door elkaar haalt. */
  assert.ok(a.maakBetaalbaar(r, {}).error, 'zonder bestemming kan het niet betaalbaar worden');
  assert.equal(r.status, STATUS.GERESERVEERD);

  a.maakBetaalbaar(r, { lokaal: 'gemeente-ibiza', foundation: 'NL00RTFO0000000000' });
  assert.equal(r.status, STATUS.BETAALBAAR);
  assert.ok(r.betaalbaarOp);
  assert.equal(r.afgewikkeldOp, null);

  a.wikkelAf(r, 'payout-1');
  assert.equal(r.status, STATUS.AFGEWIKKELD);
  assert.ok(r.afgewikkeldOp);
  assert.equal(r.uitbetaalRef, 'payout-1');
});

test('6. de statusmachine weigert een sprong die niet mag', () => {
  assert.equal(magOvergaan(STATUS.GERESERVEERD, STATUS.AFGEWIKKELD), false,
    'overmaken zonder bestemming kan niet');
  assert.equal(magOvergaan(STATUS.AFGEWIKKELD, STATUS.VERVALLEN), false,
    'wat weg is, vervalt niet -- terughalen is een nieuwe handeling');
  assert.equal(magOvergaan(STATUS.VERVALLEN, STATUS.BETAALBAAR), false);

  const a = verse();
  const r = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', bedragCenten: 6500 });
  const fout = a.wikkelAf(r, 'x');
  assert.ok(fout.error, 'en de weigering komt als fout terug, niet stil');
  assert.equal(r.status, STATUS.GERESERVEERD);
});

/* DE GEVAARLIJKSTE. Zonder dit draagt RTG 30% af over geld dat het heeft
   teruggegeven. */
test('7. een teruggedraaide bijdrage laat geen afdracht achter', () => {
  const a = verse();
  const r = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', bedragCenten: 6500 });
  assert.equal(a.stand().openCenten, 1950);

  a.verval(r, 'lidmaatschap terugbetaald');
  assert.equal(r.status, STATUS.VERVALLEN);
  assert.equal(a.stand().openCenten, 0, 'er staat niets meer open');
  assert.equal(a.stand().totaalCenten, 0, 'en het telt niet meer mee in het totaal');
  assert.equal(a.stand().vervallenCenten, 1950, 'maar het is wel zichtbaar gebleven');
  assert.match(r.vervalReden, /terugbetaald/, 'met de reden erbij');

  /* Ook per DEEL moet het weg zijn. Een mutatie die het vervallen-filter uit de
     deeltelling haalde, liet alle andere beweringen groen: openCenten en
     totaalCenten worden apart gefilterd, dus die merkten er niets van. Het bord
     zou dan 13 euro "lokaal gereserveerd" tonen voor geld dat is teruggegeven. */
  const s = a.stand();
  assert.equal(s.perDeel.lokaal, undefined,
    'een vervallen afdracht hoort in geen enkel deel meer te staan');
  assert.equal(s.perDeel.foundation, undefined);
});

test('8. een bijdrage van nul levert geen afdracht op', () => {
  const a = verse();
  assert.equal(a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't', bedragCenten: 0 }), null,
    'niets af te dragen is geen afdracht met bedrag nul, maar geen afdracht');
  assert.equal(a.stand().aantal, 0);
});

/* "30% is afgedragen" zegt niets als het lokale deel al twee jaar wacht. */
test('9. de stand telt per deel, en niet alleen het totaal', () => {
  const a = verse();
  const een = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', bedragCenten: 6500 });
  a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't2', bedragCenten: 6500 });
  a.maakBetaalbaar(een, { foundation: 'NL00RTFO0000000000' });
  a.wikkelAf(een, 'p1');

  const s = a.stand();
  assert.equal(s.perDeel.lokaal.afgewikkeld, 1300);
  assert.equal(s.perDeel.lokaal.gereserveerd, 1300, 'de tweede staat nog te wachten');
  assert.equal(s.perDeel.foundation.afgewikkeld, 650);
  assert.equal(s.perDeel.foundation.gereserveerd, 650);
  assert.equal(s.afgewikkeldCenten, 1950);
  assert.equal(s.openCenten, 1950);
});

test('10. de bron staat op codenaam, nooit op naam', () => {
  const a = verse();
  const r = a.reserveer({ bronSoort: 'lidmaatschap', bronId: 't1', codenaam: 'Anemoon', bedragCenten: 6500 });
  assert.equal(r.codenaam, 'Anemoon');
  assert.equal(r.naam, undefined, 'er is geen veld waar een echte naam in past (privacy by design)');
  assert.equal(r.bronSoort, 'lidmaatschap');
  assert.equal(r.bronId, 't1', 'terug te leiden naar de termijn die hem veroorzaakte');
});
