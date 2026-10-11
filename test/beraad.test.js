/* Het beraad (B3, kern/beraad/): overleggen en besluiten binnen een genootschap.

   Deze toetsen draaien op het ECHTE genootschap (kern/genootschap) met een
   database in het geheugen, zodat lidmaatschap en beheer niet nagebootst worden.
   De toets tegen een echte server staat in test/beraad-server.test.js.

   MUTATIES GEZIEN ZAKKEN (elk een keer gedraaid, daarna teruggezet):
   (a) ronde.js stem(): de standcontrole `r.stand !== 'stemmen'` weggehaald -- toets 2 zakt;
   (b) ronde.js zetVoorstel(): `r.stemmen = {}` weggehaald -- toets 3 zakt;
   (c) zicht.js uitslagZicht(): de kleine-groepsgrens weggehaald -- toets 5 zakt;
   (d) zicht.js: `mijnStem` vervangen door de hele `stemmen`-kaart -- toets 6 zakt;
   (e) index.js sluit(): de herhaling-tak weggehaald -- toets 4 zakt (409 en geen herhaling);
   (f) ronde.js trekInbrengIn(): de regel uit de lijst gefilterd in plaats van gemarkeerd -- toets 7 zakt;
   (g) leesweergave.js: `beraad` zelf meegegeven als veld -- toets 9 zakt;
   (h) ai.js samenvatting(): `.slice(0, 2)` op de regels -- toets 10 zakt;
   (i) standen.js: `require('../democratie/eindstanden')` erbij -- toets 11 zakt;
   (j) beleid-lijsten.js: /^\/api\/beraad\/stem$/ op KLEIN.member -- toets 12 zakt;
   (k) ronde.js stem(): `door` in de tijdlijnregel -- toets 13 zakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const keten = require('../server/lib/keten');

const WORTEL = path.join(__dirname, '..');
const MAP = path.join(WORTEL, 'server/kern/beraad');

function wereld() {
  const db = { data: {} };
  const meldingen = [];
  const notify = (key, m) => {
    if (!m || typeof m !== 'object') throw new TypeError('notify verwacht een melding als object');
    meldingen.push({ key, m });
  };
  const codenaamVan = (k) => 'Codenaam-' + k;
  const genootschap = require('../server/kern/genootschap')({ db, save() {}, codenaamVan, keyVanCodenaam: null, notify });
  let klok = Date.parse('2026-10-11T10:00:00Z');
  const beraad = require('../server/kern/beraad')({ db, save() {}, codenaamVan, notify, genootschap, nu: () => klok++ });
  const gr = genootschap.richtOp({ key: 'a' }, { naam: 'De Proefkring', soort: 'openbaar' }).groep;
  const sess = (key) => ({ key });
  const lid = (key) => { genootschap.tredBinnen(sess(key), gr.id); return sess(key); };
  return { db, beraad, genootschap, gr, sess, lid, meldingen };
}

function opgezet({ leden = ['b', 'c', 'd', 'e', 'f'], gevoelig = false, quorum } = {}) {
  const w = wereld();
  for (const k of leden) w.lid(k);
  const o = w.beraad.open(w.sess('a'), { drager: { soort: 'genootschap', id: w.gr.id }, vraag: 'Zullen wij in mei samen naar Gent?', gevoelig, quorum });
  assert.ok(o.ok, o.error);
  return Object.assign(w, { id: o.beraad.id });
}
const ronde = (w, key) => w.beraad.lees(w.sess(key), w.id).beraad.rondes.slice(-1)[0];

test('1. alleen een lid van het genootschap ziet of opent een beraad', () => {
  const w = opgezet();
  const vreemd = w.beraad.lees(w.sess('z'), w.id);
  assert.equal(vreemd.status, 404, 'een buitenstaander krijgt 404, niet 403');
  assert.equal(w.beraad.inbreng(w.sess('z'), w.id, { tekst: 'Ik doe toch mee.' }).status, 404);
  assert.equal(w.beraad.open(w.sess('z'), { drager: { soort: 'genootschap', id: w.gr.id }, vraag: 'Mag ik?' }).status, 404);
  assert.ok(w.beraad.lees(w.sess('b'), w.id).ok, 'een lid leest');
  assert.equal(w.beraad.open(w.sess('a'), { drager: { soort: 'verbond', id: 1 }, vraag: 'x' }).status, 400, 'het verbond bestaat nog niet');
});

test('2. stemmen kan pas als het voorstel bevroren is, en alleen opener of beheerder bevriest', () => {
  const w = opgezet();
  assert.equal(w.beraad.stem(w.sess('b'), w.id, 'voor').status, 409, 'zonder voorstel geen stemming');
  w.beraad.voorstel(w.sess('b'), w.id, { tekst: 'We gaan op 12 mei met de trein.' });
  assert.equal(w.beraad.stem(w.sess('b'), w.id, 'voor').status, 409, 'een voorstel is nog geen stemming');
  assert.equal(w.beraad.naarStemmen(w.sess('b'), w.id).status, 403, 'een gewoon lid zet niet naar stemmen');
  assert.ok(w.beraad.naarStemmen(w.sess('a'), w.id).ok);
  assert.ok(w.beraad.stem(w.sess('b'), w.id, 'voor').ok);
  assert.equal(w.beraad.stem(w.sess('b'), w.id, 'misschien').status, 400);
  assert.equal(w.beraad.inbreng(w.sess('c'), w.id, { tekst: 'Te laat.' }).status, 409, 'het voorstel is bevroren');
});

test('3. een nieuw voorstel zet de stemmen terug, en tijdens het stemmen mag alleen de regie dat', () => {
  const w = opgezet();
  w.beraad.voorstel(w.sess('a'), w.id, { tekst: 'Versie een.' });
  w.beraad.naarStemmen(w.sess('a'), w.id);
  w.beraad.stem(w.sess('b'), w.id, 'voor');
  assert.equal(ronde(w, 'b').mijnStem, 'voor');
  assert.equal(w.beraad.voorstel(w.sess('c'), w.id, { tekst: 'Versie van c.' }).status, 403);
  const v = w.beraad.voorstel(w.sess('a'), w.id, { tekst: 'Versie twee.' });
  assert.equal(v.versie, 2);
  assert.equal(v.stemmenTerug, true);
  const r = ronde(w, 'b');
  assert.equal(r.mijnStem, null, 'wie op versie een stemde, heeft niet op versie twee gestemd');
  assert.equal(r.stand, 'voorstel');
  assert.equal(r.bevroren, false);
});

test('4. de uitslag wordt een keer geteld, de eindstand verandert nooit, herhaald sluiten doet niets', () => {
  const w = opgezet();
  w.beraad.inbreng(w.sess('c'), w.id, { tekst: 'Graag, maar niet in het weekend.' });
  w.beraad.voorstel(w.sess('a'), w.id, { tekst: 'Dinsdag 12 mei.' });
  w.beraad.naarStemmen(w.sess('a'), w.id);
  for (const [k, s] of [['a', 'voor'], ['b', 'voor'], ['c', 'voor'], ['d', 'tegen'], ['e', 'onthouding']]) w.beraad.stem(w.sess(k), w.id, s);
  assert.equal(w.beraad.sluit(w.sess('b'), w.id, {}).status, 403, 'een gewoon lid sluit niet');
  const s = w.beraad.sluit(w.sess('a'), w.id, {});
  assert.ok(s.ok, s.error);
  const r1 = s.beraad.rondes[0];
  assert.equal(r1.eindstand.stand, 'aangenomen');
  assert.deepEqual([r1.uitslag.voor, r1.uitslag.tegen, r1.uitslag.onthouding], [3, 1, 1]);
  const meldingenNa = w.meldingen.length;
  assert.equal(meldingenNa, 5, 'vijf stemmers (c bracht ook in): elk precies een melding');

  const nog = w.beraad.sluit(w.sess('a'), w.id, { toelichting: 'Nog eens dicht.' });
  assert.ok(nog.ok && nog.herhaling, 'een tweede sluiting is een herhaling');
  assert.equal(w.meldingen.length, meldingenNa, 'geen tweede bericht');
  assert.equal(w.beraad.stem(w.sess('f'), w.id, 'tegen').status, 409, 'na het sluiten wordt niet gestemd');

  // wie later vertrekt, verandert de getelde uitslag niet
  w.genootschap.vertrek(w.sess('d'), w.gr.id);
  assert.deepEqual(ronde(w, 'b').uitslag, r1.uitslag);

  assert.equal(w.beraad.heropen(w.sess('a'), w.id, { reden: 'kort' }).status, 400);
  const h = w.beraad.heropen(w.sess('a'), w.id, { reden: 'De trein rijdt die dag niet; er is iets nieuws.' });
  assert.equal(h.beraad.rondes.length, 2, 'heropenen is een nieuwe ronde');
  assert.equal(h.beraad.rondes[0].eindstand.stand, 'aangenomen', 'de oude eindstand blijft staan');
  assert.equal(h.beraad.rondes[1].stand, 'open');
});

test('5. geen telling voor het sluiten, geen aantallen onder vijf stemmers en nooit bij een gevoelig beraad', () => {
  const w = opgezet();
  w.beraad.voorstel(w.sess('a'), w.id, { tekst: 'Ja.' });
  w.beraad.naarStemmen(w.sess('a'), w.id);
  w.beraad.stem(w.sess('a'), w.id, 'voor');
  w.beraad.stem(w.sess('b'), w.id, 'tegen');
  const open = JSON.stringify(w.beraad.lees(w.sess('c'), w.id));
  assert.equal(ronde(w, 'c').uitslag, null, 'tijdens het stemmen geen uitslag');
  assert.ok(!/"(voor|tegen|uitgebracht)":\d/.test(open), 'ook geen losse telling');
  const s = w.beraad.sluit(w.sess('a'), w.id, {});
  const u = s.beraad.rondes[0].uitslag;
  assert.equal(u.getoond, false);
  assert.equal(u.reden, 'te-kleine-groep');
  assert.ok(!('voor' in u) && !('tegen' in u));
  assert.ok(s.beraad.rondes[0].eindstand.stand, 'de eindstand staat er wel');

  const g = opgezet({ gevoelig: true });
  g.beraad.voorstel(g.sess('a'), g.id, { tekst: 'Ja.' });
  g.beraad.naarStemmen(g.sess('a'), g.id);
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) g.beraad.stem(g.sess(k), g.id, 'voor');
  const gu = g.beraad.sluit(g.sess('a'), g.id, {}).beraad.rondes[0].uitslag;
  assert.equal(gu.getoond, false);
  assert.equal(gu.reden, 'gevoelig');
});

test('6. een individuele stem ziet alleen wie hem uitbracht', () => {
  const w = opgezet();
  w.beraad.voorstel(w.sess('a'), w.id, { tekst: 'Ja.' });
  w.beraad.naarStemmen(w.sess('a'), w.id);
  w.beraad.stem(w.sess('b'), w.id, 'tegen');
  assert.equal(ronde(w, 'b').mijnStem, 'tegen');
  assert.equal(ronde(w, 'c').mijnStem, null);
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) w.beraad.stem(w.sess(k), w.id, k === 'b' ? 'tegen' : 'voor');
  w.beraad.sluit(w.sess('a'), w.id, {});
  const voorC = JSON.stringify(w.beraad.lees(w.sess('c'), w.id));
  assert.ok(!voorC.includes('"stemmen":'), 'geen stemmenkaart in het antwoord');
  assert.equal(ronde(w, 'c').mijnStem, 'voor');
});

test('7. inbreng verdwijnt nooit; intrekken is een markering die alleen de schrijver zet', () => {
  const w = opgezet();
  const i = w.beraad.inbreng(w.sess('b'), w.id, { tekst: 'Ik heb bezwaar tegen de datum.' });
  w.beraad.inbreng(w.sess('c'), w.id, { soort: 'bezwaar', tekst: 'Te duur voor sommigen.' });
  assert.equal(w.beraad.inbreng(w.sess('c'), w.id, { intrek: i.id }).status, 403);
  assert.ok(w.beraad.inbreng(w.sess('b'), w.id, { intrek: i.id }).ok);
  const r = ronde(w, 'c');
  assert.equal(r.inbreng.length, 1, 'de regel staat er nog');
  assert.ok(r.inbreng[0].ingetrokken);
  assert.equal(r.inbreng[0].tekst, null, 'een ander leest ingetrokken woorden niet meer');
  assert.equal(ronde(w, 'b').inbreng[0].tekst, 'Ik heb bezwaar tegen de datum.');
  assert.equal(r.bezwaren.length, 1);
});

test('8. intrekken van het beraad is een eindstand met reden, en ook dan hoort wie meedeed het', () => {
  const w = opgezet();
  w.beraad.inbreng(w.sess('b'), w.id, { tekst: 'Goed idee.' });
  assert.equal(w.beraad.sluit(w.sess('a'), w.id, {}).status, 409, 'zonder stemming geen sluiting');
  assert.equal(w.beraad.sluit(w.sess('a'), w.id, { intrekken: true, toelichting: 'kort' }).status, 400);
  const s = w.beraad.sluit(w.sess('a'), w.id, { intrekken: true, toelichting: 'De reis gaat niet door.' });
  assert.equal(s.beraad.rondes[0].eindstand.stand, 'ingetrokken');
  const m = w.beraad.mijn(w.sess('b'));
  assert.equal(m.terugkoppeling.length, 1);
  assert.equal(m.terugkoppeling[0].trede, 'gewekt');
  assert.ok(w.beraad.gezien(w.sess('b'), w.id).bewogen === 1);
  assert.equal(w.beraad.mijn(w.sess('b')).terugkoppeling[0].trede, 'gezien');
  assert.equal(w.beraad.gezien(w.sess('b'), w.id).bewogen, 0, 'een trede gaat niet nog eens');
  assert.equal(w.beraad.gezien(w.sess('d'), w.id).status, 404, 'wie niet meedeed, heeft niets klaarstaan');
});

test('9. Rahul krijgt een bevroren projectie zonder sleutel, codenaam of stem', () => {
  const w = opgezet();
  w.beraad.inbreng(w.sess('b'), w.id, { tekst: 'Een.' });
  const { leesweergave, BERAADVELDEN } = require('../server/kern/beraad/leesweergave');
  const lees = leesweergave({ beraad: w.beraad });
  assert.deepEqual(Object.keys(lees), ['ronde']);
  assert.ok(Object.isFrozen(lees));
  const r = lees.ronde(w.sess('c'), w.id);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.regels) && Object.isFrozen(r.regels[0]));
  assert.deepEqual(Object.keys(r.regels[0]).sort(), ['soort'].concat(BERAADVELDEN).sort());
  assert.ok(!JSON.stringify(r).includes('Codenaam-'), 'geen codenaam naar Rahul');
  assert.equal(lees.ronde(w.sess('z'), w.id), null, 'een buitenstaander krijgt niets');
  const ai = require('../server/kern/beraad/ai')({ lees });
  assert.deepEqual(Object.keys(ai).filter(k => typeof ai[k] === 'function').sort(), ['concept', 'perspectieven', 'samenvatting']);
  const bron = fs.readFileSync(path.join(MAP, 'ai.js'), 'utf8');
  for (const verboden of ['stem(', 'sluit(', 'save(', 'inbreng(', 'voorstel(', 'notify(', 'ai-kort'])
    assert.ok(!bron.includes(verboden), 'kern/beraad/ai.js bevat ' + verboden);
});

test('10. de samenvatting draagt elke inbreng, met bron; het concept wordt niet bewaard', () => {
  const w = opgezet();
  const teksten = ['Ik wil graag mee, maar het moet niet te duur worden.', 'Wie zorgt voor de kinderen?',
    'Ik ben tegen.', 'Kunnen we ook met de bus? Dat is goedkoper. En sneller.', 'Prima.'];
  const ids = teksten.map((t, i) => w.beraad.inbreng(w.sess(['b', 'c', 'd', 'e', 'f'][i]), w.id, { tekst: t }).id);
  const weg = w.beraad.inbreng(w.sess('a'), w.id, { tekst: 'Laat maar.' }).id;
  w.beraad.inbreng(w.sess('a'), w.id, { intrek: weg });
  const ai = require('../server/kern/beraad/ai')({ lees: require('../server/kern/beraad/leesweergave').leesweergave({ beraad: w.beraad }) });
  const s = ai.samenvatting(w.sess('b'), w.id);
  assert.deepEqual(s.regels.map(x => x.inbrengId), ids, 'elke inbreng, in volgorde, ook de minderheid');
  assert.ok(!s.regels.some(x => x.inbrengId === weg), 'een ingetrokken inbreng niet');
  for (const x of s.regels) assert.ok(x.zin.length > 0);
  const p = ai.perspectieven(w.sess('b'), w.id);
  assert.ok(p.aanwezig.includes('kosten') && p.aanwezig.includes('wie-raakt-het'));
  assert.ok(p.ontbreekt.some(x => x.aspect === 'toegankelijkheid' && /\?$/.test(x.vraag)));
  const voor = JSON.stringify(w.db.data.beraad);
  const c = ai.concept(w.sess('b'), w.id);
  assert.ok(c.ok && c.concept.includes('Gent') && c.bewaard === false);
  assert.equal(JSON.stringify(w.db.data.beraad), voor, 'het concept veranderde niets aan de opslag');
  assert.equal(ai.samenvatting(w.sess('z'), w.id).status, 404);
});

test('11. G6: kern/beraad laadt niets uit kern/democratie, ook niet via een omweg', () => {
  for (const f of fs.readdirSync(MAP)) {
    const bron = fs.readFileSync(path.join(MAP, f), 'utf8');
    assert.ok(!/require\([^)]*democratie/.test(bron), f + ' laadt iets uit democratie');
  }
  const geladen = execFileSync(process.execPath, ['-e',
    "for (const f of require('fs').readdirSync(process.argv[1])) require(require('path').join(process.argv[1], f));" +
    "console.log(JSON.stringify(Object.keys(require.cache)))", MAP], { encoding: 'utf8' });
  const lijst = JSON.parse(geladen);
  assert.ok(lijst.some(p => p.includes(path.join('kern', 'beraad'))), 'de meting laadde het beraad');
  assert.deepEqual(lijst.filter(p => p.includes(path.join('kern', 'democratie'))), []);
});

test('12. het AI-stuur kan in een beraad niets: elke route is verboden', () => {
  const { beleidVoor, NIVEAUS } = require('../server/kern/stuur/beleid');
  const routes = ['open', 'inbreng', 'voorstel', 'naar-stemmen', 'stem', 'sluit', 'heropen', 'terugkoppeling-gezien', 'mijn', 'lees', 'hulp'];
  for (const wereld of ['member', 'supplier', 'office', 'rtf'])
    for (const r of routes) assert.equal(beleidVoor('/api/beraad/' + r, wereld).niveau, NIVEAUS.verboden, wereld + ' ' + r);
  const lijsten = fs.readFileSync(path.join(WORTEL, 'server/kern/stuur/beleid-lijsten.js'), 'utf8');
  assert.ok(!/beraad/.test(lijsten), 'geen beraadpad op een AI-lijst');
});

test('13. de tijdlijn is een sluitende hashketen, en een stem staat er zonder naam en keuze in', () => {
  const w = opgezet();
  w.beraad.voorstel(w.sess('a'), w.id, { tekst: 'Ja.' });
  w.beraad.naarStemmen(w.sess('a'), w.id);
  w.beraad.stem(w.sess('b'), w.id, 'tegen');
  w.beraad.stem(w.sess('b'), w.id, 'voor');
  const b = w.db.data.beraad.lijst[0];
  assert.ok(keten.verifieer(b.tijdlijn).ok);
  const stemregels = b.tijdlijn.filter(r => /gestemd|stem-gewijzigd/.test(r.wat));
  assert.equal(stemregels.length, 2);
  for (const r of stemregels) { assert.ok(!('door' in r)); assert.ok(!JSON.stringify(r).match(/voor|tegen/)); }
});
