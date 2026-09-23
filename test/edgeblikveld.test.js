/* HET EDGE BLIKVELD IS EEN PROJECTIE EN GEEN BRON.

   shared/edge/blikveld.js leest wat de Edge van de werkelijkheid ziet. Deze toets
   houdt de drie beloften uit EDGE.md vast, zonder browser, met een nagemaakt
   venster waarin elke schrijfweg een verklikker is:

   1. HERKOMST: elk veld heeft dezelfde vorm {waarde, herkomst, gezag, sinds}, een
      leeg veld draagt zijn reden, en `autoritatief` is voorbehouden aan de server
      -- die er vandaag niet is, dus komt het nergens voor.
   2. ALLEEN LEZEN: lees() en acties() schrijven geen attribuut, geen opslag, geen
      bericht en geen context. Wie het blikveld nieuwer vindt dan het scherm, heeft
      ongelijk; het scherm en de server winnen (besluit 5).
   3. HET ENE LEESPAD: acties() geeft de handelingen van RTGAdaptief met hun
      Edge-stand erbij, en het tweede register (registerAction) staat in lees() met
      zijn gebrek zichtbaar in plaats van stil weggevallen.

   DE MUTATIES, elk nagetrokken: laat wereld() het src-loze schilpad overslaan (de
   wereldvolgorde zakt), laat een veld zonder reden leeg (de vormtoets zakt), laat
   lees() de context terugschrijven (de verklikker zakt), en zet de bevoegdheid op
   gezag 'autoritatief' (de gezagtoets zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BRON = path.join(__dirname, '..', 'public', 'shared', 'edge', 'blikveld.js');
const { maak } = require(BRON);
const Actiestaat = require('../public/shared/edge/actiestaat.js');
const gram = require('../public/shared/adaptief/grammatica.js');
const WereldId = require('../public/shared/rtg-world-identity.js');

const GEZAG = ['autoritatief', 'afgeleid', 'ui', 'geen'];

/* Een nagemaakt element: alleen wat het blikveld aanraakt. */
function el(attrs, tekst) {
  return { hidden: false, disabled: false, textContent: tekst || '', attrs: attrs || {},
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
    setAttribute() { throw new Error('het blikveld schreef een attribuut'); } };
}

function venster(o) {
  o = o || {};
  const schrijfsels = [];
  const body = el(o.body || {});
  const d = {
    title: o.title || 'Proefscherm', body,
    getElementById(id) { return id === 'rtgCommand' ? (o.schil || null) : null; },
    querySelector(sel) {
      if (sel.indexOf('data-rtg-edge-primary') >= 0) return o.edgePrimary || null;
      return null;
    },
    querySelectorAll(sel) { return sel === '[data-hoofdactie]' ? (o.hoofdacties || []) : []; }
  };
  const verboden = (wat) => () => { schrijfsels.push(wat); throw new Error('het blikveld schreef: ' + wat); };
  const w = { document: d, location: { pathname: o.pad || '/apps/agenda.html' },
    navigator: { onLine: o.offline ? false : true },
    localStorage: { setItem: verboden('localStorage'), getItem() { return null; } },
    sessionStorage: { setItem: verboden('sessionStorage'), getItem() { return null; } },
    postMessage: verboden('postMessage'), fetch: verboden('fetch'),
    RTGWorldIdentity: o.geenWereldkaart ? undefined : WereldId,
    RTGEdgeActiestaat: Actiestaat, RTGGrammatica: gram };
  if (o.adaptief) {
    const ctx = Object.assign({ bron: '', titel: '', acties: [], selectie: false, staat: {}, rail: [], sleutel: 'k1' }, o.adaptief.ctx);
    w.RTGAdaptief = {
      context(c) { if (c !== undefined) { schrijfsels.push('context'); throw new Error('het blikveld schreef de context'); } return ctx; },
      opContext(f) { f(ctx); return () => {}; },
      voorNu() { return (o.adaptief.items || []).map((x) => Object.assign({}, x)); },
      capability(id) { return (o.adaptief.caps || {})[id] || null; }
    };
  }
  if (o.core) w.RTGAdaptiveEdgeCore = { momentopname() { return JSON.parse(JSON.stringify(o.core)); } };
  return { w, schrijfsels };
}

function vormKlopt(velden) {
  for (const [naam, v] of Object.entries(velden)) {
    assert.deepEqual(Object.keys(v).filter((k) => k !== 'reden').sort(), ['gezag', 'herkomst', 'sinds', 'waarde'], naam);
    assert.ok(GEZAG.includes(v.gezag), naam + ': onbekend gezag ' + v.gezag);
    assert.equal(typeof v.herkomst, 'string', naam);
    if (v.waarde === null) assert.ok(v.reden && v.reden.length > 5, naam + ' is leeg zonder reden');
    if (v.gezag === 'autoritatief') assert.equal(v.herkomst, 'server', naam + ' is autoritatief zonder server');
  }
}

test('elk veld draagt waarde, herkomst, gezag en sinds; leeg betekent met reden', () => {
  for (const o of [{}, { offline: true }, { geenWereldkaart: true, pad: '/nergens.html' },
    { adaptief: { ctx: { bron: 'office.tekst', titel: 'Brief', object: { soort: 'document' }, activiteit: 'schrijven', rail: [{ sleutel: 'opslag', tekst: 'Opgeslagen', staat: 'rustig' }] } } }]) {
    const { w } = venster(o);
    const l = maak(w).lees();
    assert.deepEqual(Object.keys(l.velden).sort(), ['activiteit', 'bevoegdheid', 'context', 'hoofdactie', 'identiteit',
      'object', 'presence', 'trust', 'voortzetting', 'wereld']);
    vormKlopt(l.velden);
    assert.equal(l.velden.bevoegdheid.waarde, null, 'zonder serveroordeel is er geen bevoegdheid om te tonen');
    assert.equal(l.velden.bevoegdheid.gezag, 'geen');
  }
});

test('het blikveld schrijft niets: geen context, attribuut, opslag of bericht', () => {
  const { w, schrijfsels } = venster({ adaptief: { ctx: { bron: 'bestanden', acties: ['a'] },
    items: [{ id: 'a', naam: 'A', gewicht: 'terug', ongedaan: () => {} }] }, core: { acties: [{ id: 'x', label: 'X', allowed: true }] } });
  const b = maak(w);
  b.lees(); b.acties(); b.lees();
  assert.deepEqual(schrijfsels, []);
  /* En in de bron: geen enkele schrijfweg, ook niet een die de nagemaakte
     vensters hierboven niet kennen. */
  const src = fs.readFileSync(BRON, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const [wat, re] of [['setAttribute', /\.setAttribute\(/], ['removeAttribute', /\.removeAttribute\(/],
    ['dataset-toewijzing', /\.dataset\.\w+\s*=[^=]/], ['setItem', /\.setItem\(/], ['postMessage', /postMessage\(/],
    ['fetch', /\bfetch\(/], ['context terugschrijven', /\.context\(\s*[^)\s]/], ['innerHTML', /innerHTML/]]) {
    assert.doesNotMatch(src, re, 'het blikveld bevat een schrijfweg: ' + wat);
  }
});

test('de wereld: het open blad in de schil, dan de route, dan het pagina-attribuut', () => {
  const schil = {};
  let l = maak(venster({ schil, body: { 'data-rtg-blad-wereld': 'travel' }, pad: '/apps/app.html' }).w).lees();
  assert.deepEqual([l.velden.wereld.waarde, l.velden.wereld.herkomst], ['travel', 'blad']);
  l = maak(venster({ schil, body: { 'data-rtg-blad-wereld': 'geen' }, pad: '/apps/app.html' }).w).lees();
  assert.equal(l.velden.wereld.waarde, null, 'op de lege tafel kiest de schil nog geen wereld');
  l = maak(venster({ pad: '/apps/reizen.html' }).w).lees();
  assert.deepEqual([l.velden.wereld.waarde, l.velden.wereld.herkomst], ['travel', 'route']);
  l = maak(venster({ geenWereldkaart: true, body: { 'data-rtg-world': 'work' } }).w).lees();
  assert.deepEqual([l.velden.wereld.waarde, l.velden.wereld.herkomst], ['work', 'pagina']);
});

test('de context en wat het scherm er zelf over zegt: object, activiteit en Trust Rail', () => {
  const { w } = venster({ adaptief: { ctx: { bron: 'office.tekst', titel: 'Brief', selectie: true,
    object: { soort: 'document', id: 'd1' }, activiteit: 'schrijven',
    rail: [{ sleutel: 'opslag', tekst: 'Opgeslagen', staat: 'rustig' }] } } });
  const l = maak(w).lees();
  assert.deepEqual(l.velden.context.waarde, { bron: 'office.tekst', titel: 'Brief', selectie: true });
  assert.equal(l.velden.context.herkomst, 'scherm');
  assert.deepEqual(l.velden.object.waarde, { soort: 'document', id: 'd1' });
  assert.equal(l.velden.activiteit.waarde, 'schrijven');
  assert.equal(l.velden.trust.herkomst, 'scherm:rail');
  const off = maak(venster({ offline: true }).w).lees();
  assert.equal(off.velden.trust.waarde[0].sleutel, 'offline', 'offline is een toestand van het toestel en staat in de rail');
});

test('de hoofdactie: aangewezen door het scherm, en twee bronnen die iets anders zeggen is een gebrek', () => {
  const eigen = el({ 'aria-label': '+ Afspraak' }), edge = el({}, 'Nieuwe afspraak');
  let l = maak(venster({ hoofdacties: [eigen], edgePrimary: edge }).w).lees();
  assert.equal(l.velden.hoofdactie.herkomst, 'scherm:data-hoofdactie');
  assert.ok(l.gebreken.includes('hoofdactie-dubbel'));
  l = maak(venster({ edgePrimary: edge }).w).lees();
  assert.equal(l.velden.hoofdactie.herkomst, 'edge-padtabel');
  const verborgen = el({}, 'X'); verborgen.hidden = true;
  l = maak(venster({ hoofdacties: [verborgen] }).w).lees();
  assert.equal(l.velden.hoofdactie.waarde, null, 'een verborgen knop is geen aangewezen hoofdactie');
});

test('het ene leespad: acties() met Edge-stand, en het tweede register met zijn gebrek', () => {
  const { w } = venster({
    adaptief: { ctx: { bron: 'bestanden', acties: ['weg', 'deel'] },
      items: [{ id: 'weg', naam: 'Verwijder', gewicht: 'terug', ongedaan: () => {} },
        { id: 'deel', naam: 'Deel', gewicht: 'bewust', verhinderd: gram.verhindering({ reden: 'Geen codenaam.', bron: 'toestand' }) }],
      caps: { weg: { herstel: 'exact', effect: 'server' } } },
    core: { acties: [{ id: 'primary', label: 'Volgende stap', allowed: true }, { id: 'stil', label: 'Stil', allowed: false }] } });
  const b = maak(w);
  const a = b.acties();
  assert.deepEqual(a.map((x) => [x.id, x.edge.staat]), [['weg', 'BESCHIKBAAR'], ['deel', 'GEBLOKKEERD']]);
  assert.equal(a[0].edge.ongedaan, true, 'exact herstel met een weg terug mag ongedaan maken aanbieden');
  assert.equal(typeof a[0].ongedaan, 'function', 'het item voor de balk behoudt zijn eigen functies');
  const l = b.lees();
  const stil = l.acties.find((x) => x.id === 'stil');
  assert.equal(stil.herkomst, 'edge-compat');
  assert.equal(stil.staat, 'GEBLOKKEERD');
  assert.ok(stil.gebreken.includes('redenloos'), 'allowed:false zonder reden hoort als gebrek zichtbaar te zijn');
  assert.ok(l.acties.every((x) => x.gezag !== 'server' && x.gezag !== 'autoritatief'), 'zonder server geen servergezag');
  assert.doesNotThrow(() => JSON.stringify(l), 'lees() is platte data');
});
