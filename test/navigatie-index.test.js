/* DE GEBIEDSINDEX: wat er van de bron overblijft, en wat er wordt geweigerd.

   scripts/navigatie-index.js is met opzet in twee helften geschreven. Deze
   toets beproeft de helft die te beproeven is -- het ONTLEDEN -- en zegt
   hardop dat de andere helft dat niet is: de uitgaande proxy van deze omgeving
   weigert download.geofabrik.de met een 403 op de CONNECT, dus er is hier nog
   nooit een echte bronindex binnengekomen. Een toets die het ophalen nabouwt
   met een eigen server bewijst dat de eigen server werkt.

   De invoer staat in test/navigatie-index-fixture.js, met per rij waarom hij
   erin zit. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const idx = require('../scripts/navigatie-index.js');
const fixture = require('./navigatie-index-fixture.js');

const perCode = (uit) => new Map(uit.gebieden.map(g => [g.code, g]));
const weigering = (uit, id) => uit.geweigerd.find(w => w.id === id);

/* --------------------------------------------------------------------------
   1. DE VERTALING VAN EEN BRON-ID NAAR EEN BESTANDSNAAM.
   -------------------------------------------------------------------------- */

test('een bron-id wordt een veilige code: schuine strepen worden koppeltekens', () => {
  assert.equal(idx.codeUitId('europe/netherlands'), 'europe-netherlands');
  assert.equal(idx.codeUitId('europe/netherlands/noord-holland'), 'europe-netherlands-noord-holland');
  assert.equal(idx.codeUitId('EUROPE/Netherlands'), 'europe-netherlands', 'hoofdletters gaan omlaag');
  assert.equal(idx.codeUitId('  europe/netherlands  '), 'europe-netherlands', 'witruimte eromheen telt niet mee');
});

test('een id dat geen veilige bestandsnaam wordt, levert null en geen opgepoetste naam', () => {
  /* Elk van deze vier moet null geven. Zou het script het rare teken WEGHALEN
     in plaats van weigeren, dan werd `a_b` gelijk aan `ab` en botste hij met
     een gebied dat echt `ab` heet -- precies de fout die dit script bij een
     botsing weigert. Daarom: null. */
  for (const slecht of ['africa/foo_bar', 'europe/../../etc/passwd', 'europe/have space', '/rand', 'rand/', '']) {
    assert.equal(idx.codeUitId(slecht), null, slecht + ' hoort geweigerd te worden');
  }
  assert.equal(idx.codeUitId(null), null);
  /* WAT WEL MAG en er raar uitziet: een dubbel koppelteken. `europe/-rand`
     wordt `europe--rand`, en dat is een volstrekt veilige bestandsnaam. De
     verleiding is om hem er ook uit te gooien; dat zou een gebied kosten
     zonder iets te beschermen. De echte grendel tegen twee gebieden op een
     naam is de botsingsregel hieronder, niet de vorm van het koppelteken. */
  assert.equal(idx.codeUitId('europe/-rand'), 'europe--rand');
});

/* --------------------------------------------------------------------------
   2. HET VAK UIT DE GEOMETRIE -- en de asvolgorde, want die is te verwisselen.
   -------------------------------------------------------------------------- */

test('het vak komt uit de coordinaten, met lat en lng niet verwisseld', () => {
  const v = idx.vakUitGeometrie(fixture.vierkant(3.2, 50.7, 7.3, 53.7));
  /* GeoJSON is [lng, lat]. Wie de assen omdraait krijgt lat0 = 3.2, en dat is
     een geldig getal -- de fout zou dus NIET aan een uitzondering opvallen. */
  assert.equal(v.lat0, 50.7);
  assert.equal(v.lat1, 53.7);
  assert.equal(v.lng0, 3.2);
  assert.equal(v.lng1, 7.3);
});

test('een geometrie zonder bruikbare punten geeft null en geen vak van niets', () => {
  assert.equal(idx.vakUitGeometrie(null), null);
  assert.equal(idx.vakUitGeometrie({ type: 'Polygon', coordinates: [] }), null);
  /* Een enkel punt is geen vak: lat0 === lat1, en `vakGeldig()` in
     kern/navigatie/gebiedkeuze.js eist strikt kleiner. Een vak van nul
     oppervlak zou als "past nergens" langskomen in plaats van "geen vak". */
  assert.equal(idx.vakUitGeometrie({ type: 'Point', coordinates: [4, 52] }), null);
  /* Coordinaten die de aarde verlaten worden overgeslagen, niet meegerekend. */
  assert.equal(idx.vakUitGeometrie({ type: 'LineString', coordinates: [[999, 999], [1000, 1000]] }), null);
});

test('een diep geneste geometrie wordt volledig nagelopen', () => {
  /* Een MultiPolygon nest een niveau dieper dan een Polygon. Wie maar een
     niveau afdaalt, mist het tweede eiland en geeft een te klein vak. */
  const v = idx.vakUitGeometrie({ type: 'MultiPolygon', coordinates: [
    [[[4, 52], [5, 52], [5, 53], [4, 52]]],
    [[[-1, 40], [0, 40], [0, 41], [-1, 40]]]
  ] });
  assert.equal(v.lng0, -1, 'het tweede eiland telt mee');
  assert.equal(v.lat0, 40);
  assert.equal(v.lat1, 53);
});

/* --------------------------------------------------------------------------
   3. DE INDEX UIT DE FIXTURE.
   -------------------------------------------------------------------------- */

test('de gewone gebieden komen erdoor, met hun ouder mee vertaald', () => {
  const uit = idx.leesBronindex(fixture.tekst());
  const p = perCode(uit);
  assert.ok(p.has('europe-netherlands'), 'Nederland staat erin');
  assert.equal(p.get('europe-netherlands').naam, 'Netherlands');
  assert.equal(p.get('europe-netherlands').ouder, 'europe');
  /* DE OUDER VAN HET KIND MOET DEZELFDE VERTALING HEBBEN ONDERGAAN. Zou hij
     ongewijzigd worden overgenomen (`europe/netherlands`), dan staat er een
     ouder die in geen enkele code voorkomt en valt gebiedkeuze.js terug op
     oppervlak -- precies de weg waarop Maastricht een keer op Belgie uitkwam. */
  assert.equal(p.get('europe-netherlands-noord-holland').ouder, 'europe-netherlands');
  assert.equal(p.get('europe').ouder, null, 'een werelddeel zonder ouder is geen fout');
});

test('twee ids die op dezelfde code uitkomen worden ALLEBEI geweigerd, met de ander erbij', () => {
  const uit = idx.leesBronindex(fixture.tekst());
  assert.equal(perCode(uit).has('asia-a-b'), false, 'de botsende code komt niet in de index');
  const a = weigering(uit, 'asia/a-b');
  const b = weigering(uit, 'asia/a/b');
  assert.ok(a, 'asia/a-b staat bij de geweigerde');
  assert.ok(b, 'asia/a/b staat bij de geweigerde');
  /* De reden noemt de TEGENPARTIJ. Zonder die naam zoekt iemand een middag
     waarom een gebied verdwenen is. */
  assert.match(a.reden, /botsing.*asia\/a\/b/);
  assert.match(b.reden, /botsing.*asia\/a-b/);
});

test('een onveilig id en een gebied zonder naam vallen niet stil weg', () => {
  const uit = idx.leesBronindex(fixture.tekst());
  assert.equal(weigering(uit, 'africa/foo_bar').reden, 'code-onveilig');
  assert.equal(weigering(uit, 'africa/naamloos').reden, 'zonder-id-of-naam');
  /* De telling is de bewering; de lus erboven kan leeg zijn en bewijst dan
     niets (LAT.md regel 9). Vier weigeringen: twee botsers, een onveilige, een
     naamloze. */
  assert.equal(uit.geweigerd.length, 4);
});

test('zonder vak of zonder downloadadres blijft het veld null en wordt het geen getal of lege tekst', () => {
  const p = perCode(idx.leesBronindex(fixture.tekst()));
  assert.equal(p.get('south-america-zonder-vak').vak, null);
  assert.ok(p.get('south-america-zonder-vak').downloadAdres, 'zonder vak is niet zonder adres');
  /* HET VELD HEET `downloadAdres` EN NIET `bron`, en dat is geen smaak: de
     index draagt boven aan het bestand een `bron` waarop elk gebied terugvalt,
     dus een gebied zonder pbf-adres erfde die URL en zag eruit als bouwbaar.
     Gevonden doordat een gebied zonder adres toch te kiezen bleek. */
  assert.equal(p.get('oceania-zonder-url').downloadAdres, null, 'geen adres is null en geen lege tekst');
  /* Het formaat staat niet in de bronindex; een 0 zou op een scherm "gratis"
     betekenen. */
  assert.equal(p.get('europe-netherlands').bronBytes, null);
});

test('de index draagt de licentie en de naamsvermelding die ODbL eist', () => {
  const uit = idx.leesBronindex(fixture.tekst());
  assert.match(uit.licentie, /ODbL/);
  assert.ok(uit.naamsvermelding && /OpenStreetMap/.test(uit.naamsvermelding),
    'zonder naamsvermelding weigert kern/navigatie/gebieden.js het pakket, en terecht');
  assert.ok(uit.gelezenAt, 'de index zegt wanneer hij is gelezen');
});

test('de uitvoer staat op code gesorteerd, zodat twee rondes hetzelfde bestand geven', () => {
  const a = idx.leesBronindex(fixture.tekst()).gebieden.map(g => g.code);
  assert.deepEqual(a, a.slice().sort(), 'gesorteerd');
  /* Determinisme is hier geen netheid: het bestand komt in RTG_DATA_DIR te
     staan en de gebiedenlaag cachet op zijn wijzigingstijd. Een index die per
     ronde van volgorde wisselt, ziet er elke keer nieuw uit. */
  const b = idx.leesBronindex(fixture.tekst()).gebieden.map(g => g.code);
  assert.deepEqual(a, b);
});

/* --------------------------------------------------------------------------
   4. STUKKE INVOER: een reden, nooit een lege lijst zonder woord.
   -------------------------------------------------------------------------- */

test('stukke of lege invoer geeft een REDEN en geen stille nul', () => {
  const stuk = idx.leesBronindex('{dit is geen json');
  assert.deepEqual(stuk.gebieden, []);
  assert.ok(stuk.reden && /geldige JSON/.test(stuk.reden), 'de reden noemt wat er mis is: ' + stuk.reden);

  const leeg = idx.leesBronindex(JSON.stringify({ type: 'FeatureCollection', features: [] }));
  assert.deepEqual(leeg.gebieden, []);
  assert.ok(leeg.reden, 'een bron zonder gebieden krijgt ook een reden');
  /* HIER STOND `assert.notEqual(leeg.reden, stuk.reden)`, EN DAT WAS EEN
     TANDELOZE BEWERING: de reden bij stukke JSON draagt de foutmelding van
     JSON.parse, dus twee redenen zijn nooit letterlijk gelijk -- ook niet als
     ze hetzelfde BEWEREN. De mutatiemotor liet hem overleven met een lege bron
     die "geen geldige JSON" ging zeggen. Nu staat de bewering op de betekenis:
     een bron die wel te lezen was, mag nergens klinken als een stukke bron. */
  assert.match(leeg.reden, /geen enkel gebied/);
  assert.equal(/geldige JSON/.test(leeg.reden), false,
    'een lege maar leesbare bron mag niet klinken als stukke JSON: ' + leeg.reden);
});

/* --------------------------------------------------------------------------
   5. DE INDEX PAST OP DE LAAG DIE HEM LEEST. Zonder deze toets kan het script
      een geldig bestand schrijven dat de catalogus nergens in ziet.
   -------------------------------------------------------------------------- */

test('de gebiedenlaag leest deze index, en de licentiepoort laat hem door', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebiedsindex-'));
  const oud = process.env.RTG_DATA_DIR;
  try {
    process.env.RTG_DATA_DIR = map;
    fs.mkdirSync(path.join(map, 'navigatie'), { recursive: true });
    const index = idx.leesBronindex(fixture.tekst());
    fs.writeFileSync(path.join(map, 'navigatie', 'gebieden.json'), JSON.stringify(index));

    delete require.cache[require.resolve('../server/kern/navigatie/gebieden.js')];
    delete require.cache[require.resolve('../server/kern/navigatie/pakket.js')];
    const laag = require('../server/kern/navigatie/gebieden.js');
    const cat = laag.catalogus();
    assert.equal(cat.reden, null, 'met een index is er geen reden meer: ' + cat.reden);
    assert.equal(cat.telling.aangeboden, index.gebieden.length);
    assert.equal(cat.telling.gebouwd, 0, 'aangeboden is geen dekking: er ligt geen pakket');

    const nl = cat.gebieden.find(g => g.code === 'europe-netherlands');
    assert.ok(nl, 'Nederland komt door de catalogus');
    const poort = laag.mag(nl);
    assert.equal(poort.ok, true, 'de licentiepoort laat hem door: ' + poort.reden);
    assert.match(String(poort.naamsvermelding), /OpenStreetMap/);

    /* En de keuze werkt op deze index: een punt in Noord-Holland hoort bij het
       KIND en niet bij het land, omdat de bron de omvatting verklaart. */
    const keuze = laag.gebiedVoor({ lat: 52.4, lng: 4.9 });
    assert.equal(keuze.gebied && keuze.gebied.code, 'europe-netherlands-noord-holland',
      'grond: ' + (keuze && keuze.grond) + ', gebied: ' + JSON.stringify(keuze && keuze.gebied));
    assert.equal(keuze.vakIsGeenGrens, true, 'elk antwoord blijft zeggen dat een rechthoek geen grens is');
  } finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    delete require.cache[require.resolve('../server/kern/navigatie/gebieden.js')];
    delete require.cache[require.resolve('../server/kern/navigatie/pakket.js')];
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});
