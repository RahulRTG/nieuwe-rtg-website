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
const tekst = v => assert.ok(typeof v === 'string' && v.trim(), 'de claim mist haar grond');
const uniek = (rijen, sleutel) => assert.equal(new Set(rijen.map(sleutel)).size, rijen.length, 'dubbele bewijsidentiteit');
function verdeling(rijen, veld, telling, soorten) {
  for (const rij of rijen) assert.ok(soorten.includes(rij[veld]), 'onbekende bewijsstatus');
  for (const soort of soorten) assert.equal(n(telling, soort), rijen.filter(r => r[veld] === soort).length, 'telling ' + soort + ' wijkt af');
}

const RATELS = {
  'SLO.json': r => {
    // Dezelfde publieke afspraak als check.js: wijziging van doelen, verwachte
    // HTTP-statussen of meetminimum mag niet onzichtbaar blijven in SLO.md.
    const slo = require('./slo');
    const md = fs.readFileSync(slo.DOEL, 'utf8');
    const begin = md.indexOf(slo.BEGIN), eind = md.indexOf(slo.EIND);
    assert.ok(begin >= 0 && eind > begin, 'de gepubliceerde SLO-afspraak ontbreekt');
    assert.equal(md.slice(begin, eind + slo.EIND.length), slo.blok(r), 'machineconfiguratie wijkt af van gepubliceerde SLO-afspraak');
  },
  'SUITE.json': r => {
    const g = r.gemeten;
    assert.equal(typeof g.groen, 'boolean');
    assert.equal(typeof g.volledig, 'boolean');
    assert.equal(typeof g.tapVolledig, 'boolean');
    assert.ok(Number.isSafeInteger(g.afsluitcode) && g.afsluitcode >= 0);
    assert.equal(g.groen, g.afsluitcode === 0, 'suitekleur spreekt afsluitcode tegen');
    assert.equal(n(g, 'tests'), ['geslaagdeTests', 'mislukt', 'geannuleerd', 'overgeslagen', 'todo'].reduce((s, k) => s + n(g, k), 0));
    if (g.groen) {
      assert.equal(g.volledig, true, 'een deelronde is geen groene volle suite');
      assert.equal(g.tapVolledig, true, 'ontbrekende TAP is geen groen');
      assert.ok(g.tests > 0 && n(g, 'bestanden') > 0, 'geen tests is geen groen');
      for (const k of ['mislukt', 'geannuleerd', 'overgeslagen', 'todo']) assert.equal(g[k], 0, k + ' mag niet als PASS verdwijnen');
    }
  },
  'HANDELINGPROEF.json': r => {
    const g = r.gemeten, rijen = lijst(r, 'perRoute');
    assert.equal(g.ketenOk, true, 'een gebroken handelingsketen is geen bewijs');
    assert.equal(n(g, 'gezakt'), 0, 'werk zonder handelingsspoor blokkeert');
    assert.equal(rijen.length, n(g, 'beproefd'));
    assert.equal(g.beproefd, n(g, 'routesMetRol'));
    uniek(rijen, x => x.methode + ' ' + x.pad);
    verdeling(rijen, 'audit', g, ['bewezen', 'gezakt', 'ongemeten']);
    for (const rij of rijen) {
      const gelukt = rij.status >= 200 && rij.status < 300;
      assert.equal(rij.audit !== 'ongemeten', gelukt, 'een geweigerde oproep mag geen auditbewijs krijgen');
      tekst(rij.reden);
    }
  },
  'KERNHERKOMST.json': r => {
    const g = r.gemeten, rijen = lijst(r, 'perNaam'), open = lijst(r, 'onopgelost');
    assert.equal(rijen.length, n(g, 'namen'));
    uniek(rijen, x => x.naam);
    for (const rij of rijen) {
      tekst(rij.naam);
      assert.ok(lijst(rij, 'herkomsten').length > 0, 'een bekende naam vereist een herkomst');
      for (const h of rij.herkomsten) { tekst(h.bestand); tekst(h.hoe); }
    }
    const meer = rijen.filter(x => x.herkomsten.length > 1);
    assert.equal(meer.length, n(g, 'namenMetMeerdereHerkomsten'), 'ambigue herkomst mag niet als uniek tellen');
    assert.deepEqual(lijst(r, 'meerdereHerkomsten'), meer);
    assert.equal(open.length, n(g, 'onopgelost'), 'onopgeloste herkomst mag niet uit de telling verdwijnen');
    for (const rij of open) { tekst(rij.bestand); tekst(rij.reden); }
  },
  'SCHRIJFANALYSE.json': r => {
    const g = r.gemeten, rijen = lijst(r, 'perRoute'), veto = lijst(r, 'veto');
    assert.equal(rijen.length, n(g, 'routes'));
    uniek(rijen, x => x.route);
    verdeling(rijen, 'schrijft', g, ['ja', 'nee', 'onbekend']);
    assert.equal(veto.length, n(g, 'veto'));
    uniek(veto, x => x.route);
    const per = new Map(rijen.map(x => [x.route, x]));
    for (const v of veto) {
      const bron = per.get(v.route);
      assert.ok(bron && bron.schrijft === 'ja', 'schrijfveto vereist aangetroffen schrijfvorm');
      assert.equal(v.bestand, bron.bestand);
      assert.equal(v.waarom, bron.waarom);
      tekst(v.waarom);
    }
  },
  'WAAROM.json': r => {
    assert.ok(r.perRoute && typeof r.perRoute === 'object' && !Array.isArray(r.perRoute));
    const g = r.gemeten, rijen = Object.values(r.perRoute), soorten = lijst(r, 'soorten');
    const ids = require('./lib/waarom').SOORTEN.map(s => s.id);
    assert.deepEqual(soorten.map(s => s.id), ids, 'ook lege en onbekende bakken moeten zichtbaar blijven');
    assert.equal(rijen.length, n(g, 'routes'));
    for (const rij of rijen) {
      assert.ok(ids.includes(rij.soort), 'onbekende redenklasse');
      assert.equal(rij.soort === 'bereikt', rij.status >= 200 && rij.status < 300, 'weigering mag niet als bereikte handler tellen');
      tekst(rij.omdat);
    }
    for (const soort of soorten) assert.equal(n(soort, 'aantal'), rijen.filter(x => x.soort === soort.id).length);
    for (const soort of ['bereikt', 'onbekend']) assert.equal(n(g, soort), rijen.filter(x => x.soort === soort).length);
    assert.equal(n(g, 'kandidaten'), g.routes + som(lijst(r, 'zonderRol'), 'aantal'), 'onbereikbare rollen mogen niet uit de noemer verdwijnen');
  },
  'VERTROUWEN.json': r => {
    assert.ok(r.perRoute && typeof r.perRoute === 'object' && !Array.isArray(r.perRoute));
    const rijen = Object.values(r.perRoute);
    assert.equal(rijen.length, n(r, 'routes'));
    verdeling(rijen, 'staat', r.telling, ['bewezen', 'verschaald', 'verzwakt', 'geschorst', 'ongemeten']);
    const velden = ['defect', 'ontbrekend', 'verouderd', 'vermoedVerouderd', 'vervalOnbekend'];
    for (const rij of rijen) {
      tekst(rij.reden); tekst(rij.heropent);
      for (const k of velden) if (Object.hasOwn(rij, k)) assert.ok(Array.isArray(rij[k]), k + ' moet zijn bewijsgronden behouden');
      if (rij.defect?.length) assert.equal(rij.staat, 'geschorst', 'een gezakte cel schorst de route');
      else if (rij.ontbrekend?.length) assert.ok(['verzwakt', 'ongemeten'].includes(rij.staat), 'ontbrekende cellen kunnen geen compleet bewijs dragen');
      else if (rij.verouderd?.length) assert.equal(rij.staat, 'verschaald', 'oude cellen zijn geen actueel bewijs');
      if (rij.staat === 'bewezen') {
        assert.ok(Number.isFinite(r.ouderdomDagen) && Number.isFinite(r.halfwaardetijdDagen) && r.ouderdomDagen >= 0 && r.ouderdomDagen <= r.halfwaardetijdDagen, 'onbekende of verstreken versheid kan niet bewezen heten');
        assert.deepEqual(lijst(r, 'onreproduceerbaar'), [], 'vuile bewijsbron kan niet bewezen heten');
      }
    }
    for (const k of ['defect', 'ontbrekend', 'verouderd', 'vervalOnbekend']) assert.equal(n(r.soorten, k), rijen.filter(x => x[k]?.length).length);
    assert.equal(n(r.soorten, 'verouderdVermoed'), rijen.filter(x => !x.verouderd?.length && x.vermoedVerouderd?.length).length);
  },
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
