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
// alle hexkleuren die in een verloop van dit materiaal voorkomen
function glansTonen(naam) {
  var m = new RegExp('--' + naam + '-glans\\s*:\\s*([^;]+);').exec(CSS);
  assert.ok(m, naam + ' hoort een glanslaag te hebben; zonder glans is het geverfd karton');
  return (m[1].match(/#[0-9A-Fa-f]{6}/g) || []).map(function (h) {
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
  assert.ok(c.b > 40, 'goud met bijna geen blauw is puur geel en dus glitter (' + c.hex + ')');
  assert.ok(c.r < 230, 'een uitgeblazen goud is een spiegel; dit hoort mat te zijn (' + c.hex + ')');
  // geborsteld metaal heeft EEN lichtrichting: drie stops, niet tien
  var tonen = glansTonen('gold');
  assert.ok(tonen.length <= 3, 'meer dan drie lichtpunten maakt van geborsteld goud glitter');
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
