/* ============================================================================
   HET REGRESSIECORPUS VAN DE RISICOPROPAGATIE.

   WAAROM DIT BESTAND ZWAAR WEEGT. scripts/lib/risico.js gaat straks bepalen
   welke bewijzen NIET opnieuw hoeven draaien. Elke fout hierin is dus geen
   zakkende toets maar een toets die ONTERECHT wordt overgeslagen -- en die
   verdwijnt zonder geluid. Vandaar per gedragsregel een voorbeeld, inclusief de
   drie regels die het makkelijkst per ongeluk sneuvelen: de onopgeloste rand die
   ALTIJD meetelt, de twijfel die zich voortplant, en het onbekende pad dat de
   hele uitkomst onbetrouwbaar maakt.

   WAAROM EEN NEPINDEX EN GEEN ECHTE MAP. De vraag hier is niet "lost deze
   require op" -- dat is het werk van lib/werkelijkheid.js en dat wordt in
   test/bedrading.test.js met echte bestanden op schijf beproefd. Hier gaat het
   uitsluitend om de propagatie: gegeven deze graaf, wie is geraakt en hoe zeker.
   Een verzonnen graaf laat die vraag scherper stellen dan een echte.
   De laatste toets doet wel een echte meting, tegen de echte boom.

   DE MUTATIE VOOR DIT BESTAND: haal in risico.js de regel weg die de
   onopgeloste rand toevoegt -> "de onopgeloste rand telt altijd mee" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { raak, klasseVan, onopgelosteRand } = require('../scripts/lib/risico');
const { index, gebiedVan } = require('../scripts/lib/werkelijkheid');

/* Een index in de kleinste vorm die `raak` echt gebruikt. Kanten worden als
   "wie laadt wie in" opgegeven, precies zoals ze in de code staan. */
function nep(spec) {
  const bestanden = new Map();
  const omgekeerd = new Map();
  for (const [pad, k] of Object.entries(spec)) {
    const kanten = { opgelost: k.laadt || [], benaderd: k.benaderd || [], onbekend: k.onbekend || [] };
    bestanden.set(pad, { pad, kanten, gebied: gebiedVan(pad) });
    for (const d of kanten.opgelost) {
      if (!omgekeerd.has(d)) omgekeerd.set(d, []);
      omgekeerd.get(d).push(pad);
    }
    for (const b of kanten.benaderd) for (const d of b.kandidaten) {
      if (!omgekeerd.has(d)) omgekeerd.set(d, []);
      omgekeerd.get(d).push(pad);
    }
  }
  return { bestanden, omgekeerd, gebiedVan };
}

const KETEN = nep({
  'server/kern/diep.js': {},
  'server/kern/midden.js': { laadt: ['server/kern/diep.js'] },
  'server/routes/boven.js': { laadt: ['server/kern/midden.js'] },
  'server/kern/los.js': {}
});

test('een wijziging plant zich transitief voort, met de afstand erbij', () => {
  const r = raak(KETEN, ['server/kern/diep.js']);
  assert.equal(r.geraakt.get('server/kern/diep.js').afstand, 0);
  assert.equal(r.geraakt.get('server/kern/midden.js').afstand, 1);
  assert.equal(r.geraakt.get('server/routes/boven.js').afstand, 2,
    'twee stappen omhoog, en niet blijven steken bij de directe inlader');
  assert.ok(!r.geraakt.has('server/kern/los.js'), 'wie er niet bij hoort, hoort er niet bij');
});

test('een BENADERDE kant maakt de treffer mogelijk in plaats van zeker', () => {
  const ix = nep({
    'server/kern/a.js': {},
    'server/kern/lader.js': { benaderd: [{ kandidaten: ['server/kern/a.js', 'server/kern/b.js'] }] }
  });
  const r = raak(ix, ['server/kern/a.js']);
  assert.equal(r.geraakt.get('server/kern/lader.js').via, 'mogelijk');
  assert.match(r.geraakt.get('server/kern/lader.js').reden, /mogelijk/);
  assert.equal(r.telling.mogelijk, 1);
});

test('twijfel plant zich voort: alles achter een benaderde kant is ook maar mogelijk', () => {
  /* Zonder deze regel is een keten "zeker, mogelijk, zeker" -- en dat laatste
     zeker is een leugen, want de hele keten hangt aan die ene aanname. */
  const ix = nep({
    'server/kern/a.js': {},
    'server/kern/lader.js': { benaderd: [{ kandidaten: ['server/kern/a.js'] }] },
    'server/routes/top.js': { laadt: ['server/kern/lader.js'] }
  });
  const r = raak(ix, ['server/kern/a.js']);
  assert.equal(r.geraakt.get('server/routes/top.js').via, 'mogelijk');
});

test('een tweede, zekere weg maakt van mogelijk weer zeker -- en nooit andersom', () => {
  /* De volgorde van de rij mag het antwoord niet bepalen. Dit is de fout die
     een breedte-eerst-loop zonder deze regel altijd maakt. */
  const ix = nep({
    'server/kern/a.js': {},
    'server/kern/twee.js': {
      benaderd: [{ kandidaten: ['server/kern/a.js'] }],
      laadt: ['server/kern/a.js']
    }
  });
  const r = raak(ix, ['server/kern/a.js']);
  assert.equal(r.geraakt.get('server/kern/twee.js').via, 'zeker');
});

test('een ruit: twee wegen omhoog, en de zekere wint ook als de twijfel er eerst was', () => {
  /* DE MUTATIE DIE MIJN EERSTE VERSIE VAN DEZE TOETS NIET ZAG. Bij een DIRECTE
     inlader is de opwaardering niet nodig -- daar weet de kantenvergelijking al
     dat er een bewezen weg naast ligt. Twee stappen hoger wel: `top.js` wordt
     eerst bereikt via de onzekere tak en pas daarna via de zekere, en dan bepaalt
     de toevallige volgorde van de rij het antwoord. Zonder opwaardering staat
     `top.js` op "mogelijk" terwijl er een keten van uitsluitend opgeloste kanten
     naartoe loopt -- en dat is een schuld die niemand hoeft te dragen. */
  const ix = nep({
    'server/kern/a.js': {},
    'server/kern/via-mss.js': { benaderd: [{ kandidaten: ['server/kern/a.js'] }] },
    'server/kern/via-zeker.js': { laadt: ['server/kern/a.js'] },
    'server/routes/top.js': { laadt: ['server/kern/via-mss.js', 'server/kern/via-zeker.js'] }
  });
  const r = raak(ix, ['server/kern/a.js']);
  assert.equal(r.geraakt.get('server/kern/via-mss.js').via, 'mogelijk');
  assert.equal(r.geraakt.get('server/kern/via-zeker.js').via, 'zeker');
  assert.equal(r.geraakt.get('server/routes/top.js').via, 'zeker',
    'er loopt een bewezen weg naartoe, dus hij is bewezen geraakt');
});

test('de onopgeloste rand telt ALTIJD mee, ook bij een wijziging die niets ermee te maken heeft', () => {
  /* DE GRONDWET, TWEEDE ZIN. Een bestand met een require die pas op runtime
     bekend is, kan niet bewijzen wat hij NIET inlaadt. Dus hij is geraakt. */
  const ix = nep({
    'server/kern/hoek.js': {},
    'server/kern/mapper.js': { onbekend: [{ lijn: 12, vorm: 'kale variabele', reden: 'pad uit een variabele' }] }
  });
  const r = raak(ix, ['server/kern/hoek.js']);
  assert.ok(r.geraakt.has('server/kern/mapper.js'), 'de rand hoort erbij');
  assert.equal(r.geraakt.get('server/kern/mapper.js').via, 'onopgelost');
  assert.equal(r.telling.onopgelost, 1);
  assert.match(r.geraakt.get('server/kern/mapper.js').reden, /kan niet bewijzen/);
});

test('de drie zekerheden worden APART geteld en niet weggemiddeld', () => {
  const ix = nep({
    'server/kern/a.js': {},
    'server/kern/zeker.js': { laadt: ['server/kern/a.js'] },
    'server/kern/mss.js': { benaderd: [{ kandidaten: ['server/kern/a.js'] }] },
    'server/kern/rand.js': { onbekend: [{ lijn: 3, vorm: 'kale variabele', reden: 'x' }] }
  });
  const r = raak(ix, ['server/kern/a.js']);
  assert.deepEqual(r.telling, { zeker: 2, mogelijk: 1, onopgelost: 1 },
    'a.js zelf en zijn zekere inlader; een mogelijke; een rand');
});

test('een gewijzigd pad buiten de index maakt de uitkomst ONVOLLEDIG, en de klasse hard', () => {
  /* De eerste versie sloeg zo'n pad stil over. De verzameling zag er dan klein
     en gezond uit terwijl er iets buiten beeld was veranderd -- precies de
     versmalling die dit hele bouwwerk verbiedt. */
  const r = raak(KETEN, ['server/routes/verwijderd.js']);
  assert.equal(r.volledig, false);
  assert.equal(r.onvolledig.length, 1);
  const k = klasseVan(r, 'cosmetic');
  assert.equal(k.betrouwbaar, false);
  assert.equal(k.klasse, 'security', 'wat je niet kunt plaatsen, behandel je als het zwaarste');
});

test('de graaf wint van de vorm: binnenwerk in een beveiligingspad is beveiliging', () => {
  const ix = nep({
    'server/rem.js': {},
    'server/middleware/poort.js': { laadt: ['server/rem.js'] }
  });
  const r = raak(ix, ['server/rem.js']);
  assert.equal(r.gebied, 'security');
  assert.equal(klasseVan(r, 'implementation').klasse, 'security',
    'de inlogrem verloor twee regels en de diff noemde dat binnenwerk');
});

test('het zwaarste BEREIKTE gebied telt, niet dat van het gewijzigde bestand zelf', () => {
  const ix = nep({
    'server/kern/hulp.js': {},
    'server/kern/pay/boeking.js': { laadt: ['server/kern/hulp.js'] }
  });
  const r = raak(ix, ['server/kern/hulp.js']);
  assert.equal(gebiedVan('server/kern/hulp.js'), 'algemeen', 'op zichzelf onschuldig');
  assert.equal(r.gebied, 'money', 'maar er hangt een geldpad aan');
});

test('cosmetisch blijft cosmetisch, ook midden in de beveiligingslaag', () => {
  /* De enige plek waar de graaf verliest, en hij verliest hier terecht: een
     witregel of een commentaarregel verandert niets aan wat de machine doet.
     Zonder deze uitzondering draait elke documentatieronde de zwaarste toetsen. */
  const ix = nep({ 'server/rem.js': {}, 'server/middleware/poort.js': { laadt: ['server/rem.js'] } });
  const r = raak(ix, ['server/rem.js']);
  assert.equal(klasseVan(r, 'cosmetic').klasse, 'cosmetic');
});

test('maxDiepte begrenst de wandeling, maar dat is informatie en geen vrijbrief', () => {
  const r = raak(KETEN, ['server/kern/diep.js'], { maxDiepte: 1 });
  assert.ok(r.geraakt.has('server/kern/midden.js'));
  assert.ok(!r.geraakt.has('server/routes/boven.js'), 'de wandeling stopt echt');
});

test('de echte boom: de onopgeloste rand heeft een naam, en de propagatie doet iets', () => {
  /* DE METING ZELF. Zonder dit kan deze motor stilletjes veranderen in iets dat
     altijd een lege verzameling teruggeeft -- en dat is de gevaarlijkste vorm
     van kapot die deze laag kent, want dan wordt ALLES overgeslagen. */
  const ix = index(['server']);
  const rand = onopgelosteRand(ix);
  assert.ok(rand.size >= 1, 'de rand is bekend en bij naam');
  for (const [pad, waarom] of rand) {
    assert.ok(ix.bestanden.has(pad) && /regel \d+/.test(waarom),
      'elke rand draagt zijn plek: ' + pad + ' -- ' + waarom);
  }

  const r = raak(ix, ['server/rem.js']);
  assert.ok(r.geraakt.size > 5, 'de inlogrem raakt echt iets (' + r.geraakt.size + ')');
  assert.equal(r.gebied, 'security');
  assert.equal(r.volledig, true);
  assert.equal(r.telling.onopgelost, rand.size, 'de rand zit er voluit in');
  assert.ok([...r.geraakt.values()].some((s) => s.afstand > 1),
    'en de wandeling gaat verder dan de directe inladers');
});
