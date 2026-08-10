/* De herkomstlaag (kern/command/herkomst.js): waar komt een gegeven vandaan,
   wie hangt ervan af, en -- het belangrijkste -- hoe zeker is elk van die
   antwoorden.

   WAT DEZE TOETS VOORAL BEWAAKT zijn twee dingen die allebei stil kunnen
   verdwijnen:

   1. ELK ANTWOORD DRAAGT ZIJN AARD. Gemeten, aangegeven en afgeleid zijn niet
      even hard. Vallen die etiketten weg, dan ziet het scherm er precies
      hetzelfde uit en is het onbruikbaar geworden: je kunt niet meer zien welk
      deel van het plaatje uit de gegevens komt en welk deel uit een tabel die
      iemand ooit heeft getypt.

   2. STILTE IS GEEN BEWIJS. Het journaal ziet alleen wat via RTG Command is
      gegaan. Een soort zonder schrijver betekent dus NIET "hier schrijft
      niemand in", en als dat er niet bij staat gooit iemand ooit iets weg waar
      wel degelijk aan wordt geschreven.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - alle aard-etiketten op 'gemeten' gezet
     -> "elk antwoord draagt zijn aard" ZAKT (RAAK)
   - een ontbrekende bewaartermijn stilletjes op 365 dagen gezet
     -> "wat geen bewaartermijn heeft, wordt genoemd" ZAKT (RAAK)
   - de blindeVlek-zin uit de uitslag gehaald
     -> "stilte in het journaal is geen bewijs" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakRegister } = require('../server/kern/command/register');
const { maakKwaliteit } = require('../server/kern/command/kwaliteit');
const { maakGraaf } = require('../server/kern/command/graaf');
const { maakHerkomst } = require('../server/kern/command/herkomst');

/* Een kleine wereld: zaken met bestellingen die naar ze wijzen. De codes zijn
   bewust langer dan één teken -- de meter slaat te korte waarden over. */
function maak(opties) {
  const o = opties || {};
  const db = { data: {
    suppliers: [{ code: 'HOSHI', name: 'Aguamarina' }, { code: 'KIKUNOI', name: 'Kikunoi' }],
    orders: [
      { ref: 'O1', supplierCode: 'HOSHI', status: 'klaar', at: '2026-01-01T00:00:00.000Z' },
      { ref: 'O2', supplierCode: 'HOSHI', status: 'klaar', at: '2026-01-02T00:00:00.000Z' },
      { ref: 'O3', supplierCode: 'HOSHI', status: 'klaar', at: '2026-01-03T00:00:00.000Z' },
      { ref: 'O4', supplierCode: 'KIKUNOI', status: 'klaar', at: '2026-01-04T00:00:00.000Z' },
      { ref: 'O5', supplierCode: 'KIKUNOI', status: 'klaar', at: '2026-01-05T00:00:00.000Z' },
      { ref: 'O6', supplierCode: 'KIKUNOI', status: 'klaar', at: '2026-01-06T00:00:00.000Z' }
    ]
  } };
  const register = maakRegister([
    { type: 'zaak', label: 'Zaak', meervoud: 'zaken', domein: 'handel',
      collectie: 'suppliers', sleutel: 'code', zoek: ['code'], titel: r => r.name },
    { type: 'bestelling', label: 'Bestelling', meervoud: 'bestellingen', domein: 'handel',
      collectie: 'orders', sleutel: 'ref', zoek: ['ref'], titel: r => 'Bestelling ' + r.ref }
  ]);
  const kwaliteit = maakKwaliteit({ db, register });
  const graaf = maakGraaf({ db, register, kwaliteit });

  const regels = o.journaal || [
    { at: '2026-02-01T10:00:00.000Z', actor: 'ik', actie: 'bestelling afronden', niveau: 'auto',
      objectType: 'bestelling', objectId: 'O1' },
    { at: '2026-02-02T10:00:00.000Z', actor: 'jij', actie: 'bestelling afronden', niveau: 'hand',
      objectType: 'bestelling', objectId: 'O2' }
  ];
  const journaal = {
    recent: () => regels.slice().reverse(),
    overObject: (t, i) => regels.filter(r => r.objectType === t && r.objectId === i)
  };
  const runbooks = { RUNBOOKS: [
    { id: 'rb-1', naam: 'Bestelling afronden', type: 'bestelling', veld: 'status', actie: 'status zetten' }
  ] };
  const bewaarbeleid = o.beleid === null ? null : (o.beleid || [
    { tak: 'orders', label: 'bestellingen', dagen: 365, grond: 'nodig', datum: 'at',
      waarom: 'een jaar na de bestelling heeft niemand er nog iets aan' }
  ]);

  return { db, register, graaf, herkomst: maakHerkomst({ db, register, graaf, journaal, runbooks, bewaarbeleid }) };
}

test('elk antwoord draagt zijn aard', () => {
  /* DE KERN. Zonder deze etiketten ziet het scherm er identiek uit en is het
     onbruikbaar: dan is niet meer te zien welk deel uit de gegevens komt en
     welk deel uit een tabel die iemand ooit heeft getypt. */
  const k = maak().herkomst.kaart();
  const bestelling = k.soorten.find(x => x.type === 'bestelling');

  assert.equal(bestelling.heen[0].aard, 'gemeten', 'een verwijzing is gemeten');
  assert.equal(bestelling.magSchrijven[0].aard, 'aangegeven', 'wie MAG schrijven staat in een tabel');
  assert.equal(bestelling.heeftGeschreven[0].aard, 'gemeten', 'wie het DEED staat in het journaal');
  assert.equal(bestelling.afhankelijk.aard, 'afgeleid');
  assert.equal(bestelling.bewaren.aard, 'aangegeven');
  assert.equal(bestelling.bewaren.bron, 'server/bewaarbeleid.js', 'en welke tabel dat is');

  const soorten = new Set([].concat(
    k.soorten.map(x => x.bewaren.aard), k.soorten.map(x => x.afhankelijk.aard)));
  assert.ok(!soorten.has(undefined), 'geen enkel antwoord komt zonder aard');
});

test('stilte in het journaal is geen bewijs', () => {
  const k = maak().herkomst.kaart();
  assert.ok(k.zonderSchrijver.includes('zaak'), 'er is niets over zaken genoteerd');
  assert.match(k.blindeVlek, /betekent NIET/,
    'en daar hoort met zoveel woorden bij dat dat niets bewijst: ' + k.blindeVlek);
  assert.match(k.blindeVlek, /journaal/);
});

test('wat geen bewaartermijn heeft, wordt genoemd', () => {
  const k = maak().herkomst.kaart();
  const zaak = k.soorten.find(x => x.type === 'zaak');
  const bestelling = k.soorten.find(x => x.type === 'bestelling');

  assert.equal(bestelling.bewaren.termijn, 365, 'de bestellingen staan in het beleid');
  assert.equal(zaak.bewaren.termijn, null, 'de zaken niet');
  assert.match(zaak.bewaren.uitleg, /geen termijn/, 'en dat wordt gezegd: ' + zaak.bewaren.uitleg);
  assert.deepEqual(k.zonderTermijn, ['zaak']);
});

test('wat hiervan afhangt is gerekend en niet geteld', () => {
  const k = maak().herkomst.kaart();
  const zaak = k.soorten.find(x => x.type === 'zaak');
  assert.equal(zaak.terug.length, 1, 'de bestellingen wijzen naar de zaak');
  assert.equal(zaak.terug[0].van, 'bestelling');
  assert.match(zaak.afhankelijk.uitleg, /wees/, 'en het zegt wat er gebeurt als de zaak verdwijnt');

  const bestelling = k.soorten.find(x => x.type === 'bestelling');
  assert.equal(bestelling.terug.length, 0);
  assert.match(bestelling.afhankelijk.uitleg, /geen enkele/);
});

test('het spoor van één object loopt beide kanten op', () => {
  const h = maak().herkomst;
  const w = h.spoor('bestelling', 'O1');
  assert.equal(w.object.id, 'O1');
  assert.ok(w.wijstNaar.some(x => x.type === 'zaak' && x.id === 'HOSHI'), 'vanaf O1 kom je bij HOSHI uit');
  assert.equal(w.journaal.length, 1, 'en het journaal over dit exemplaar staat erbij');

  const z = h.spoor('zaak', 'HOSHI');
  assert.equal(z.wijstNaar.length, 0);
  assert.ok(z.wordtGenoemdDoor.length >= 3, 'andersom vind je de bestellingen: ' + z.wordtGenoemdDoor.length);

  assert.equal(h.spoor('onzin', 'X').status, 404);
  assert.equal(h.spoor('zaak', 'BESTAATNIET').status, 404);
});

test('de vervaldatum wordt gerekend uit het datumveld van het beleid', () => {
  const w = maak().herkomst.spoor('bestelling', 'O1');
  assert.equal(w.bewaren.vervalt, new Date(Date.parse('2026-01-01T00:00:00.000Z') + 365 * 86400000).toISOString());
  assert.equal(w.bewaren.let, null);

  /* En draagt de rij geen bruikbare datum, dan wordt dat gezegd in plaats van
     een datum te verzinnen. */
  const m = maak();
  m.db.data.orders[0].at = '';
  const zonder = m.herkomst.spoor('bestelling', 'O1');
  assert.equal(zonder.bewaren.vervalt, null);
  assert.match(zonder.bewaren.let, /geen bruikbare datum/);
});

test('zonder bewaarbeleid doet de laag alsof er geen termijn is, niet alsof er een is', () => {
  const k = maak({ beleid: null }).herkomst.kaart();
  assert.deepEqual(k.zonderTermijn.sort(), ['bestelling', 'zaak']);
  for (const s of k.soorten) assert.equal(s.bewaren.termijn, null);
});
