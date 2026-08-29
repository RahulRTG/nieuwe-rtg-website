/* ============================================================================
   DE SCHRIJFANALYSE -- en vooral: waar hij NIET 'nee' mag zeggen.

   Deze analyse is een VETO en geen certificaat (zie de kop van
   scripts/schrijfanalyse.js). Zijn schrijfvormenlijst is met opzet te ruim, dus
   een 'ja' is goedkoop en een 'nee' is duur: die laatste komt als bewijs onder
   een contract te staan.

   Daarom gaat het merendeel van deze toetsen over de gevallen waarin hij
   'onbekend' hoort te zeggen. Eén ervan komt uit een fout die hier echt is
   gemaakt en die geen enkele meter zou hebben gevonden:

     const aiStatus = () => require('../../ai-stand').beschikbaarheid(anthropic);

   Een pijlfunctie zonder accolades kreeg een LEEG lichaam. Leeg betekent geen
   schrijfvorm en geen aanroep, dus kwam er 'leest aantoonbaar' uit -- terwijl de
   functie een andere module aanroept. POST /api/ai/status stond daardoor als
   bewezen leesroute in de uitslag, en zou zo een NOT_APPLICABLE-contract hebben
   gekregen met bewijs eronder dat er niet was. Gevonden door drie treffers met
   de hand na te kijken.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { analyseer, functiesUit, weegLichaam } = require('../scripts/lib/schrijfanalyse');

const route = (bron, pad) => analyseer(bron).find(r => r.pad === pad);

test('een handler die save() aanroept, schrijft', () => {
  const r = route("app.post('/api/x', (req,res) => { db.data.y.push(1); save(); res.json({ok:true}); });", '/api/x');
  assert.strictEqual(r.schrijft, 'ja');
});

test('een handler die alleen filtert en teruggeeft, leest', () => {
  const r = route("app.post('/api/x', (req,res) => { const m = db.data.z.filter(a => a.k === 1).slice(0,5); res.json({ m }); });", '/api/x');
  assert.strictEqual(r.schrijft, 'nee', r && r.waarom);
});

test('een aanroep naar een andere module maakt het ONBEKEND en niet nee', () => {
  const r = route("app.post('/api/x', (req,res) => res.json(metier.zoek(req.body)));", '/api/x');
  assert.strictEqual(r.schrijft, 'onbekend');
});

/* ---------------------------------------------------------------------------
   DE PIJLFUNCTIE ZONDER ACCOLADES -- de fout die hierboven staat beschreven.
   ------------------------------------------------------------------------- */

test('een pijlfunctie zonder accolades krijgt haar EXPRESSIE als lichaam', () => {
  const f = functiesUit("const aiStatus = () => require('../x').beschikbaarheid(a);");
  assert.ok(f.has('aiStatus'));
  assert.ok(/require/.test(f.get('aiStatus')),
    'het lichaam hoort de expressie te zijn; leeg zou "schrijft niets" betekenen en dat is hier onwaar');
});

test('een handler die zo\'n pijlfunctie aanroept, is ONBEKEND', () => {
  const bron = [
    "const aiStatus = () => require('../../ai-stand').beschikbaarheid(anthropic);",
    "app.post('/api/ai/status', auth, (req, res) => res.json(aiStatus()));"
  ].join('\n');
  const r = route(bron, '/api/ai/status');
  assert.strictEqual(r.schrijft, 'onbekend',
    'dit is de fout die POST /api/ai/status als bewezen leesroute in de uitslag zette');
});

test('een functie waarvan het lichaam niet te lezen is, is nooit stil "nee"', () => {
  /* Een openingsaccolade zonder sluiting (afgekapt bestand, rare vorm): dan mag
     er geen 'nee' uitkomen, want er is niets gewogen. */
  const f = functiesUit('function stuk() { if (a) {');
  assert.ok(/ONLEESBAAR/.test(f.get('stuk') || ''),
    'een onleesbaar lichaam hoort een naam te krijgen die als aanroep telt, zodat de uitkomst ONBEKEND wordt');
});

/* ---------------------------------------------------------------------------
   HET LICHAAM MOET HEEL ZIJN
   ------------------------------------------------------------------------- */

test('een handler van meer dan een regel wordt niet halverwege afgeknipt', () => {
  const bron = [
    "app.post('/api/x', (req, res) => {",
    "  const a = 1;",
    "  db.data.lijst.push(a);",
    "  save();",
    "  res.json({ ok: true });",
    "});"
  ].join('\n');
  const r = route(bron, '/api/x');
  assert.strictEqual(r.schrijft, 'ja',
    'wie op de sluithaak van dezelfde regel mikt, leest elke handler van meer dan een regel als leeg');
});

test('een schrijfvorm in een genest blok telt mee', () => {
  const bron = "app.post('/api/x', (req,res) => { if (a) { if (b) { save(); } } res.json({}); });";
  assert.strictEqual(route(bron, '/api/x').schrijft, 'ja');
});

/* ---------------------------------------------------------------------------
   DE ROOSTER: ja > onbekend > nee
   ------------------------------------------------------------------------- */

test('een lichaam met een schrijfvorm EN een onbekende aanroep is ja, niet onbekend', () => {
  const u = weegLichaam(' save(); metier.zoek(); ');
  assert.strictEqual(u.schrijft, 'ja', 'de zwaarste uitkomst wint; anders verdwijnt een schrijfvorm achter een onbekende');
});

test('een aanroep die binnen het bestand naar een schrijver leidt, maakt de route ja', () => {
  const bron = [
    "function bewaar(x) { db.data.lijst.push(x); save(); }",
    "app.post('/api/x', (req, res) => { bewaar(req.body); res.json({ ok: true }); });"
  ].join('\n');
  assert.strictEqual(route(bron, '/api/x').schrijft, 'ja',
    'de analyse hoort een hop diep te volgen binnen hetzelfde bestand');
});
