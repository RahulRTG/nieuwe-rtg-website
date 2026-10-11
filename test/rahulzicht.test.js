/* RAHUL LEEST HET BLIKVELD -- via een positieve veldenlijst, en alleen die.

   shared/edge/rahulzicht.js maakt van het Edge Blikveld de schermcontext die de
   Rahul-helper naar /api/fluister stuurt. Zes beloften, elk met een mutatie die
   is nagetrokken:

   1. VOLLEDIG BESLIST: elk veld dat het ECHTE blikveld levert staat in MEE of in
      NIET_MEE, nooit in allebei. Een nieuw blikveldveld gaat dus niet vanzelf
      naar een model -- deze toets zakt tot iemand kiest.
      Mutatie: haal `presence` uit NIET_MEE; toets 1 zakt.
   2. POSITIEF: wat eruit komt zijn alleen `wereld`, `deel` en `verwijzingen`, en
      een verwijzing is alleen soort en id. Een blikveld vol identiteit, open
      bladen, labels en velden laat daar niets van achter.
      Mutatie: neem het object met een spread over; toets 2 zakt.
   3. HERKOMST: een titel gaat alleen mee als het scherm (of het blad, of het
      casco) hem zelf zei -- een kale documenttitel is geen blikveld-waarheid.
      Mutatie: zet 'document' in TITELBRON; toets 3 zakt.
   4. HET SERVERCONTRACT: wat eruit komt, saneert server/kern/stuur/menscontext.js
      tot PASS zonder een enkele weggegooide sleutel. Zo kan de client geen vorm
      sturen die de server niet kent (er komt geen vijfde contextvorm bij).
      Mutatie: noem `deel` `titel`; toets 4 zakt (gewist + woorden weg).
   5. OP DE BRON: geen spread, geen Object.assign, geen delete in de projectie
      (AI-CONTEXT-01: opbouwen, nooit kopiëren-en-weghalen).
   6. DE HELPER: RTGRahulTabHelpers.context() neemt de drie velden over als het
      blikveld er is, en geeft exact de oude vorm als het er niet is.
      Mutatie: laat helpers.js rahulzicht niet lezen; toets 6 zakt.

   De browserkant -- de schil met een echt blad, en de server die PASS zegt --
   staat in test/rahulzicht.e2e.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const BRON = path.join(WORTEL, 'public', 'shared', 'edge', 'rahulzicht.js');
const Z = require(BRON);
const { maak } = require('../public/shared/edge/blikveld.js');
const menscontext = require('../server/kern/stuur/menscontext');

/* Het kleinste venster waarin het echte blikveld leest: geen schil, geen
   register, geen Edge. Elk veld komt dan leeg terug, maar de SLEUTELS zijn de
   echte -- en daar gaat toets 1 over. */
function kaalVenster() {
  const body = { getAttribute: () => null };
  return { document: { title: 'Proef', body, getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [] }, location: { pathname: '/apps/onbekend.html' }, navigator: { onLine: true } };
}

function veld(waarde, herkomst) { return { waarde, herkomst, gezag: 'ui', sinds: 1 }; }
function volBlikveld(o) {
  o = o || {};
  return { versie: 1, op: 1, acties: [{ id: 'reizen.boek', naam: 'Boek' }], gebreken: [], velden: {
    identiteit: veld({ naam: 'Echte Naam', codenaam: 'Amberen Vos' }, 'edge-signaal'),
    wereld: veld(o.wereld === undefined ? 'travel' : o.wereld, 'blad'),
    context: veld({ bron: 'reizen.tabs', titel: o.titel || 'Mijn reizen', selectie: true }, o.ctxHerkomst || 'blad'),
    object: veld({ soort: 'Reis', id: 'r-42', label: 'Huwelijksreis Bali', velden: { bedrag: '9000' } }, 'blad'),
    activiteit: veld('plannen', 'blad'),
    presence: veld({ wie: 'Collega X' }, 'edge-signaal'),
    voortzetting: veld({ bladen: ['/apps/geld.html', '/apps/zorg.html'], actief: 0 }, 'toestel:werktafel'),
    hoofdactie: veld({ label: '+ Reis' }, 'blad:data-hoofdactie'),
    trust: veld([{ sleutel: 'offline', tekst: 'Offline' }], 'toestel'),
    bevoegdheid: veld(null, 'geen')
  } };
}

test('1. elk veld van het echte blikveld is beslist: MEE of NIET_MEE, nooit allebei', () => {
  const echt = Object.keys(maak(kaalVenster()).lees().velden).sort();
  assert.ok(echt.length >= 10, 'het blikveld leverde te weinig velden; dan zegt deze toets niets: ' + echt);
  const mee = Object.keys(Z.MEE), niet = Object.keys(Z.NIET_MEE);
  assert.deepEqual(mee.filter((k) => niet.includes(k)), [], 'een veld staat in beide lijsten');
  const onbeslist = echt.filter((k) => !mee.includes(k) && !niet.includes(k));
  assert.deepEqual(onbeslist, [], 'nieuw blikveldveld zonder besluit: zet het in MEE of NIET_MEE (met reden)');
  const verzonnen = mee.concat(niet).filter((k) => !echt.includes(k));
  assert.deepEqual(verzonnen, [], 'de lijsten noemen een veld dat het blikveld niet heeft');
  for (const k of niet) assert.ok(String(Z.NIET_MEE[k]).length > 20, k + ' staat in NIET_MEE zonder reden');
});

test('2. positief: alleen wereld, deel en verwijzingen -- en een verwijzing is soort en id', () => {
  const z = Z.projecteer(volBlikveld());
  assert.deepEqual(Object.keys(z.context).sort(), ['deel', 'verwijzingen', 'wereld']);
  assert.deepEqual(z.context, { wereld: 'travel', deel: 'Mijn reizen', verwijzingen: [{ soort: 'reis', id: 'r-42' }] });
  const tekst = JSON.stringify(z);
  for (const lek of ['Echte Naam', 'Amberen Vos', 'Huwelijksreis', '9000', '/apps/geld', 'Collega X', '+ Reis', 'reizen.boek', 'plannen', 'Offline']) {
    assert.ok(!tekst.includes(lek), 'de projectie draagt "' + lek + '" mee: ' + tekst);
  }
  assert.deepEqual(z.herkomst, { wereld: 'blad', deel: 'blad', verwijzingen: 'blad' });
  // niets bruikbaars: null, en de helper houdt wat hij had
  assert.equal(Z.projecteer(maak(kaalVenster()).lees()), null);
  assert.equal(Z.projecteer(null), null);
  // een wereld die niet in de kaart staat, gaat niet mee
  assert.equal(Z.projecteer(volBlikveld({ wereld: 'mars' })).context.wereld, undefined);
});

test('3. een titel gaat alleen mee als het scherm, het blad of het casco hem zei', () => {
  assert.equal(Z.projecteer(volBlikveld({ ctxHerkomst: 'document' })).context.deel, undefined,
    'een kale documenttitel is geen blikveld-waarheid');
  for (const h of ['scherm', 'blad', 'edge-casco']) {
    assert.equal(Z.projecteer(volBlikveld({ ctxHerkomst: h })).context.deel, 'Mijn reizen', h);
  }
  const lang = Z.projecteer(volBlikveld({ titel: 'x'.repeat(500) + '\u0007' })).context.deel;
  assert.ok(lang.length <= 70 && !/[\x00-\x1f]/.test(lang), 'de titel blijft begrensd');
});

test('4. de server saneert het tot PASS zonder een weggegooide sleutel', () => {
  const z = Z.projecteer(volBlikveld());
  for (const k of Object.keys(z.context)) assert.ok(menscontext.CONTRACTSLEUTELS.includes(k), k + ' staat niet in het contract');
  const s = menscontext.saneer(Object.assign({ app: 'RTG', selectie: '' }, z.context));
  assert.equal(s.stand, 'PASS', s.reden);
  assert.deepEqual(s.gewist, [], 'de client stuurde iets wat de server weggooit: ' + JSON.stringify(s.gewist));
  assert.equal(s.context.presentatie.wereld, 'travel');
  assert.equal(s.context.presentatie.scherm, 'Mijn reizen');
  assert.deepEqual(s.context.verwijzingen, [{ soort: 'reis', id: 'r-42' }]);
});

test('5. op de bron: opbouwen, nooit kopiëren en weghalen', () => {
  const code = fs.readFileSync(BRON, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\.\.\.\s*[A-Za-z_(]/, 'een spread in de projectie');
  assert.doesNotMatch(code, /Object\.assign/, 'Object.assign in de projectie');
  assert.doesNotMatch(code, /\bdelete\s/, 'delete in de projectie');
  assert.doesNotMatch(code, /setAttribute|localStorage|sessionStorage|postMessage|\.context\(/,
    'de projectie schrijft of zet een context');
});

function helpersIn(w) {
  const doc = { title: 'RTG Command', querySelector: () => null, addEventListener() {} };
  const ctx = Object.assign({ document: doc }, w);
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WORTEL, 'public', 'shared', 'rahul-tab', 'helpers.js'), 'utf8'), ctx);
  return ctx.RTGRahulTabHelpers;
}

test('6. de helper neemt de drie velden over, en zonder blikveld blijft de oude vorm', () => {
  const zonder = helpersIn({}).context();
  assert.deepEqual(Object.keys(zonder).sort(), ['app', 'deel', 'selectie']);
  assert.equal(zonder.deel, 'Actieve pagina');

  const blik = volBlikveld();
  const met = helpersIn({ RTGEdgeRahulzicht: Z, RTGEdgeBlikveld: { lees: () => blik } }).context();
  assert.equal(met.wereld, 'travel');
  assert.equal(met.deel, 'Mijn reizen', 'de titel van het blad gaat voor de DOM van de schil');
  assert.deepEqual(JSON.parse(JSON.stringify(met.verwijzingen)), [{ soort: 'reis', id: 'r-42' }]);
  assert.deepEqual(Object.keys(met).sort(), ['app', 'deel', 'selectie', 'verwijzingen', 'wereld']);

  // een blikveld dat gooit, breekt de helper niet
  const kapot = helpersIn({ RTGEdgeRahulzicht: Z, RTGEdgeBlikveld: { lees: () => { throw new Error('x'); } } }).context();
  assert.deepEqual(Object.keys(kapot).sort(), ['app', 'deel', 'selectie']);
});
