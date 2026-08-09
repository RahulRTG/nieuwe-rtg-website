/* Ronde: het dagbeeld -- de schil die de drie assen als één scherm toont.

   De twee beloftes die hier worden vastgehouden:

   1. HET SCHERM VERZINT GEEN CIJFERS OM ZICHZELF TE VULLEN. Een onderneming in
      de ideefase heeft geen omzet, en dan staat er geen nul -- nul is een
      gemeten waarde en suggereert dat er verkocht had kunnen worden. En de
      gezondheidsscore heeft twee meetbare bronnen nodig; een bedrijf dat
      gisteren begon en vandaag een 60 krijgt, heeft een cijfer over niets.
   2. DE ACTIES STAAN OP GEWICHT. Wat het plan breekt gaat voorop, daarna wat
      er ontbreekt, daarna wat er kan.

   Draai los: node --experimental-sqlite --test test/onderneming-dagbeeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakOnderneming = require('../server/kern/onderneming');
const METER = require('../server/kern/onderneming/meter');

function stubKern(zaken) {
  const lijst = zaken || [];
  const data = { ondernemingen: [], suppliers: lijst,
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services', 'agenda'] } }, thuisHuizen: {} };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  return maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    findSupplier: (code) => lijst.find(z => z.code === code) || null,
    ordersVanZaak: (code) => (lijst.find(z => z.code === code) || {}).orders || [],
    boekingenVanZaak: (code) => (lijst.find(z => z.code === code) || {}).boekingen || []
  });
}

const GEZOND = {
  persoon: { urenPerWeek: 32, ervaringJaren: 8, startkapitaal: 15000, verkoopervaring: true },
  idee: { branche: 'zzp', wat: 'Ramen wassen', doelgroep: 'Kantoren', plaats: 'Haarlem',
    onderscheid: 'Vaste ploeg, avondwerk, geen onderaannemers', verkoopmodel: 'abonnement',
    prijs: 120, kostprijs: 30, verwachtPerMaand: 60, vasteLasten: 1800 }
};

function maakOnd(K, intake) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (intake) K.ondernemingIntakeZet(o, intake);
  return o;
}

/* ---------------- de meter, los ---------------- */

test('de meter geeft altijd dezelfde vorm terug, ook zonder cijfer', () => {
  const leeg = METER.scoreUit([{ id: 'a', gemeten: false, reden: 'niets' }], 2);
  assert.equal(leeg.score, null);
  assert.equal(leeg.grondslag.gemeten, 0);
  assert.equal(leeg.grondslag.totaal, 1);
  assert.deepEqual(leeg.grondslag.ontbreekt, [{ id: 'a', reden: 'niets' }],
    'ook zonder cijfer staat er waarom -- een aanroeper die soms wel en soms geen grondslag krijgt, leest hem niet meer uit');
});

test('de meter telt een ontbrekende bron niet als nul mee', () => {
  const bronnen = [{ id: 'a', gemeten: true, punten: 25, max: 25 },
    { id: 'b', gemeten: true, punten: 25, max: 25 },
    { id: 'c', gemeten: false, reden: 'geen data' }];
  assert.equal(METER.scoreUit(bronnen, 2).score, 100,
    'twee volle bronnen geven 100, ook al is de derde onmeetbaar');
});

/* ---------------- de ideefase: niets verzinnen ---------------- */

test('een idee krijgt geen gezondheidscijfer, met de reden erbij', () => {
  const K = stubKern();
  const d = K.ondernemingDagbeeld(maakOnd(K, GEZOND));
  assert.equal(d.fase, 'idee');
  assert.equal(d.gezondheid.score, null, 'één meetbare bron is geen cijfer waard');
  assert.equal(d.gezondheid.grondslag.gemeten, 1, 'alleen "ligt er een plan" is meetbaar zonder zaak');
  assert.equal(d.gezondheid.grondslag.ontbreekt.length, 3);
  assert.ok(d.gezondheid.uitleg.includes('1 van de 4'));
});

test('een idee toont geen omzet van nul maar helemaal geen omzet', () => {
  const K = stubKern();
  const d = K.ondernemingDagbeeld(maakOnd(K, GEZOND));
  assert.equal(d.cijfers.filter(c => c.gemeten).length, 0,
    'er valt niets te meten, dus er staat niets -- nul zou suggereren dat er verkocht had kunnen worden');
  assert.ok(d.cijfers[0].reden.includes('geen zaak'));
});

test('de groet hoort bij de fase en zegt wat die fase is', () => {
  const K = stubKern();
  const o = maakOnd(K, GEZOND);
  assert.ok(K.ondernemingDagbeeld(o).groet.includes('verkent een idee'));

  const v = K.ondernemingVerkenning(o);
  K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  const na = K.ondernemingDagbeeld(o);
  assert.equal(na.fase, 'validatie');
  assert.ok(na.groet.includes('plan ligt er'), 'de groet volgt de fase mee');
});

/* ---------------- de acties ---------------- */

test('wat het plan breekt staat bovenaan de acties', () => {
  const K = stubKern();
  const slecht = JSON.parse(JSON.stringify(GEZOND));
  slecht.idee.prijs = 25;            // onder de kostprijs: blokkerend
  delete slecht.idee.wat;            // en een ontbrekend intakeveld
  const d = K.ondernemingDagbeeld(maakOnd(K, slecht));
  assert.ok(d.acties.length >= 2);
  assert.ok(d.acties[0].id.startsWith('stress:'),
    'een blokkerende bevinding gaat voor een ontbrekend veld');
  assert.ok(d.acties.some(a => a.id === 'intake-plan'), 'en het ontbrekende veld staat er ook');
});

test('een compleet plan levert de actie om het vast te leggen, en die verdwijnt daarna', () => {
  const K = stubKern();
  const o = maakOnd(K, GEZOND);
  assert.ok(K.ondernemingDagbeeld(o).acties.some(a => a.id === 'plan-vastleggen'));
  const v = K.ondernemingVerkenning(o);
  K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  assert.ok(!K.ondernemingDagbeeld(o).acties.some(a => a.id === 'plan-vastleggen'),
    'wat gedaan is, staat er niet meer');
});

test('de vervolgacties volgen de werkelijke staat', () => {
  const K = stubKern();
  const o = maakOnd(K, GEZOND);
  assert.ok(K.ondernemingDagbeeld(o).acties.some(a => a.id === 'rechtsvorm'),
    'zonder rechtsvorm staat die vraag er');
  K.ondernemingRechtsvorm(o, 'eenmanszaak');
  assert.ok(!K.ondernemingDagbeeld(o).acties.some(a => a.id === 'rechtsvorm'));

  const v = K.ondernemingVerkenning(o);
  K.ondernemingPlanVastleggen(o, v.plan, v.stress, {});
  assert.ok(K.ondernemingDagbeeld(o).acties.some(a => a.id === 'inschrijven'),
    'met een vastgelegd plan en zonder KvK komt de inschrijving op');
  K.ondernemingIngeschreven(o, '12345678');
  assert.ok(K.ondernemingDagbeeld(o).acties.some(a => a.id === 'koppel-zaak'),
    'en daarna het koppelen van de zaak');
});

/* ---------------- met een draaiende zaak ---------------- */

test('een draaiende zaak levert wél cijfers en wél een gezondheidsscore', () => {
  const nu = new Date().toISOString();
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', staff: [{ id: 1 }], boekingen: [
    { customerCodename: 'Reiger', status: 'bevestigd', paid: true, price: 900, at: nu },
    { customerCodename: 'Wilg', status: 'bevestigd', paid: true, price: 800, at: nu },
    { customerCodename: 'Els', status: 'aangevraagd' }
  ] };
  const K = stubKern([zaak]);
  const o = maakOnd(K, GEZOND);
  K.ondernemingKoppel(o, 'GLAS');
  const d = K.ondernemingDagbeeld(o);

  const omzet = d.cijfers.find(c => c.id === 'omzet');
  assert.equal(omzet.gemeten, true);
  assert.equal(omzet.waarde, 1700, 'alleen de betaalde boekingen van deze maand');
  assert.equal(d.cijfers.find(c => c.id === 'klanten').waarde, 3);
  assert.equal(d.cijfers.find(c => c.id === 'wachtend').waarde, 1);

  assert.ok(typeof d.gezondheid.score === 'number', 'nu is er wel genoeg om te meten');
  assert.equal(d.gezondheid.grondslag.gemeten, 4);
  assert.ok(d.acties.some(a => a.id === 'aanvragen'), 'de openstaande aanvraag komt op de lijst');
});

test('zonder betaalde omzet deze maand blijft die bron onmeetbaar, en zakt de score niet naar nul', () => {
  const zaak = { code: 'GLAS', name: 'Glas', type: 'zzp', staff: [{ id: 1 }], boekingen: [
    { customerCodename: 'Reiger', status: 'bevestigd', paid: true, price: 900, at: '2020-01-01T00:00:00.000Z' }
  ] };
  const K = stubKern([zaak]);
  const o = maakOnd(K, GEZOND);
  K.ondernemingKoppel(o, 'GLAS');
  const g = K.ondernemingDagbeeld(o).gezondheid;
  const omzetBron = g.grondslag.ontbreekt.find(b => b.id === 'omzet');
  assert.ok(omzetBron, 'oude omzet telt niet als omzet van deze maand');
  assert.equal(g.grondslag.gemeten, 3, 'de andere drie zijn wel meetbaar');
  assert.ok(g.score > 0, 'en de score rust op die drie, niet op vier met een nul erbij');
});
