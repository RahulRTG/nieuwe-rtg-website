/* ============================================================================
   HET VOORNEMEN -- van "boek vijf hotels in Parijs onder 180 euro" naar een
   gecontroleerd plan, met de blokkade VOOR de uitvoering.

   DE FOUT DIE DIT VOORKOMT. Een agent die vijf boekingen doet, vraagt vandaag
   vijf keer los "mag dit". Bij de vierde is het budget op. Er staan dan drie
   boekingen, een boze klant en een half-uitgevoerde handeling die niemand heeft
   besloten. Het beleid heeft gewerkt en het resultaat is een puinhoop.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 1   de keuring gaat over het TOTAAL, en de blokkade staat VOOR de
               eerste stap -- niet halverwege
     toets 4   een goedgekeurd plan kan niet meer veranderen
     toets 5   elke stap levert het bewijs in
     toets 6   een stap gebeurt hoogstens een keer, met een eigen sleutel
     toets 8   een nee wordt geen ja door het nog eens te vragen

   Draai los: node --experimental-sqlite --test test/voornemen.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const bev = require('../server/kern/commercie/bevoegdheid');
const { maakBesluit } = require('../server/kern/commercie/besluit');
const { maakBewijstoken, geheugenGezien } = require('../server/kern/commercie/bewijstoken');
const { maakVoornemens, STAND } = require('../server/kern/commercie/voornemen');
const plan = require('../server/kern/commercie/voornemen/plan');

const nu = () => 1_700_000_000_000;

function opstelling({ maxCenten = 500000, beleid, zonderToken } = {}) {
  const db = { data: {} };
  const token = maakBewijstoken({ sleutel: 'een-geheim-voor-de-toets', nu, gezien: geheugenGezien(nu) });
  const bevoegd = bev.maakBevoegdheid({ capability: 'reis.boek', grenzen: { maxCenten }, door: 'agent', nu });
  const motor = maakBesluit({ zoekBevoegdheid: () => bevoegd, nu, beleid,
    munt: zonderToken ? null : token.munt });
  const V = maakVoornemens({ db, save: () => {}, nu, beslis: motor.beslis,
    verbruikToken: zonderToken ? null : token.verbruik });
  return { V, db, token };
}

const hotels = (n, centen) => Array.from({ length: n }, (_, i) =>
  ({ wat: 'hotel ' + (i + 1) + ' Parijs', doel: 'hotel:P' + (i + 1), centen }));

function uitvoerder() {
  const gedaan = [];
  return { gedaan, doe: async (s) => { gedaan.push(s); return { boeking: 'B' + s.stap, idem: s.idemSleutel }; } };
}

/* DE BEWERING. De zin die een mens hoort te lezen komt VOORDAT er iets gebeurt. */
test('1. de keuring gaat over het totaal, en de blokkade staat voor de eerste stap', async () => {
  const { V } = opstelling();
  const v = V.stelOp({ actor: 'ai-agent', handeling: 'reis.boek', doel: 'reis:PARIJS',
    stappen: hotels(5, 18440) });                       // 5 x 184,40 = 922,00

  assert.equal(v.voornemen.totaalCenten, 92200,
    'vijf keer 184,40 is geen vijf kleine besluiten maar een van 922');
  const k = V.keur(v.voornemen.id, {});
  assert.equal(k.voornemen.stand, STAND.WACHT);
  assert.match(k.voornemen.reden, /€ 500/, 'met de grens erbij, niet alleen "mag niet"');

  // en er is nog NIETS uitgevoerd
  const u = uitvoerder();
  const poging = await V.voerUit(v.voornemen.id, { doe: u.doe });
  assert.equal(poging.status, 409);
  assert.equal(u.gedaan.length, 0,
    'geen drie boekingen en dan pas een weigering -- dat is de hele reden dat deze laag bestaat');
});

test('2. een plan dat er ruim binnen past, gaat gewoon door', async () => {
  const { V } = opstelling();
  const v = V.stelOp({ actor: 'ai-agent', handeling: 'reis.boek', stappen: hotels(2, 4000) });
  assert.equal(V.keur(v.voornemen.id, {}).voornemen.stand, STAND.GEKEURD);

  const u = uitvoerder();
  const r = await V.voerUit(v.voornemen.id, { doe: u.doe });
  assert.equal(r.voornemen.stand, STAND.UITGEVOERD);
  assert.equal(r.voornemen.gedaan, 2);
  assert.equal(u.gedaan.length, 2);
});

test('3. de tweede handtekening komt van iemand anders, en het beleid houdt het laatste woord', () => {
  const { V } = opstelling();
  const v = V.stelOp({ actor: 'ai-agent', handeling: 'reis.boek', stappen: hotels(5, 18440) });
  V.keur(v.voornemen.id, {});

  assert.match(V.tekenAf(v.voornemen.id, { door: '' }).error, /Wie tekent er af/);
  assert.match(V.tekenAf(v.voornemen.id, { door: 'ai-agent' }).error, /dezelfde persoon/,
    'een tweede handtekening van dezelfde persoon is er geen');

  const af = V.tekenAf(v.voornemen.id, { door: 'manager' });
  assert.equal(af.voornemen.stand, STAND.GEKEURD);
  assert.equal(af.voornemen.goedgekeurdDoor, 'manager');
  /* Aftekenen zet de stand niet zelf: het gaat terug langs de keuring, nu met de
     goedkeuring in de context. Anders houdt deze functie het laatste woord en
     niet het beleid. */
  assert.ok(af.voornemen.besluit.at);
});

/* DE TWEEDE BEWERING. Zonder dit is "goedgekeurd" een stempel op iets dat daarna
   nog kan groeien: keur 900 goed, voer 9000 uit. */
test('4. een goedgekeurd plan kan niet meer veranderen', async () => {
  const { V, db } = opstelling();
  const v = V.stelOp({ actor: 'ai-agent', handeling: 'reis.boek', stappen: hotels(2, 4000) });
  V.keur(v.voornemen.id, {});

  // iemand verhoogt een bedrag na de keuring
  db.data.voornemens[0].stappen[1].centen = 900000;

  const u = uitvoerder();
  const r = await V.voerUit(v.voornemen.id, { doe: u.doe });
  assert.equal(r.status, 409);
  assert.match(r.error, /veranderd na de keuring/);
  assert.equal(r.voornemen.stand, STAND.GESTAAKT, 'vervallen, niet "bijna geldig"');
  assert.equal(u.gedaan.length, 0);

  // ook de VOLGORDE telt mee: drie hotels omwisselen is een ander plan
  const { V: V2, db: db2 } = opstelling();
  const w = V2.stelOp({ actor: 'a', handeling: 'reis.boek',
    stappen: [{ wat: 'a', doel: 'x', centen: 100 }, { wat: 'b', doel: 'y', centen: 200 }] });
  V2.keur(w.voornemen.id, {});
  const st = db2.data.voornemens[0].stappen;
  [st[0].wat, st[1].wat] = [st[1].wat, st[0].wat];
  assert.equal((await V2.voerUit(w.voornemen.id, { doe: uitvoerder().doe })).status, 409);
});

/* DE DERDE BEWERING. Een stap die draait op "de keuring stond hierboven toch" is
   een stap zonder keten. */
test('5. elke uitvoering levert het bewijs in, en een ongeldig bewijs staakt het geheel', async () => {
  const { V, token } = opstelling();
  const v = V.stelOp({ actor: 'ai-agent', handeling: 'reis.boek', doel: 'reis:P', stappen: hotels(2, 4000) });
  const k = V.keur(v.voornemen.id, {});
  assert.equal(k.voornemen.heeftBewijs, true, 'het besluit geeft een bewijstoken mee');
  assert.equal(k.voornemen.bewijstoken, undefined,
    'maar het token zelf komt er niet uit: wie kan lezen, hoeft de sleutel niet in handen te krijgen');

  const u = uitvoerder();
  assert.equal((await V.voerUit(v.voornemen.id, { doe: u.doe })).voornemen.stand, STAND.UITGEVOERD);

  // een voornemen waarvan het bewijs al elders is opgemaakt, gaat niet door
  const { V: V2, token: t2 } = opstelling();
  const w = V2.stelOp({ actor: 'ai-agent', handeling: 'reis.boek', doel: 'reis:P', stappen: hotels(2, 4000) });
  V2.keur(w.voornemen.id, {});
  const binnenin = V2.vind(w.voornemen.id).bewijstoken;
  t2.verbruik(binnenin, { capability: 'reis.boek', doel: 'reis:P', waardeCenten: 8000 });  // iemand anders eerst

  const u2 = uitvoerder();
  const r = await V2.voerUit(w.voornemen.id, { doe: u2.doe });
  assert.equal(r.status, 409);
  assert.match(r.error, /bewijs bij dit voornemen geldt niet meer/);
  assert.equal(u2.gedaan.length, 0);
});

/* DE VIERDE BEWERING. Dit is wat een herhaling onschadelijk maakt tot in de
   betaalrij. */
test('6. elke stap draagt een eigen economische sleutel, en gebeurt hoogstens een keer', async () => {
  const { V } = opstelling();
  const v = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(3, 4000), sleutel: 'reis-parijs-1' });
  V.keur(v.voornemen.id, {});

  const u = uitvoerder();
  await V.voerUit(v.voornemen.id, { doe: u.doe });
  assert.deepEqual(u.gedaan.map(s => s.idemSleutel),
    ['reis-parijs-1:1', 'reis-parijs-1:2', 'reis-parijs-1:3']);

  // nog eens uitvoeren doet niets: het voornemen is af
  const u2 = uitvoerder();
  const weer = await V.voerUit(v.voornemen.id, { doe: u2.doe });
  assert.equal(weer.status, 409);
  assert.equal(u2.gedaan.length, 0);

  // en hetzelfde voornemen opnieuw opstellen levert hetzelfde voornemen
  const nog = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(3, 4000), sleutel: 'reis-parijs-1' });
  assert.equal(nog.hergebruikt, true);
  assert.equal(nog.voornemen.id, v.voornemen.id);
});

test('7. een stap die vastloopt staakt het geheel, met de reden en op de juiste stap', async () => {
  const { V } = opstelling();
  const v = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(4, 4000) });
  V.keur(v.voornemen.id, {});

  let n = 0;
  const r = await V.voerUit(v.voornemen.id, { doe: async () => {
    n += 1;
    if (n === 3) throw new Error('het hotel is intussen volgeboekt');
    return { ok: true };
  } });

  assert.equal(r.status, 500);
  assert.match(r.error, /Stap 3/);
  assert.match(r.error, /volgeboekt/);
  assert.equal(r.voornemen.stand, STAND.GESTAAKT);
  assert.equal(r.voornemen.gedaan, 2, 'twee staan er, en dat is zichtbaar in plaats van weggepoetst');
  assert.equal(r.voornemen.stappen[3].gedaan, false, 'de vierde is niet stiekem toch gedaan');
});

/* DE VIJFDE BEWERING. Er is geen overgang van AFGEWEZEN naar GEKEURD. */
test('8. een nee wordt geen ja door het nog eens te vragen', () => {
  const { V } = opstelling({ maxCenten: 1000 });
  const v = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(5, 18440) });
  const k = V.keur(v.voornemen.id, {});
  assert.equal(k.voornemen.stand, STAND.AFGEWEZEN);

  const weer = V.keur(v.voornemen.id, {});
  assert.equal(weer.status, 409);
  assert.match(weer.error, /wordt niet opnieuw gekeurd/);
  assert.equal(V.vind(v.voornemen.id).stand, STAND.AFGEWEZEN);
});

/* HET TWEEDE SLOT, EN HET HEEFT EEN EIGEN TOETS NODIG. `keur()` weigert een
   tweede keuring al, dus een mutatie op de OVERGANGSTABEL liet hierboven niets
   zakken -- het eerste slot ving hem op. Dat is precies waarom een tabel die de
   laatste verdediging is, apart getoetst hoort te worden: hij bewaakt de
   aanroeper die er morgen bij komt en die `keur` niet passeert. */
test('8b. de overgangstabel laat een eindstand nergens meer heen', () => {
  for (const eind of [STAND.AFGEWEZEN, STAND.UITGEVOERD, STAND.GESTAAKT]) {
    for (const naar of Object.values(STAND)) {
      assert.equal(plan.magOvergaan(eind, naar), false,
        eind + ' hoort een eindstand te zijn, ook richting ' + naar);
    }
  }
  // en de wegen die er WEL horen te zijn, zijn er
  assert.equal(plan.magOvergaan(STAND.OPGESTELD, STAND.WACHT), true);
  assert.equal(plan.magOvergaan(STAND.WACHT, STAND.GEKEURD), true);
  assert.equal(plan.magOvergaan(STAND.GEKEURD, STAND.BEZIG), true);
  assert.equal(plan.magOvergaan(STAND.BEZIG, STAND.UITGEVOERD), true);
  // een onbekende stand is geen sluipweg
  assert.equal(plan.magOvergaan('VERZONNEN', STAND.GEKEURD), false);
});

test('9. BEPERKT is voor een plan geen ja, want niemand weet welke stappen sneuvelen', () => {
  const { V } = opstelling({ maxCenten: 50000, beleid: { versie: 'v1', goedkeuringBovenCenten: 10_000_000,
    extraBewijsBovenCenten: 10_000_000, omkeerbaarBovenCenten: 10_000_000 } });
  const v = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(5, 18440) });   // 92200 > 50000
  const k = V.keur(v.voornemen.id, {});

  assert.equal(k.voornemen.stand, STAND.AFGEWEZEN);
  assert.match(k.voornemen.reden, /past niet in zijn geheel/);
  assert.match(k.voornemen.reden, /niet aan het systeem/,
    'welke stappen eraf gaan is een keuze van de aanvrager');
});

test('10. een plan zonder stappen, met een negatief bedrag of zonder omschrijving bestaat niet', () => {
  const { V } = opstelling();
  assert.match(V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: [] }).error, /zonder stappen/);
  assert.match(V.stelOp({ actor: 'a', stappen: hotels(1, 100) }).error, /hoort bij een handeling/);
  assert.match(V.stelOp({ actor: 'a', handeling: 'x', stappen: [{ wat: 'a', centen: -100 }] }).error,
    /geen geldig bedrag/);
  assert.match(V.stelOp({ actor: 'a', handeling: 'x', stappen: [{ centen: 100 }] }).error,
    /zegt niet wat er gebeurt/);
  /* Een negatieve stap zou het totaal omlaag praten en zo de grens ondergraven
     waarop het geheel is goedgekeurd -- vandaar dat nul wel mag en min niet. */
  assert.equal(V.stelOp({ actor: 'a', handeling: 'x', stappen: [{ wat: 'gratis stap', centen: 0 }] }).ok, true);
});

test('11. wat halverwege blijft steken is telbaar en niet weggestopt', async () => {
  const { V } = opstelling();
  const v = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(4, 4000) });
  V.keur(v.voornemen.id, {});
  let n = 0;
  await V.voerUit(v.voornemen.id, { doe: async () => { n += 1; if (n === 2) throw new Error('stuk'); return {}; } });

  // gestaakt telt niet als halverwege: dat is een afgesloten stand
  assert.equal(V.halverwege().length, 0);

  // maar een voornemen dat op BEZIG blijft staan wel
  const w = V.stelOp({ actor: 'a', handeling: 'reis.boek', stappen: hotels(3, 4000), sleutel: 'w' });
  V.keur(w.voornemen.id, {});
  await V.voerUit(w.voornemen.id, { doe: async (s) => { if (s.stap === 2) throw Object.assign(new Error('x')); return {}; } })
    .catch(() => {});
  V.vind(w.voornemen.id).stand = STAND.BEZIG;   // zoals na een herstart midden in de uitvoering
  const h = V.halverwege();
  assert.equal(h.length, 1);
  assert.equal(h[0].van, 3);
  assert.equal(h[0].gedaan, 1);
});
