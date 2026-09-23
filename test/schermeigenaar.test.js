/* EEN EIGENAAR PER FUNCTIE -- SCHERMEIGENAAR.json tegen een verse meting.

   De consolidatieronde van 23 september 2026 begon met een vraag die een
   bestandsvergelijking niet kon beantwoorden: doen twee schermen hetzelfde
   werk? Geen enkel scherm was byte voor byte gelijk aan een ander, en toch
   bestonden er twee dagproducten (vandaag.html met verzonnen momenten naast
   life.html), een tweede avond-samensteller in leven.js, een tweede beslisweg
   in RTG One naast Decision Room, en twee menu-items die "Vandaag" heetten.

   Deze toets maakt van de uitkomst een regel die kan zakken:

     1. elk scherm staat in het register, met een capability en een rol;
     2. elke capability heeft precies EEN eigenaar;
     3. een scherm dat een capability van een ander opnieuw bouwt
        (rol tweede-ingang) staat in een open oordeel met een vervolg;
     4. elk paar schermen dat de meting (scripts/schermfunctie.js) op dezelfde
        API-paden vindt, heeft een oordeel -- een nieuwe dubbeling wacht dus
        niet tot iemand hem opmerkt;
     5. een alias is een doorverwijzing en geen product: het menu en geen
        enkele klikbare link binnen het huis wijst ernaar;
     6. binnen een wereld draagt geen menu-item de naam van een ander.

   De meting is vers (meet()), niet het ingecheckte SCHERMFUNCTIE.json: een
   register dat tegen een oud bestand wordt gehouden, is een bewering over het
   verleden (MENSNETWERK.md).

   Draai los: node --test test/schermeigenaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REG = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SCHERMEIGENAAR.json'), 'utf8'));
const { meet } = require('../scripts/schermfunctie');
const METING = meet();
const kort = b => b.replace(/^public\//, '');
const paar = (a, b) => [kort(a), kort(b)].sort().join(' + ');

test('elk scherm staat in het register, en het register noemt geen scherm dat er niet is', () => {
  const gemeten = METING.perScherm.map(s => kort(s.bestand)).sort();
  const geregistreerd = Object.keys(REG.schermen).sort();
  assert.deepEqual(geregistreerd.filter(s => !gemeten.includes(s)), [], 'het register noemt een scherm dat niet bestaat');
  assert.deepEqual(gemeten.filter(s => !geregistreerd.includes(s)), [],
    'een scherm zonder capability en rol: zet het in SCHERMEIGENAAR.json, en is het een tweede ingang naar iets dat al bestaat, geef het een oordeel');
});

test('een alias is een doorverwijzing, en het register weet waarheen', () => {
  for (const s of METING.perScherm) {
    const r = REG.schermen[kort(s.bestand)];
    if (s.soort === 'alias') {
      assert.equal(r.rol, 'alias', kort(s.bestand) + ' stuurt door en is dus geen productscherm');
      assert.equal(r.naar, s.aliasNaar, kort(s.bestand) + ': het register kent een andere bestemming dan het bestand');
      const doel = path.join(WORTEL, 'public', s.aliasNaar.split(/[?#]/)[0]);
      assert.ok(fs.existsSync(doel), kort(s.bestand) + ' stuurt door naar een scherm dat niet bestaat');
      assert.notEqual(REG.schermen[kort('public' + s.aliasNaar.split(/[?#]/)[0])].rol, 'alias',
        kort(s.bestand) + ' stuurt door naar een andere doorverwijzing');
    } else {
      assert.notEqual(r.rol, 'alias', kort(s.bestand) + ' staat als alias in het register maar stuurt niet door');
    }
  }
});

test('elke capability heeft precies een eigenaar, en die eigenaar draagt haar', () => {
  const eigenaarVan = REG.capabilities;
  for (const [scherm, r] of Object.entries(REG.schermen)) {
    if (r.rol === 'alias') continue;
    assert.ok(r.capability, scherm + ' heeft geen capability');
    assert.ok(Object.keys(REG.rollen).includes(r.rol), scherm + ': onbekende rol ' + r.rol);
    assert.ok(eigenaarVan[r.capability], scherm + ': capability ' + r.capability + ' heeft geen eigenaar');
    if (r.rol === 'eigenaar') {
      assert.equal(eigenaarVan[r.capability], scherm,
        r.capability + ' heeft twee eigenaren: ' + eigenaarVan[r.capability] + ' en ' + scherm +
        '. Kies er een; de ander toont of opent de capability, of krijgt een oordeel.');
    } else {
      assert.notEqual(eigenaarVan[r.capability], scherm, scherm + ' is eigenaar maar staat als ' + r.rol);
    }
  }
  for (const [cap, eigenaar] of Object.entries(eigenaarVan)) {
    const r = REG.schermen[eigenaar];
    assert.ok(r && r.rol === 'eigenaar' && r.capability === cap, cap + ': de eigenaar ' + eigenaar + ' draagt deze capability niet als eigenaar');
  }
});

/* DE RATEL. Tien oordelen stonden open op 23 september 2026; de toegangsschermen
   (toestemming, mijn-relaties, rtgid) zijn dezelfde dag samengevoegd, dus negen:
   de gezinsagenda, rit naast ov, Pulse naast De Salon, twee sociale overzichten,
   Commerce naast de Mall, en vier gedeelde componenten. Dat getal mag alleen
   OMLAAG: een open punt sluiten verlaagt OPEN_MAX met de hand, een nieuw open
   punt erbij laat deze toets zakken tot iemand het besluit neemt om hem te
   verhogen -- met de reden in de historie. */
const OPEN_MAX = 9;

test('het aantal open oordelen stijgt niet (OPEN_MAX mag alleen omlaag)', () => {
  const open = REG.oordelen.filter(o => o.stand === 'open').length;
  assert.ok(open <= OPEN_MAX, open + ' open oordelen, de ratel staat op ' + OPEN_MAX + ': los een punt op in plaats van er een bij te zetten');
  assert.ok(open >= OPEN_MAX, 'er staan er nog maar ' + open + ' open: zet OPEN_MAX op ' + open + ', anders kan er ongemerkt een bij');
});

test('elk oordeel is een van de vijf klassen (of geen-dubbel met reden), en open betekent: er staat een vervolg', () => {
  for (const o of REG.oordelen) {
    const naam = o.schermen.join(' + ');
    assert.ok(Object.keys(REG.klassen).includes(o.klasse), naam + ': onbekende klasse ' + o.klasse);
    assert.ok(Object.keys(REG.standen).includes(o.stand), naam + ': onbekende stand ' + o.stand);
    assert.ok(o.reden && o.reden.length > 20, naam + ': een oordeel zonder reden is een mening');
    for (const s of o.schermen) assert.ok(REG.schermen[s], naam + ': ' + s + ' bestaat niet');
    if (o.eigenaar) assert.ok(REG.schermen[o.eigenaar], naam + ': eigenaar ' + o.eigenaar + ' bestaat niet');
    if (o.stand === 'open') assert.ok(o.vervolg, naam + ': open zonder vervolg is een vergeten punt');
    /* Een echte dubbeling mag niet "blijven": hij is opgelost of hij staat open. */
    if (['exact-dubbel', 'functioneel-dubbel'].includes(o.klasse)) {
      assert.notEqual(o.stand, 'blijft', naam + ': een ' + o.klasse + ' kan niet blijven bestaan');
    }
  }
});

test('een tweede eigen implementatie staat altijd in een open oordeel, en een schil in een zelfde-component', () => {
  for (const [scherm, r] of Object.entries(REG.schermen)) {
    if (r.rol === 'tweede-ingang') {
      assert.ok(REG.oordelen.some(o => o.stand === 'open' && o.schermen.includes(scherm) && o.schermen.includes(REG.capabilities[r.capability])),
        scherm + ' bouwt ' + r.capability + ' opnieuw naast ' + REG.capabilities[r.capability] + ' en staat in geen open oordeel');
    }
    if (r.rol === 'schil') {
      assert.ok(REG.oordelen.some(o => o.klasse === 'zelfde-component' && o.schermen.includes(scherm)),
        scherm + ' heet een schil op dezelfde implementatie, maar geen oordeel zegt welke');
    }
  }
});

test('elk paar schermen op dezelfde API-paden heeft een oordeel (verse meting)', () => {
  /* De MUTATIE: laat een nieuw scherm dezelfde routes aanroepen als een
     bestaand scherm (of verwijder een oordeel hieronder) -- deze toets zakt dan
     met het paar erbij. */
  const beoordeeld = new Set();
  for (const o of REG.oordelen) {
    for (let i = 0; i < o.schermen.length; i++) {
      for (let j = i + 1; j < o.schermen.length; j++) beoordeeld.add(paar(o.schermen[i], o.schermen[j]));
    }
  }
  assert.ok(METING.overlap.length > 0, 'de meting vond geen enkel overlappaar; dan is de meter blind en niet het huis schoon');
  const zonder = METING.overlap.filter(o => !beoordeeld.has(paar(o.a, o.b)))
    .map(o => paar(o.a, o.b) + ' (' + o.gedeeld + ' gedeelde paden, o.a. ' + o.voorbeeld.slice(0, 3).join(' ') + ')');
  assert.deepEqual(zonder, [], 'deze schermen raken dezelfde data en hebben geen oordeel in SCHERMEIGENAAR.json');
  for (const t of METING.titelbotsing) {
    const s = t.schermen.map(kort);
    assert.ok(beoordeeld.has(paar(s[0], s[1])), 'twee schermen heten "' + t.titel + '" en er staat geen oordeel: ' + s.join(', '));
  }
});

test('het menu wijst naar geen enkele doorverwijzing', () => {
  assert.deepEqual(METING.menuOpAlias, [],
    'een menu-ingang op een alias stuurt elke tik langs een omweg en houdt de alias in leven');
});

test('binnen het huis wijst geen klikbare link naar een doorverwijzing', () => {
  /* Een alias blijft voor wat van BUITEN komt (bladwijzers, geinstalleerde
     iconen). Binnen het huis hoort een link naar de bestemming te gaan. */
  const aliassen = METING.perScherm.filter(s => s.soort === 'alias').map(s => s.url);
  const patroon = new RegExp('(?:href=["\']|url: *[\'"]|data-link=["\']|location\\.href *= *[\'"])(' +
    aliassen.map(u => u.replace(/[.]/g, '\\.')).join('|') + ')(?=["\'?#])', 'g');
  const treffers = [];
  const loop = map => {
    for (const d of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, d.name);
      if (d.isDirectory()) { if (d.name !== 'dist') loop(p); continue; }
      if (!/\.(html|js|json)$/.test(d.name)) continue;
      const rel = path.relative(WORTEL, p).split(path.sep).join('/');
      if (aliassen.includes('/' + rel.replace(/^public\//, ''))) continue;
      const tekst = fs.readFileSync(p, 'utf8');
      for (const m of tekst.matchAll(patroon)) treffers.push(rel + ' -> ' + m[1]);
    }
  };
  loop(path.join(WORTEL, 'public'));
  assert.deepEqual(treffers, [], 'laat deze links naar de bestemming van de alias wijzen');
});

test('binnen een wereld draagt geen menu-item de naam van een ander', () => {
  /* Zo stond er twee keer "Vandaag" in LivingOS (Life en Pulse), twee keer
     "Betalen" (de app-stand en RTG Pay) en "Ontdekken" naast Foundation Connect. */
  const md = fs.readFileSync(path.join(WORTEL, 'WERELDLIJST.md'), 'utf8');
  let wereld = null;
  const gezien = new Map();
  const dubbel = [];
  for (const regel of md.split('\n')) {
    const kop = regel.match(/^## (\S+)/);
    if (kop) { wereld = kop[1]; continue; }
    const rij = regel.match(/^\| ([^|]+) \| `(link|tab|os):/);
    if (!rij || !wereld) continue;
    const sleutel = rij[1].trim().toLowerCase();
    if (gezien.has(sleutel)) dubbel.push(rij[1].trim() + ' (' + gezien.get(sleutel) + ' en ' + wereld + ')');
    else gezien.set(sleutel, wereld);
  }
  assert.ok(gezien.size > 50, 'de wereldlijst is niet gelezen');
  assert.deepEqual(dubbel, [], 'twee menu-items met dezelfde naam: een lid weet niet welke hij opent');
});

test('Dag heeft een eigenaar en Vandaag is geen tweede dagproduct meer', () => {
  assert.equal(REG.capabilities['dag.overzicht'], 'apps/life.html');
  assert.deepEqual(REG.schermen['apps/vandaag.html'], { rol: 'alias', naar: '/apps/life.html' });
  const life = fs.readFileSync(path.join(WORTEL, 'public/apps/life.html'), 'utf8');
  for (const weg of ['/apps/agenda.html', '/apps/mijnmall.html', '/apps/leven.html']) {
    assert.ok(life.includes('href="' + weg + '"'), 'de ingang ' + weg + ' uit Vandaag staat in Life');
  }
});
