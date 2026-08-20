/* Eigen a11y-keuring (scripts/a11ykeuring.js), die axe-core verving. De keuring
   zelf draait in de browser (scripts/a11y.js); hier toetsen we de PURE kern in
   Node -- kleur/luminantie/contrast-wiskunde en de conservatieve predicaten
   (mist-alt/naam/label) -- plus dat de geïnjecteerde BRON syntactisch klopt.
   Los: node --test test/a11ykeuring.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const k = require('../scripts/a11ykeuring');

// klein DOM-element-mock voor de predicaten
function elm(tag, attrs = {}, text = '') {
  return {
    tagName: tag.toUpperCase(), _a: attrs, _t: text,
    getAttribute(n) { return n in this._a ? this._a[n] : null; },
    hasAttribute(n) { return n in this._a; },
    get textContent() { return this._t; },
    get value() { return this._a.value; },
    closest() { return null; }, querySelector() { return null; }
  };
}

test('kleur ontleedt rgb/rgba en weigert de rest', () => {
  assert.deepEqual(k.kleur('rgb(255, 255, 255)'), [255, 255, 255, 1]);
  assert.deepEqual(k.kleur('rgba(12, 12, 11, 0.5)'), [12, 12, 11, 0.5]);
  assert.equal(k.kleur('transparent'), null);
  assert.equal(k.kleur(''), null);
});

test('luminantie en contrastverhouding kloppen met WCAG', () => {
  assert.ok(Math.abs(k.luminantie([255, 255, 255]) - 1) < 1e-9);
  assert.ok(k.luminantie([0, 0, 0]) < 1e-9);
  assert.ok(Math.abs(k.ratio([255, 255, 255], [0, 0, 0]) - 21) < 0.01, 'wit op zwart = 21:1');
  assert.ok(Math.abs(k.ratio([0, 0, 0], [0, 0, 0]) - 1) < 1e-9, 'gelijk = 1:1');
  // wit op het huismerk-zwart (#0C0C0B) is ruim voldoende
  assert.ok(k.ratio([255, 255, 255], [12, 12, 11]) > 18);
});

test('grootTekst volgt de WCAG-grenzen (24px, of 18.66px vet)', () => {
  assert.equal(k.grootTekst(24, 400), true);
  assert.equal(k.grootTekst(16, 400), false);
  assert.equal(k.grootTekst(19, 700), true);
  assert.equal(k.grootTekst(16, 700), false);
});

test('naam: vindt een toegankelijke naam via alle gangbare mechanismen', () => {
  global.document = { getElementById: () => null };
  try {
    assert.equal(k.naam(elm('button', { 'aria-label': 'Sluiten' })), 'Sluiten');
    assert.equal(k.naam(elm('a', {}, 'Naar huis')), 'Naar huis');
    assert.equal(k.naam(elm('button', { title: 'Menu' })), 'Menu');
    assert.equal(k.naam(elm('button', {})), '', 'geen enkele naam -> leeg');
  } finally { delete global.document; }
});

test('mistAlt: alleen als er echt geen alt en geen presentation/hidden is', () => {
  assert.equal(k.mistAlt(elm('img', {})), true);
  assert.equal(k.mistAlt(elm('img', { alt: '' })), false, 'lege alt is bewust-decoratief, geen overtreding');
  assert.equal(k.mistAlt(elm('img', { alt: 'Logo' })), false);
  assert.equal(k.mistAlt(elm('img', { role: 'presentation' })), false);
  assert.equal(k.mistAlt(elm('img', { 'aria-hidden': 'true' })), false);
});

test('mistNaam: knop/link zonder enige naam', () => {
  global.document = { getElementById: () => null };
  try {
    assert.equal(k.mistNaam(elm('button', {})), true);
    assert.equal(k.mistNaam(elm('button', {}, 'OK')), false);
    assert.equal(k.mistNaam(elm('a', { 'aria-hidden': 'true' })), false, 'verborgen telt niet');
  } finally { delete global.document; }
});

test('mistLabel: veld zonder label/aria/title/placeholder (conservatief, geen vals alarm)', () => {
  assert.equal(k.mistLabel(elm('INPUT', {})), true);
  assert.equal(k.mistLabel(elm('INPUT', { 'aria-label': 'E-mail' })), false);
  assert.equal(k.mistLabel(elm('INPUT', { title: 'Zoek' })), false);
  assert.equal(k.mistLabel(elm('INPUT', { placeholder: 'E-mail' })), false, 'placeholder telt mee, zoals axe');
  assert.equal(k.mistLabel(elm('INPUT', { type: 'hidden' })), false);
  assert.equal(k.mistLabel(elm('INPUT', { type: 'submit' })), false);
  // een veld met een gekoppeld <label> (via de .labels-NodeList) is niet ongelabeld
  const metLabel = elm('INPUT', {}); metLabel.labels = [{}];
  assert.equal(k.mistLabel(metLabel), false);
});

/* De poort die contrast fataal maakt. Stond eerder als twee losse if-regels
   onderin scripts/a11y.js, en was daarmee alleen te bewijzen door een echte
   pagina met een echt contrastgat te bouwen -- dus in de praktijk niet. */
test('velt: contrast laat de keuring nu falen, net als een structurele fout', () => {
  assert.equal(k.velt(0, 0).faalt, false, 'schoon is schoon');
  assert.deepEqual(k.velt(0, 0).melding, [], 'en dan valt er niets te melden');

  const alleenContrast = k.velt(0, 3);
  assert.equal(alleenContrast.faalt, true,
    'drie contrastovertredingen zonder structurele fout horen de bouw te laten falen; adviserend was de oude stand');
  assert.match(alleenContrast.melding.join(' '), /3 contrastovertreding/);

  assert.equal(k.velt(2, 0).faalt, true, 'structureel blijft fataal');
  assert.equal(k.velt(2, 3).melding.length, 2, 'allebei gemeld, zodat een ronde beide laat zien');
});

test('BRON is syntactisch geldige browsercode en bevat de instap', () => {
  assert.match(k.BRON, /window\.__a11yKeur = keurInPagina/);
  // parse-check zonder uitvoeren: new Function gooit bij een syntaxfout
  assert.doesNotThrow(() => new Function('window', 'document', 'getComputedStyle', 'CSS', k.BRON));
});

/* ---------- de grond onder de tekst ----------
   Deze drie toetsen bestaan omdat de keuring tot 19 augustus 2026 maar 38% van
   de tekst woog: hij gaf op zodra er een verloop in de keten stond, en de
   themalaag geeft `body` er een. Gemeten over 258 schermen in twee thema's:
   1884 elementen gewogen, 3042 overgeslagen, alle 3042 om die ene reden. */

test('lagen van een achtergrond worden gesplitst op de komma BUITEN de haakjes', () => {
  /* DE MUTATIE: splits gewoon op ','. Dan valt `rgba(255,211,135,.32)` in
     stukken en klopt er niets meer van de kleuren. Dit is precies de fout die
     de hero van bestellen.html als wit-op-bijna-wit meldde. */
  const lagen = k.laagStukken(
    'radial-gradient(circle at 88% 25%,rgba(255,211,135,.32),transparent 32%), linear-gradient(135deg,rgb(58,17,29),rgb(120,27,53))');
  assert.equal(lagen.length, 2, 'twee lagen, niet zes brokstukken');
  assert.match(lagen[0], /^radial-gradient/);
  assert.match(lagen[1], /^linear-gradient/);
});

test('een dekkende laag verbergt alles eronder', () => {
  /* Zonder dit onderscheid telt een lichte glans OVER een dekkend donker
     verloop mee als mogelijke grond, en dan lijkt witte tekst onleesbaar
     terwijl er niets mis is.
     DE MUTATIE: laat dektHelemaal altijd false teruggeven. */
  assert.equal(k.dektHelemaal([[58, 17, 29, 1], [120, 27, 53, 1]]), true);
  assert.equal(k.dektHelemaal([[255, 211, 135, 0.32], [0, 0, 0, 0]]), false);
});

test('doorzichtige lagen mengen zoals de browser dat doet', () => {
  /* DE MUTATIE: laat mengOver de alfa negeren en de bovenste kleur teruggeven.
     Dan wordt een wash van 20% opeens de hele grond. */
  assert.deepEqual(k.mengOver([255, 255, 255, 0.5], [0, 0, 0]), [128, 128, 128]);
  assert.deepEqual(k.mengOver([10, 20, 30, 1], [200, 200, 200]), [10, 20, 30]);
  assert.deepEqual(k.mengOver([255, 0, 0, 0], [12, 12, 11]), [12, 12, 11]);
});

test('van een verloop tellen alleen de uitersten', () => {
  /* Wat tussen de lichtste en de donkerste toon ligt kan nooit ongunstiger zijn
     dan een van die twee. Zonder deze inperking groeit het aantal kandidaten
     met elke laag erop.
     DE MUTATIE: geef alle stops terug. De toets hieronder telt er dan drie. */
  const uit = k.uitersten([[58, 17, 29, 1], [120, 27, 53, 1], [173, 91, 59, 1]]);
  assert.equal(uit.length, 2, 'lichtste en donkerste, meer niet');
  assert.deepEqual(uit[0], [173, 91, 59, 1]);
  assert.deepEqual(uit[1], [58, 17, 29, 1]);
});

/* ---------- de letter zelf ----------
   Deze toets bestaat omdat de keuring tot 20 augustus 2026 elke tekst met een
   ALFA in zijn kleur ongewogen liet passeren: `if (fg[3] < 1) return`. Gemeten
   over alle schermen in drie thema's: 1968 van de 5977 tekstelementen, 32,9% --
   de grootste blinde vlek die deze poort had, en precies de groep waar de
   zachte tonen van dit huis in wonen (--rtg-muted en --rtg-soft staan als
   rgba() in de themalaag). */

test('een halfdoorzichtige letter wordt over zijn grond gemengd, niet overgeslagen', () => {
  /* DE MUTATIE: laat opGrond de fg ongemengd wegen (ratio(fg, k) in plaats van
     ratio(mengOver(fg, k), k)). Wit-met-alfa-0,4 op zwart meet dan 21:1 terwijl
     er in werkelijkheid donkergrijs op zwart staat. */
  const uit = k.opGrond([255, 255, 255, 0.4], [[12, 12, 11]]);
  assert.deepEqual(uit.inkt, [109, 109, 109], 'wit op 40% over bijna-zwart is middengrijs');
  assert.ok(uit.verhouding < 4.5, 'en dat haalt de norm niet: ' + uit.verhouding);
  // dekkend blijft precies wat het was
  assert.equal(Math.round(k.opGrond([255, 255, 255, 1], [[12, 12, 11]]).verhouding * 100) / 100,
    Math.round(k.ratio([255, 255, 255], [12, 12, 11]) * 100) / 100);
});

test('over een verloop telt de ongunstigste combinatie, per kandidaat gemengd', () => {
  /* Een letter met alfa is op elke toon van het verloop een ANDERE kleur, dus
     eerst mengen en dan vergelijken -- niet andersom.
     DE MUTATIE: meng EEN keer, over kandidaten[0], en vergelijk die ene inkt
     met alle gronden. Hieronder staat de donkere grond voorop, dus die menging
     levert middengrijs -- en dan meet de witte grond 3,68 in plaats van 1,03 en
     verdwijnt de bevinding. Vandaar dat de donkere hier eerst staat. */
  const uit = k.opGrond([255, 255, 255, 0.5], [[12, 12, 11], [255, 255, 255]]);
  assert.deepEqual(uit.grond, [255, 255, 255], 'op wit is een halve witte letter het slechtst af');
  assert.ok(uit.verhouding < 1.1, 'wit op wit blijft wit: ' + uit.verhouding);
});
