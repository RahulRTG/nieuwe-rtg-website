/* Integriteitsratels voor meetregisters die voorheen alleen werden getoond.
   Dit bewijst de boekhouding van de opgeslagen ronde, niet de actualiteit of
   productkwaliteit. Onbekend blijft onbekend. De grenzen zijn identiteiten of
   reeds verklaarde nulinvarianten; er wordt geen nieuwe PASS-score berekend.
   test/registerratels.test.js voert elke wacht ook bewust kapotte invoer.
   Gebruik: node scripts/registerratels.js (alleen lezen, geen vastlegging). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const n = (o, k) => {
  assert.ok(o && Number.isSafeInteger(o[k]) && o[k] >= 0, k + ' moet een gemeten niet-negatief geheel getal zijn');
  return o[k];
};
const lijst = (o, k) => { assert.ok(o && Array.isArray(o[k]), k + ' moet een lijst zijn'); return o[k]; };
const som = (rijen, k) => rijen.reduce((s, rij) => s + n(rij, k), 0);

const RATELS = {
  'AUDITPROEF.json': r => {
    const g = r.gemeten;
    assert.equal(g.ketenHeel, true, 'de auditketen is niet heel');
    assert.equal(n(g, 'blindeRondes'), 0, 'een blinde auditronde is geen bewijs');
    assert.equal(n(g, 'gezakt'), 0, 'een gezakte auditclaim blokkeert');
    assert.equal(n(g, 'beoordeeld'), n(g, 'bewezen') + n(g, 'gezakt'));
    assert.equal(n(g, 'routesMetRol'), n(g, 'beoordeeld') + n(g, 'ongemeten'));
    assert.equal(lijst(r, 'perRoute').length, g.routesMetRol);
  },
  'MUTATIEBOEK.json': r => {
    const g = r.gemeten;
    assert.equal(g.sluit, true, 'routeboekhouding sluit niet');
    assert.equal(g.statusSluit, true, 'statusboekhouding sluit niet');
    assert.equal(som(lijst(r, 'bakken'), 'aantal'), n(g, 'routesTotaal'));
    assert.equal(n(g, 'somVanDeBakken'), g.routesTotaal);
    assert.equal(som(lijst(r, 'statussen'), 'aantal'), n(g, 'mutaties'));
    assert.equal(n(g, 'statusSom'), g.mutaties);
    assert.equal(n(g, 'mutatiesVerklaard') + n(g, 'mutatiesOnverklaard'), g.mutaties);
  },
  'ONBEWEZEN.json': r => {
    const g = r.gemeten;
    assert.equal(g.sluit, true, 'de verdeling van onbewezen routes sluit niet');
    assert.equal(n(g, 'metBewijs') + n(g, 'onbewezen'), n(g, 'mutaties'));
    assert.equal(som(lijst(r, 'bakken'), 'aantal'), g.onbewezen);
  },
  'ONDERZOEKSKETEN.json': r => {
    const g = r.gemeten, stations = lijst(r, 'stations'), schakels = lijst(r, 'schakels');
    assert.deepEqual(lijst(g, 'ontbrekendeBestanden'), [], 'een station verwijst naar ontbrekende bron');
    assert.equal(stations.length, n(g, 'stations'));
    assert.ok(stations.length > 0, 'lege keten is geen onderzoek');
    assert.equal(schakels.length, n(g, 'schakels'));
    const ids = new Set(stations.map(s => s.id));
    assert.equal(ids.size, stations.length, 'dubbele stationidentiteit');
    for (const s of schakels) assert.ok(ids.has(s.van) && ids.has(s.naar), 'schakel zonder station');
  },
  'RAILVERGELIJK.json': r => {
    const g = r.telling, rijen = lijst(r, 'rijen');
    const soorten = { GELIJK: 'gelijk', HOGER: 'hoger', LAGER: 'lager', INGEVULD: 'ingevuld', OVERTREDING: 'overtreding', NIET_GEMETEN: 'nietGemeten' };
    assert.equal(rijen.length, n(g, 'zinnen'));
    for (const rij of rijen) assert.ok(Object.hasOwn(soorten, rij.soort), 'onbekende vergelijkingsstatus');
    for (const [soort, teller] of Object.entries(soorten)) assert.equal(n(g, teller), rijen.filter(x => x.soort === soort).length);
    assert.equal(n(g, 'overtreding'), 0, 'rail overschrijdt zijn contract');
    assert.equal(n(g, 'ingevuld'), 0, 'rail handelt zonder vereiste invoer');
    assert.ok(r.tweedeRail && typeof r.tweedeRail.gemeten === 'boolean');
    if (!r.tweedeRail.gemeten) {
      assert.equal(g.nietGemeten, g.zinnen, 'geen tweede rail mag niet als gelijk tellen');
      assert.ok(typeof r.tweedeRail.reden === 'string' && r.tweedeRail.reden.trim());
    } else assert.equal(r.contract.zelfde, true, 'rails gebruiken verschillende contracten');
  },
  'ROUTEBRON.json': r => {
    const g = r.gemeten;
    assert.equal(n(g, 'waarvanTegenspraak'), 0, 'router en bron spreken elkaar tegen');
    assert.equal(n(g, 'routerRoutesMetBestand') + n(g, 'routerRoutesZonderBestand'), n(g, 'routerRoutes'));
    assert.equal(n(g, 'gelijk') + n(g, 'verschillend'), n(g, 'beideKennen'));
    assert.equal(n(g, 'waarvanVerouderd') + g.waarvanTegenspraak + n(g, 'waarvanNietVastTeStellen'), g.verschillend);
    assert.equal(lijst(r, 'alleRoutes').length, g.routerRoutes);
    assert.equal(lijst(r, 'perRoute').length, g.routerRoutesMetBestand);
    assert.equal(lijst(r, 'verschillen').length, g.verschillend);
  },
  'SYMBOLEN.json': r => {
    const g = r.gemeten;
    assert.equal(n(g, 'waarvanParsefout'), 0, 'onleesbare zelfstandige bron mag niet stil ontbreken');
    assert.equal(n(g, 'gelezen') + n(g, 'nietGelezen'), n(g, 'bestandenGezien'));
    assert.equal(n(g, 'waarvanBundeldeel') + g.waarvanParsefout, g.nietGelezen);
    assert.equal(lijst(r, 'nietGelezen').length, g.nietGelezen);
    assert.equal(lijst(r, 'perBestand').length, g.gelezen);
  },
  'VERRAAD.json': r => {
    const g = r.gemeten, rondes = lijst(r, 'rondes');
    assert.equal(n(g, 'blindeInjecties'), 0, 'een onwaargenomen injectie is geen bewijs');
    assert.equal(n(g, 'onherhaalbareRondes'), 0, 'de injectie moet reproduceerbaar zijn');
    assert.equal(rondes.length, n(g, 'verklaard'));
    assert.ok(rondes.length > 0, 'geen ronde is geen bewijs');
    assert.equal(n(g, 'toegediend'), rondes.filter(x => x.toegediend === true).length);
    assert.equal(n(g, 'waargenomen'), rondes.filter(x => x.waargenomen === true).length);
    assert.equal(g.toegediend - g.waargenomen, g.blindeInjecties);
    for (const ronde of rondes) assert.equal(ronde.herhaalbaar, true);
  },
  'WERELDSTIJL.json': r => {
    const werelden = lijst(r, 'werelden');
    assert.ok(werelden.length > 0, 'geen werelden is geen meting');
    assert.equal(new Set(werelden.map(w => w.wereld)).size, werelden.length);
    for (const w of werelden) {
      const schermen = lijst(w, 'lijst');
      assert.equal(schermen.length, n(w, 'schermen'));
      assert.ok(w.telling && typeof w.telling === 'object');
      assert.equal(Object.keys(w.telling).reduce((s, k) => s + n(w.telling, k), 0), schermen.length);
      for (const [klasse, aantal] of Object.entries(w.telling)) assert.equal(aantal, schermen.filter(s => s.klasse === klasse).length);
      for (const s of schermen) {
        assert.ok(typeof s.reden === 'string' && s.reden.trim(), 'klasse zonder gemeten reden');
        if (s.klasse === 'schil') assert.equal(s.dragers.wereldschil, true, 'schilclaim zonder schil');
      }
    }
  }
};

function controleer(naam, register) {
  assert.ok(Object.hasOwn(RATELS, naam), 'onbekende registerratel: ' + naam);
  assert.ok(register && typeof register === 'object' && !Array.isArray(register), 'ontbrekend meetregister');
  RATELS[naam](register);
}
if (require.main === module) {
  let fouten = 0;
  for (const naam of Object.keys(RATELS)) {
    try { controleer(naam, JSON.parse(fs.readFileSync(path.join(__dirname, '..', naam), 'utf8'))); }
    catch (e) { fouten++; console.error(naam + ': ' + e.message); }
  }
  process.exitCode = fouten ? 1 : 0;
}
module.exports = { RATELS, controleer };
