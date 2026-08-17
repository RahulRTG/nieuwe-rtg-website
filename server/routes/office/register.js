/* Backoffice (deelmodule): HET PLATFORMREGISTER.

   Van elk ding in dit huis: wat het is, wat het doet, of het aan staat en wat we
   ervan weten. Vier soorten (functie, bediening, scherm, control) in een
   recordvorm; de vorm en de statusregels staan in kern/platformregister.js en
   kern/platformregister/samenstellen.js, hier worden de echte bronnen erin
   gehangen.

   GEEN VAN DEZE VIER IS HIER BEDACHT. De functiecatalogus, de schakelkast, de
   bewijsmatrix, de app-gids en de CONTROL-objecten bestonden alle vijf al; wat
   ontbrak was de VERTALING van bewijs op routeniveau naar het niveau waarop een
   mens denkt. Niemand vraagt hoe het met POST /api/bank/spaardoel staat.

   HET REKENT MET DEZELFDE FUNCTIE ALS DE RATEL: scripts/bewijsmatrix.js bouw(),
   met de routetabel van DEZE server erin gehangen -- net als ./dossier.js, en om
   dezelfde reden (bouw() start anders een tweede server op).

   WAT HET UITDRUKKELIJK NIET DOET: schakelen. Kijken en ingrijpen zijn hier twee
   schermen. De boardroom blijft de plek waar een knop omgaat; dit is de plek
   waar je ziet wat je weet voordat je hem omzet. */
'use strict';
const fs = require('fs');
const path = require('path');
const pr = require('../../kern/platformregister');
const sam = require('../../kern/platformregister/samenstellen');
const matrix = require('../../../scripts/bewijsmatrix');
const schermenMeter = require('../../../scripts/schermen');

const WORTEL = path.join(__dirname, '../../..');
const BRONNEN = ['POORTWACHT.json', 'ROLPROEF.json', 'INVOERPROEF.json',
  'IDEMPROEF.json', 'STAATPROEF.json', 'KETENS.json', '.routejournaal'];

/* De instrumenten die een CONTROL-object dragen. Met de hand, want er is geen
   manier om "alles wat een CONTROL exporteert" te vinden zonder de hele boom te
   laden -- en dat mag een server niet doen. De lijst mag groeien; hij hoort
   niet te krimpen zonder dat er een control verdwijnt. */
const CONTROLBRONNEN = [
  '../../../scripts/lib/rolproef', '../../../scripts/lib/invoerproef',
  '../../../scripts/lib/staatproef', '../../../scripts/lib/idemproef',
  '../../../scripts/lib/ketenproef', '../../../scripts/lib/schermleugen',
  '../../../scripts/bewijsmatrix', '../../lib/keten', '../../lib/keten-anker',
  '../../lib/klok', '../../lib/verraad'
];

module.exports = (octx) => {
  const { app, officeAuth, db } = octx.kern;
  const functies = require('../../functies');

  const stempel = () => BRONNEN.map(n => {
    try { return fs.statSync(path.join(WORTEL, n)).mtimeMs; } catch (e) { return 0; }
  }).join('|');

  /* De routetabel en de bewakers uit DEZE server; zie ./dossier.js voor waarom
     dat geinjecteerd wordt en niet opgehaald. */
  let injectieCache = null;
  function injectie() {
    if (injectieCache) return injectieCache;
    const inv = require('../../kern/routedekking').inventaris(
      typeof app._routes === 'function' ? app._routes() : []);
    const routes = [], bewakers = new Map();
    for (const r of inv.routes) {
      routes.push({ methode: r.methode, pad: r.pad });
      bewakers.set(r.methode + ' ' + r.pad,
        { bewakers: Array.isArray(r.bewakers) ? r.bewakers : [], waar: null });
    }
    injectieCache = { tabel: { routes, herkomst: 'de router van deze server (app._routes)', gedegradeerd: false }, bewakers };
    return injectieCache;
  }

  const controls = () => {
    const uit = [];
    for (const b of CONTROLBRONNEN) {
      try { const m = require(b); if (m && m.CONTROL) uit.push(m.CONTROL); }
      catch (e) { /* een instrument dat niet laadt, meldt zich als ontbrekend bewijs */ }
    }
    return uit;
  };

  const registerBestaat = (naam) => { try { return fs.existsSync(path.join(WORTEL, naam)); } catch (e) { return false; } };

  let cache = null;
  function bouwRegister() {
    const nu = stempel();
    if (cache && cache.stempel === nu) return cache.reg;

    const { tabel, bewakers } = injectie();
    const m = matrix.bouw({ tabel, bewakers });
    const { perDing, onbenoemd } = sam.verdeelRoutes(m.rijen, functies.FUNCTIES);

    /* De schakelstand komt uit de levende kast, niet uit `standaard`: standaard
       is wat er bij oplevering aan stond, niet wat er NU aan staat. */
    const staat = (db && db.data && db.data.functies) || {};
    const standVan = (id) => functies.functieStatus(id, staat);

    const alle = [].concat(
      sam.functieRecords(functies.FUNCTIES, perDing, standVan),
      sam.bedieningRecords(perDing),
      schermRecordsVeilig(),
      sam.controlRecords(controls(), registerBestaat)
    );

    const reg = { dingen: alle, onbenoemd, herkomst: m.herkomst, routes: m.routes };
    cache = { stempel: nu, reg };
    return reg;
  }

  /* De schermmeter leest het journaal van de laatste e2e-ronde. Ligt dat er niet,
     dan is de schermstatus ONBEKEND en zeggen we dat -- een scherm stil op
     "nooit geopend" zetten omdat het journaal ontbreekt, is een meting verzinnen
     (LAT.md regel 3). */
  function schermRecordsVeilig() {
    let schermen = [], gids = {};
    try { schermen = schermenMeter.alleSchermen(); } catch (e) { return []; }
    try { gids = require('../../kern/appgids').GIDS || {}; } catch (e) { gids = {}; }

    /* geopendeSchermen() NEEMT EEN PAD en geeft {afgelegd, neven} terug. Zonder
       pad leest hij undefined, geeft netjes null, en dan kwamen alle 260 schermen
       als "nooit geopend" uit dit register -- een meting verzonnen uit een
       ontbrekend bestand. Het journaal heet .schermjournaal en wordt door
       `npm run e2e` geschreven, niet door de gewone suite. */
    let waarneming = null;
    try {
      const w = schermenMeter.geopendeSchermen(path.join(WORTEL, '.schermjournaal'));
      if (w && w.afgelegd) {
        waarneming = { afgelegd: w.afgelegd, neven: w.neven,
          vegers: schermenMeter.veegToetsen(w.afgelegd, schermen.length) };
      }
    } catch (e) { waarneming = null; }
    return sam.schermRecords(schermen, gids, waarneming);
  }

  function overzicht(vraag) {
    const reg = bouwRegister();
    const v = vraag || {};
    const zoek = String(v.zoek || '').trim().toLowerCase().slice(0, 120);
    const soort = String(v.soort || '').trim().slice(0, 20);
    const staat = String(v.staat || '').trim().slice(0, 24);
    const alleenAandacht = !!v.alleenAandacht;

    let rijen = reg.dingen;
    if (soort) rijen = rijen.filter(d => d.soort === soort);
    if (staat) rijen = rijen.filter(d => d.status.staat === staat);
    /* UITZONDERINGSGESTUURD (ONTWERP.md): wat vraagt om aandacht staat vooraan te
       kunnen komen. Gezakt, zonder routes, ongemeten, nooit geopend, of een
       register dat ontbreekt -- dat is het werk. */
    if (alleenAandacht) rijen = rijen.filter(d =>
      ['gezakt', 'zonder routes', 'ongemeten', 'nooit geopend', 'register ontbreekt'].includes(d.status.staat) ||
      d.schakel.stand === 'storing' || d.onbeschreven);
    if (zoek) rijen = rijen.filter(d =>
      (d.naam + ' ' + d.id + ' ' + d.doet).toLowerCase().includes(zoek));

    const perSoort = {};
    for (const s of pr.SOORTEN) {
      const eigen = reg.dingen.filter(d => d.soort === s.id);
      const telling = {};
      for (const d of eigen) telling[d.status.staat] = (telling[d.status.staat] || 0) + 1;
      perSoort[s.id] = { naam: s.naam, wat: s.wat, totaal: eigen.length, telling };
    }

    const limiet = Math.max(1, Math.min(200, Number(v.limiet) || 40));
    const nr = Math.max(1, Number(v.pagina) || 1);
    return {
      herkomst: reg.herkomst,
      routes: reg.routes,
      totaal: reg.dingen.length,
      soorten: pr.SOORTEN,
      perSoort,
      uitleg: pr.UITLEG,
      /* ROUTES DIE BIJ GEEN ENKEL DING HOREN. Hoort leeg te zijn. Is hij dat
         niet, dan is er iets in dit huis waarvan niemand kan zeggen wat het is --
         en dat is precies de vraag die dit register beantwoordt. */
      onbenoemd: reg.onbenoemd,
      filter: { zoek, soort, staat, alleenAandacht },
      lijst: { pagina: nr, limiet, totaal: rijen.length,
        paginas: Math.max(1, Math.ceil(rijen.length / limiet)),
        resultaten: rijen.slice((nr - 1) * limiet, (nr - 1) * limiet + limiet) }
    };
  }

  app.post('/api/office/platformregister', officeAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(overzicht(req.body || {}));
  });

  return { overzicht };
};
