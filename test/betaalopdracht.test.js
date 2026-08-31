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
  });
  /* De teruggang wordt per SOORT geregistreerd en niet aan de constructor
     meegegeven: een huis, een rij, maar elke rail boekt in zijn eigen grootboek
     terug. Hier is dat de nep-SEPA. */
  op.registreerTeruggang('sepa-uit', async (o) => {
    terug.aanroepen.push(o.id);
    if (terugboekFaalt) return { error: 'het grootboek weigerde de teruggang' };
    return { ok: true, boeking: { id: 'TERUG-1' } };
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
    railInzenden: async () => ({ id: 'R1', status: 'paid' })
  });
  op.registreerTeruggang('sepa-uit', async () => ({ ok: true }));
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.vind(o.id).status, 'AFGEWIKKELD');

  const weer = await op.dienIn(o);
  assert.equal(weer.status, 'AFGEWIKKELD', 'nog een keer indienen doet niets');
  assert.equal(op.vind(o.id).pogingen, 1, 'en telt geen extra poging');

  const geweigerd = await op.bevestig({ id: o.id, gelukt: false, reden: 'te laat' });
  assert.equal(geweigerd.status, 'AFGEWIKKELD', 'afgewikkeld blijft afgewikkeld');
  assert.ok(klachten.some(k => /geweigerde statusovergang/.test(k[0])), 'en de poging is geklaagd, niet genegeerd');
});

test('de webhook-bevestiging sluit een ingediende opdracht', async () => {
  const { op } = maak({ railStatus: 'ingepland' });
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.vind(o.id).status, 'INGEDIEND');
  const r = await op.bevestig({ id: o.id, settlementRef: 'SEPA-XYZ' });
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

/* DE WEBHOOK-KANT. De rail neemt een opdracht aan en meldt pas UREN later of hij
   echt is verwerkt. Die tweede melding is het enige moment waarop RTG mag zeggen
   dat het geld er is -- en, als hij negatief is, het moment waarop het geld
   terug moet. Precies dat tweede deel is waar een statusveld alleen niet genoeg
   is: "MISLUKT" opschrijven en het geld laten staan is hetzelfde gat als
   daarvoor, alleen een dag later in de tijdlijn. */
test('de webhook vindt de opdracht op de referentie van de rail, niet op onze id', async () => {
  const { op } = maak({ railStatus: 'ingepland' });
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.vind(o.id).settlementRef, 'RAIL-1');

  const r = await op.bevestig({ settlementRef: 'RAIL-1' });
  assert.equal(r.id, o.id, 'dezelfde opdracht, gevonden zonder onze eigen id');
  assert.equal(r.status, 'AFGEWIKKELD');

  // een onbekende referentie raakt niets
  assert.equal((await op.bevestig({ settlementRef: 'RAIL-BESTAATNIET' })).status, 404,
    'een webhook over een payout die wij niet kennen pakt geen willekeurige opdracht');
});

/* Hier stond ook een bewering dat een LEGE referentie niets matcht. Die kon niet
   zakken: een settlementRef is null of een echte string en nooit leeg, dus de
   vergelijking liep sowieso nergens op stuk. De mutatie sloeg af, en een toets
   die niet kan zakken is slechter dan geen toets (LAT.md regel 9) -- weg dus, en
   de afslag in de code heet nu een snelkoppeling in plaats van een grendel. */
test('twee opdrachten met dezelfde railreferentie: de webhook gaat over de laatste', async () => {
  const db = { data: {} };
  const op = require('../server/kern/betaalopdracht')({
    d: () => db.data, save: () => {}, crypto, nu: () => 7000,
    log: { warn: () => {} },
    railInzenden: async () => ({ id: 'PO-ZELFDE', status: 'ingepland' })  // de rail hergebruikt zijn id
  });
  op.registreerTeruggang('sepa-uit', async () => ({ ok: true }));
  const eerste = op.maak({ ...basis, ledgerRef: 'BB-oud' });
  const tweede = op.maak({ ...basis, ledgerRef: 'BB-nieuw' });
  await op.dienIn(eerste);
  await op.dienIn(tweede);

  const r = await op.bevestig({ settlementRef: 'PO-ZELFDE' });
  assert.equal(r.id, tweede.id, 'de laatste poging wint, niet de eerste');
  assert.equal(op.vind(eerste.id).status, 'INGEDIEND', 'de oudere blijft ongemoeid');
});

test('meldt de rail achteraf een mislukking, dan komt het geld terug', async () => {
  const { op, terug } = maak({ railStatus: 'ingepland' });
  const o = op.maak(basis);
  await op.dienIn(o);
  assert.equal(op.openstaand().centen, 5000, 'zolang hij loopt telt hij mee');

  const r = await op.bevestig({ settlementRef: 'RAIL-1', gelukt: false, reden: 'rekening bestaat niet' });
  assert.equal(r.status, 'TERUGGEBOEKT', 'niet alleen MISLUKT opschrijven -- het geld moet terug');
  assert.deepEqual(terug.aanroepen, [o.id], 'dezelfde teruggang als bij opgeven, precies een keer');
  assert.match(op.vind(o.id).laatsteFout, /rekening bestaat niet/, 'met de reden van de rail erbij');
  assert.equal(op.openstaand().aantal, 0, 'en daarna is de reconciliatie leeg');
});

test('een tweede webhook over dezelfde opdracht verandert niets meer', async () => {
  const { op, terug } = maak({ railStatus: 'ingepland' });
  const o = op.maak(basis);
  await op.dienIn(o);
  await op.bevestig({ settlementRef: 'RAIL-1', gelukt: false, reden: 'eerste melding' });
  assert.equal(op.vind(o.id).status, 'TERUGGEBOEKT');

  // providers herhalen hun webhooks; een tweede levering mag niet nog eens boeken
  const weer = await op.bevestig({ settlementRef: 'RAIL-1', gelukt: false, reden: 'herhaalde melding' });
  assert.equal(weer.status, 'TERUGGEBOEKT');
  assert.equal(terug.aanroepen.length, 1, 'er is niet nog een keer teruggeboekt');
  const laat = await op.bevestig({ settlementRef: 'RAIL-1', gelukt: true });
  assert.equal(laat.status, 'TERUGGEBOEKT', 'en een late "toch gelukt" draait een teruggeboekte opdracht niet om');
});

/* EEN RIJ VOOR HET HELE HUIS, MAAR NIET EEN TERUGGANG. De bank boekt terug naar
   extern:sepa, Pay naar extern:uitbetaald, en het fonds heeft helemaal geen
   boeking om terug te draaien. Wie die drie op een hoop gooit, boekt vroeg of
   laat geld naar de verkeerde kant -- stil, want het grootboek sluit er gewoon
   van. Vandaar een tabel per soort, en een weigering voor wat er niet in staat. */
test('een soort zonder geregistreerde teruggang wordt geweigerd, niet geraden', async () => {
  const db = { data: {} };
  const klachten = [];
  const op = require('../server/kern/betaalopdracht')({
    d: () => db.data, save: () => {}, crypto, nu: () => 3000,
    maxPogingen: 1, log: { warn: (m, g) => klachten.push([m, g]) },
    railInzenden: async () => { throw new Error('rail dicht'); }
  });
  const o = op.maak({ ...basis, soort: 'onbekende-rail' });
  await op.dienIn(o);

  const eind = op.vind(o.id);
  assert.equal(eind.status, 'MISLUKT', 'niet TERUGGEBOEKT: er is niets teruggeboekt');
  assert.match(eind.terugboekFout, /geen teruggang geregistreerd/);
  assert.equal(op.openstaand().zonderTerugboeking, 1, 'en hij staat als "geld af zonder bestemming" op het bord');
  assert.ok(klachten.some(k => /TERUGBOEKING MISLUKT/.test(k[0])), 'met een luide klacht erbij');
});

test('twee rails kunnen niet dezelfde soort claimen', () => {
  const db = { data: {} };
  const op = require('../server/kern/betaalopdracht')({
    d: () => db.data, save: () => {}, crypto, nu: () => 3000, log: { warn: () => {} },
    railInzenden: async () => ({ id: 'X', status: 'ingepland' })
  });
  op.registreerTeruggang('sepa-uit', async () => ({ ok: true }));
  assert.throws(() => op.registreerTeruggang('sepa-uit', async () => ({ ok: true })), /staat al een teruggang/);
  assert.throws(() => op.registreerTeruggang('iets', 'geen functie'), /is een functie/);
});

/* ============================================================================
   ECONOMISCHE IDEMPOTENTIE -- zeventien herhalingen, EEN handeling.

   DE FOUT DIE HIER ZAT, en zij is de duurste soort. Elke opdracht droeg al een
   idempotentiesleutel -- 'rtf:<lid>:<factuur>', 'pay-uit:<zaak>:<boeking>',
   'bank-sepa:<iban>:<boeking>' -- die keurig aan de rail werd meegegeven. Alleen
   keek RTG er zelf nooit naar. Een zoekopdracht gaf zes plekken die hem
   SCHRIJVEN en geen enkele die hem LEEST.

   Twee aanroepen met dezelfde sleutel leverden dus twee opdrachten van samen het
   dubbele bedrag, en of dat geld ook echt twee keer wegging hing af van de goede
   wil van een externe partij. Precies het soort veld dat eruitziet als een
   grendel en er geen is.
   ========================================================================== */

test('dezelfde economische handeling levert EEN opdracht, hoe vaak je hem ook aanbiedt', async () => {
  const { op } = maak();
  const eerste = op.maak({ ...basis, idemSleutel: 'rtf:LID7:FACT-1' });
  const tweede = op.maak({ ...basis, idemSleutel: 'rtf:LID7:FACT-1' });
  const derde = op.maak({ ...basis, centen: 999999, idemSleutel: 'rtf:LID7:FACT-1' });

  assert.equal(tweede.id, eerste.id, 'een herhaling hoort dezelfde handeling te raken');
  assert.equal(derde.id, eerste.id, 'ook als er een ander bedrag bij staat');
  assert.equal(tweede.hergebruikt, true,
    'stil dezelfde opdracht teruggeven zou een tweede stil gedrag zijn op de plek waar we er een weghalen');
  assert.equal(derde.centen, basis.centen, 'en het bedrag van de EERSTE handeling blijft staan');

  const alles = op.lijst({ limit: 50 });
  assert.equal(alles.aantal, 1, 'een opdracht in de rij, niet drie');
  assert.equal(alles.opdrachten[0].centen, basis.centen);
});

test('een andere sleutel is een andere handeling, en die mag er gewoon bij', () => {
  const { op } = maak();
  const a = op.maak({ ...basis, idemSleutel: 'pay-uit:KIKUNOI:B1' });
  const b = op.maak({ ...basis, ledgerRef: 'L2', idemSleutel: 'pay-uit:KIKUNOI:B2' });
  assert.notEqual(a.id, b.id);
  assert.equal(b.hergebruikt, undefined);
  assert.equal(op.lijst({ limit: 50 }).aantal, 2);
});

test('zonder eigen sleutel hangt de idempotentie aan de boeking, en die is er een per uitbetaling', () => {
  const { op } = maak();
  const a = op.maak(basis);                                   // valt terug op 'opdracht:' + ledgerRef
  const b = op.maak(basis);
  assert.equal(b.id, a.id, 'twee keer dezelfde boeking uitbetalen is een uitbetaling');

  const c = op.maak({ ...basis, ledgerRef: 'L-ANDERS' });
  assert.notEqual(c.id, a.id, 'een andere boeking is wel een andere handeling');
});

test('een hergebruikte opdracht die al is afgerond, wordt niet opnieuw ingediend', async () => {
  const { op, rail } = maak();
  const eerste = op.maak({ ...basis, idemSleutel: 'vast' });
  await op.dienIn(eerste);
  await op.bevestig({ settlementRef: 'RAIL-1', gelukt: true });
  assert.equal(op.vind(eerste.id).status, 'AFGEWIKKELD');

  const pogingenVoor = rail.pogingen.length;
  const weer = op.maak({ ...basis, idemSleutel: 'vast' });
  const na = await op.dienIn(weer);
  assert.equal(weer.id, eerste.id);
  assert.equal(na.status, 'AFGEWIKKELD');
  assert.equal(rail.pogingen.length, pogingenVoor,
    'een afgeronde betaling nog eens de rail op sturen is precies wat idempotentie moet voorkomen');
});

/* Een lege sleutel vindt niets. Let op wat deze toets WEL en NIET zegt: hij
   bewijst het gedrag, niet dat er een grendel nodig is. De afslag op een lege
   sleutel in vindOpIdem is een snelkoppeling -- via maak() draagt elke opdracht
   een sleutel, dus er staat er nooit een lege in de rij, en een mutatie die de
   afslag weghaalt laat dan ook niets zakken. Dat is hier opgeschreven in plaats
   van weggewerkt met een toets die iets anders meet. */
test('een lege idempotentiesleutel vindt niets, ook niet met een volle rij', () => {
  const { op } = maak();
  op.maak({ ...basis, idemSleutel: 'echt' });
  op.maak({ ...basis, ledgerRef: 'L2', idemSleutel: 'ook-echt' });

  assert.equal(op.vindOpIdem(''), null);
  assert.equal(op.vindOpIdem(null), null);
  assert.equal(op.vindOpIdem(undefined), null);
  assert.equal(op.vindOpIdem('echt').idemSleutel, 'echt', 'een echte sleutel vindt wel');
});

test('de herhaling wordt geklaagd, want stil ontdubbelen verbergt een fout in de aanroeper', () => {
  const klachten = [];
  const db = { data: {} };
  const op = require('../server/kern/betaalopdracht')({
    d: () => db.data, save: () => {}, crypto, nu: () => 1000,
    maxPogingen: 3, backoffMs: [100],
    log: { warn: (bericht, gegevens) => klachten.push({ bericht, gegevens }) },
    railInzenden: async () => ({ id: 'R1', status: 'ingepland' })
  });
  op.maak({ ...basis, idemSleutel: 'x' });
  op.maak({ ...basis, idemSleutel: 'x' });

  assert.equal(klachten.length, 1);
  assert.match(klachten[0].bericht, /twee keer aangeboden/);
  assert.equal(klachten[0].gegevens.idemSleutel, 'x');
  assert.ok(klachten[0].gegevens.bestaand, 'met de opdracht erbij die er al stond');
});

test('definitieve railbevestiging finaliseert de economic settlement precies een keer', async () => {
  const { op } = maak({ railStatus: 'ingepland' });
  const gezien = [];
  op.registreerAfwikkeling('sepa-uit', async o => { gezien.push(o.id); return { ok: true }; });
  const o = op.maak({ ...basis, economicIntentId: 'EI1', settlementId: 'ES1', claimId: 'CL1' });
  assert.equal(o.afwikkelingNodig, true);
  await op.dienIn(o);
  const r = await op.bevestig({ id: o.id, settlementRef: 'SEPA-1' });
  assert.deepEqual(gezien, [o.id]);
  assert.ok(r.afwikkelingVerwerktAt);
  assert.equal(r.economicIntentId, 'EI1');
  await op.bevestig({ id: o.id, settlementRef: 'SEPA-1' });
  assert.deepEqual(gezien, [o.id], 'een webhook-retry finaliseert niet dubbel');
});

test('een mislukte finalize-hook blijft zichtbaar en de ronde herstelt de crashnaad', async () => {
  const { op, klok } = maak({ railStatus: 'paid' });
  let pogingen = 0;
  op.registreerAfwikkeling('sepa-uit', async () => {
    pogingen++;
    return pogingen === 1 ? { error: 'runtime tijdelijk niet schrijfbaar' } : { ok: true };
  });
  const o = op.maak(basis);
  const eerste = await op.dienIn(o);
  assert.equal(eerste.status, 'AFGEWIKKELD', 'de externe waarheid blijft waar');
  assert.match(eerste.afwikkelFout, /niet schrijfbaar/);
  assert.equal(op.openstaand().zonderAfwikkeling, 1, 'maar intern onaf staat op het bord');
  klok.t += 1000;
  await op.ronde({ tot: klok.t });
  assert.equal(pogingen, 2);
  assert.ok(op.vind(o.id).afwikkelingVerwerktAt);
  assert.equal(op.openstaand().zonderAfwikkeling, 0);
});

test('twee rails kunnen niet dezelfde finalize-hook claimen', () => {
  const { op } = maak();
  op.registreerAfwikkeling('sepa-uit', async () => ({ ok: true }));
  assert.throws(() => op.registreerAfwikkeling('sepa-uit', async () => ({ ok: true })), /staat al een afwikkeling/);
  assert.throws(() => op.registreerAfwikkeling('x', 'geen functie'), /is een functie/);
});
