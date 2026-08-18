/* De idem-poort: hetzelfde verzoek twee keer sturen mag nooit twee keer werken.

   Deze toets draait op de middleware zelf, met een nagebootst verzoek/antwoord.
   Dat is met opzet: de poort is een regel over herhalingen en niet over een
   route, en zo is elke tak los aan te wijzen -- ook de takken die je met een
   echte server bijna niet kunt afdwingen (twee gelijktijdige verzoeken die
   elkaar in de vlucht tegenkomen, en het verlopen van een sleutel).

   Twee dingen worden hier bewust vastgelegd omdat ze makkelijk verloren gaan:

   1. Een MISLUKT antwoord wordt niet bewaard. Dat is de regel waarmee deze laag
      staat of valt -- zou hij een fout bewaren, dan krijgt de retry waar
      idem-sleutels juist voor bestaan een oude fout terug en probeert het nooit
      meer echt.

   2. `idem` in de BODY wordt met rust gelaten. Dat veld is van de applicatie:
      routes als /api/pakket/koop en /api/wbw/verreken gebruiken het zelf en
      geven bij een herhaling met opzet een ander antwoord. Zie de kop van
      server/lib/idem-poort.js. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');

const maakIdemPoort = require('../server/lib/idem-poort');

/* Een verzoek/antwoord-paar dat net genoeg van Express nabootst. Elk verzoek
   krijgt zijn EIGEN body-object, want zo werkt express.json ook. */
/* HET STANDAARDPAD IS BEWUST ONVERKLAARD.

   Stond hier eerst /api/concern/nieuw, en die staat inmiddels in
   idemsleutels.js als "zelfde verzoek is een herhaling". Daardoor sloegen drie
   toetsen die juist het GEDRAG ZONDER SLEUTEL vastleggen om -- ze kregen
   deduplicatie waar ze er geen verwachtten. Een onverklaard pad houdt die
   toetsen over hun eigen onderwerp; het verklaarde gedrag staat verderop apart. */
function nepReq({ methode = 'POST', pad = '/api/proef/onverklaard', body = {}, auth = 'Bearer lid-a', sleutel = null } = {}) {
  const koppen = { authorization: auth };
  if (sleutel) koppen['idempotency-key'] = sleutel;
  return {
    method: methode,
    path: pad,
    url: pad,
    ip: '10.0.0.1',
    body,
    get(n) { return koppen[String(n).toLowerCase()]; }
  };
}

function nepRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.verzonden = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (lijf) => { res.verzonden = lijf; res.emit('finish'); return res; };
  return res;
}

/* Draai een verzoek door de poort heen naar een route die telt hoe vaak hij
   echt is aangeroepen. `route` mag asynchroon zijn. */
function doe(poort, req, route) {
  const res = nepRes();
  return new Promise((klaar) => {
    const next = () => {
      Promise.resolve(route(req, res)).then(() => klaar({ res, doorgelaten: true }));
    };
    const uit = poort(req, res, next);
    // de poort antwoordde zelf (herhaling of 409): dan is next nooit geroepen
    if (uit && typeof uit.then === 'function') uit.then(() => klaar({ res, doorgelaten: false }));
    else if (res.verzonden !== null) klaar({ res, doorgelaten: false });
  });
}

test('zonder sleutel verandert er niets: elk verzoek doet gewoon het werk', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };

  const a = await doe(poort, nepReq({ body: { naam: 'RTG' } }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG' } }), route);

  assert.equal(keer, 2, 'zonder sleutel hoort de route twee keer te draaien');
  assert.equal(a.res.verzonden.id, 'concern-1');
  assert.equal(b.res.verzonden.id, 'concern-2');
  assert.ok(!b.res.verzonden.herhaald, 'zonder sleutel is er niets om te herhalen');
});

/* ---------------------------------------------------------------------------
   DE GRENS: DE BODY IS NIET VAN DEZE LAAG.

   Deze twee zijn niet verzonnen. De volledige suite ving met
   test/synergie.test.js en test/wbw.test.js dat een poort die `idem` uit de
   body pakt het eigen gedrag van die routes sloopt: /api/pakket/koop antwoordt
   bij een herhaling met opzet {alBetaald:true} in plaats van {betaald:...}, en
   /api/wbw/verreken met een 409. De poort legde daar het EERSTE antwoord
   overheen en maakte van "al betaald" weer "zojuist betaald".
   ------------------------------------------------------------------------- */

test('idem in de BODY laat de poort met rust -- dat veld is van de route', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => {
    keer++;
    if (keer === 1) return res.status(200).json({ ok: true, betaald: 25000 });
    res.status(200).json({ ok: true, alBetaald: true });
  };
  const lijf = () => ({ id: 'deal-1', idem: 'syn-koop-1' });

  const a = await doe(poort, nepReq({ body: lijf() }), route);
  const b = await doe(poort, nepReq({ body: lijf() }), route);

  assert.equal(a.res.verzonden.betaald, 25000);
  assert.equal(b.res.verzonden.alBetaald, true, 'de route mag zijn eigen tweede antwoord geven');
  assert.ok(!b.res.verzonden.herhaald, 'de poort hoort hier helemaal niet in te grijpen');
});

test('ook idempotentieSleutel in de body blijft van de route', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => {
    keer++;
    if (keer === 1) return res.status(200).json({ ok: true, verrekend: 5000 });
    res.status(409).json({ error: 'er is geen schuld meer' });
  };
  const lijf = () => ({ idempotentieSleutel: 'wbw-1' });

  await doe(poort, nepReq({ body: lijf() }), route);
  const b = await doe(poort, nepReq({ body: lijf() }), route);

  assert.equal(b.res.statusCode, 409, 'de 409 van de route mag niet door een bewaarde 200 worden vervangen');
});

/* ------------------------- de header, wel van ons ------------------------ */

test('dezelfde header-sleutel doet het werk EEN keer en herhaalt daarna', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };

  const a = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);

  assert.equal(keer, 1, 'de herhaling mag de route NIET opnieuw draaien');
  assert.equal(a.res.verzonden.id, 'concern-1');
  assert.equal(b.res.verzonden.id, 'concern-1', 'de herhaling geeft hetzelfde antwoord');
  assert.equal(b.res.verzonden.herhaald, true, 'en draagt het merk van de idem-laag');
  assert.ok(!a.res.verzonden.herhaald, 'het eerste antwoord is geen herhaling');
});

test('een verse sleutel doet het werk WEL opnieuw -- anders is het geen idempotentie maar een slot', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };

  await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  const c = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k2' }), route);

  assert.equal(keer, 2, 'een NIEUWE opdracht met een verse sleutel hoort gewoon te werken');
  assert.equal(c.res.verzonden.id, 'concern-2');
});

test('dezelfde sleutel met een ANDER verzoek is een 409 en geen stille herhaling', async () => {
  const poort = maakIdemPoort();
  const route = (req, res) => res.status(200).json({ ok: true, naam: req.body.naam });

  await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'IETS ANDERS' }, sleutel: 'k1' }), route);

  assert.equal(b.res.statusCode, 409);
  assert.match(b.res.verzonden.error, /al gebruikt voor een ander verzoek/);
  assert.notEqual(b.res.verzonden.naam, 'RTG', 'nooit stil het oude antwoord teruggeven');
});

test('vrije tekst is geen ander verzoek: een andere notitie mag geen 409 geven', async () => {
  const poort = maakIdemPoort();
  const route = (req, res) => res.status(200).json({ ok: true, id: 1 });

  await doe(poort, nepReq({ body: { naam: 'RTG', notitie: 'eerste poging' }, sleutel: 'k1' }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG', notitie: 'tweede poging' }, sleutel: 'k1' }), route);

  assert.equal(b.res.statusCode, 200);
  assert.equal(b.res.verzonden.herhaald, true);
});

test('een MISLUKT antwoord wordt niet bewaard: de retry mag het echt opnieuw doen', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => {
    keer++;
    if (keer === 1) return res.status(500).json({ error: 'even niet' });
    res.status(200).json({ ok: true, id: 'gelukt-bij-poging-' + keer });
  };

  const a = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);

  assert.equal(a.res.statusCode, 500);
  assert.equal(keer, 2, 'na een mislukking hoort de retry de route WEL te bereiken');
  assert.equal(b.res.verzonden.id, 'gelukt-bij-poging-2');
});

test('een 200 met ok:false telt als mislukking -- zelfde regel als de geldlaag', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => {
    keer++;
    if (keer === 1) return res.status(200).json({ ok: false, reden: 'saldo ontoereikend' });
    res.status(200).json({ ok: true, id: 2 });
  };

  await doe(poort, nepReq({ body: { bedrag: 5 }, sleutel: 'k1' }), route);
  await doe(poort, nepReq({ body: { bedrag: 5 }, sleutel: 'k1' }), route);

  assert.equal(keer, 2, 'ok:false in een 200 mag niet bewaard worden');
});

test('twee gelijktijdige dubbeltikken: de tweede wacht en doet het werk niet nog eens', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  let laatDoor;
  const traag = new Promise(r => { laatDoor = r; });
  const route = async (req, res) => {
    keer++;
    await traag;                                  // echte I/O: hier past een tweede verzoek doorheen
    res.status(200).json({ ok: true, id: 'concern-' + keer });
  };

  const a = doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  const b = doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  laatDoor();
  const [ra, rb] = await Promise.all([a, b]);

  assert.equal(keer, 1, 'de tweede tik mag de route niet ook draaien');
  assert.equal(ra.res.verzonden.id, 'concern-1');
  assert.equal(rb.res.verzonden.id, 'concern-1');
  assert.equal(rb.res.verzonden.herhaald, true);
});

test('de sleutel van iemand anders geeft NOOIT jouw antwoord', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, van: req.get('authorization') }); };

  const a = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'geraden', auth: 'Bearer lid-a' }), route);
  const b = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'geraden', auth: 'Bearer lid-b' }), route);

  assert.equal(keer, 2, 'dezelfde sleutel van een ander is een ander verzoek');
  assert.equal(a.res.verzonden.van, 'Bearer lid-a');
  assert.equal(b.res.verzonden.van, 'Bearer lid-b', 'lid-b mag het antwoord van lid-a niet zien');
  assert.ok(!b.res.verzonden.herhaald);
});

test('dezelfde sleutel op een ANDER pad is een ander verzoek', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, pad: req.path }); };

  await doe(poort, nepReq({ pad: '/api/concern/nieuw', sleutel: 'k1' }), route);
  const b = await doe(poort, nepReq({ pad: '/api/agenda/toevoegen', sleutel: 'k1' }), route);

  assert.equal(keer, 2);
  assert.equal(b.res.verzonden.pad, '/api/agenda/toevoegen');
});

test('GET blijft ongemoeid, ook met een sleutel erbij', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, keer }); };

  await doe(poort, nepReq({ methode: 'GET', sleutel: 'k1' }), route);
  await doe(poort, nepReq({ methode: 'GET', sleutel: 'k1' }), route);

  assert.equal(keer, 2, 'lezen is al idempotent en hoort niet gecachet te worden');
});

test('een verlopen sleutel doet het werk opnieuw', async () => {
  let t = 1000;
  const poort = maakIdemPoort({ nu: () => t, ttl: 60000 });
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: keer }); };

  await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  t += 59000;
  await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  assert.equal(keer, 1, 'binnen de termijn blijft het een herhaling');

  t += 2000; // nu voorbij de ttl
  const c = await doe(poort, nepReq({ body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  assert.equal(keer, 2, 'na het verlopen mag het werk weer echt gebeuren');
  assert.equal(c.res.verzonden.id, 2);
});

test('de ring loopt niet vol: oude sleutels vallen eruit', async () => {
  const poort = maakIdemPoort({ max: 5 });
  const route = (req, res) => res.status(200).json({ ok: true });

  for (let i = 0; i < 40; i++) {
    await doe(poort, nepReq({ body: { i }, sleutel: 'k' + i }), route);
  }
  assert.ok(poort.omvang() <= 5, 'de ring hoort begrensd te zijn, kreeg ' + poort.omvang());
});

test('een te lange sleutel telt niet als sleutel', () => {
  assert.equal(maakIdemPoort._sleutelVan(nepReq({ sleutel: 'x'.repeat(5000) })), null);
});

test('de afdruk negeert de sleutelvelden, maar niet de inhoud', () => {
  const a = maakIdemPoort._afdrukVan({ naam: 'RTG', idem: 'k1' });
  const b = maakIdemPoort._afdrukVan({ naam: 'RTG', idem: 'k2' });
  const c = maakIdemPoort._afdrukVan({ naam: 'ANDERS', idem: 'k1' });
  assert.equal(a, b, 'een ander sleutelveld is geen ander verzoek');
  assert.notEqual(a, c, 'een andere naam is WEL een ander verzoek');
});

/* ---------------------------------------------------------------------------
   DE VERKLAARDE SLEUTEL -- het dubbeltikvenster.

   Een route verklaart in server/lib/idemsleutels.js wat "hetzelfde verzoek"
   voor hem betekent. Daarmee is een dubbeltik afgevangen zonder dat de client
   iets stuurt en zonder dat de route een regel verandert.

   De laatste toets hieronder is het hele argument waarom dit een VERKLARING is
   en geen slimmigheid: generiek dedupliceren op inhoud zou een tweede
   dobbelworp opslikken, en dat valt niemand op.
   ------------------------------------------------------------------------- */

test('een VERKLAARDE route vangt de dubbeltik zonder dat de client iets stuurt', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: 'concern-' + keer }); };
  const lijf = () => ({ naam: 'RTG' });

  const a = await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: lijf() }), route);
  const b = await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: lijf() }), route);

  assert.equal(keer, 1, 'twee keer hetzelfde concern oprichten is een dubbeltik');
  assert.equal(b.res.verzonden.id, 'concern-1');
  assert.equal(b.res.verzonden.herhaald, true);
  assert.ok(!a.res.verzonden.herhaald);
});

test('een ANDER verzoek op diezelfde route is gewoon een tweede handeling', async () => {
  const poort = maakIdemPoort();
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: keer }); };

  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: { naam: 'Eerste' } }), route);
  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: { naam: 'Tweede' } }), route);

  assert.equal(keer, 2, 'twee verschillende concerns zijn twee concerns');
});

test('het venster is kort: na afloop is het een echte tweede handeling', async () => {
  let t = 1000;
  const poort = maakIdemPoort({ nu: () => t });
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: keer }); };
  const lijf = () => ({ naam: 'RTG' });

  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: lijf() }), route);
  t += 4000;                       // binnen het dubbeltikvenster
  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: lijf() }), route);
  assert.equal(keer, 1, 'binnen vijf seconden is het een dubbeltik');

  t += 4000;                       // erbuiten
  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: lijf() }), route);
  assert.equal(keer, 2, 'daarna wil iemand er echt een tweede');
});

test('een header-sleutel houdt zijn LANGE venster, ook op een verklaarde route', async () => {
  let t = 1000;
  const poort = maakIdemPoort({ nu: () => t });
  let keer = 0;
  const route = (req, res) => { keer++; res.status(200).json({ ok: true, id: keer }); };

  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: { naam: 'RTG' }, sleutel: 'k1' }), route);
  t += 60 * 60000;                 // een uur later: ver buiten het dubbeltikvenster
  await doe(poort, nepReq({ pad: '/api/concern/nieuw', body: { naam: 'RTG' }, sleutel: 'k1' }), route);

  assert.equal(keer, 1, 'een bewuste sleutel is een opdracht en geen dubbeltik');
});

/* HET ARGUMENT WAAROM DIT EEN VERKLARING IS EN GEEN SLIMMIGHEID. */
test('een route die NIET idempotent is verklaard, wordt met rust gelaten', async () => {
  const poort = maakIdemPoort();
  let worpen = 0;
  const dobbel = (req, res) => { worpen++; res.status(200).json({ ok: true, worp: worpen }); };

  // twee keer {} naar dezelfde route, direct achter elkaar
  await doe(poort, nepReq({ pad: '/api/command/sonde/draai', body: {} }), dobbel);
  const b = await doe(poort, nepReq({ pad: '/api/command/sonde/draai', body: {} }), dobbel);

  assert.equal(worpen, 2,
    'twee keer dezelfde meethandeling zijn TWEE metingen; generiek dedupliceren zou de tweede opslikken');
  assert.equal(b.res.verzonden.worp, 2);
});

test('elke nietIdempotent-verklaring draagt een reden', () => {
  const { SLEUTELS } = require('../server/lib/idemsleutels');
  for (const [sleutel, v] of Object.entries(SLEUTELS)) {
    if (!v.nietIdempotent) continue;
    assert.ok(v.waarom && v.waarom.length > 20,
      sleutel + ' zegt "niet idempotent" zonder reden -- dan is het een ontsnapping en geen verklaring');
  }
});
