/* RTG Materialen & Licht: de regels uit MATERIAAL.md, machinaal gehandhaafd.

   Wat hier gemeten wordt zijn geen smaakoordelen maar eigenschappen van een
   materiaal. "Pearl is warm" is te toetsen: rood mag niet onder blauw zakken.
   "Goud is mat" ook: een te verzadigde geeltoon is geen geborsteld goud maar
   internet-goud. En "fluweel absorbeert licht" betekent dat bordeaux donker
   hoort te zijn -- als het oplicht is het geen fluweel meer.

   Wat deze toets NIET doet: bepalen of iets mooi is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'public/shared/rtg-materiaal.css'), 'utf8');

function hex(naam) {
  var m = new RegExp('--' + naam + '\\s*:\\s*(#[0-9A-Fa-f]{6})').exec(CSS);
  assert.ok(m, 'token --' + naam + ' hoort te bestaan als hexwaarde');
  return { r: parseInt(m[1].slice(1, 3), 16), g: parseInt(m[1].slice(3, 5), 16), b: parseInt(m[1].slice(5, 7), 16), hex: m[1] };
}
/* Alle hexkleuren die in een verloop van dit materiaal voorkomen.

   Het verloop noemt zijn tonen sinds kort bij NAAM (var(--pearl-hoog) in
   plaats van #FBF8F3), zodat een wijzerplaat hetzelfde materiaal kan gebruiken
   zonder de hexcodes over te tikken. Deze toets moet die verwijzing dus
   volgen -- deed hij dat niet, dan las hij nul tonen en zweeg hij vrolijk over
   elk materiaal. Precies dat gebeurde bij de eerste poging: de onyx-toets
   zakte (0 >= 2 is onwaar) maar de goud-toets "slaagde" met nul lichtpunten. */
function losOp(waarde, diepte) {
  return waarde.replace(/var\(\s*(--[\w-]+)\s*\)/g, function (heel, naam) {
    if ((diepte || 0) > 4) return heel;             // geen eindeloze kring
    var m = new RegExp('\\' + naam + '\\s*:\\s*([^;]+);').exec(CSS);
    return m ? losOp(m[1].trim(), (diepte || 0) + 1) : heel;
  });
}
function glansTonen(naam) {
  var m = new RegExp('--' + naam + '-glans\\s*:\\s*([^;]+);').exec(CSS);
  assert.ok(m, naam + ' hoort een glanslaag te hebben; zonder glans is het geverfd karton');
  var opgelost = losOp(m[1]);
  /* GEEN ENKELE verwijzing mag blijven staan. "Er kwamen kleuren uit" is te
     zwak: bij een dood var() tussen twee goede tonen leest de toets er nog
     twee, en dan keurt hij een verloop goed waarvan een derde ontbreekt.
     Gemeten met de mutatie var(--pearl-bestaatniet): die zakte hier pas. */
  var rest = opgelost.match(/var\(\s*--[\w-]+/g);
  assert.ok(!rest, naam + '-glans houdt een verwijzing over die nergens heen wijst: ' +
    (rest || []).join(', ') + ' -- een verloop dat de toets niet kan lezen, kan de toets ' +
    'ook niet bewaken');
  var tonen = opgelost.match(/#[0-9A-Fa-f]{6}/g) || [];
  assert.ok(tonen.length, naam + '-glans levert geen enkele kleur op');
  return tonen.map(function (h) {
    return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), hex: h };
  });
}

const MATERIALEN = ['pearl', 'gold', 'onyx', 'bordeaux', 'royal'];

test('elk materiaal heeft alle drie de lagen: basis, glans en rand', () => {
  /* Een vlak dat alleen een basiskleur heeft is geverfd karton. Pas met glans
     (hoe licht erop valt) en rand (wat de rand met licht doet) wordt het een
     materiaal (MATERIAAL.md, "licht is een eigenschap"). */
  MATERIALEN.forEach(function (m) {
    ['basis', 'glans', 'rand'].forEach(function (laag) {
      assert.match(CSS, new RegExp('--' + m + '-' + laag + '\\s*:'),
        m + ' mist de laag "' + laag + '"');
    });
    assert.match(CSS, new RegExp('--op-' + m + '\\s*:'),
      m + ' hoort te zeggen wat er leesbaar op staat');
  });
});

/* DE KERNTOETS VAN PEARL.

   DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: maak van --pearl-basis een koel wit
   zoals #F2F4F8. Dat ziet er op een scherm prima uit -- schoon zelfs -- en is
   precies het verkeerde materiaal: klinisch in plaats van keramiek. Het
   verschil is aan een hexcode niet te zien maar wel te meten. */
test('Pearl is warm: nooit meer blauw dan rood', () => {
  ['pearl-basis', 'pearl-diep'].forEach(function (t) {
    var c = hex(t);
    assert.ok(c.r >= c.g && c.g >= c.b,
      t + ' (' + c.hex + ') is niet warm: verwacht rood >= groen >= blauw, ' +
      'want Pearl is gepolijst keramiek en geen klinisch wit');
  });
  glansTonen('pearl').forEach(function (c) {
    assert.ok(c.r > c.b, 'een Pearl-glanstoon (' + c.hex + ') mag nooit koeler zijn dan warm');
  });
});

test('Gold is mat champagne, geen internet-goud', () => {
  /* #FFD700 en familie zijn te verzadigd en te geel: dat leest als glitter en
     niet als geborsteld metaal. De maat: er hoort ECHT rood in te zitten (geen
     puur geel, dus blauw niet op nul) en de basis mag niet uitgeblazen zijn. */
  var c = hex('gold-basis');
  assert.ok(c.r > c.g && c.g > c.b, 'goud loopt warm af: rood > groen > blauw');
  /* Op HELDERHEID en niet op het blauwkanaal. De eerste versie van deze toets
     eiste blauw > 40 "want anders is het puur geel", en dat zou de echte
     logotoon #857007 (blauw = 7) hebben afgekeurd terwijl die juist de norm is.
     Wat glitter van geborsteld goud onderscheidt is licht: #FFD700 heeft
     helderheid 202, het logogoud 106. Een regel die het merk afkeurt is geen
     regel maar een fout. */
  var licht = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  assert.ok(licht < 160, 'goud met helderheid ' + Math.round(licht) +
    ' is internet-goud (' + c.hex + '); geborsteld champagne blijft mat en diep');
  // geborsteld metaal heeft EEN lichtrichting: drie stops, niet tien
  var tonen = glansTonen('gold');
  assert.ok(tonen.length <= 3, 'meer dan drie lichtpunten maakt van geborsteld goud glitter');
});

/* DE ANKERTOETS. Zonder deze kan een materiaal langzaam wegdrijven van het
   beeldmerk zonder dat iemand het merkt -- en dat is precies wat er gebeurd was:
   een verzonnen champagne en een verzonnen wijn stonden er een commit lang in.

   DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: zet --gold-basis terug op #B99A55.
   Dat ziet er prima uit, haalt alle andere toetsen, en is niet het logo. */
test('goud en bordeaux zijn EXACT de tonen uit het logo', () => {
  assert.equal(hex('gold-basis').hex.toUpperCase(), '#857007',
    'de goudtoon hoort exact het logogoud te zijn (CLAUDE.md: kleuren komen uit het logo)');
  assert.equal(hex('bordeaux-basis').hex.toUpperCase(), '#7F1634',
    'de bordeauxtoon hoort exact het logobordeaux te zijn');
});

/* De logotoon is het materiaal in RUST en niet automatisch een tekstkleur.
   #857007 haalt op onyx 4,02:1 en op fluweel 2,09:1 -- allebei onder de norm.
   Daarom is er een aparte tekstkleur, en die MOET het wel halen.

   DE MUTATIE: zet --gold-tekst gelijk aan --gold-basis. Het ziet er dan
   ingetogen uit en is precies waar iemand op een telefoon zijn ogen op stukkijkt. */
test('goud op donker haalt de contrastnorm', () => {
  function lin(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function L(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  function cr(a, b) { var x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  var r = cr(hex('gold-tekst'), hex('onyx-basis'));
  assert.ok(r >= 4.5, 'goud-op-onyx haalt maar ' + r.toFixed(2) +
    ':1; de norm is 4,5 en de logotoon zelf haalt hem daar niet');

  /* Op FLUWEEL werkt goud helemaal niet: de logotoon haalt 2,09:1 en zelfs het
     hoogsel maar 4,21:1. Daar is de leeskleur ivoor, en dat hoort deze toets
     ook te bewijzen -- anders lost iemand het "op" met nog lichter goud en
     verliest het merk zijn goud. */
  var opFluweel = cr(hex('op-bordeaux'), hex('bordeaux-basis'));
  assert.ok(opFluweel >= 4.5, 'de leeskleur op fluweel haalt maar ' + opFluweel.toFixed(2) + ':1');
  assert.ok(cr(hex('gold-tekst'), hex('bordeaux-basis')) < 4.5,
    'zou goud op fluweel de norm halen, dan mag deze regel weg -- nu niet');
});

test('Bordeaux is fluweel: het absorbeert licht', () => {
  /* Het oude accent (#C23A5E) was rood; dit hoort wijn te zijn -- bijna zwart
     tot er licht op valt. De maat is de helderheid van de basis. */
  var c = hex('bordeaux-basis');
  var licht = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  assert.ok(licht < 60, 'bordeaux (' + c.hex + ', helderheid ' + Math.round(licht) +
    ') licht te veel op; fluweel absorbeert licht en lijkt bijna zwart');
  assert.ok(c.r > c.b, 'en als het licht vangt hoort het rood te zijn, niet paars');
});

test('Onyx is pianolak en geen egale verf', () => {
  var tonen = glansTonen('onyx');
  assert.ok(tonen.length >= 2, 'pianolak heeft een verloop; egaal zwart is verf');
  var uniek = new Set(tonen.map(function (t) { return t.hex.toLowerCase(); }));
  assert.ok(uniek.size >= 2, 'een verloop met overal dezelfde toon is geen verloop');
});

test('Royal is het enige materiaal dat koel mag zijn', () => {
  var c = hex('royal-basis');
  assert.ok(c.b > c.r, 'Royal is koningsblauw, dus blauw hoort te overheersen');
  // en de andere vier zijn dat dus NIET
  ['pearl-basis', 'gold-basis', 'bordeaux-basis'].forEach(function (t) {
    var x = hex(t);
    assert.ok(x.r >= x.b, t + ' (' + x.hex + ') is koel, en dat mag alleen Royal zijn');
  });
});

test('diepte komt uit rand en glans, niet uit een slagschaduw', () => {
  /* Een wolk onder een kaart is het tegenovergestelde van een materiaal: het is
     een effect. De materiaalvlakken zetten box-shadow daarom expliciet uit. */
  var blok = /\.rtg-vlak-pearl[\s\S]*?\{([\s\S]*?)\}/.exec(CSS);
  assert.ok(blok, 'de materiaalvlakken horen een gedeelde regel te hebben');
  assert.match(CSS, /box-shadow\s*:\s*none/,
    'de materiaalvlakken horen slagschaduw uit te zetten');
});

test('er zijn precies twee letterrollen, en alles loopt daardoorheen', () => {
  /* Zodat het wisselen van de werkletter later EEN regel is. Een blad dat zelf
     een familie noemt, breekt die belofte stilletjes. */
  assert.match(CSS, /--rtg-display\s*:/, 'de display-rol hoort te bestaan');
  assert.match(CSS, /--rtg-interface\s*:/, 'de interface-rol hoort te bestaan');

  var families = CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/font-family\s*:\s*([^;]+);/g) || [];
  families.forEach(function (f) {
    assert.ok(/var\(--rtg-(display|interface)\)/.test(f),
      'dit blad noemt een letterfamilie buiten de twee rollen om: ' + f.trim());
  });
});
