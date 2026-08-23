/* Test voor de eigen in-memory fout-aggregatie in server/log.js. Storingen
   worden gegroepeerd op een vingerafdruk (bericht met cijfers weggenormaliseerd
   + plaats), met een teller; foutenSamenvatting() geeft de recentste bovenaan;
   foutenReset() zet alles terug. Dit verving een externe tracker (Sentry). */
const { test } = require('node:test');
const assert = require('node:assert');
const { log } = require('../server/log');

// De error-log naar stderr even dempen tijdens deze test (scheelt ruis).
function stil(fn) {
  const echt = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;
  try { return fn(); } finally { process.stderr.write = echt; }
}

// Fouten die vanaf dezelfde plek ontstaan (zelfde stackframe): zo groepeert
// het net als in productie, waar dezelfde route-regel de fout gooit.
function boem(msg) { return new Error(msg); }

test('gelijksoortige storingen vallen samen tot een groep met een teller', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering(boem('order 123 mislukt'), { p: '/api/order' });
    log.uitzondering(boem('order 456 mislukt'), { p: '/api/order' });
    log.uitzondering(boem('vertaling stuk'), { p: '/api/ai' });
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.totaal, 3, 'drie storingen in totaal');
  assert.strictEqual(s.distinct, 2, 'twee soorten (order-# en vertaling)');
  const order = s.recent.find(g => g.aantal === 2);
  assert.ok(order, 'de order-groep bestaat');
  assert.match(order.bericht, /order/, 'het is inderdaad de order-fout');
  assert.strictEqual(order.aantal, 2, 'de twee order-fouten met verschillende id vallen samen');
});

test('de recentste groep staat bovenaan', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering(new Error('eerste soort'), {});
    log.uitzondering(new Error('tweede soort'), {});
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.recent[0].bericht, 'tweede soort', 'laatst gezien = bovenaan');
});

test('een string-fout (geen Error) crasht de aggregatie niet', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering('kapot zonder Error-object', { bron: 'test' });
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.totaal, 1);
  assert.strictEqual(s.recent[0].bericht, 'kapot zonder Error-object');
});

/* HET RESETCONTRACT: reset(gemuteerd) is gelijk aan vers.

   Fase C van de verificatie-runtime. De toets hieronder bewees reset-naar-nul
   met EEN storing, en dat is te weinig om een server op te durven hergebruiken.
   Wat je daarvoor nodig hebt is de sterkere eigenschap: welke toestand je er ook
   in duwt, na een reset is de waarneembare stand gelijk aan die van een verse
   start. Anders lekt de ene toets in de volgende, en dat geeft geen fout maar
   een verkeerd antwoord.

   Hier wordt de ring bewust VOL geduwd (RING is 60) en er overheen, met
   verschillende vingerafdrukken en verschillende aantallen, plus een storing
   zonder plaats en een met een lege boodschap. Dat raakt de verdringing, de
   groepering en de volgteller alle drie. Daarna moet alles weer zijn zoals bij
   de start.

   Deze drie wortels staan daarom in STATE.json als `herstelbaar`, met deze
   toets als bewijs. Zonder zo'n proef zouden ze `onbekend` blijven en dus als
   procesgebonden tellen -- en dan kost elke toets een eigen server. */
test('resetcontract: welke storingen er ook in gingen, na reset is de stand die van een verse start', () => {
  const vers = (() => { stil(() => log.foutenReset()); return log.foutenSamenvatting(); })();
  assert.deepEqual(vers, { totaal: 0, distinct: 0, recent: [] },
    'een verse stand is leeg; is dat niet zo, dan zegt de vergelijking hieronder niets');

  stil(() => {
    for (let i = 0; i < 90; i++) log.uitzondering(boem('soort ' + i + ' stuk'), { p: '/api/x' + i });
    for (let i = 0; i < 5; i++) log.uitzondering(boem('herhaling'), { p: '/api/zelfde' });
    log.uitzondering(boem(''), {});
    log.uitzondering(boem('zonder plaats'), undefined);
  });
  const vol = log.foutenSamenvatting();
  assert.ok(vol.totaal >= 97, 'de mutatie moet echt iets doen, anders bewijst de reset niets: ' + vol.totaal);
  assert.ok(vol.distinct > 1 && vol.distinct <= 60, 'de ring hoort begrensd te zijn op 60: ' + vol.distinct);

  stil(() => log.foutenReset());
  assert.deepEqual(log.foutenSamenvatting(), vers,
    'na reset hoort de stand exact gelijk te zijn aan die van een verse start');

  /* En de volgteller mag ook niet doorlopen: die ordent "recentst geraakt", dus
     een teller die na reset verder telt geeft een volgende toets een andere
     volgorde dan een verse start zou geven. Dat is precies het soort verschil
     dat je nooit ziet tot het een keer uitmaakt. */
  stil(() => log.uitzondering(boem('na de reset'), { p: '/api/na' }));
  const na = log.foutenSamenvatting();
  stil(() => { log.foutenReset(); log.uitzondering(boem('na de reset'), { p: '/api/na' }); });
  assert.deepEqual(log.foutenSamenvatting(), na,
    'dezelfde storing na een reset hoort dezelfde samenvatting te geven als na een verse start');
  stil(() => log.foutenReset());
});

/* De vierde wortel van dit bestand: de haak naar een externe tracker. Die zit
   niet in foutenReset() -- terecht, want hem stilletjes losmaken zou in
   productie de alarmering uitzetten. Hij heeft dus zijn EIGEN reset, en die
   moet net zo goed bewezen zijn. */
test('resetcontract: onError(null) maakt de foutenhaak weer los', () => {
  const gezien = [];
  log.onError((err) => gezien.push(err && err.message));
  stil(() => log.uitzondering(boem('met haak'), {}));
  assert.deepEqual(gezien, ['met haak'], 'de haak hoort te vuren, anders toetst de regel hieronder niets');

  log.onError(null);
  stil(() => log.uitzondering(boem('zonder haak'), {}));
  assert.deepEqual(gezien, ['met haak'], 'na onError(null) hoort er niets meer bij te komen');
  stil(() => log.foutenReset());
});

test('foutenReset() zet alles terug op nul', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering(new Error('iets'), {});
    log.foutenReset();
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.totaal, 0);
  assert.strictEqual(s.distinct, 0);
  assert.strictEqual(s.recent.length, 0);
});
