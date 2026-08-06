/* ============================================================================
   DE DOMEINGRENS: laat hij door wat mag, en houdt hij tegen wat niet mag?

   Waar dit over gaat: server.js geeft elke router hetzelfde object `kern` met
   ruim negenhonderd eigenschappen, dus kan elk domein bij alles van elk ander.
   server/opzet/domeingrens.js legt daar een doorkijk over die alleen doorlaat
   wat een domein heeft opgeschreven (GRENZEN.json).

   DRIE BEWERINGEN DIE ALLE DRIE UIT EEN ECHTE OVERWEGING KOMEN, en de eerste
   twee zijn de reden dat het een Proxy is en geen gefilterde kopie:

   1. LATE BINDING BLIJFT. server/routes/supplier/genrepuls.js zegt het zelf: de
      genre-motoren hangen pas NA die routes aan de kern. Een kopie op
      mountmoment bevriest dat en levert undefined; dan neemt genrepuls stil de
      "geen motor"-tak en antwoordt de route vriendelijk het verkeerde.
   2. EEN VREEMDE NAAM GOOIT, hij wordt geen undefined. Undefined is de
      gevaarlijkste uitkomst, want `motor && motor.doeIets()` slaat er stil
      overheen.
   3. WAT NIET IN DE KERN ZIT is geen grensovertreding. Dan is het een typefout
      of een optionele naam, en die hoort zijn eigen undefined te krijgen zoals
      altijd -- anders verandert deze grens het gedrag van code die niets fout
      doet.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakDoorkijk, INTERFACE } = require('../server/opzet/domeingrens');

test('een naam uit de eigen lijst komt door', () => {
  const kern = { app: 'APP', eigenDing: 42, vanEenAnder: 'nee' };
  const k = maakDoorkijk(kern, 'member', ['eigenDing']);
  assert.equal(k.app, 'APP', 'de gedeelde interface mag altijd');
  assert.equal(k.eigenDing, 42, 'en wat het domein zelf heeft opgeschreven');
});

test('een naam van een ANDER domein gooit, en de fout noemt domein en naam', () => {
  const kern = { app: 1, vanEenAnder: 'geheim' };
  const k = maakDoorkijk(kern, 'member', []);
  let fout = null;
  try { void k.vanEenAnder; } catch (e) { fout = e; }
  assert.ok(fout, 'reiken naar een vreemde naam hoort te GOOIEN en niet undefined te geven');
  assert.equal(fout.domeingrens.domein, 'member');
  assert.equal(fout.domeingrens.naam, 'vanEenAnder');
  assert.match(fout.message, /GRENZEN\.json/, 'de fout zegt waar je het oplost');
});

test('wat NIET in de kern zit blijft gewoon undefined', () => {
  /* Anders verandert de grens het gedrag van code die niets fout doet: een
     optionele naam (`if (kern.misschien)`) zou ineens gooien. */
  const k = maakDoorkijk({ app: 1 }, 'member', []);
  assert.equal(k.bestaatNiet, undefined);
});

test('LATE BINDING: een naam die er bij het ophangen nog niet was, komt later wel door', () => {
  /* Dit is de bewering waar het Proxy-ontwerp op staat. Bij een gefilterde kopie
     zou `motor` hier undefined blijven en zou genrepuls stil de verkeerde tak
     nemen -- zonder deze toets zou niemand het verschil zien. */
  const kern = { app: 1 };
  const k = maakDoorkijk(kern, 'supplier', ['golfclub']);
  assert.equal(k.golfclub, undefined, 'hij bestaat nog niet');
  kern.golfclub = { overzicht: () => 'ok' };            // een latere laag hangt hem op
  assert.equal(typeof k.golfclub.overzicht, 'function', 'en nu komt hij er wel door');
  assert.equal(k.golfclub.overzicht(), 'ok');
});

test('wie iets NEERZET mag het ook lezen', () => {
  /* Routers voeden elkaar via de kern (kern.zaakBoard = ...). Zou een
     schrijfactie de naam niet toestaan, dan kon een domein zijn eigen werk niet
     meer terugvinden. */
  const kern = { app: 1 };
  const k = maakDoorkijk(kern, 'supplier', []);
  k.zaakBoard = () => 'bord';
  assert.equal(k.zaakBoard(), 'bord', 'eigen werk blijft leesbaar');
  assert.equal(kern.zaakBoard(), 'bord', 'en het landt op de ECHTE kern, niet in de doorkijk');
});

test('een naam die het domein uitrekent, werkt zolang hij op de lijst staat', () => {
  /* Zo doen genrepuls/genreplan/genreblik het: kern[MOTOR[type]]. Een scanner
     ziet die naam niet, dus hij komt niet automatisch in GRENZEN.json -- en dan
     houdt deze grens hem tegen. Dat is de bedoeling: de lijst wordt compleet
     doordat hij knelt, niet doordat iemand goed heeft geraden. */
  const kern = { app: 1, fitclub: 'motor' };
  const met = maakDoorkijk(kern, 'supplier', ['fitclub']);
  assert.equal(met['fit' + 'club'], 'motor', 'uitgerekende naam op de lijst: door');
  const zonder = maakDoorkijk(kern, 'supplier', []);
  assert.throws(() => zonder['fit' + 'club'], /domeingrens/, 'niet op de lijst: tegengehouden, niet stil');
});

test('de interface is niet stilletjes leeggeraakt', () => {
  /* Een lege INTERFACE zou elke doorkijk laten gooien op `app` en dan is deze
     module onbruikbaar; een te volle maakt de grens betekenisloos. Beide kanten. */
  assert.ok(INTERFACE.includes('app') && INTERFACE.includes('db') && INTERFACE.includes('auth'),
    'de dragende namen staan erin');
  assert.ok(INTERFACE.length < 60,
    'de interface blijft KLEIN -- hij is er om de grens te laten bestaan, niet om hem op te heffen');
});

test('destructureren werkt zoals een router het doet', () => {
  /* Elke router begint met `const { app, db, ... } = kern`. Dat leest via de
     Proxy, dus als has/ownKeys niet kloppen breekt alles bij het opstarten. */
  const kern = { app: 1, db: 2, eigen: 3, vreemd: 4 };
  const k = maakDoorkijk(kern, 'member', ['eigen']);
  const { app, db, eigen } = k;
  assert.deepEqual([app, db, eigen], [1, 2, 3]);
  assert.throws(() => { const { vreemd } = k; void vreemd; }, /domeingrens/);
});
