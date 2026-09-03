/* DE VERSTRENGELINGSMETER -- en of hij werkelijk iets onderscheidt.

   scripts/verstrengeling.js beantwoordt de vraag die vóór een binnenpoort komt:
   welke delen van RTG kunnen elkaar wakker maken, en hoeveel daarvan is
   verklaard? Zo'n meter kan op twee manieren liegen, en ze wijzen tegengesteld:

     TE HOOG   door de LAAG weg te laten. Dat deed hij ook echt: de eerste ronde
               meldde `supplier -> horeca` (37 randen) als zwaarste verstrengeling,
               terwijl dat server/routes/supplier is dat server/kern/horeca
               aanroept -- een ingang die zijn eigen domein gebruikt. Wie zo meet,
               gaat spaghetti opruimen die niet bestaat.
     TE LAAG   door de restpost weg te definiëren. Elke rand die niemand kan
               uitleggen tot GEDEELDE_PRIMITIEF of EIGEN_DATA rekenen levert een
               mooi getal en een blinde meter.

   Toets 7 is de zelfijking: een rand die niemand heeft verklaard MOET ONBEKEND
   heten. Zakt die toets niet meer, dan meet dit script niets.

   Draai los: node --test test/verstrengeling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../scripts/verstrengeling');

/* Een ruwe rand is een bestandspaar, precies zoals lees() ze oplevert. */
const r = (van, naar) => ({ van, naar });
const soortVan = (res, van, naar) => {
  const g = res.randen.find(x => x.van === van && x.naar === naar);
  return g && g.soort;
};

test('1. de laag hoort in de identiteit van een knoop', () => {
  /* DE FOUT DIE DEZE METER ZELF MAAKTE. Een ingang die zijn domein aanroept is
     geen verstrengeling; zonder laag heet hij `supplier -> horeca` en staat hij
     bovenaan de werkvoorraad. */
  const res = V.analyse([r('server/routes/supplier/eten.js', 'server/kern/horeca/index.js')]);
  assert.equal(res.randen.length, 1);
  assert.equal(res.randen[0].van, 'ingang:supplier');
  assert.equal(res.randen[0].naar, 'domein:horeca');
  assert.equal(res.randen[0].soort, 'LAAGRAND');
  assert.equal(res.randen[0].omhoog, false);
});

test('2. een rand OMHOOG wordt als zodanig gemeld', () => {
  /* Een domein dat zijn eigen ingang nodig heeft, is de bevinding waar deze
     hele meter voor bestaat. Hij mag nooit als gewone rand voorbijkomen. */
  const res = V.analyse([r('server/kern/horeca/pols.js', 'server/routes/supplier/eten.js')]);
  assert.equal(res.randen[0].omhoog, true);
  assert.notEqual(res.randen[0].soort, 'LAAGRAND');
});

test('3. eigen data is een FAMILIEvraag, geen achtervoegselvraag', () => {
  const res = V.analyse([
    r('server/kern/leerstof-bibliotheek/a.js', 'server/kern/leerstof-data/b.js'),
    r('server/kern/bank/a.js', 'server/kern/bankregie/b.js')
  ]);
  assert.equal(soortVan(res, 'domein:leerstof-bibliotheek', 'domein:leerstof-data'), 'EIGEN_DATA');
  /* De grens ernaast: `bank` en `bankregie` delen een beginletterreeks maar geen
     familie -- er valt niets te knippen aan `bankregie`. Dat zijn twee dingen, en
     wie ze samenvoegt verbergt een echte rand. */
  assert.equal(soortVan(res, 'domein:bank', 'domein:bankregie'), 'ONBEKEND');
});

test('3b. de familieregel knipt op het KOPPELTEKEN en niet op beginletters', () => {
  /* De toets die er eerst niet was, en waardoor een dode voorwaarde in de
     familieregel maandenlang gerust had kunnen stellen. Twee namen die met
     dezelfde letters beginnen zijn geen familie; twee namen met dezelfde stam
     vóór het koppelteken wel -- ook als de stam kort is. */
  const res = V.analyse([
    r('server/kern/ai/x.js', 'server/kern/ai-kort/y.js'),
    r('server/kern/gast/x.js', 'server/kern/gastvrij/y.js')
  ]);
  assert.equal(soortVan(res, 'domein:ai', 'domein:ai-kort'), 'EIGEN_DATA');
  assert.equal(soortVan(res, 'domein:gast', 'domein:gastvrij'), 'ONBEKEND');
});

test('4. een gedeelde primitief wordt GEMETEN, niet verklaard', () => {
  /* Drie gebruikers is de drempel. Met twee is hetzelfde doel géén primitief --
     anders promoveert elke toevallige samenwerking zichzelf tot kern. */
  const tweeGebruikers = [
    r('server/kern/a/x.js', 'server/kern/z/x.js'),
    r('server/kern/b/x.js', 'server/kern/z/x.js')
  ];
  const res2 = V.analyse(tweeGebruikers);
  assert.equal(soortVan(res2, 'domein:a', 'domein:z'), 'ONBEKEND');

  const res3 = V.analyse([...tweeGebruikers, r('server/kern/c/x.js', 'server/kern/z/x.js')]);
  assert.equal(soortVan(res3, 'domein:a', 'domein:z'), 'GEDEELDE_PRIMITIEF');
  assert.match(res3.randen[0].grond, /3 knopen/);
});

test('5. een verklaring wint van de afleiding, en draagt haar reden mee', () => {
  const ruw = [r('server/kern/mall/a.js', 'server/kern/ervaring/b.js')];
  assert.equal(soortVan(V.analyse(ruw), 'domein:mall', 'domein:ervaring'), 'ONBEKEND');
  const res = V.analyse(ruw, [{ van: 'domein:mall', naar: 'domein:ervaring',
    soort: 'DOMEINRELATIE', reden: 'de mall verkoopt ervaringen' }]);
  assert.equal(soortVan(res, 'domein:mall', 'domein:ervaring'), 'DOMEINRELATIE');
  assert.match(res.randen[0].grond, /de mall verkoopt ervaringen/);
});

test('6. twee verklaringen voor dezelfde rand worden GEMELD', () => {
  /* Anders wint stil de laatste, en verdwijnt de reden die iemand eerder gaf.
     Precies het patroon van een tweede lijst uit LAT-regel 4. */
  const res = V.analyse([r('server/kern/mall/a.js', 'server/kern/ervaring/b.js')], [
    { van: 'domein:mall', naar: 'domein:ervaring', soort: 'DOMEINRELATIE', reden: 'eerste' },
    { van: 'domein:mall', naar: 'domein:ervaring', soort: 'LEGACY', reden: 'tweede' }
  ]);
  assert.deepEqual(res.dubbeleVerklaringen, ['domein:mall -> domein:ervaring']);
});

test('7. ZELFIJKING: een onverklaarde rand heet ONBEKEND en niets anders', () => {
  /* De toets die de meter eerlijk houdt. Twee losse domeinen, één rand, geen
     verklaring, onder elke drempel: er is geen afleiding die hier past, dus
     moet de restpost zichtbaar worden. Slaagt deze toets terwijl er iets ANDERS
     uitkomt, dan definieert de meter zijn eigen werkvoorraad weg. */
  const res = V.analyse([r('server/kern/vakwerk/a.js', 'server/kern/klantenboek/b.js')]);
  assert.equal(res.randen[0].soort, 'ONBEKEND');
  assert.equal(res.randen[0].grond, 'niemand heeft deze rand verklaard');
});

test('7b. de eigen ingang telt niet als schade bij uitneembaarheid', () => {
  /* De fout die deze meter bijna maakte. Wie horeca uitzet, zet de horeca-routes
     mee uit -- dat is de bedoeling en geen breuk. Zonder dat onderscheid meldde
     hij dat 542 van de 544 domeinen iets meeslepen, en dat leest als "niets is
     uit te nemen" terwijl het "elk domein heeft een ingang" betekent. */
  const r = V.meet(undefined, []);
  assert.ok(Array.isArray(r.uitneembaar) && r.uitneembaar.length, 'de omkering hoort in de uitslag te staan');
  for (const u of r.uitneembaar) {
    assert.ok(u.geraakteDomeinen <= u.geraakt,
      'de domeinen zijn een deelverzameling van alles wat geraakt wordt: ' + u.id);
  }
  /* En beide getallen blijven bestaan: ze mogen niet door elkaar lopen. */
  const metIngang = r.uitneembaar.find(u => u.geraakt > u.geraakteDomeinen);
  assert.ok(metIngang, 'er hoort minstens een knoop te zijn die meer knopen dan domeinen raakt');
});

test('7c. elke verklaring draagt een SOORT die bestaat en een reden die iets zegt', () => {
  /* Nu het getal op nul staat, is de gevaarlijkste beweging niet een nieuwe rand
     maar een SLECHTE VERKLARING: "hoort zo" houdt de meter op nul en meet
     niets meer. Deze toets is de bodem daaronder. Hij kan niet beoordelen of een
     reden WAAR is -- dat blijft mensenwerk, en daarom staat bij elke verklaring
     het bestand en de regel waar hij vandaan komt. */
  const lijst = require('../scripts/lib/verstrengeling-verklaringen');
  const SOORTEN = new Set(['EIGEN_DATA', 'GEDEELDE_PRIMITIEF', 'DOMEINRELATIE', 'ORKESTRATIE',
    'PRESENTATIE', 'BELEID', 'BEWIJS', 'LEGACY']);
  assert.ok(lijst.length, 'de lijst bestaat');
  const gezien = new Set();
  for (const v of lijst) {
    assert.match(v.van, /^(ingang|domein|motor|opzet):/, 'een verklaring wijst een echte knoop aan: ' + v.van);
    assert.match(v.naar, /^(ingang|domein|motor|opzet):/, 'ook aan de andere kant: ' + v.naar);
    assert.ok(SOORTEN.has(v.soort), 'met een soort die bestaat: ' + v.soort + ' (' + v.van + ')');
    assert.ok(v.reden && v.reden.length > 30,
      'en een reden die iets uitlegt in plaats van een verwijzing: ' + v.van + ' -> ' + v.naar);
    const sleutel = v.van + ' -> ' + v.naar;
    assert.ok(!gezien.has(sleutel), 'en geen twee verklaringen voor dezelfde rand: ' + sleutel);
    gezien.add(sleutel);
  }
});

test('8. wederkerigheid staat BIJ de rand en niet in een tweede lijst', () => {
  const res = V.analyse([
    r('server/kern/a/x.js', 'server/kern/b/x.js'),
    r('server/kern/b/y.js', 'server/kern/a/y.js'),
    r('server/kern/a/x.js', 'server/kern/c/x.js')
  ]);
  assert.equal(res.randen.find(x => x.naar === 'domein:b').wederkerig, true);
  assert.equal(res.randen.find(x => x.naar === 'domein:c').wederkerig, false);
});

test('9. de bedrading van de app is geen module met 93 problemen', () => {
  /* server/server.js bedraadt de hele app -- scripts/check.js noemt hem zo.
     Als motor gerekend levert hij 93 uitgaande randen die allemaal onverklaard
     heten, terwijl bedraden precies zijn taak is. */
  assert.deepEqual(V.knoopVan('server/server.js'), { laag: 'opzet', domein: 'server.js' });
  const res = V.analyse([r('server/server.js', 'server/kern/horeca/index.js')]);
  assert.equal(res.randen[0].soort, 'ORKESTRATIE');
});

test('10. de laag van een map buiten kern/ wordt VERKLAARD en niet geraden', () => {
  /* server/school/ is bedrijfslogica, geen motor. Zonder die uitspraak levert
     elke aanroep van school naar een domein een valse rand OMHOOG. */
  assert.equal(V.knoopVan('server/school/dag.js').laag, 'domein');
  assert.equal(V.knoopVan('server/mail.js').laag, 'motor');
  const res = V.analyse([r('server/school/dag.js', 'server/kern/leerstof/x.js')]);
  assert.equal(res.randen[0].omhoog, false);
});
