/* LINKS- OF RECHTSHANDIG: DE HAND BEPAALT WAAR DE DINGEN LIGGEN.

   De duimboog van een linkshandige is het spiegelbeeld van die van een
   rechtshandige. Tot 19 augustus 2026 wist geen enkele regel in dit huis van dat
   verschil: de bank stond altijd links en Rahul altijd rechts, dus een
   linkshandige had de bank onder zijn duim en Rahul buiten bereik. In elk
   dialoogvenster lag ANNULEREN het dichtstbij en BEVESTIGEN het verst weg.

   Wat deze toets vasthoudt zijn de drie dingen die stil kapot kunnen gaan:

     1. de leesvolgorde (opslag boven cookie boven standaard) -- want als de
        cookie zou winnen, overschrijft een verouderd blad uit de
        servicewerker-cache de keuze van een mens;
     2. dat een onbekende waarde er niet in komt -- die cookie komt van buiten
        en belandt in een attribuut op <html>;
     3. dat de schilbalk in DOM-VOLGORDE spiegelt en niet met `order` -- want
        `order` verplaatst het beeld en niet wat een schermlezer hoort.

   Bij elke bewering staat de mutatie die hem hoort te laten zakken (LAT.md
   regel 2). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const HAND = fs.readFileSync(path.join(WORTEL, 'public/shared/hand.js'), 'utf8');
const ROMP = fs.readFileSync(path.join(WORTEL, 'public/shared/command/romp.js'), 'utf8');

/* Een browser die genoeg browser is: een <html> met attributen, een opslag en
   een cookie. Meer heeft hand.js niet nodig, en wat hij wel aanraakt hoort hier
   zichtbaar te zijn en niet weggemoffeld in een nepobject dat alles slikt. */
function nepvenster(opts) {
  const attrs = {};
  const opslag = Object.assign({}, (opts || {}).opslag);
  const venster = {
    document: {
      documentElement: {
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => (k in attrs ? attrs[k] : null)
      },
      cookie: (opts || {}).cookie || ''
    },
    localStorage: {
      getItem: (k) => (k in opslag ? opslag[k] : null),
      setItem: (k, v) => { opslag[k] = String(v); },
      removeItem: (k) => { delete opslag[k]; }
    },
    gebeurtenissen: [],
    addEventListener: () => {},
    dispatchEvent: function (e) { this.gebeurtenissen.push(e); return true; },
    CustomEvent: function (naam, init) { this.type = naam; this.detail = (init || {}).detail; }
  };
  venster.window = venster;
  vm.createContext(venster);
  vm.runInContext(HAND, venster);
  return { venster, attrs, opslag };
}

test('zonder iets gezet is de hand rechts, en dat staat meteen op <html>', () => {
  /* DE MUTATIE: zet STANDAARD in hand.js op 'links'. Dan zakt dit, en terecht --
     de standaard is een besluit (de meeste mensen zijn rechtshandig) en geen
     willekeur. */
  const { venster, attrs } = nepvenster({});
  assert.equal(venster.RTGHand.is(), 'rechts');
  assert.equal(attrs['data-hand'], 'rechts', 'het attribuut hoort er bij het laden al te staan');
  assert.equal(venster.RTGHand.links(), false);
});

test('de opslag wint van de cookie, en niet andersom', () => {
  /* DIT IS DE BELANGRIJKSTE VAN DE VIJF. De cookie bestaat alleen zodat de
     SERVER het attribuut vast in de HTML kan zetten (voordeur.js). Zou hij
     winnen, dan overschrijft een verouderd blad uit de servicewerker-cache de
     keuze die een mens net maakte -- en dat is precies het soort fout dat een
     mens laat denken dat de instelling niet werkt.

     DE MUTATIE: draai in lees() de volgorde om naar `uitKoek() || uitOpslag()`.
     Dan zakt deze en blijft de rest groen. */
  const { venster } = nepvenster({ opslag: { rtg_hand: 'links' }, cookie: 'rtg_hand=rechts' });
  assert.equal(venster.RTGHand.is(), 'links');
  /* En de cookie wordt meteen bijgetrokken, anders blijft de server elk volgend
     blad met de verkeerde kant stempelen. */
  assert.match(venster.document.cookie, /rtg_hand=links/);
});

test('een onbekende waarde komt er niet in, uit de cookie noch uit zet()', () => {
  /* Die cookie komt van BUITEN en belandt in een attribuut op <html>. Wat er
     niet uit twee woorden bestaat, hoort er niet doorheen te komen.

     DE MUTATIE: haal de GOED-controle uit zet(), of vervang de cookie-regex
     door /rtg_hand=([^;]+)/. */
  const { venster, attrs } = nepvenster({ cookie: 'rtg_hand=" onload=alert(1)' });
  assert.equal(venster.RTGHand.is(), 'rechts', 'onzin uit de cookie valt terug op de standaard');
  assert.equal(attrs['data-hand'], 'rechts');
  venster.RTGHand.zet('bovenhands');
  assert.equal(attrs['data-hand'], 'rechts', 'zet() neemt geen derde hand aan');
  venster.RTGHand.zet('links');
  assert.equal(attrs['data-hand'], 'links', 'voorwaarde: zetten werkt wel, anders toetst het bovenstaande niets');
});

test('de zijden hebben een naam, zodat een scherm niet zelf hoeft te rekenen', () => {
  /* DE MUTATIE: laat duimzijde() altijd 'right' teruggeven. */
  const { venster } = nepvenster({});
  assert.equal(venster.RTGHand.duimzijde(), 'right');
  assert.equal(venster.RTGHand.ankerzijde(), 'left');
  venster.RTGHand.zet('links');
  assert.equal(venster.RTGHand.duimzijde(), 'left');
  assert.equal(venster.RTGHand.ankerzijde(), 'right');
});

/* ---------------------------------------------------------------------- */

function romp(hand) {
  const ctx = {
    document: { querySelectorAll: () => [] },
    addEventListener: () => {},
    RTGHand: { links: () => hand === 'links', is: () => hand }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ROMP, ctx);
  return ctx.RTGCommandRomp((k) => '<svg data-i="' + k + '"></svg>');
}

test('de schilbalk spiegelt in DOM-volgorde en niet met opmaak', () => {
  /* WAAROM DOM-VOLGORDE. shared/adaptief/balk.js maakt met zoveel woorden de
     afspraak "een schermlezer leest ze waar ze staan". Met `order` zou een
     ziende de lade rechts zien en een schermlezer hem als eerste horen: twee
     verschillende schermen op dezelfde pagina.

     Deze toets meet de VOLGORDE in de opgeleverde markup en niet een klasse,
     zodat hij ook zakt als iemand het later alsnog met CSS probeert op te
     lossen.

     DE MUTATIE: haal de `links ?`-keuze uit romp.js en zet de drie stukken weer
     in vaste volgorde. */
  const r = romp('rechts');
  const l = romp('links');

  const plek = (html, klasse) => html.indexOf(klasse);
  assert.ok(plek(r, 'cmd-lade') < plek(r, 'cmd-balkbladen'),
    'rechtshandig: de lade staat voor de bladen');
  assert.ok(plek(r, 'cmd-balkbladen') < plek(r, 'cmd-mondknop'),
    'rechtshandig: Rahul staat achteraan');

  assert.ok(plek(l, 'cmd-mondknop') < plek(l, 'cmd-balkbladen'),
    'linkshandig: Rahul staat vooraan, want daar ligt de duim');
  assert.ok(plek(l, 'cmd-balkbladen') < plek(l, 'cmd-lade'),
    'linkshandig: de lade staat achteraan, aan de ankerzijde');

  /* En het blijft DEZELFDE balk: er mag niets bijkomen of wegvallen door te
     spiegelen. Zonder deze bewering zou een gespiegelde balk met een ontbrekende
     knop hierboven gewoon groen zijn. */
  const tel = (html, k) => html.split(k).length - 1;
  for (const k of ['cmd-lade', 'cmd-balkbladen', 'cmd-balksluit', 'cmd-vraagvorm', 'cmd-mondknop']) {
    assert.equal(tel(l, k), tel(r, k), k + ' komt links en rechts even vaak voor');
  }
  assert.equal(tel(l, 'cmd-balk"'), 1, 'er is precies een schilbalk');
});

test('geen enkele spiegeling gebeurt met de order-eigenschap', () => {
  /* De opmaakkant van dezelfde afspraak: shared/hand.css mag alles doen behalve
     de leesvolgorde loskoppelen van wat je ziet. `flex-direction: row-reverse`
     op een KNOPPENRIJ mag wel -- daar is de volgorde geen betekenis maar
     bereik, en de knoppen houden hun onderlinge DOM-volgorde.

     DE MUTATIE: zet `order: -1` bij in een van de regels in hand.css. */
  const css = fs.readFileSync(path.join(WORTEL, 'public/shared/hand.css'), 'utf8');
  const zonderCommentaar = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/(^|[;{\s])order\s*:/.test(zonderCommentaar), false,
    'hand.css gebruikt `order`, en dan lopen beeld en leesvolgorde uiteen');
  assert.match(zonderCommentaar, /\[data-hand="links"\]/,
    'voorwaarde: er staat werkelijk iets in dit blad, anders toetst het bovenstaande niets');
});
