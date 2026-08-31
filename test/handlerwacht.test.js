/* ============================================================================
   DE WACHT IN DE HANDLER.

   HET PROBLEEM DAT DIT MEET. Voor 612 schrijfroutes is de bewakerslijst van de
   router LEEG: hun autorisatie zit in de handler, omdat de geloofsbrief in het
   LICHAAM van het verzoek staat (een gezinscode plus profieltoken) en niet in de
   kop. Geen enkele statische controle kon daar iets over zeggen, en de vier
   bewijsproeven sloegen ze over met "geen bewakerslaag". 612 routes waarover
   niets te zeggen valt, is precies de vorm waarin ongemeten als groen leest.

   WAT DEZE TOETSEN BEWAKEN. Niet de uitkomst -- die beweegt met elke route die
   erbij komt -- maar de EIGENSCHAPPEN van de meter:

     de optelling sluit          elke route valt in precies een bak
     elke naam bestaat           een gezagsfunctie die nergens staat, keurt alles
                                 goed wat erop lijkt
     elke verklaring leeft       een verklaarde route die niet meer bestaat houdt
                                 het getal kunstmatig op nul
     de indirectie stopt         een niveau wordt gevolgd, niet meer

   DE MUTATIES VOOR DIT BESTAND, elk gedraaid en zien zakken:
     1. zet een verzonnen naam in GEZAG -> "elke gezagsfunctie bestaat echt" zakt;
     2. haal de reden weg bij een verklaring -> "elke verklaring draagt een reden" zakt;
     3. laat weeg() de indirectie twee niveaus volgen -> de telling verschuift en
        "de optelling sluit" blijft staan, maar de bak `bewaakt` groeit; dat is
        met opzet GEEN toets: waar de grens ligt is een besluit, en het staat in
        de kop van scripts/handlerwacht.js.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const hw = require('../scripts/handlerwacht');
const { meet, GEZAG, handlerLijf, weeg } = hw;
const uit = meet();

test('de meter loopt schoon: geen enkele klacht', () => {
  assert.deepEqual(uit.klachten, [], uit.klachten.join(' | '));
});

test('de optelling sluit: elke route zonder bewakerslaag valt in precies een bak', () => {
  const g = uit.gemeten;
  const som = g.bewaakt + g.openbaarMetReden + g.eigenControle + g.sleutelDoorgegeven +
    g.zonderWachtMetReden + g.laat + g.onbewaakt + g.nietGelezen;
  assert.equal(som, g.zonderBewakerslaag,
    'de bakken tellen op tot ' + som + ' en er zijn ' + g.zonderBewakerslaag + ' routes');
});

test('elke gezagsfunctie in het register bestaat echt en zegt wat hij vaststelt', () => {
  /* Dit is de controle die `tenantVan` ving: een naam die ik had opgeschreven op
     de aanname dat de tenant-routes wel zoiets zouden hebben. Ze gebruiken
     viaBeheerOfDirectie. Een register dat namen noemt die nergens staan, keurt
     alles goed wat erop lijkt. */
  for (const g of GEZAG) {
    assert.ok(g.stelt && g.stelt.length > 20, g.naam + ' zegt niet wat hij vaststelt');
    assert.ok(g.waar, g.naam + ' zegt niet waar hij woont');
    assert.equal(typeof g.argReq, 'boolean', g.naam + ' zegt niet of hij met req begint');
  }
});

test('elke verklaring draagt een reden en wijst naar een bestaande route', () => {
  const { alleRoutes } = require('../scripts/lib/routes');
  const bestaat = new Set(alleRoutes().map(r => r.methode + ' ' + r.pad));
  for (const [sleutel, reden] of Object.entries(uit.zonderWacht)) {
    assert.ok(reden && reden.length > 30, sleutel + ' is verklaard zonder uitgeschreven reden');
    assert.ok(bestaat.has(sleutel), sleutel + ' is verklaard maar bestaat niet meer');
  }
});

test('een verklaring geldt alleen waar de meter niets vond', () => {
  /* Een verklaring mag een METING nooit overschrijven: een route die wel degelijk
     een gezagsfunctie draait, hoort als bewaakt te tellen, ook als iemand hem
     ooit op de verklaarde lijst zette. */
  for (const r of uit.perRoute) {
    if (r.staat === 'zonderWachtMetReden') assert.ok(!r.wacht, r.sleutel + ' draagt toch een wacht');
    if (r.staat === 'bewaakt') assert.ok(!uit.zonderWacht[r.sleutel],
      r.sleutel + ' is bewaakt EN verklaard; dan overschrijft de verklaring de meting');
  }
});

test('handlerLijf leest de handler en niet het optie-object ervoor', () => {
  /* De fout die vijf sociale routes als onbewaakt meldde: bij
     `app.post(pad, express.json({ limit: "1.5mb" }), (req, res) => { ... })`
     is de eerste accolade die van de OPTIES. */
  const code = "app.post('/x', express.json({ limit: '1.5mb' }), (req, res) => {\n  const s = rtfSociaal(req, res);\n});";
  const lijf = handlerLijf(code, 1);
  assert.match(lijf, /rtfSociaal/);
  assert.doesNotMatch(lijf, /1\.5mb/);
});

test('handlerLijf volgt een handler die als naam wordt doorgegeven', () => {
  /* `router.post('/pad', maak);` -- de eerste versie zocht de volgende accolade
     in de tekst en las een willekeurige functie verderop. */
  const code = "function maak(req, res) {\n  const s = gezinVan(req, res);\n}\nrouter.post('/gezin/x', maak);";
  const lijf = handlerLijf(code, 4);
  assert.match(lijf, /gezinVan/);
});

test('handlerLijf leest ook een pijl zonder accolades', () => {
  const code = "app.post('/api/les/leraar', (req, res) => stuur(res, lesmaker.leraar(req.body.code, req.body.leraarToken)));";
  const lijf = handlerLijf(code, 1);
  assert.match(lijf, /leraarToken/);
});

test('een wacht NA het eerste antwoord telt niet als bewaakt', () => {
  const laat = weeg("res.json({ ok: true });\nconst s = gezinVan(req, res);", null);
  assert.equal(laat.staat, 'laat');
  const goed = weeg("const s = gezinVan(req, res); if (!s) return;\nres.json({ ok: true });", null);
  assert.equal(goed.staat, 'bewaakt');
});

test('de indirectie gaat een niveau diep en niet twee', () => {
  const code = 'const mijn = (req, res) => { const p = personeelVan(req, res); return p; };';
  const een = weeg('const pv = mijn(req, res); if (!pv) return;', code);
  assert.equal(een.staat, 'bewaakt');
  assert.match(een.wacht, /mijn -> personeelVan/);

  const diep = 'const b = (req, res) => { return personeelVan(req, res); };\n' +
               'const a = (req, res) => { return b(req, res); };';
  const twee = weeg('const x = a(req, res); if (!x) return;', diep);
  assert.notEqual(twee.staat, 'bewaakt',
    'twee niveaus wordt niet gevolgd: waar die grens ligt is een besluit, niet een gok');
});

test('de twee publieke lijsten worden vergeleken, niet samengevoegd', () => {
  /* scripts/poortwacht.js draagt een eigen PUBLIEK-map naast die van de
     keuring. Samenvoegen zou keuringsregel 28 RUIMER maken, en dat is de
     gevaarlijke richting bij een poortregel. */
  assert.ok(uit.tweePubliekeLijsten, 'de tweede lijst hoort gelezen te worden');
  assert.ok(Array.isArray(uit.tweePubliekeLijsten.alleenInPoortwacht));
  assert.ok(Array.isArray(uit.tweePubliekeLijsten.alleenInDeKeuring));
});

test('HANDLERWACHT.json is gelijk aan de meting eronder', () => {
  const opSchijf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'HANDLERWACHT.json'), 'utf8'));
  assert.deepEqual(meet().gemeten, opSchijf.gemeten, 'draai: npm run handlerwacht:vast');
});
