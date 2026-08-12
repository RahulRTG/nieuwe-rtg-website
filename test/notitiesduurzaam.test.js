/* HET BORD BEVESTIGT NIET WAT DE OPSLAG NOG NIET HEEFT.

   De ketenronde weerlegde een belofte die niemand had opgeschreven: een notitie
   werd met 200 bevestigd en was na een herstart weg (KETENS.json, keten NOTITIE,
   verraad `schrijf-verloren` -- STIL VERLIES). Sindsdien gaat elke mutatie op het
   bord door een duurzame bundel (server/kern/notities.js), en dit bestand is de
   toets die dat vasthoudt.

   WAT HIER WORDT BEWEERD, en wat met opzet NIET:
     - zonder verraad blijft het bord gewoon werken (de eerste reparatiepoging op
       de geldroute brak vier toetsen; dat is hier de eerste vraag, niet de laatste);
     - het antwoord is ECHT afgewacht -- een vergeten `await` in de route stuurt
       een Promise, en die serialiseert naar `{}` met een keurige 200;
     - onder een liegende opslag komt er GEEN 2xx uit;
     - de afhankelijkheid die dat mogelijk maakt is niet stil weg te halen.

   Er staat hier NIETS over wat andere apps doen. Een toets die vastlegt dat de
   agenda nog niet duurzaam is, zou de volgende stap tegenhouden in plaats van
   bewaken -- dat is precies de val waar VERVOLG.md voor waarschuwt.

   Draai los: node --experimental-sqlite --test test/notitiesduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ntd-')); mappen.push(m); return m; };

function api(base, pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Duurzaam ' + seq, email: 'ntd' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

/* Twee servers: een eerlijke en een liegende. De liegende krijgt een eigen
   datamap, want een opslag die schrijfacties weggooit hoort niet in de map van
   een andere toets te wroeten. */
let eerlijk, leugen;
test.before(async () => {
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap() } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' } });
});
test.after(() => {
  stop(eerlijk && eerlijk.child);
  stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. zonder verraad doet het bord gewoon zijn werk', async () => {
  const tok = await lid(eerlijk.base);
  const n = await api(eerlijk.base, '/api/notities/bewaar', { titel: 'Duurzaam', tekst: 'Het strandhuis in mei.' }, tok);
  assert.equal(n.status, 200);
  /* DIT IS DE await-CONTROLE, en hij is geen formaliteit. Zonder `await` in de
     route komt hier een geserialiseerde Promise uit: status 200, lichaam `{}`.
     Een toets die alleen naar de status kijkt, ziet dat verschil niet. */
  assert.equal(n.body.ok, true, 'een 200 zonder ok is een niet-afgewachte belofte');
  assert.match(String(n.body.id || ''), /^nt[0-9a-f]+$/, 'de route hoort het echte id terug te geven');

  const m = await api(eerlijk.base, '/api/notities/mijn', {}, tok);
  assert.equal(m.body.eigen.length, 1);
  assert.equal(m.body.eigen[0].tekst, 'Het strandhuis in mei.');
});

test('2. de andere drie knoppen blijven ook gewoon werken', async () => {
  /* Afvinken, delen en weggooien gaan door dezelfde bundel. Werken ze niet meer,
     dan is de duurzaamheid gekocht met een kapot bord. */
  const tok = await lid(eerlijk.base);
  const l = await api(eerlijk.base, '/api/notities/bewaar',
    { soort: 'lijst', titel: 'Inpakken', items: [{ t: 'Paspoort' }, { t: 'Lader' }] }, tok);
  assert.equal(l.status, 200);

  const v = await api(eerlijk.base, '/api/notities/vink', { id: l.body.id, index: 0, af: true }, tok);
  assert.equal(v.status, 200);
  assert.equal(v.body.ok, true);
  let m = await api(eerlijk.base, '/api/notities/mijn', {}, tok);
  assert.equal(m.body.eigen.find(x => x.id === l.body.id).items[0].af, true, 'het vinkje hoort te staan');

  const w = await api(eerlijk.base, '/api/notities/weg', { id: l.body.id }, tok);
  assert.equal(w.status, 200);
  assert.equal(w.body.ok, true);
  m = await api(eerlijk.base, '/api/notities/mijn', {}, tok);
  assert.equal(m.body.eigen.some(x => x.id === l.body.id), false, 'weg is weg');
});

test('3. onder een liegende opslag komt er GEEN bevestiging uit', async () => {
  /* De kern van deze hele ronde. `schrijf-verloren` laat de opslag netjes
     terugkeren zonder iets te bewaren -- precies de fout waar niemand iets van
     merkt. Het bord hoort dan nee te zeggen. */
  const tok = await lid(leugen.base);
  const n = await api(leugen.base, '/api/notities/bewaar', { titel: 'Verdwijnt', tekst: 'niets' }, tok);
  assert.notEqual(n.status, 200, 'bevestigen wat de opslag niet heeft, is de fout zelf');
  assert.ok(n.status >= 500, 'dit is geen invoerfout van het lid maar een opslagfout (kreeg ' + n.status + ')');
  assert.equal(n.body.ok, undefined, 'geen ok bij een mislukte commit');
  assert.match(String(n.body.error || ''), /niet vastgelegd/,
    'het lid hoort te horen dat het niet vastligt, niet alleen dat er "iets" misging');
});

test('4. de leugen raakt de SCHRIJFkant, niet de hele server', async () => {
  /* Zonder deze controle bewijst toets 3 niets: een server die onder verraad
     overal 5xx geeft, zou daar ook doorheen komen. De leeskant schrijft niets en
     hoort dus gewoon te antwoorden. */
  const tok = await lid(leugen.base);
  const m = await api(leugen.base, '/api/notities/mijn', {}, tok);
  assert.equal(m.status, 200, 'lezen hoort onder dit verraad gewoon te lukken');
  assert.ok(Array.isArray(m.body.eigen));
});

test('5. de duurzame bundel is geen optie die je stil kunt weglaten', async () => {
  /* Zou de kern zonder `bijeen` terugvallen op de gewone save(), dan is deze hele
     reparatie met één regel in server.js ongedaan te maken -- zonder dat iets
     klaagt. Hij hoort bij het opstarten om te vallen, en niet pas bij de eerste
     notitie van een lid. */
  const { maakNotities } = require('../server/kern/notities');
  assert.throws(() => maakNotities({ db: { data: {} }, save() {}, crypto: require('crypto'),
    codenaamVan: () => null, sseToCustomer() {} }, null), /bijeen/);

  // en de helper zelf laat zich evenmin half bedraden
  const maakVastleggen = require('../server/lib/duurzaam');
  assert.throws(() => maakVastleggen({ save() {}, bron: 'proef' }), /bijeen/);
  assert.throws(() => maakVastleggen({ bijeen: async () => {}, bron: 'proef' }), /save/);
  assert.equal(typeof maakVastleggen({ bijeen: async (fn) => fn(), save() {}, bron: 'proef' }), 'function');
});

/* ---------- en dezelfde belofte voor de drie andere apps ----------

   Notities was de eerste; agenda, bestanden en berichten hangen sinds
   12 augustus aan dezelfde helper (server/lib/duurzaam.js). Een toets per app
   en niet een lus over alle vier: als er een zakt, wil je in de naam van de
   toets lezen WELKE app zijn werk kwijtraakt. */

test('6. de agenda bevestigt niet zonder opslag, en werkt gewoon zonder verraad', async () => {
  const tok = await lid(eerlijk.base);
  const goed = await api(eerlijk.base, '/api/agenda/toevoegen',
    { titel: 'Tandarts', datum: '2026-09-01', tijd: '10:00' }, tok);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.ok, true, 'een 200 zonder ok is een niet-afgewachte belofte');

  const tok2 = await lid(leugen.base);
  const slecht = await api(leugen.base, '/api/agenda/toevoegen',
    { titel: 'Verdwijnt', datum: '2026-09-01' }, tok2);
  assert.ok(slecht.status >= 500, 'de agenda hoort nee te zeggen (kreeg ' + slecht.status + ')');
});

test('7. de kluis bevestigt niet zonder opslag', async () => {
  const tok = await lid(eerlijk.base);
  const goed = await api(eerlijk.base, '/api/bestanden/map', { naam: 'Reizen' }, tok);
  assert.equal(goed.status, 200);
  assert.match(String(goed.body.id || ''), /\w/, 'de route hoort het echte id terug te geven');

  const tok2 = await lid(leugen.base);
  const slecht = await api(leugen.base, '/api/bestanden/map', { naam: 'Verdwijnt' }, tok2);
  assert.ok(slecht.status >= 500, 'de kluis hoort nee te zeggen (kreeg ' + slecht.status + ')');
});

test('8. een berichtvlag bevestigt niet zonder opslag', async () => {
  const tok = await lid(eerlijk.base);
  const goed = await api(eerlijk.base, '/api/member/berichten/vlag',
    { id: 'proef-gesprek', vlag: 'vast', aan: true }, tok);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.ok, true);

  const tok2 = await lid(leugen.base);
  const slecht = await api(leugen.base, '/api/member/berichten/vlag',
    { id: 'proef-gesprek', vlag: 'vast', aan: true }, tok2);
  assert.ok(slecht.status >= 500, 'een vlag hoort nee te zeggen (kreeg ' + slecht.status + ')');
});

test('9. een geneste laag doet MEE in de bundel en commit niet zelf', async () => {
  /* Een notitie met een datum maakt een agenda-afspraak, en allebei die lagen
     leggen duurzaam vast. Zou de binnenste zijn eigen commit doen, dan staat de
     afspraak vast voordat de notitie dat is -- twee commits met een gat ertussen.
     Dit is de bewering, en hij is hier met nepdelen te stellen; over HTTP is het
     verschil tussen een en twee commits van buiten niet te zien.

     WAT ER NIET WORDT BEWEERD: dat het geheugen leeg blijft na een mislukte
     commit. Dat doet het niet, en dat is bewust dezelfde keuze als op de
     geldketen -- de belofte gaat over wat een herstart overleeft, niet over wat
     er tot dan toe op je scherm staat. De ketenronde meet dat deel. */
  const maakVastleggen = require('../server/lib/duurzaam');
  let bundels = 0, saves = 0;
  const nep = { bijeen: async (fn) => { bundels++; return fn(); }, save: () => { saves++; } };

  const buiten = maakVastleggen({ ...nep, inBundel: () => false, bron: 'proef' });
  await buiten(() => {});
  assert.equal(bundels, 1, 'buiten een bundel opent hij er zelf een');

  const binnen = maakVastleggen({ ...nep, inBundel: () => true, bron: 'proef' });
  await binnen(() => {});
  assert.equal(bundels, 1, 'binnen een bundel opent hij er GEEN tweede');
  assert.equal(saves, 2, 'maar zijn mutatie gaat wel mee de bundel in');
});

test('10. zonder verraad landt de notitie MET zijn afspraak', async () => {
  /* De tegenproef bij 9: zou de bundel de agenda-afspraak overslaan, dan is
     toets 9 groen om de verkeerde reden. */
  const tok = await lid(eerlijk.base);
  const n = await api(eerlijk.base, '/api/notities/bewaar',
    { titel: 'Ophalen bij de stomerij', tekst: 'x', herinnerOp: '2026-09-02', herinnerTijd: '09:00' }, tok);
  assert.equal(n.status, 200);
  const ag = await api(eerlijk.base, '/api/agenda/mijn-lijst', {}, tok);
  assert.match(JSON.stringify(ag.body || {}), /Ophalen bij de stomerij/,
    'de gekoppelde afspraak hoort er te staan');
});
