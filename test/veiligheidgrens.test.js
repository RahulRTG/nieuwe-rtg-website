/* ============================================================================
   DE GRENSREGEL VAN RTG VEILIG STAAT OP DRIE PLEKKEN EN BLIJFT DEZELFDE

   server/kern/veiligheid/grens.js is de bron. Twee andere plekken dragen een
   KOPIE, en dat is geen slordigheid maar de enige werkbare vorm: een browser kan
   dat serverbestand niet laden, en public/apps/foundation/onveilig.html is met
   opzet een pagina die geen enkel verzoek doet ("er wordt niets van je gevraagd,
   niets opgeslagen en niets verstuurd" -- dat blok staat er, en een fetch zou
   het tot een leugen maken).

   Wat een kopie nodig heeft is dus geen import maar een TOETS. Deze.

   WAAROM DIT ZWAARDER WEEGT DAN EEN GEWONE DUBBELING. Dit is een belofte over
   wat er NIET gebeurt als het misgaat. Een kopie die achterloopt leest als de
   waarheid en is het niet, en de lezer is iemand die overweegt zijn leven van
   deze zinnen af te laten hangen. Precies de vorm van test/genrecap.test.js, dat
   citaten uit de lagenmodellen tegen hun bron houdt.

   HET STOND ER OOK ECHT UIT ELKAAR. Voor deze ronde had de server een korte
   variant ("er wordt niemand gebeld en er kijkt geen mens mee") en de clientlaag
   een langere die er twee dingen bij zei -- geen hulpdienst, en niets zonder
   internet. Allebei waar, allebei anders, en niemand die merkte welke een lezer
   te zien kreeg.

   MET EEN MUTATIE NAGETROKKEN: een woord veranderen in de zin in
   public/shared/veiligheid.js laat toets 2 zakken; het blok uit onveilig.html
   halen laat toets 3 zakken; een vijfde zin aan NIET toevoegen laat 2 en 3
   allebei zakken, en dat hoort -- een nieuwe belofte moet overal langs.

   Draai los: node --test test/veiligheidgrens.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const GRENS = require('../server/kern/veiligheid/grens');
/* Witruimte plat, want HTML breekt regels af en dat verandert de zin niet. Wat
   deze toets moet vangen is een ANDER WOORD, niet een andere regelafbreking --
   een toets die op opmaak zakt, wordt binnen een maand weggehaald in plaats van
   gerespecteerd. Een tag MIDDEN in een zin blijft wel zakken, en dat hoort:
   "<b>geen</b> alarmcentrale" leest anders dan de bron. */
const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\s+/g, ' ');

const ZINNEN = GRENS.NIET.concat([GRENS.WEL]);

test('1. de bron zegt alle vier de dingen die niet gebeuren, en wat je wel kunt doen', () => {
  assert.equal(GRENS.NIET.length, 4, 'vier beloftes; wie er een schrapt, verzwakt de grens');
  for (const z of ZINNEN) {
    assert.ok(GRENS.VOLLEDIG.includes(z), 'de volledige regel mist: ' + z);
  }
  assert.match(GRENS.WEL, /alarmnummer/,
    'de enige zin die zegt wat de lezer WEL kan doen, hoort het alarmnummer te noemen');
});

test('2. de clientlaag draagt exact dezelfde zinnen', () => {
  const bron = lees('public/shared/veiligheid.js');
  for (const z of ZINNEN) {
    assert.ok(bron.includes(z),
      'public/shared/veiligheid.js mist deze zin uit kern/veiligheid/grens.js: "' + z + '"');
  }
});

test('3. de Foundation-pagina die ernaar verwijst, draagt ze ook', () => {
  /* Wie op onveilig.html leest dat RTG Veilig bestaat, hoort daar meteen te
     lezen wat het NIET is. Een verwijzing zonder die zinnen is een aanbeveling,
     en dat is precies wat deze laag over zichzelf niet mag doen. */
  const bron = lees('public/apps/foundation/onveilig.html');
  assert.match(bron, /RTG Veilig/, 'de pagina hoort RTG Veilig te noemen (HDI.md par. 7 regel 4b)');
  for (const z of ZINNEN) {
    assert.ok(bron.includes(z),
      'onveilig.html verwijst naar RTG Veilig maar mist deze zin: "' + z + '"');
  }
});

test('4. de server geeft de grens mee in zijn eigen antwoord', () => {
  /* Niet via een draaiende server maar op de BRON: veiligBeeld() hoort de
     constante te gebruiken en niet een eigen zin. Een tweede tekst in dat
     bestand is precies wat hier is opgeruimd. */
  const bron = lees('server/kern/veiligheid/index.js');
  assert.match(bron, /GRENS\.VOLLEDIG/,
    'veiligBeeld() hoort ./grens.js te gebruiken in plaats van een eigen zin');
  assert.ok(!/geen alarmcentrale:/.test(bron),
    'in index.js staat weer een eigen variant van de grensregel; die hoort in ./grens.js');
});
