/* DE NAVIGATIEPROEF -- het instrument, niet de keten.

   scripts/navigatieproef.js opent RTG Navigatie in een echte browser en meet de
   belofte uit BETROUWBAARHEID.md par. 1: *breng mij vanaf waar ik nu ben naar
   mijn bestemming*. Die ronde duurt minuten en vraagt een Chromium; hier staat
   wat er van het INSTRUMENT waar moet blijven, plus een handvol lexicale
   grendels op het scherm zelf.

   WAAROM DIE TWEEDE HELFT ER IS, EN WAT ZE WAARD IS. De browserproef is het
   echte bewijs -- hij voerde de vijf defecten werkelijk uit en zag ze zakken.
   Maar hij MELDT ZICH AF op een machine zonder browser, en dan bewaakt niets
   meer dat een reparatie blijft staan. De toetsen 4 tot en met 7 zijn daarom
   met opzet lexicaal (graad `vermoed`, LAT.md): ze bewijzen niet dat het scherm
   werkt, ze houden alleen de vorm tegen waarin het aantoonbaar stuk was. Wie ze
   voor het bewijs aanziet, meet een tekst in plaats van een app.

   EN ZE ZIJN OMHEEN TE LOPEN, gemeten en niet vermoed: `ArrowDown || ArrowUp`
   in de IF vervangen door `false` laat alle negen toetsen hier groen -- de naam
   staat een regel lager nog een keer, in de regel die de keuze verschuift. De
   browserproef ziet het wel (schakel 4 tikt werkelijk twee keer omlaag en drukt
   Enter). Dat gat staat hier opgeschreven in plaats van dichtgeplamuurd met een
   nog nauwkeuriger regex: de volgende omweg vind je met dezelfde truc weer niet,
   en een grendel die zich voordoet als bewijs is erger dan een die zegt wat hij
   is.

   Draai los: node --test test/navigatieproef.test.js
   De keten zelf: npm run navigatieproef */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'navigatieproef.js'), 'utf8');
const scherm = fs.readFileSync(path.join(WORTEL, 'public', 'apps', 'navigatie.html'), 'utf8');
const plek = fs.readFileSync(path.join(WORTEL, 'public', 'shared', 'plek.js'), 'utf8');
/* Commentaar eruit voordat er iets over de CODE wordt beweerd -- anders zakt een
   toets op de uitleg van de reparatie die hij bewaakt. Dat is hier twee keer
   gebeurd, en test/ritproef.test.js toets 2 was er al eens in gelopen. */
const { zonderCommentaar } = require('../scripts/lib/bron');
const schermKaal = zonderCommentaar(scherm);

test('0. de proef zakt op een open schakel, een gebroken belofte of een scriptfout', () => {
  assert.match(bron, /uit\.sluit = t\.open === 0 && t\.gebroken === 0 && t\.scriptfouten === 0/,
    'sluit hoort alle drie de slechte uitkomsten te tellen');
  /* Een scriptfout MOET meetellen: het duurste defect van deze ronde was er een,
     en het scherm zag er gewoon uit terwijl het zoeken stuk was. */
  assert.match(bron, /page\.on\('pageerror'/, 'zonder pageerror-teller mist de proef de stilste faalvorm');
  assert.match(bron, /process\.exit\(u\.overgeslagen \? 0 : \(u\.sluit \? 0 : 1\)\)/,
    'zonder foutcode is dit een meting en geen proef');
});

test('1. de proef draait op een wegwerpserver en nooit op de ontwikkelserver', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/,
    'een proef op de ontwikkelserver meet andermans data');
  assert.match(bron, /startChromium/, 'de browser hoort via scripts/lib/scherm.js te komen, niet via een eigen lader');
});

test('2. overslaan is nooit stil', () => {
  /* Een ronde die zich afmeldt terwijl niemand het leest, laat een stuk huis er
     gezond uitzien. Zonder browser staat er een reden in de uitslag. */
  assert.match(bron, /uit\.overgeslagen = /, 'een overgeslagen ronde hoort in de uitslag te staan');
  assert.match(bron, /OVERGESLAGEN/, 'en zichtbaar te zijn voor wie hem draait');
});

test('3. de proef bouwt geen eigen meetpunt in de app', () => {
  /* De zoomschakel meet het BEELD. De verleiding was een `window.__cam` in
     navigatie.html om de camera-afstand af te kunnen lezen -- dan meet de proef
     zijn eigen haak, en staat er productiecode die alleen voor de proef bestaat. */
  assert.doesNotMatch(zonderCommentaar(bron), /window\.__/, 'de proef leest een eigen haak in de app uit');
  assert.doesNotMatch(schermKaal, /window\.__/, 'het scherm draagt een haak die alleen een proef gebruikt');
  assert.match(bron, /page\.screenshot\(\{ clip: VENSTER \}\)/,
    'de zoommeting hoort aan het beeld te hangen');
});

test('4. het zoekveld vraagt nooit een plek die er niet is', () => {
  /* Gemeten defect: `lat: hier.lat` terwijl `hier` null is tot de eerste fix.
     Elke toetsaanslag gaf `Cannot read properties of null` en het zoeken bleef
     stuk -- zonder melding. */
  const zoek = schermKaal.slice(schermKaal.indexOf('async function zoekBestemmingen'), schermKaal.indexOf('function pak('));
  assert.ok(zoek.length > 100, 'zoekBestemmingen niet gevonden; dan bewaakt deze toets niets');
  assert.match(zoek, /hier \? \{ q, lat: hier\.lat/, 'de plek hoort voorwaardelijk mee te gaan');
  assert.doesNotMatch(zoek.replace(/hier \? \{ q, lat: hier\.lat, lng: hier\.lng \} : \{ q \}/, ''),
    /hier\.(lat|lng)/, 'er staat nog een onbewaakte lezing van hier in het zoeken');
});

test('5. een leeg of geweigerd antwoord komt op het scherm', () => {
  const zoek = schermKaal.slice(schermKaal.indexOf('async function zoekBestemmingen'), schermKaal.indexOf('function pak('));
  assert.match(zoek, /if \(r\.status !== 200\) return meldInLijst/,
    'een weigering van de motor (503 zonder Nederlands wegennet) wordt weer weggegooid');
  assert.match(zoek, /if \(!rij\.length\) return meldInLijst/,
    'nul treffers sluit de lijst weer stil; dat is niet te onderscheiden van een kapot veld');
});

test('5a. de zoeklijst is met het toetsenbord te bedienen', () => {
  /* De browserproef bewijst dit echt (schakel 4); deze grendel staat er voor de
     machine zonder browser, waar die proef zich afmeldt. Drie dingen die samen
     de weg vormen: een rol die een keuze belooft, pijltjes die er een aanwijzen,
     en Enter die hem pakt. */
  assert.match(schermKaal, /setAttribute\('role', 'option'\)/, 'de resultaten dragen geen optie-rol');
  assert.match(schermKaal, /e\.key === 'Enter'[\s\S]{0,80}pak\(keuzes\[/, 'Enter pakt de aangewezen bestemming niet');
  /* En dan binnen HET ZOEKVELD, niet ergens anders op de pagina: deze toets
     stond eerst op de hele bron en bleef groen toen de Escape van het zoekveld
     werkelijk was gesloopt -- hij zag die van de meldknop. Een grendel die de
     verkeerde deur bewaakt, is geen grendel. */
  const luister = schermKaal.slice(schermKaal.indexOf("$('#zoek').addEventListener('keydown'"));
  const handler = luister.slice(0, luister.indexOf('\n  });'));
  assert.ok(handler.length > 50 && handler.length < 1200, 'de keydown van het zoekveld is niet af te bakenen');
  assert.match(handler, /e\.key === 'Escape'/, 'Escape sluit de zoeklijst niet');
  assert.match(handler, /e\.key === 'ArrowDown'/, 'de pijltjes horen in dezelfde luisteraar te zitten');
});

test('6. de badge wordt ook bijgewerkt als de kaart faalt', () => {
  /* Dit is het defect uit BETROUWBAARHEID.md par. 6 nr. 1, en het stond er nog:
     kern/navigatie/dekking.js gaf het juiste antwoord, maar het scherm haalde
     het alleen op in de geslaagde tak -- dus bleef "Motor actief" staan boven
     Nederland zonder ingeladen wegennet. */
  const init = schermKaal.slice(schermKaal.indexOf('async function initialiseerKaart'), schermKaal.indexOf('window.addEventListener(\'resize\''));
  const faaltak = init.slice(init.indexOf('if (r.status !== 200)'), init.indexOf('kaartBegonnen = true'));
  assert.match(faaltak, /await haalStatus\(\)/, 'de faaltak haalt de status niet op; dan liegt de badge daar');
  assert.ok(faaltak.indexOf('await haalStatus()') < faaltak.indexOf('poort'),
    'de status hoort opgehaald te zijn voordat de poort dichtvalt');
});

test('7. wachten op een antwoord dat er al is', () => {
  /* shared/plek.js kon "er komt geen plek" niet doorgeven, dus wachtte de app
     altijd zijn volle time-out uit: gemeten 12,2 seconden zwart scherm. */
  assert.match(plek, /opties\.geenPlek === 'function'/, 'volg() kan een uitblijvende plek niet melden');
  assert.match(plek, /if \(gehad \|\| gemeld \|\| gestopt\) return;/,
    'geenPlek hoort hoogstens een keer af te gaan, en nooit na een geslaagde fix');
  assert.match(schermKaal, /geenPlek: reden =>/, 'het scherm luistert niet naar een uitblijvende plek');
  assert.doesNotMatch(schermKaal, /window\.prompt/,
    'de meldknop staat weer in een browservenster; dat blokkeert de pagina en ontbreekt in een PWA');
});
