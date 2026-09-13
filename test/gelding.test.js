/* ============================================================================
   DE DRIE GELDINGSASSEN -- en de ene eigenschap die ze waardevol maakt.

   CLAIM, DRAAG en WACHT beantwoorden drie verschillende vragen: waar GELDT een
   wet, waar LEEFT hij, en waar kan iemand hem ZIEN. Die drie hebben alleen
   betekenis als ze onafhankelijk zijn. Deelt de dragersensor een bron met de
   wachtersensor, dan bewegen ze bij elke wijziging samen en meet je een echo.

   DE IJKCRITERIA, en ze zijn alle drie nagetrokken:

     een drager verdwijnt   -> DRAAG verschuift, WACHT niet
     een wachterpad verdwijnt -> WACHT verschuift, DRAAG niet
     de claim verandert     -> CLAIM verschuift, de andere twee niet

   Beweegt er een tweede as mee zonder oorzaak, dan is er een verborgen gedeelde
   bron -- precies de fout die deze laag moet uitsluiten.

   Draai los: node --test test/gelding.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const B = require('../scripts/gelding.js');
/* KAAL, dus zonder commentaar. De eerste versie hiervan zakte op zijn EIGEN
   uitleg: een zin die vertelt dat asWacht niets van asDraag leest, bevat het
   woord asDraag. Dezelfde lezer als elke andere bronkeuring in dit huis
   (LAT.md: commentaar eruit, maar geen code opeten). */
const { zonderCommentaar } = require('../scripts/lib/bron.js');
const BRON = zonderCommentaar(fs.readFileSync(path.join(WORTEL, 'scripts/gelding.js'), 'utf8'));

/* Een kleine vormenverzameling, zodat de ijking niet van de echte code afhangt:
   een wijziging in het product mag deze toets niet laten zakken. */
const VORMEN = [
  { module: 'server/kern/paspoort/toezicht.js', velden: ['id', 'codenaam', 'niveau', 'at'] },
  { module: 'server/school/klas.js', velden: ['id', 'leerling', 'vak', 'cijfer'] },
  { module: 'server/kern/agenda.js', velden: ['id', 'titel', 'van', 'tot'] },
];
const WACHTERBRON = "const MAPPEN = ['vertegenwoordiging', 'rugdekking', 'carriereledger']";

const cellenVan = (m) => [...m.keys()].sort().join(' ; ');

/* MUTATIE GEZIEN ZAKKEN: in asDraag() de wachterbron ingelezen en zijn paden
   meegewogen; toets 1 zakte op de bronscheiding. */
test('1. de drie assen delen geen bron', () => {
  /* Structureel: asDraag kent alleen `vormen`, asWacht alleen zijn brontekst.
     Een sensor die de ander AANROEPT zou dat hier moeten verraden. */
  const draagBlok = BRON.slice(BRON.indexOf('function asDraag'), BRON.indexOf('function asWacht'));
  assert.doesNotMatch(draagBlok, /asWacht|wachter\.bestand|MAPPEN/,
    'de dragersensor leest de wachter; dan bewegen die twee assen samen en meet je een echo');

  const wachtBlok = BRON.slice(BRON.indexOf('function asWacht'), BRON.indexOf('const sleutel'));
  assert.doesNotMatch(wachtBlok, /objectmodel|asDraag|MENSVELD|WAARDEVELD/,
    'de wachtersensor leest de vormen van de dragersensor; dan is het verschil tussen "er is een regel" ' +
    'en "de test ziet hem" niet meer te meten');

  const claimBlok = BRON.slice(BRON.indexOf('function asClaim'), BRON.indexOf('const MENSVELD'));
  assert.doesNotMatch(claimBlok, /objectmodel|asDraag|asWacht/,
    'de claimsensor leest een andere as; de doctrine hoort alleen uit de doctrine te komen');
});

/* MUTATIE GEZIEN ZAKKEN: asDraag() een vaste cellenlijst laten teruggeven
   ongeacht `vormen`; toets 2 zakte, want dan verschuift de DRAAG-as niet meer. */
test('2. een drager verdwijnt: DRAAG verschuift, WACHT niet', () => {
  const voorD = B.asDraag(VORMEN), voorW = B.asWacht(WACHTERBRON);
  const zonder = VORMEN.filter(v => v.module !== 'server/kern/paspoort/toezicht.js');
  const naD = B.asDraag(zonder), naW = B.asWacht(WACHTERBRON);

  assert.notEqual(cellenVan(voorD.cellen), cellenVan(naD.cellen),
    'de DRAAG-as beweegt niet als er een drager wegvalt; dan meet hij de dragers niet');
  assert.equal(voorD.dragers.length - 1, naD.dragers.length, 'precies een drager minder');
  assert.equal(cellenVan(voorW.cellen), cellenVan(naW.cellen),
    'de WACHT-as bewoog mee terwijl er alleen een DRAGER wegviel -- dat is een verborgen gedeelde bron');
});

/* MUTATIE GEZIEN ZAKKEN: asWacht() de paden laten negeren en altijd alle
   contexten zetten; toets 3 zakte. */
test('3. een wachterpad verdwijnt: WACHT verschuift, DRAAG niet', () => {
  const voorW = B.asWacht(WACHTERBRON), voorD = B.asDraag(VORMEN);
  const naW = B.asWacht("const MAPPEN = ['carriereledger']");
  const naD = B.asDraag(VORMEN);

  assert.notEqual(voorW.paden.length, naW.paden.length, 'de WACHT-as leest de padenlijst niet');
  assert.equal(cellenVan(voorD.cellen), cellenVan(naD.cellen),
    'de DRAAG-as bewoog mee terwijl er alleen een WACHTERPAD wegviel -- verborgen gedeelde bron');

  /* En de lege lijst: een wachter die niets scant, ziet niets. Zou hij dan alles
     zien, dan is "gezien" een aanname en geen waarneming. */
  const leeg = B.asWacht("const MAPPEN = []");
  assert.equal(leeg.cellen.size, 0, 'een wachter zonder paden hoort niets te zien');
});

/* MUTATIE GEZIEN ZAKKEN: de uitzonderingenlijst uit asClaim() weggehaald; de
   school-cellen sprongen van ONBEPAALD naar GECLAIMD, en toets 4 zakte. */
test('4. de claim verandert: CLAIM verschuift, DRAAG en WACHT niet', () => {
  const voor = B.asClaim();
  const voorD = cellenVan(B.asDraag(VORMEN).cellen);
  const voorW = cellenVan(B.asWacht(WACHTERBRON).cellen);

  const bewaar = B.GEVAL.claim.uitzonderingen;
  try {
    B.GEVAL.claim.uitzonderingen = [];
    const na = B.asClaim();
    const veranderd = [...na.cellen.keys()].filter(k => na.cellen.get(k).claimt !== voor.cellen.get(k).claimt);
    assert.ok(veranderd.length > 0, 'de CLAIM-as beweegt niet als de doctrine verandert');
  } finally { B.GEVAL.claim.uitzonderingen = bewaar; }

  assert.equal(cellenVan(B.asDraag(VORMEN).cellen), voorD, 'de DRAAG-as bewoog mee met een CLAIM-wijziging');
  assert.equal(cellenVan(B.asWacht(WACHTERBRON).cellen), voorW, 'de WACHT-as bewoog mee met een CLAIM-wijziging');
});

/* MUTATIE GEZIEN ZAKKEN: de waarschuwing uit `grens` gehaald; zakte hier. */
test('5. de twee misleesbare uitslagen dragen hun waarschuwing in het register', () => {
  const pad = path.join(WORTEL, 'GELDING.json');
  assert.ok(fs.existsSync(pad), 'GELDING.json ontbreekt; draai `npm run gelding`. Niet-gemeten mag nooit ' +
    'als in orde langskomen');
  const j = JSON.parse(fs.readFileSync(pad, 'utf8'));

  assert.match(j.grens, /GECLAIMD_GEEN_DRAGER_GEVONDEN betekent\s+NIET dat er geen drager is/,
    'zonder die zin leest een lege cel als "hier gebeurt niets", terwijl de sensor alleen niets vond');
  assert.match(j.grens, /GEDRAGEN_NIET_GEZIEN betekent NIET "ongetest"/,
    'zonder die zin leest een ongeziene cel als een gat in de toetsing');
  assert.match(j.grens, /GEEN PERCENTAGE/,
    'een percentage over cellen veronderstelt dat elke cel even zwaar weegt, en dat is niet gemeten');
  assert.equal(j.graad, 'vermoed', 'deze assen zijn deels verklaard en deels lexicaal');

  /* De dragersensor ziet maar een van de vier handelingen, en dat hoort te
     staan waar de lezer het ziet -- anders leest een lege `rangschikken`-cel
     als bewijs dat er niet gerangschikt wordt. */
  assert.deepEqual(j.assen.draag.ziet, ['opslaan']);
  assert.ok(j.assen.draag.zietNiet.length >= 3 && String(j.assen.draag.zietNietWaarom).length > 30,
    'de dragersensor zegt niet welke handelingen hij NIET ziet, of waarom');

  assert.deepEqual(j.assen.claim.citaatKapot, [],
    'een citaat van de claim wijst naar een zin die niet meer bestaat; dan is de claim niet meer na te lezen');
});
