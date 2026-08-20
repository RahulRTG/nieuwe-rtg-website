/* DE KLEUR VAN DE iOS-BALK, EN WAAROM DAAR EEN METER ONDER HOORT.

   De acties rechtsboven in de balk en de terugknop links stonden op
   --ios-accent, en dat is de DAGKLEUR: zestien ankertinten (vier seizoenen x
   vier zonstanden) met een interpolatie ertussen, dus de kleur van die tekst
   hing af van het seizoen en het uur van de dag.

   DE CONTRASTPOORT ZIET DIT NOOIT, en dat is geen fout van de poort. De balk is
   `rgba(12,12,11,0.72)` over een body met een verloop; `achtergrond()` in
   scripts/a11ykeuring.js slaat een onoplosbare grond bewust over, want gokken is
   erger dan overslaan. Gevolg: "contrast 0 van 259" dekte deze tekst niet, en de
   fout kon er maanden staan zonder dat iets uitsloeg.

   Deze toets vult dat gat op de ENIGE manier die hier kan: niet door een scherm
   te openen, maar door de grond zelf uit te rekenen -- de balk is een bekende
   kleur met een bekende dekking over een bekende grond, dus dat is een som en
   geen aanname. Hij rekent met dezelfde ratio() als de keuring, zodat er niet
   twee rekenregels ontstaan (LAT.md regel 4).

   Draai los: node --test test/balkkleur.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ratio } = require('../scripts/a11ykeuring');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const IOS = lees('public/shared/ios.css');
const DAG = lees('public/shared/dagkleur.css');
const MATERIAAL = lees('public/shared/rtg-materiaal.css');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const meng = (voor, a, achter) => voor.map((v, i) => Math.round(a * v + (1 - a) * achter[i]));

/* De vier gronden die de balk kan hebben. Ze komen uit de themalaag en niet uit
   dit bestand: champagne is parel, de andere drie zijn donker. Verandert een
   thema van grond, dan hoort deze lijst mee te veranderen -- en dan zakt deze
   toets, wat precies de bedoeling is. */
const THEMAGROND = { onyx: '#0C0C0B', bordeaux: '#4A0C1E', royal: '#101E3F', champagne: '#F4F0E9' };
const BALK = hex('#0C0C0B');
const DEKKING = 0.72;
const gronden = Object.entries(THEMAGROND).map(([n, g]) => [n, meng(BALK, DEKKING, hex(g))]);

/* De maat van de balk staat vast in ios.css: 17px, gewicht 400. Dat is geen
   grote tekst (WCAG: 24px, of 18,66px vet), dus de norm is 4,5 en niet 3. */
const NORM = 4.5;

function tokenWaarde(blad, naam) {
  const m = blad.match(new RegExp('--' + naam + ':\\s*([^;]+);'));
  return m ? m[1].trim() : null;
}
function hexVan(waarde, bladen) {
  if (/^#[0-9A-Fa-f]{6}$/.test(waarde)) return waarde;
  const v = waarde.match(/var\(\s*--([a-z0-9-]+)\s*(?:,\s*(#[0-9A-Fa-f]{6}))?\s*\)/i);
  if (!v) return null;
  for (const b of bladen) {
    const w = tokenWaarde(b, v[1]);
    if (w) { const r = hexVan(w, bladen); if (r) return r; }
  }
  return v[2] || null;   // de terugval in de var() zelf
}

test('de labels in de balk staan niet in de dagkleur', () => {
  /* DE MUTATIE: zet color van .ios-nav-acties > * of .ios-terug terug op
     var(--ios-accent). Op het scherm van vandaag ziet dat er prima uit -- deze
     fout is per seizoen en per uur zichtbaar, en op de helft van de dagen niet.
     Precies daarom staat hij hier en niet in een oog. */
  const tekstregels = IOS.split('}').filter((b) => /color\s*:\s*var\(--ios-accent\)/.test(b));
  assert.equal(tekstregels.length, 0,
    'er staat weer tekst in --ios-accent (de dagkleur) in de balk:\n' +
    tekstregels.map((r) => r.trim().slice(0, 120)).join('\n'));
});

test('de dagkleur is nergens in de gedeelde bladen nog een TEKSTkleur', () => {
  /* Dezelfde fout stond op vier plekken in de UI-kit, waar de dagkleur
     --rtg-acc heet: de weg terug (twee keer), het merk-plaatje en de hover van
     een knoprij. Daar is de grond de PAGINA en niet de balk, en dan is het beeld
     even slecht: 3 tot 4 van de 16 zakken op de donkere thema's en 15 van de 16
     op champagne. Geen enkele tint haalt alle vier.

     DE MUTATIE: zet een van de vier terug op var(--rtg-acc). Op het scherm van
     vandaag ziet dat er goed uit, en op een ander seizoen of een ander thema
     niet -- precies de fout die geen mens op tijd ziet.

     BORDER EN ACHTERGROND MOGEN WEL. Daar is de dagkleur geen tekst en is de
     inkt per tint al uitgerekend (shared/dagkleur.css). Deze toets kijkt dus
     naar `color:` en niet naar `border-color:` of `background:` -- en dat
     onderscheid is de hele reden dat hij met een woordgrens zoekt. */
  for (const blad of ['public/shared/rtg-ui.css', 'public/shared/ios.css']) {
    const bron = lees(blad).replace(/\/\*[\s\S]*?\*\//g, '');
    const treffers = [...bron.matchAll(/(^|[;{\s])color\s*:\s*var\(\s*--(rtg-acc|ios-accent)\s*[,)]/g)];
    assert.equal(treffers.length, 0,
      blad + ' gebruikt de dagkleur weer als tekstkleur (' + treffers.length + 'x); ' +
      'geen enkele van de zestien tinten haalt 4,5:1 op alle vier de thema-gronden');
  }
});

test('de labelkleur haalt de norm op elk van de vier thema-gronden', () => {
  /* DE MUTATIE: zet --ios-label op een van de gedempte tinten, bijvoorbeeld
     var(--rtg-soft). Op onyx haalt die het nog; op champagne, waar de balk naar
     middengrijs composeert, zakt hij -- en dat is precies het geval dat niemand
     ziet omdat bijna niemand dat thema aan heeft staan. */
  const waarde = tokenWaarde(IOS, 'ios-label');
  assert.ok(waarde, 'ios.css draagt geen --ios-label meer');
  const kleur = hexVan(waarde, [IOS, MATERIAAL]);
  assert.ok(kleur, 'de labelkleur is niet tot een hexwaarde te herleiden: ' + waarde);
  for (const [naam, grond] of gronden) {
    const r = ratio(hex(kleur), grond);
    assert.ok(r >= NORM,
      'labelkleur ' + kleur + ' haalt op de balk van thema ' + naam +
      ' maar ' + r.toFixed(2) + ':1 (norm ' + NORM + ' voor 17px regular)');
  }
});

test('de dagkleur kan geen label zijn: 15 van de 16 tinten zakken ergens', () => {
  /* DIT IS DE MEETSTAND EN GEEN WENS. Hij legt vast waarom de vorige keuze niet
     kon, zodat "we kunnen toch gewoon de dagkleur nemen" een getal tegenover
     zich heeft in plaats van een mening.

     De eerste versie van deze toets beweerde dat GEEN ENKELE tint het overal
     haalt. Dat was mijn aanname en hij was onwaar: citroen (#E6C64A) haalt op
     alle vier de gronden 4,5 of meer. De toets zakte er meteen op, en dat is
     precies waarvoor hij er is -- ook tegen de persoon die hem schrijft. Het
     punt blijft staan en wordt er scherper van: EEN tint van de zestien is
     veilig, en een label dat vijftien van de zestien dagen niet te lezen is,
     is geen label.

     DE MUTATIE: verander de norm in 3,0, of maak de tinten zo licht dat ze
     allemaal slagen. Dan zakt deze toets, en terecht: dan is de aanname onder
     --ios-label verouderd en hoort iemand er opnieuw naar te kijken. */
  const tinten = [...DAG.matchAll(/--dag-kleur:(#[0-9A-Fa-f]{6});/g)].map((m) => m[1]);
  assert.equal(tinten.length, 16, 'er horen zestien ankertinten te zijn, gevonden: ' + tinten.length);
  const onveilig = tinten.filter((t) => gronden.some(([, g]) => ratio(hex(t), g) < NORM));
  assert.equal(onveilig.length, 15,
    'het aantal dagtinten dat op minstens een van de vier gronden onder ' + NORM +
    ' zakt is veranderd (' + onveilig.length + ' in plaats van 15); de aanname onder ' +
    '--ios-label is daarmee verouderd en hoort opnieuw gewogen te worden');
});

test('de gemeten cijfers in TOEGANKELIJK.md kloppen nog', () => {
  /* Een document dat een getal noemt dat niet meer klopt, is erger dan een
     document zonder getal.
     DE MUTATIE: verander een grond in THEMAGROND hierboven; dan lopen de
     aantallen uiteen en zakt deze toets. */
  const tinten = [...DAG.matchAll(/--dag-kleur:(#[0-9A-Fa-f]{6});/g)].map((m) => m[1]);
  const donker = gronden.find(([n]) => n === 'onyx')[1];
  const champ = gronden.find(([n]) => n === 'champagne')[1];
  const zaktDonker = tinten.filter((t) => ratio(hex(t), donker) < NORM).length;
  const zaktChamp = tinten.filter((t) => ratio(hex(t), champ) < NORM).length;
  const doc = lees('TOEGANKELIJK.md');
  assert.match(doc, new RegExp('\\\\*\\\\*' + zaktDonker + ' van 16\\\\*\\\\*'),
    'TOEGANKELIJK.md noemt een ander aantal dan de ' + zaktDonker + ' die op een donkere balk zakken');
  assert.match(doc, new RegExp('\\\\*\\\\*' + zaktChamp + ' van 16\\\\*\\\\*'),
    'TOEGANKELIJK.md noemt een ander aantal dan de ' + zaktChamp + ' die op de champagne-balk zakken');
});
