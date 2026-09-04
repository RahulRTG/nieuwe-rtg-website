#!/usr/bin/env node
/* WAT REIKT EEN VERZOEK WERKELIJK AAN -- de runtime-meting die de statische
   graaf niet kan doen.

   AANROEPGRAAF.json herleidt 18,1% van de aanroepen in server/ naar een symbool.
   Van wat overblijft is de grootste verklaarbare post het CONTEXTOBJECT: 20.961
   aanroepen op namen die via een zak reizen die in server/opzet/ wordt
   samengesteld. Statisch is dat niet te volgen zonder de hele opbouw na te
   spelen, en dat is geen tekort van de meter maar een eigenschap van deze
   architectuur.

   Wat statisch niet kan, kan tijdens het DRAAIEN. server/opzet/contextspoor.js
   noteert in de domeingrens-Proxy welke kernnaam een verzoek ophaalt; dit script
   zet een wegwerpserver op met die stand aan, rijdt de routes een keer, en legt
   de uitslag vast in CONTEXTPROEF.json.

   WAT DIT NIET IS, en dat is de helft van zijn waarde:

   - het meet "REIKTE NAAR", niet "riep aan". `const { save } = kern` haalt een
     naam op zonder hem te gebruiken;
   - het meet alleen wat het AAN HET WERK KRIJGT. Een route die 401 of 404 geeft
     heeft niets gedaan, en dan is een lege lijst geen uitspraak over die route
     maar over deze proef. Beide standen staan apart in de uitslag;
   - het overschrijft geen enkel ander register. De idempotentieproef rijdt
     dezelfde routes maar schrijft IDEMPROEF.json; daarop meeliften zou die
     meting aan deze vastknopen.

   De wereld, de sleutels en de plausibele lijven komen uit dezelfde modules die
   de andere proeven gebruiken (lib/wegwerpserver, lib/proefsleutels,
   lib/idemwereld, lib/rolproef) -- geen tweede waarheid over hoe je hier een
   route aan het werk krijgt.

   Draaien: npm run contextproef            (alle routes)
            node scripts/contextproef.js --max=200
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'CONTEXTPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;

/* Zelfde wacht als de andere proef-instrumenten: alleen doen als iemand DIT
   bestand draait. Zonder deze regel start een volle meetronde zodra iets het
   require't, en schrijft een onschuldige laadcontrole het register over. */
if (require.main !== module) { module.exports = {}; return; }

const { start } = require('./lib/wegwerpserver');
const { haalSleutels, meldSleutels, BASISROLLEN } = require('./lib/proefsleutels');
const { alleRoutes, verdeelOpRol, rolVan } = require('./lib/routes');
const { plausibelLijf } = require('./lib/rolproef');

(async () => {
  const spoorPad = path.join(os.tmpdir(), 'rtg-contextspoor-' + process.pid + '.json');
  const server = await start({ naam: 'contextproef',
    env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF',
      RTG_CONTEXTPROEF: '1', RTG_CONTEXTPROEF_UIT: spoorPad } });
  const { basis, klaar } = server;

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data };
    } catch (e) { return { status: 0, data: String(e.message) }; }
  };

  const bos = await haalSleutels({ post });
  const { tokens, tokenVoor } = bos;
  meldSleutels(bos);
  const mist = BASISROLLEN.filter(r => !tokens[r]);
  if (mist.length) {
    console.error('geen token voor: ' + mist.join(', ') + ' -- dan meet deze proef een wereld waar niemand binnenkomt');
    klaar(); process.exit(2);
  }

  /* Dezelfde wereld als de idempotentieproef: zonder rekening, saldo en pas
     stranden duizenden routes op "deed geen werk", en een route die niets doet
     reikt ook nergens naar. */
  let geldLijven = {};
  try {
    const { zetWereldKlaar } = require('./lib/idemwereld');
    const wereld = await zetWereldKlaar({ post, tokens, datamap: server.datamap });
    geldLijven = wereld.perRoute || {};
    console.log('  wereld klaargezet                    : ' + (Object.keys(wereld.extra || {}).join(', ') || 'NIETS'));
  } catch (e) {
    console.log('  wereld NIET klaargezet               : ' + String(e.message).slice(0, 120));
  }

  const kandidaten = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET');
  const verdeling = verdeelOpRol(kandidaten, Object.keys(tokens).filter(r => tokens[r]));
  const teDoen = [...verdeling.metRol, ...verdeling.zonderRol.map(r => ({ ...r, rol: null }))];
  const lijst = MAX ? teDoen.slice(0, MAX) : teDoen;

  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes die deze ronde rijdt          : ' + lijst.length + (MAX ? '  (--max=' + MAX + ')' : ''));

  const statusVan = new Map();
  let n = 0;
  for (const r of lijst) {
    const tok = r.rol ? tokenVoor(r.rol) : null;
    const lijf = geldLijven[r.methode + ' ' + r.pad] || geldLijven[r.pad] || plausibelLijf(r.pad);
    const uit = await post(r.pad, lijf, tok);
    statusVan.set(r.methode + ' ' + r.pad, uit.status);
    if (++n % 250 === 0) console.log('    ' + n + '/' + lijst.length + ' gereden');
  }

  /* De server moet zijn spoor kunnen wegschrijven: dat gebeurt bij afsluiten. */
  klaar();
  await new Promise(r => setTimeout(r, 1500));

  let spoor = null;
  try { spoor = JSON.parse(fs.readFileSync(spoorPad, 'utf8')); } catch (e) { spoor = null; }
  if (!spoor) {
    console.error('het contextspoor is niet weggeschreven (' + spoorPad + '). Zonder spoor is er niets te melden -- ' +
      'en een lege uitslag zou hier lezen als "geen enkel verzoek reikt naar de kern".');
    process.exit(3);
  }

  /* Een verzoek dat 401/404/0 gaf heeft niets gedaan. Dat apart houden is het
     verschil tussen "deze route reikt nergens naar" en "deze proef kreeg hem
     niet aan het werk". */
  const AAN_HET_WERK = s => s > 0 && s !== 401 && s !== 403 && s !== 404 && s !== 405;
  const perVerzoek = (spoor.perVerzoek || []).filter(v => v.verzoek !== '(buiten een verzoek)');
  const buiten = (spoor.perVerzoek || []).find(v => v.verzoek === '(buiten een verzoek)');
  const metSpoor = new Set(perVerzoek.map(v => v.verzoek));

  const gereden = lijst.map(r => r.methode + ' ' + r.pad);
  const werkte = gereden.filter(k => AAN_HET_WERK(statusVan.get(k)));
  const alleNamen = new Set();
  for (const v of perVerzoek) for (const nm of v.namen) alleNamen.add(nm.naam);

  const uit = {
    /* Een MELDING over gedrag: welk verzoek reikte waarnaar. Geen index --
       hij noemt alleen wat hij aan het werk kreeg, en zegt dat er ook bij. */
    soort: 'meting',
    uitleg: 'Runtime-meting: welke naam op het contextobject een verzoek werkelijk ophaalt. Gemeten in de domeingrens-Proxy (server/opzet/contextspoor.js), het enige punt waar elke toegang langskomt. Bestaat omdat een op de zes aanroepen in dit huis statisch niet te herleiden is.',
    stempel: { op: new Date().toISOString().slice(0, 10) },
    grens: 'REIKTE NAAR, niet "riep aan": `const { save } = kern` haalt een naam op zonder hem te gebruiken. En alleen over routes die deze proef aan het werk kreeg; de rest is een uitspraak over de proef, niet over de route.',
    gemeten: {
      routesGereden: gereden.length,
      routesAanHetWerk: werkte.length,
      routesMetSpoor: gereden.filter(k => metSpoor.has(k)).length,
      routesZonderSpoorMaarWelAanHetWerk: werkte.filter(k => !metSpoor.has(k)).length,
      verzoekenMetSpoor: perVerzoek.length,
      losseNamen: alleNamen.size,
      buitenEenVerzoek: buiten ? buiten.namen.length : 0,
      volledigeRonde: !MAX
    },
    /* Wat de proef niet aan het werk kreeg, met de status erbij. Zonder deze
       lijst leest een ontbrekend spoor als een uitspraak over de route. */
    nietAanHetWerk: gereden.filter(k => !AAN_HET_WERK(statusVan.get(k)))
      .slice(0, 200).map(k => ({ route: k, status: statusVan.get(k) })),
    /* DE BEDRADING, en die is geen restpost. De eerste ronde liet zien dat
       verreweg de meeste toegang tot het contextobject NIET tijdens een verzoek
       gebeurt maar bij het ophangen van de routes: een module doet
       `const { app, auth, save } = kern` een keer, en gebruikt daarna gewone
       variabelen. Dat is een uitspraak over de architectuur en niet over deze
       proef, dus staat hij hier met naam en al -- niet als een getal. */
    bijBedrading: buiten ? buiten.namen : [],
    perVerzoek
  };

  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  const g = uit.gemeten;
  console.log('\nCONTEXTPROEF.json geschreven');
  console.log('  gereden        ', g.routesGereden, '| aan het werk:', g.routesAanHetWerk, '| met een spoor:', g.routesMetSpoor);
  console.log('  losse kernnamen', g.losseNamen, '| bij de bedrading (buiten een verzoek):', g.buitenEenVerzoek);
  if (!g.volledigeRonde) console.log('  LET OP: deelronde (--max), dus geen uitspraak over het geheel');
  try { fs.unlinkSync(spoorPad); } catch (e) { /* laat maar staan */ }
})().catch(e => { console.error(e); process.exit(1); });
