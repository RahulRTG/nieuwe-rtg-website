/* DE RAAKVLAKPOORT MOET DICHT KUNNEN, EN OP DE JUISTE MOMENTEN OPEN BLIJVEN.

   WCAG 2.5.8 vraagt 24 bij 24 CSS-pixels voor alles wat je aanwijst. De
   a11y-scan mat dat niet: structuur en contrast stonden op nul terwijl er 267
   knoppen waren die een hand met tremor niet raakt. Sinds die ronde bestaat
   (scripts/raakvlakkeuring.js) hoort er ook een toets bij, en om dezelfde reden
   als bij velt(): een poort die je nooit hebt zien dichtgaan is geen poort
   (LAT.md regel 9).

   Twee dingen staan hier apart, want ze kunnen los stuk:

     1. HET OORDEEL. Leest de grens uit het register en zakt bij een raakvlak
        erboven -- ook bij precies een erboven, want zo sluipt het erin.
     2. DE MEETREGEL ZELF. De twee uitzonderingen die WCAG maakt (een link IN
        een zin, en wat niet in beeld staat) moeten er zijn, en ze moeten niet
        te ruim zijn. Die kant is belangrijker dan de andere: een uitzondering
        die te veel doorlaat maakt de hele ronde een groene leugen.

   De meetregel draait hier op een NAGEMAAKTE pagina en niet in een browser. Dat
   kan omdat raakvlakInPagina alleen document.querySelectorAll, getComputedStyle
   en getBoundingClientRect gebruikt -- drie dingen die je kunt neerzetten.

   Draai los: node --test test/raakvlak.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { veltRaakvlak, raakvlakInPagina, GRENS } = require('../scripts/raakvlakkeuring');

test('de grens staat op 24, want dat is wat WCAG 2.5.8 vraagt', () => {
  assert.equal(GRENS, 24);
});

test('een raakvlak erbij laat de poort zakken', () => {
  const uit = veltRaakvlak(1, 0);
  assert.equal(uit.faalt, true, 'een enkele erbij hoort al te zakken -- zo sluipt het erin');
  assert.match(uit.melding, /BIJGEKOMEN/);
  assert.match(uit.melding, /24x24/, 'de melding hoort te zeggen waar de grens ligt');
});

test('op de grens blijft de poort open', () => {
  const uit = veltRaakvlak(3, 3);
  assert.equal(uit.faalt, false);
  assert.equal(uit.melding, '', 'precies op de grens is er niets te melden');
});

test('onder de grens gaat de poort niet open maar wel strakker, en zegt dat', () => {
  const uit = veltRaakvlak(1, 5);
  assert.equal(uit.faalt, false);
  assert.match(uit.melding, /strakker/, 'wie er onder komt hoort te horen dat de grens omlaag kan');
});

test('een ontbrekende grens telt als nul en niet als vrijbrief', () => {
  /* Het register kan een sleutel missen. Dan hoort de poort STRENG te zijn:
     een undefined die als oneindig leest, is een poort die stilletjes uit gaat. */
  assert.equal(veltRaakvlak(1, undefined).faalt, true);
  assert.equal(veltRaakvlak(0, undefined).faalt, false);
});

/* ---- de meetregel zelf, op een nagemaakte pagina ------------------------- */

function nepPagina(elementen) {
  const els = elementen.map((e) => {
    const el = {
      tagName: e.tag.toUpperCase(),
      id: e.id || '',
      className: e.klasse || '',
      textContent: e.tekst || '',
      disabled: false,
      tabIndex: 0,
      parentElement: null,
      _stijl: Object.assign({ display: 'block', visibility: 'visible', opacity: '1' }, e.stijl || {}),
      _maat: { width: e.w, height: e.h },
      getAttribute: (n) => (e.attr && e.attr[n]) || null,
      getClientRects: () => [1],
      getBoundingClientRect: () => ({ width: e.w, height: e.h })
    };
    return el;
  });
  elementen.forEach((e, i) => {
    if (e.ouder != null) {
      els[i].parentElement = { tagName: e.ouder.tag.toUpperCase(), textContent: e.ouder.tekst,
        getAttribute: () => null, parentElement: null };
    }
  });
  global.document = { querySelectorAll: () => els };
  global.getComputedStyle = (el) => el._stijl || { display: 'block', visibility: 'visible', opacity: '1' };
  return els;
}

function meet(elementen) {
  const oudDoc = global.document, oudStijl = global.getComputedStyle;
  try { nepPagina(elementen); return raakvlakInPagina(24); }
  finally { global.document = oudDoc; global.getComputedStyle = oudStijl; }
}

test('een knop onder 24 wordt gemeld, met zijn maat erbij', () => {
  const uit = meet([{ tag: 'button', id: 'klein', tekst: 'Ververs', w: 49, h: 19 }]);
  assert.equal(uit.klein.length, 1);
  assert.match(uit.klein[0], /button#klein/);
  assert.match(uit.klein[0], /49x19/, 'zonder de maat erbij kan niemand hem terugvinden');
});

test('precies 24x24 is groot genoeg', () => {
  assert.equal(meet([{ tag: 'button', tekst: 'ok', w: 24, h: 24 }]).klein.length, 0);
});

test('een te smalle knop telt net zo goed als een te lage', () => {
  /* Dit was echt zo op kantoor.html: een naam van drie letters, 15 breed en 24
     hoog. Wie alleen op hoogte meet, mist die. */
  assert.equal(meet([{ tag: 'a', tekst: 'Rit', w: 15, h: 24 }]).klein.length, 1);
});

test('een link IN een zin valt onder de uitzondering van WCAG zelf', () => {
  const uit = meet([{ tag: 'a', tekst: 'lees dit', w: 50, h: 16,
    ouder: { tag: 'p', tekst: 'Er staat hier een hele zin en daarin staat lees dit ergens in het midden.' } }]);
  assert.equal(uit.klein.length, 0, 'de regelhoogte van de tekst eromheen begrenst hem, en dat zondert WCAG uit');
});

test('een link die in zijn eentje een alinea vult is GEEN link in een zin', () => {
  /* De uitzondering hangt aan "in een zin". Zonder deze grens zou elke <a> in
     een <p> gratis doorgang krijgen, en dat is precies hoe een uitzondering een
     groene leugen wordt. */
  const uit = meet([{ tag: 'a', tekst: 'Naar de zaak-app', w: 157, h: 20,
    ouder: { tag: 'p', tekst: 'Naar de zaak-app' } }]);
  assert.equal(uit.klein.length, 1);
});

test('wat niet in beeld staat hoeft niet te raken te zijn', () => {
  const uit = meet([
    { tag: 'button', tekst: 'weg', w: 10, h: 10, stijl: { display: 'none' } },
    { tag: 'button', tekst: 'doorzichtig', w: 10, h: 10, stijl: { opacity: '0' } },
    { tag: 'button', tekst: 'verborgen', w: 10, h: 10, attr: { 'aria-hidden': 'true' } }
  ]);
  assert.equal(uit.klein.length, 0, 'drie manieren om weg te zijn, en alle drie tellen niet mee');
});

test('de ronde vertelt ook hoeveel er gekeken is', () => {
  /* Zonder dat getal is nul niet van "niets gevonden om te meten" te
     onderscheiden -- en dat verschil is het hele punt van deze ronde. */
  const uit = meet([
    { tag: 'button', tekst: 'a', w: 40, h: 40 },
    { tag: 'button', tekst: 'b', w: 10, h: 10 }
  ]);
  assert.equal(uit.gekeken, 2);
  assert.equal(uit.klein.length, 1);
});

/* ---------------------------------------------------------------------------
   DE COOKIEBALK WERD DOOR DEZE RONDE NOOIT GEZIEN, EN DROEG TWEE TE KLEINE
   RAAKVLAKKEN.

   Dit is een gat in de MEETOPZET en niet in de meetregel. public/shared/cookie.js
   begint met `if (localStorage.getItem(SLEUTEL)) return;` -- de balk verdwijnt
   zodra iemand een keer heeft bevestigd. De raakvlakronde draait INGELOGD, dus
   zag hij een banner die er niet meer was, en de nulstand in A11Y-INGELOGD.json
   klopte alleen voor de tweede bezoeker. In een verse browser stonden er twee
   raakvlakken van 17px hoog (`Privacy` en `Prima`) op ELK scherm van dit huis.

   Gemeten in een echte browser op 390x844: 17 hoog, 22 breed. Nu 24 bij 24, met
   de onderlijn op de tekst in plaats van op de rand van het vakje -- anders
   zakt de streep mee omlaag als het raakvlak groeit.

   Deze toets kijkt naar de STIJLREGEL en niet naar een browser, want dat is de
   plek waar het fout ging en de plek waar het terug kan sluipen. */
test('de cookiebalk haalt de 24 pixels, ook bij het eerste bezoek', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '../public/shared/cookie.js'), 'utf8');
  const regel = (bron.match(/#rtg-cookie a,#rtg-cookie button\{[^}]*\}/) || [''])[0];
  assert.ok(regel, 'de stijlregel voor de klikbare woorden is er niet meer');
  assert.match(regel, new RegExp('min-height:' + GRENS + 'px'),
    'de klikbare woorden in de cookiebalk zijn lager dan WCAG 2.5.8 vraagt');
  assert.match(regel, new RegExp('min-width:' + GRENS + 'px'),
    'de klikbare woorden in de cookiebalk zijn smaller dan WCAG 2.5.8 vraagt');
  /* EN NIET TERUG NAAR border-bottom: die zit op de rand van het vakje, dus met
     een raakvlak van 24px komt de streep los van de tekst te hangen. */
  assert.ok(!/border-bottom:\s*1px/.test(regel),
    'de onderlijn zit weer op de rand van het vakje; dan hangt hij los van het woord');
});
