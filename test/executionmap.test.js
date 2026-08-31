/* DE CAPABILITY-COMPILER (scripts/executionmap.js, EXECUTIE.md blok 1).

   EXECUTION_MAP.json is een PROJECTIE en geen bron. Dat is niet te zien aan het
   bestand -- JSON ziet er hetzelfde uit of iemand hem heeft gegenereerd of met de
   hand heeft bijgewerkt -- en daarom staat het hier. CAPABILITEIT.json telde 21
   losse capability-lijsten in dit huis; een executiekaart die je met de hand kunt
   bijwerken, wordt binnen een jaar de 22e.

   DRIE HANDHAVINGEN, en ze zakken alle drie:
     1 de kaart is byte voor byte gelijk aan wat de bronnen NU opleveren, dus
       een handmatige wijziging EN een generator die iets anders doet zonder dat
       een bron veranderde, worden allebei rood;
     2 waar twee bronnen elkaar tegenspreken staat ONBEPAALD met beide waarden --
       nooit stil een winnaar (dat is geen theorie: IDEMPROEF.json doet dit 28
       keer over zichzelf);
     3 de kaart VERRUIMT niets: wat er per rol in staat is exact wat beleidVoor()
       zegt, en de vertaling naar de gedeelde noemer komt uit de noemer zelf en
       niet uit een tweede tabel.

   En de vierde die makkelijk vergeten wordt: elk veld waarvan we de waarde NIET
   kennen, staat er als ONBEPAALD MET REDEN. Een kaart die risico, herstel en
   kosten invult omdat de kolom nu eenmaal bestaat, verzint ze. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { bouw, tekst, herhalingUit, BRONNEN, ROLLEN } = require('../scripts/executionmap');
const { beleidVoor } = require('../server/kern/stuur/beleid');
const { PROJECTIES } = require('../scripts/gezagsnoemer');

const WORTEL = path.join(__dirname, '..');
const OP_SCHIJF = path.join(WORTEL, 'EXECUTION_MAP.json');
const K = bouw();

test('0. de compiler draait en levert een kaart met inhoud', () => {
  assert.ok(!K.fout, K.fout);
  assert.ok(K.telling.capabilities > 1000, 'te weinig routes: ' + K.telling.capabilities);
  assert.ok(K.telling.bereikbaarPerRol > 100, 'te weinig bereikbare paren: ' + K.telling.bereikbaarPerRol);
});

test('1. DE KAART OP SCHIJF IS GELIJK AAN WAT DE BRONNEN OPLEVEREN', () => {
  const opSchijf = fs.existsSync(OP_SCHIJF) ? fs.readFileSync(OP_SCHIJF, 'utf8') : null;
  assert.ok(opSchijf !== null, 'EXECUTION_MAP.json bestaat niet -- draai: npm run executionmap');
  assert.equal(opSchijf, tekst(K),
    'EXECUTION_MAP.json is niet gelijk aan de hercompilatie. Of hij is met de hand gewijzigd, ' +
    'of de generator is veranderd zonder dat een bron veranderde. Draai: npm run executionmap');
});

test('2. elke bron draagt zijn echte vingerafdruk, zodat "ongewijzigd" narekenbaar is', () => {
  for (const b of BRONNEN) {
    const afdruk = K.bronnen[b];
    assert.ok(afdruk, 'bron zonder vingerafdruk: ' + b);
    const echt = crypto.createHash('sha256').update(fs.readFileSync(path.join(WORTEL, b))).digest('hex').slice(0, 16);
    assert.equal(afdruk, echt, 'de vingerafdruk van ' + b + ' klopt niet met het bestand');
  }
});

test('3. TEGENSPRAAK WORDT ONBEPAALD, nooit stil een winnaar', () => {
  /* Rechtstreeks uit de bron nagerekend: elke (pad, rol) waarover IDEMPROEF.json
     twee verschillende dingen zegt, MOET in de kaart ONBEPAALD zijn. */
  const per = require('../IDEMPROEF.json').perRoute || [];
  const gezien = new Map();
  for (const r of per) {
    if (!r || r.methode !== 'POST' || !r.pad) continue;
    const k = r.pad + ' ' + (r.rol || '');
    if (!gezien.has(k)) gezien.set(k, new Set());
    gezien.get(k).add(r.idempotentie || 'ongemeten');
  }
  const kaart = new Map(K.capabilities.map(c => [c.pad + ' ' + (c.rol || ''), c]));
  let getoetst = 0;
  for (const [k, waarden] of gezien) {
    if (waarden.size < 2) continue;
    const c = kaart.get(k);
    if (!c) continue;
    getoetst++;
    assert.equal(c.herhaling, 'ONBEPAALD', k + ': de bron is het oneens (' + [...waarden].join('/') +
      ') maar de kaart zet er ' + c.herhaling + ' neer');
    assert.ok(c.herhalingReden && /tegen/.test(c.herhalingReden), k + ': ONBEPAALD zonder reden');
  }
  /* GEEN EIS MEER DAT DE DATA EEN TEGENSPRAAK BEVAT. Die stond er, en terecht --
     een controle die nul gevallen ziet bewijst niets. Maar toen de bron zichzelf
     niet meer tegensprak, zakte de bouw op iets GOEDS. De regel zelf staat nu
     hieronder op een gebouwd geval; dit blijft de controle op de echte data. */
  if (!getoetst) assert.equal([...gezien.values()].filter(w => w.size > 1).length, 0,
    'er zijn tegenspraken in de bron die niet in de kaart terugkomen');
});

test('3b. de tegenspraakregel zelf, op een gebouwd geval', () => {
  const eens = herhalingUit(['beschermd']);
  assert.equal(eens.herhaling, 'beschermd');
  assert.equal(eens.conflict, false);

  const oneens = herhalingUit(['beschermd', 'ongemeten']);
  assert.equal(oneens.herhaling, 'ONBEPAALD',
    'twee verschillende metingen over dezelfde route mogen nooit stil een winnaar krijgen');
  assert.equal(oneens.conflict, true);
  assert.match(oneens.reden, /spreekt zichzelf tegen/);
  assert.match(oneens.reden, /beschermd en ongemeten/, 'de reden noemt niet WAT er botst');

  /* Leeg is `ongemeten` en niet ONBEPAALD: niets gemeten is geen tegenspraak. */
  assert.equal(herhalingUit([]).herhaling, 'ongemeten');
  assert.equal(herhalingUit([]).conflict, false);
});

test('4. DE KAART VERRUIMT NIETS: bereik is exact wat beleidVoor() zegt', () => {
  for (const c of K.capabilities) {
    for (const rol of ROLLEN) {
      const echt = beleidVoor(c.pad, rol).niveau;
      const inKaart = typeof c.bereik === 'string' ? c.bereik : c.bereik[rol];
      assert.equal(inKaart, echt, c.pad + ' (' + rol + '): kaart zegt ' + inKaart + ', beleid zegt ' + echt);
    }
  }
});

test('5. de vertaling naar de noemer komt uit de noemer, niet uit een tweede tabel', () => {
  const p = PROJECTIES.find(x => x.bestand === 'server/kern/stuur/beleid.js');
  for (const [trede, v] of Object.entries(p.treden)) {
    const uitKaart = K.noemer[trede];
    assert.ok(uitKaart, 'trede ' + trede + ' ontbreekt in de legenda van de kaart');
    const verwacht = Array.isArray(v.noemer) ? v.noemer.join('|') : v.noemer;
    assert.equal(uitKaart.noemer, verwacht, 'de kaart beeldt ' + trede + ' anders af dan de noemer zelf');
  }
  assert.deepEqual(Object.keys(K.noemer).sort(), Object.keys(p.treden).sort(),
    'de legenda kent andere treden dan de noemer -- dat is de tweede tabel die er niet mag zijn');
});

test('6. wat we niet weten staat er als ONBEPAALD MET REDEN, en niet als een verzonnen waarde', () => {
  for (const naam of ['risico', 'kosten']) {
    const v = K.velden[naam];
    assert.ok(v, 'veldsoort ' + naam + ' ontbreekt');
    assert.equal(v.waarde, 'ONBEPAALD', naam + ' heeft een waarde gekregen die niemand heeft vastgesteld');
    assert.ok(v.reden && v.reden.length > 25, naam + ' is ONBEPAALD zonder reden');
    assert.equal(v.afgeleid, false, naam + ' heet afgeleid maar er is niets om uit af te leiden');
  }
});

test('6b. HERSTEL: bevestigd mag, maar ALLEEN met een uitgevoerde proef eronder', () => {
  /* Deze toets stond als "komt nooit boven `vermoed`", en dat was de goede regel
     zolang herstel uit NAMEN werd afgeleid: die vergelijken woorden, geen
     handelingen. Sinds scripts/herstelproef.js het paar werkelijk UITVOERT
     (heen, kijken, terug, kijken) bestaat er wel bewijs, en dan zou "nooit boven
     vermoed" het bewijs wegpoetsen. De regel is dus niet vervallen maar
     verplaatst: een bevestiging moet naar een uitgevoerde proef wijzen, met
     dezelfde tegenhanger en de soort erbij. Zonder die eis was de nieuwe tak
     precies het gat dat de oude toets dichthield. */
  const proef = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERSTELPROEF.json'), 'utf8')); }
    catch (e) { return null; }
  })();
  const uitProef = new Map((proef && proef.per || []).map(u => [u.heen, u]));

  for (const c of K.capabilities) {
    if (!c.herstel) continue;
    assert.ok(['vermoed', 'onbepaald', 'bevestigd'].includes(c.herstel),
      c.pad + ' draagt herstel "' + c.herstel + '"');
    if (c.herstel === 'vermoed') assert.ok(c.herstelTegenhanger, c.pad + ': vermoed zonder tegenhanger');
    if (c.herstel === 'onbepaald') assert.ok(c.herstelKandidaten && c.herstelKandidaten.length > 1,
      c.pad + ': onbepaald zonder de kandidaten die het onbepaald maken');
    if (c.herstel !== 'bevestigd') continue;
    const u = uitProef.get(c.pad);
    assert.ok(u, c.pad + ' heet bevestigd zonder dat de herstelproef hem heeft uitgevoerd');
    assert.equal(u.terug, c.herstelTegenhanger, c.pad + ': bevestigd op een andere tegenhanger dan beproefd');
    assert.ok(['exact', 'compensatie'].includes(u.uitslag),
      c.pad + ': de proef gaf "' + u.uitslag + '", en dat is geen bevestiging');
  }
  assert.equal(K.telling.bevestigdeTerugweg, uitProef.size
    ? K.capabilities.filter(c => c.herstel === 'bevestigd').length
    : 0, 'de telling van bevestigde terugwegen klopt niet met de rijen');
});
test('6c. het besluit staat NAAST de meting en vervangt hem niet', () => {
  const besluiten = require('../IDEMBESLUIT.json').routes || {};
  let getoetst = 0;
  for (const c of K.capabilities) {
    const b = besluiten[c.pad];
    if (!b) { assert.ok(!c.herhalingBesluit, c.pad + ' draagt een besluit dat niet in IDEMBESLUIT.json staat'); continue; }
    getoetst++;
    assert.equal(c.herhalingBesluit, b.klasse, c.pad + ': de kaart zegt iets anders dan het besluitregister');
    assert.ok(c.herhaling, c.pad + ': het besluit heeft de meting weggedrukt');
  }
  assert.ok(getoetst > 50, 'te weinig besluiten getoetst: ' + getoetst);
});

test('7. elke afgeleide veldsoort noemt zijn bron en wat hij betekent', () => {
  for (const [naam, v] of Object.entries(K.velden)) {
    assert.ok(typeof v.afgeleid === 'boolean', naam + ' zegt niet of hij is afgeleid');
    if (v.afgeleid) assert.ok(v.bron, naam + ' heet afgeleid maar noemt geen bron');
    assert.ok((v.wat && v.wat.length > 10) || v.reden, naam + ' legt niet uit wat hij betekent');
  }
});

test('8. elke rij die ONBEPAALD zegt, zegt ook waarom', () => {
  for (const c of K.capabilities) {
    if (c.herhaling === 'ONBEPAALD') assert.ok(c.herhalingReden, c.pad + ': herhaling ONBEPAALD zonder reden');
    if (c.bewijs === 'ONBEPAALD') assert.ok(c.bewijsReden, c.pad + ': bewijs ONBEPAALD zonder reden');
  }
});
