/* De betaalopdracht (kern/betaalopdracht/): het verschil tussen "geboekt" en
   "echt weg". Getest met een NEPRAIL die we naar believen laten mislukken, want
   dat is precies het geval dat er in productie niet uit te lokken is en dat
   vroeger stil verdween: kern/bank/overboeken.js belde de payout in een try met
   een lege catch eronder, dus een mislukte SEPA gaf een geslaagd antwoord, het
   geld stond van de rekening af en er kwam nooit een herhaling.

   Wat hier moet blijken: de opdracht bestaat VOORDAT de rail is gebeld, hij
   overleeft een mislukking, hij komt met dezelfde idempotentiesleutel terug,
   hij geeft na de laatste poging op EN boekt dan terug, en zolang hij niet
   afgerond is telt hij mee in de reconciliatie.
   Draai los: node --test test/betaalopdracht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

/* Een testopstelling met een klok die we zelf verzetten: de backoff wacht in
   productie minuten, en een toets die echt wacht is een toets die niemand nog
   draait. */
function maak({ railFaalt = 0, railStatus = 'ingepland', terugboekFaalt = false, maxPogingen = 3 } = {}) {
  const db = { data: {} };
  const klok = { t: 1000000 };
  const rail = { pogingen: [], sleutels: [] };
  const terug = { aanroepen: [] };
  let nogFalen = railFaalt;
  const op = require('../server/kern/betaalopdracht')({
    d: () => db.data, save: () => {}, crypto, nu: () => klok.t,
    maxPogingen, backoffMs: [100, 200, 400],
    log: { warn: () => {} },   // de klacht zelf toetsen we apart hieronder
    railInzenden: async (o) => {
      rail.pogingen.push(o.id);
      rail.sleutels.push(o.idemSleutel);
      if (nogFalen > 0) { nogFalen--; throw new Error('de rail is onbereikbaar'); }
      return { id: 'RAIL-' + rail.pogingen.length, status: railStatus };
    },
    terugboeken: async (o) => {
      terug.aanroepen.push(o.id);
      if (terugboekFaalt) return { error: 'het grootboek weigerde de teruggang' };
      return { ok: true, boeking: { id: 'TERUG-1' } };
    }
  });
  return { op, db, klok, rail, terug };
}

const basis = { soort: 'sepa-uit', centen: 5000, bron: 'NL00RTG0000000001', bestemming: 'NL91ABNA0417164300', ledgerRef: 'BB-1', oms: 'test' };

test('de opdracht staat vast VOORDAT de rail is gebeld', () => {
  const { op, db, rail } = maak();
  const o = op.maak(basis);
  assert.equal(o.status, 'GEBOEKT', 'geboekt, de rail weet nog van niets');
  assert.equal(rail.pogingen.length, 0, 'de rail is nog niet aangeroepen');
  assert.equal(db.data.betaalOpdrachten.length, 1, 'en hij staat al in de opslag');
  assert.equal(db.data.betaalOpdrachten[0].ledgerRef, 'BB-1', 'met de boeking waar hij bij hoort');
});

test('een opdracht zonder boeking bestaat niet', () => {
  const { op } = maak();
  assert.throws(() => op.maak({ ...basis, ledgerRef: null }), /ledgerRef/);
  assert.throws(() => op.maak({ ...basis, centen: 0 }), /positief bedrag/);
});

test('geslaagde inzending: ingediend, en pas afgewikkeld als de rail dat zelf zegt', async () => {
  const a = maak({ railStatus: 'ingepland' });
  const r1 = await a.op.dienIn(a.op.maak(basis));
  assert.equal(r1.status, 'INGEDIEND', 'aangenomen is nog niet afgerond');
  assert.equal(r1.settlementRef, 'RAIL-1', 'de referentie van de rail staat erbij');

  const b = maak({ railStatus: 'paid' });
  const r2 = await b.op.dienIn(b.op.maak(basis));
  assert.equal(r2.status, 'AFGEWIKKELD', 'een definitieve railstatus sluit hem wel');
});

test('een mislukte rail laat de opdracht staan en plant een herhaling', async () => {
  const { op, rail } = maak({ railFaalt: 1 });
  const o = op.maak(basis);
  const na = await op.dienIn(o);
  assert.equal(na.status, 'GEBOEKT', 'hij is NIET afgerond -- dit was vroeger een geslaagd antwoord');
  assert.equal(na.pogingen, 1);
  assert.match(na.laatsteFout, /onbereikbaar/, 'de reden staat erbij, hij valt niet stil');
  assert.ok(na.volgendeAt > 0, 'er staat een volgende poging ingepland');
  assert.equal(rail.pogingen.length, 1);
});

test('de ronde pakt hem op zodra hij aan de beurt is, met dezelfde idempotentiesleutel', async () => {
  const { op, klok, rail } = maak({ railFaalt: 1 });
  const o = op.maak({ ...basis, idemSleutel: 'vaste-sleutel' });
  await op.dienIn(o);

  const tevroeg = await op.ronde({ tot: klok.t });
  assert.equal(tevroeg.gedaan, 0, 'voor de backoff verstreken is gebeurt er niets');

  klok.t += 1000;
  const ronde = await op.ronde({ tot: klok.t });
  assert.equal(ronde.gedaan, 1);
  assert.equal(op.vind(o.id).status, 'INGEDIEND', 'de tweede poging slaagt');
  assert.deepEqual(rail.sleutels, ['vaste-sleutel', 'vaste-sleutel'],
    'beide pogingen dragen dezelfde sleutel -- anders is een herhaling een tweede betaling');
});

test('na de laatste poging geeft hij op EN komt het geld terug', async () => {
  const { op, klok, terug } = maak({ railFaalt: 99, maxPogingen: 3 });
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.vind(o.id).status, 'GEBOEKT', 'na poging 1 nog niet opgegeven');
  klok.t += 10000; await op.ronde({ tot: klok.t });
  assert.equal(op.vind(o.id).pogingen, 2);
  klok.t += 10000; await op.ronde({ tot: klok.t });

  const eind = op.vind(o.id);
  assert.equal(eind.pogingen, 3, 'precies maxPogingen keer geprobeerd');
  assert.equal(eind.status, 'TERUGGEBOEKT', 'opgegeven, en het geld is teruggeboekt');
  assert.deepEqual(terug.aanroepen, [o.id], 'de teruggang is precies een keer aangeroepen');
  assert.equal(eind.klaarAt > 0, true);
});

test('mislukt ook de teruggang, dan blijft hij OPEN staan en niet stil dicht', async () => {
  const { op, klok } = maak({ railFaalt: 99, maxPogingen: 2, terugboekFaalt: true });
  const o = op.maak(basis);
  await op.dienIn(o);
  klok.t += 10000; await op.ronde({ tot: klok.t });

  const eind = op.vind(o.id);
  assert.equal(eind.status, 'MISLUKT', 'niet TERUGGEBOEKT, want er is niets teruggeboekt');
  assert.match(eind.terugboekFout, /weigerde/);
  const open = op.openstaand();
  assert.equal(open.aantal, 1, 'hij telt nog mee als openstaand');
  assert.equal(open.zonderTerugboeking, 1, 'en apart als "geld staat af zonder bestemming"');
});

test('de reconciliatie telt alleen wat nog niet buiten RTG rond is', async () => {
  const { op, klok } = maak({ railStatus: 'paid' });
  const klaar = op.maak({ ...basis, centen: 5000 });
  await op.dienIn(klaar);

  const b = maak({ railFaalt: 99, maxPogingen: 9 });
  const open1 = b.op.maak({ ...basis, centen: 2500, ledgerRef: 'BB-2' });
  const open2 = b.op.maak({ ...basis, centen: 700, ledgerRef: 'BB-3' });
  await b.op.dienIn(open1);
  await b.op.dienIn(open2);

  assert.equal(op.openstaand().centen, 0, 'een afgewikkelde opdracht telt niet mee');
  assert.equal(op.openstaand().perStatus.AFGEWIKKELD, 1);
  const o = b.op.openstaand();
  assert.equal(o.aantal, 2);
  assert.equal(o.centen, 3200, 'de twee openstaande bedragen bij elkaar');
  assert.ok(o.oudsteAt > 0, 'en hoe lang de oudste al wacht');
  void klok;
});

test('een status kan niet achteruit, en een afgewikkelde opdracht wordt niet opnieuw ingediend', async () => {
  const klachten = [];
  const db = { data: {} };
  const op = require('../server/kern/betaalopdracht')({
    d: () => db.data, save: () => {}, crypto, nu: () => 5000,
    log: { warn: (m, g) => klachten.push([m, g]) },
    railInzenden: async () => ({ id: 'R1', status: 'paid' }),
    terugboeken: async () => ({ ok: true })
  });
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.vind(o.id).status, 'AFGEWIKKELD');

  const weer = await op.dienIn(o);
  assert.equal(weer.status, 'AFGEWIKKELD', 'nog een keer indienen doet niets');
  assert.equal(op.vind(o.id).pogingen, 1, 'en telt geen extra poging');

  const geweigerd = op.bevestig({ id: o.id, gelukt: false, reden: 'te laat' });
  assert.equal(geweigerd.status, 'AFGEWIKKELD', 'afgewikkeld blijft afgewikkeld');
  assert.ok(klachten.some(k => /geweigerde statusovergang/.test(k[0])), 'en de poging is geklaagd, niet genegeerd');
});

test('de webhook-bevestiging sluit een ingediende opdracht', async () => {
  const { op } = maak({ railStatus: 'ingepland' });
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.vind(o.id).status, 'INGEDIEND');
  const r = op.bevestig({ id: o.id, settlementRef: 'SEPA-XYZ' });
  assert.equal(r.status, 'AFGEWIKKELD');
  assert.equal(r.settlementRef, 'SEPA-XYZ');
  assert.equal(op.openstaand().aantal, 0, 'daarna is de reconciliatie leeg');
});

test('twee rondes tegelijk bieden dezelfde opdracht niet twee keer aan', async () => {
  const { op, klok } = maak({ railFaalt: 1 });
  const o = op.maak(basis);
  await op.dienIn(o);
  klok.t += 10000;
  const [a, b] = await Promise.all([op.ronde({ tot: klok.t }), op.ronde({ tot: klok.t })]);
  const overgeslagen = [a, b].filter(r => r.overgeslagen).length;
  assert.equal(overgeslagen, 1, 'de tweede ronde ziet dat er al een loopt');
  assert.equal(op.vind(o.id).pogingen, 2, 'en de opdracht is maar een keer extra aangeboden');
});
